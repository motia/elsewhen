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
const AI_CATALOG_LIMIT = 150;
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
  if (!tavilyKey) return [];
  const filteredUrl = `https://onhuddle.co/events?city=${encodeURIComponent(location)}`;
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { authorization: `Bearer ${tavilyKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      query: `Find current events in ${location} on OnHuddle. Use this filtered event directory as the primary source: ${filteredUrl}. Return event detail pages, titles, dates, times, venues, categories, prices, and image URLs.`,
      include_domains: ['onhuddle.co'],
      search_depth: 'advanced',
      max_results: 20,
      include_raw_content: false
    })
  });
  if (!response.ok) throw new Error(`Tavily request failed (${response.status})`);
  const data = await response.json();
  return data.results || [];
}

async function recommendations(location) {
  const cacheKey = location.toLowerCase();
  const cached = recommendationCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < 5 * 60_000) return { ...cached.value, cached: true };
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) throw new Error('OPENROUTER_API_KEY is not configured in .env');

  const [catalog, search] = await Promise.all([
    onHuddleEvents(location),
    tavilySearch(location).catch(() => [])
  ]);
  if (!catalog.events.length && !search.length) throw new Error('No live event sources returned results');

  const candidates = balancedCandidates(catalog.events, AI_CATALOG_LIMIT);
  const huddleContext = candidates.map((event) => ({
    title: event.name,
    slug: event.slug,
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
  const tavilyContext = search.map((result) => ({ title: result.title, url: result.url, content: String(result.content || '').slice(0, 1000) }));
  const prompt = `Select up to ${RECOMMENDATION_LIMIT} diverse real activities in ${location} from the OnHuddle candidates below. Return ONLY JSON as {"events":[{"title":"","time":"","place":"","cost":"","category":"","tags":[""],"desc":"","score":90,"sourceUrl":"","img":""}]}. Scores must be 1-99. Prefer gentle social connection, movement, and novelty that can fit an evening, but include variety across categories. Copy each slug and image exactly: sourceUrl must be https://onhuddle.co/event/{slug}, and img must be the provided image URL or empty. Do not invent events or details. The complete OnHuddle source contained ${catalog.events.length} of reported total ${catalog.total}; ${huddleContext.length} category-balanced candidates were supplied to keep this AI request bounded. Candidates: ${JSON.stringify(huddleContext)}. Tavily OnHuddle results for extra detail: ${JSON.stringify(tavilyContext)}`;
  const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${openRouterKey}`, 'content-type': 'application/json', 'x-title': 'DayShape' },
    body: JSON.stringify({ model: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' } })
  });
  if (!aiResponse.ok) throw new Error(`OpenRouter request failed (${aiResponse.status})`);
  const ai = await aiResponse.json();
  const content = ai.choices?.[0]?.message?.content;
  const parsed = JSON.parse(content || '{}');
  const bySlug = new Map(candidates.map((event) => [event.slug, event]));
  const byTitle = new Map(candidates.map((event) => [String(event.name).trim().toLowerCase(), event]));
  const selected = (Array.isArray(parsed.events) ? parsed.events : []).slice(0, RECOMMENDATION_LIMIT).flatMap((event) => {
    const slug = String(event.sourceUrl || '').split('/event/')[1]?.split(/[?#]/)[0];
    const source = bySlug.get(slug) || byTitle.get(String(event.title || '').trim().toLowerCase());
    if (!source) return [];
    return [{
      ...event,
      title: source.name,
      category: source.category || event.category || 'Other',
      sourceUrl: `https://onhuddle.co/event/${source.slug}`,
      img: normalizeHuddleImage(source.main_image || source.image_url)
    }];
  });
  const value = { events: selected, source: 'onhuddle', sourceCount: catalog.events.length, sourceTotal: catalog.total, aiCandidateCount: huddleContext.length, tavilyResults: search.length };
  recommendationCache.set(cacheKey, { createdAt: Date.now(), value });
  return value;
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/api/status') {
      return json(res, 200, { configured: Boolean(process.env.TAVILY_API_KEY && process.env.OPENROUTER_API_KEY) });
    }
    if (req.method === 'GET' && req.url === '/api/cities') {
      return json(res, 200, { cities: await onHuddleCities() });
    }
    if (req.method === 'POST' && req.url === '/api/recommendations') {
      const data = await body(req);
      const location = String(data.location || '').trim().slice(0, 100);
      if (!location) return json(res, 400, { error: 'Choose a location first.' });
      return json(res, 200, await recommendations(location));
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
