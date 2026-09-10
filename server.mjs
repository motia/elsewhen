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

async function recommendations(location) {
  const tavilyKey = process.env.TAVILY_API_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!tavilyKey || !openRouterKey) throw new Error('API keys are not configured in .env');

  const searchResponse = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { authorization: `Bearer ${tavilyKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query: `real events and evening activities in ${location} with concrete dates, times and venues`, search_depth: 'basic', max_results: 8 })
  });
  if (!searchResponse.ok) throw new Error(`Tavily request failed (${searchResponse.status})`);
  const search = await searchResponse.json();

  const prompt = `Select up to 3 real activities in ${location}. Return ONLY JSON as {"events":[{"title":"","time":"","place":"","cost":"","tags":[""],"desc":"","score":90,"sourceUrl":""}]}. Scores must be 1-99. Prefer gentle social connection, movement, and novelty that can fit an evening. Search context: ${JSON.stringify((search.results || []).slice(0, 8))}`;
  const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${openRouterKey}`, 'content-type': 'application/json', 'x-title': 'DayShape' },
    body: JSON.stringify({ model: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' } })
  });
  if (!aiResponse.ok) throw new Error(`OpenRouter request failed (${aiResponse.status})`);
  const ai = await aiResponse.json();
  const content = ai.choices?.[0]?.message?.content;
  const parsed = JSON.parse(content || '{}');
  return Array.isArray(parsed.events) ? parsed.events.slice(0, 3) : [];
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/api/status') {
      return json(res, 200, { configured: Boolean(process.env.TAVILY_API_KEY && process.env.OPENROUTER_API_KEY) });
    }
    if (req.method === 'POST' && req.url === '/api/recommendations') {
      const data = await body(req);
      const location = String(data.location || '').trim().slice(0, 100);
      if (!location) return json(res, 400, { error: 'Choose a location first.' });
      return json(res, 200, { events: await recommendations(location) });
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
