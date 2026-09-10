import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

async function loadEnv() {
  try {
    const source = await readFile(join(root, '.env'), 'utf8');
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

await loadEnv();

const port = Number(process.env.PORT || 4173);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.mp4': 'video/mp4' };
const RECOMMENDATION_LIMIT = 15;
const PLAN_LIMIT = 3;
const AI_CATALOG_LIMIT = 150;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-3.5-flash-lite';
const USE_ONHUDDLE = /^(1|true|yes|on)$/i.test(process.env.USE_ONHUDDLE || '');
const recommendationCache = new Map();

function json(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(value));
}

async function body(req) {
  let value = '';
  for await (const chunk of req) {
    value += chunk;
    if (value.length > 100_000) throw new Error('Request too large');
  }
  return JSON.parse(value || '{}');
}

async function onHuddleEvents(location) {
  const all = [];
  let total = 0;
  for (let page = 1; page <= 25; page += 1) {
    const params = new URLSearchParams({ page: String(page), page_size: '100', city: location });
    const response = await fetch(`https://api.onhuddle.co/api/web/v1/events?${params}`, {
      headers: { accept: 'application/json', origin: 'https://onhuddle.co' }
    });
    if (!response.ok) throw new Error(`OnHuddle request failed (${response.status})`);
    const data = await response.json();
    total = Number(data.total || 0);
    all.push(...(Array.isArray(data.items) ? data.items : []));
    if (!data.items?.length || all.length >= total) break;
  }
  return { events: all, total };
}

async function onHuddleCities() {
  const response = await fetch('https://api.onhuddle.co/api/web/v1/locations/cities?lang=en', {
    headers: { accept: 'application/json', origin: 'https://onhuddle.co' }
  });
  if (!response.ok) throw new Error(`OnHuddle cities request failed (${response.status})`);
  const cities = await response.json();
  return (Array.isArray(cities) ? cities : [])
    .filter((city) => city.display_name && city.event_count > 0)
    .sort((a, b) => b.event_count - a.event_count);
}

function normalizeHuddleImage(value) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  const path = String(value).replace(/^\/app\/output\//, '/').replace(/^\/output\//, '/');
  return `https://cdn.onhuddle.co${path.startsWith('/') ? path : `/${path}`}`;
}

function balancedCandidates(events, limit) {
  const groups = new Map();
  for (const event of events) {
    const category = event.category || 'Other';
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(event);
  }
  const candidates = [];
  while (candidates.length < limit && groups.size) {
    for (const [category, group] of groups) {
      const event = group.shift();
      if (event) candidates.push(event);
      if (!group.length) groups.delete(category);
      if (candidates.length >= limit) break;
    }
  }
  return candidates;
}

async function tavilySearch(location) {
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!tavilyKey) throw new Error('TAVILY_API_KEY is not configured in .env');
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { authorization: `Bearer ${tavilyKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      query: `Find real, current events and bookable activities in ${location} taking place now or in the coming weeks. Search trustworthy organizer, venue, ticketing, cultural institution, and local event directory pages. Return direct source URLs plus titles, dates, times, venues, categories, prices, descriptions, and image URLs when available.`,
      search_depth: 'advanced',
      max_results: 20,
      include_raw_content: false
    })
  });
  if (!response.ok) throw new Error(`Tavily request failed (${response.status})`);
  const data = await response.json();
  return data.results || [];
}

async function recommendations(location, preferences = {}) {
  const preferenceSummary = Object.fromEntries(
    ['focus', 'movement', 'novelty', 'connection'].map((key) => {
      const value = preferences[key] || {};
      return [key, {
        want: Math.max(0, Math.min(100, Number(value.want) || 50)),
        capacity: Math.max(0, Math.min(100, Number(value.capacity) || 50))
      }];
    })
  );
  const cacheKey = `${location.toLowerCase()}:${JSON.stringify(preferenceSummary)}`;
  const cached = recommendationCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < 5 * 60_000) return { ...cached.value, cached: true };
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) throw new Error('OPENROUTER_API_KEY is not configured in .env');

  const [catalog, search] = await Promise.all([
    USE_ONHUDDLE
      ? onHuddleEvents(location).catch((error) => {
          console.warn(`Optional OnHuddle source unavailable: ${error.message}`);
          return { events: [], total: 0 };
        })
      : Promise.resolve({ events: [], total: 0 }),
    tavilySearch(location)
  ]);
  if (!catalog.events.length && !search.length) throw new Error('No live event sources returned results');

  const candidates = balancedCandidates(catalog.events, AI_CATALOG_LIMIT);
  const huddleContext = candidates.map((event) => ({
    title: event.name,
    sourceUrl: `https://onhuddle.co/event/${event.slug}`,
    category: event.category,
    venue: event.location_summary?.venue,
    start: event.earliest_schedule_date,
    end: event.latest_schedule_date,
    free: event.is_free,
    minPrice: event.min_price,
    maxPrice: event.max_price,
    summary: String(event.summary || '').slice(0, 400),
    tags: (event.tags || []).slice(0, 8),
    image: normalizeHuddleImage(event.main_image || event.image_url)
  }));
  const tavilyContext = search.map((result) => ({
    title: result.title,
    sourceUrl: result.url,
    content: String(result.content || '').slice(0, 1200)
  }));
  const prompt = `Today is ${new Date().toISOString().slice(0, 10)}. Create exactly ${PLAN_LIMIT} distinct possible free-time plans in ${location} from the real source material below. Tavily web search is the primary discovery source. Optional OnHuddle API candidates may also be supplied. Each plan must have a clear personality and 2-3 compatible activities; make the plans meaningfully different, not merely reordered copies. Use the user's want/capacity signals to vary intensity while still offering choice: ${JSON.stringify(preferenceSummary)}. Return ONLY JSON as {"plans":[{"title":"","theme":"","summary":"","score":90,"events":[{"title":"","time":"","place":"","cost":"","category":"","tags":[""],"desc":"","score":90,"sourceUrl":"","img":""}]}]}. Scores must be 1-99. Exclude events that have already ended. Every event must be supported by one supplied result. Copy its sourceUrl exactly, copy an image URL exactly when one is supplied, and otherwise use an empty img. Never invent an event or factual detail. Avoid reusing an activity across plans when enough candidates exist, and never repeat an activity inside a plan. Tavily results: ${JSON.stringify(tavilyContext)}. Optional OnHuddle candidates (${huddleContext.length} selected from ${catalog.events.length} of reported total ${catalog.total}): ${JSON.stringify(huddleContext)}`;
  let messages = [{ role: 'user', content: prompt }];
  let parsed;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${openRouterKey}`, 'content-type': 'application/json', 'x-title': 'DayShape' },
      body: JSON.stringify({ model: OPENROUTER_MODEL, temperature: 0.2, messages, response_format: { type: 'json_object' } })
    });
    if (!aiResponse.ok) throw new Error(`OpenRouter request failed (${aiResponse.status})`);
    const ai = await aiResponse.json();
    const content = String(ai.choices?.[0]?.message?.content || '');
    try {
      const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      const candidate = JSON.parse(cleaned || '{}');
      if (!Array.isArray(candidate.plans)) throw new Error('Missing plans array');
      parsed = candidate;
      break;
    } catch {
      if (attempt === 0) {
        messages = [
          ...messages,
          { role: 'assistant', content },
          { role: 'user', content: 'That response was not valid JSON in the requested shape. Return the same plans again as one strictly valid JSON object. Quote every string and include no Markdown or commentary.' }
        ];
      }
    }
  }
  if (!parsed) throw new Error('OpenRouter returned invalid plan JSON after one retry');
  const normalizeUrl = (value) => {
    try {
      const url = new URL(String(value));
      url.hash = '';
      return url.toString().replace(/\/$/, '');
    } catch {
      return '';
    }
  };
  const sources = [
    ...search.map((result) => ({ type: 'tavily', title: result.title, sourceUrl: result.url })),
    ...candidates.map((event) => ({ type: 'onhuddle', title: event.name, sourceUrl: `https://onhuddle.co/event/${event.slug}`, event }))
  ];
  const byUrl = new Map(sources.map((source) => [normalizeUrl(source.sourceUrl), source]).filter(([url]) => url));
  const byTitle = new Map(sources.map((source) => [String(source.title).trim().toLowerCase(), source]).filter(([title]) => title));
  const validateEvent = (event) => {
    const source = byUrl.get(normalizeUrl(event.sourceUrl)) || byTitle.get(String(event.title || '').trim().toLowerCase());
    if (!source) return null;
    if (source.type === 'tavily') {
      return {
        ...event,
        sourceUrl: source.sourceUrl,
        img: ''
      };
    }
    const huddleEvent = source.event;
    return {
      ...event,
      title: huddleEvent.name,
      category: huddleEvent.category || event.category || 'Other',
      sourceUrl: source.sourceUrl,
      img: normalizeHuddleImage(huddleEvent.main_image || huddleEvent.image_url)
    };
  };
  const plans = (Array.isArray(parsed.plans) ? parsed.plans : []).slice(0, PLAN_LIMIT).flatMap((plan, index) => {
    const seen = new Set();
    const events = (Array.isArray(plan.events) ? plan.events : []).slice(0, 3).flatMap((event) => {
      const validated = validateEvent(event);
      if (!validated || seen.has(validated.sourceUrl)) return [];
      seen.add(validated.sourceUrl);
      return [validated];
    });
    if (!events.length) return [];
    return [{
      id: `plan-${index + 1}`,
      title: String(plan.title || `Plan ${index + 1}`).slice(0, 80),
      theme: String(plan.theme || 'Balanced').slice(0, 40),
      summary: String(plan.summary || '').slice(0, 240),
      score: Math.max(1, Math.min(99, Number(plan.score) || 80)),
      events
    }];
  });
  const selected = plans.flatMap((plan) => plan.events).slice(0, RECOMMENDATION_LIMIT);
  const value = { plans, events: selected, source: USE_ONHUDDLE && catalog.events.length ? 'tavily+onhuddle' : 'tavily', sourceCount: catalog.events.length, sourceTotal: catalog.total, aiCandidateCount: huddleContext.length, tavilyResults: search.length };
  recommendationCache.set(cacheKey, { createdAt: Date.now(), value });
  return value;
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/api/status') {
      return json(res, 200, { configured: Boolean(process.env.TAVILY_API_KEY && process.env.OPENROUTER_API_KEY), onHuddleEnabled: USE_ONHUDDLE, openRouterModel: OPENROUTER_MODEL });
    }
    if (req.method === 'GET' && req.url === '/api/cities') {
      if (!USE_ONHUDDLE) return json(res, 200, { cities: [] });
      return json(res, 200, { cities: await onHuddleCities().catch(() => []) });
    }
    if (req.method === 'POST' && req.url === '/api/recommendations') {
      const data = await body(req);
      const location = String(data.location || '').trim().slice(0, 100);
      if (!location) return json(res, 400, { error: 'Choose a location first.' });
      return json(res, 200, await recommendations(location, data.preferences));
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed' });
    const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
    const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const safe = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, '');
    const file = join(root, safe);
    if (!file.startsWith(root)) return json(res, 403, { error: 'Forbidden' });
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
    if (req.method === 'HEAD') return res.end();
    res.end(data);
  } catch (error) {
    if (error.code === 'ENOENT') return json(res, 404, { error: 'Not found' });
    console.error(error.message);
    json(res, 502, { error: error.message });
  }
});

server.listen(port, '0.0.0.0', () => console.log(`DayShape running at http://localhost:${port}`));
