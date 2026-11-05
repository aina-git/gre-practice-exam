import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

export const MODEL = 'gpt-6.1-terra';
export const REASONING_EFFORT = 'high';
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const API_URL = 'https://api.openai.com/v1/responses';
const OUTPUT_BUDGET = 25000; // Includes reasoning and visible output.

export function responseText(data) {
  if (data.error) throw new Error(data.error.message || 'OpenAI could not complete the request.');
  if (data.status !== 'completed') {
    throw new Error(data.status === 'incomplete'
      ? 'OpenAI stopped before finishing (' + (data.incomplete_details?.reason || 'incomplete response') + '). Please try again.'
      : 'OpenAI returned an unfinished response.');
  }
  const content = (data.output || []).filter(item => item.type === 'message').flatMap(item => item.content || []);
  if (content.some(item => item.type === 'refusal')) throw new Error('OpenAI declined this request.');
  const text = content.filter(item => item.type === 'output_text').map(item => item.text || '').join('\n').trim();
  if (!text) throw new Error('OpenAI returned no answer text.');
  return text;
}

function validMessages(messages) {
  if (!Array.isArray(messages) || !messages.length || messages.length > 100) return false;
  let size = 0;
  return messages.every(message => {
    if (!message || !['system', 'developer', 'user', 'assistant'].includes(message.role) || typeof message.content !== 'string' || !message.content.trim()) return false;
    size += message.content.length;
    return size <= 120000;
  });
}

async function readJSON(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 200000) throw Object.assign(new Error('Request is too large.'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Send a valid JSON object.'), { status: 400 }); }
}

// A local-only personal gateway. It deliberately has no LAN/public deployment mode.
export function createGREServer({ apiKey = process.env.OPENAI_API_KEY || '', fetchImpl = fetch, upstreamTimeoutMs = 240000 } = {}) {
  let key = apiKey.trim();
  let active = 0;
  const status = () => ({ model: MODEL, reasoningEffort: REASONING_EFFORT, configured: !!key });
  const server = http.createServer(async (req, res) => {
    const send = (code, body) => {
      res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(body));
    };
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    const port = req.socket.localPort;
    const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    const origins = hosts.map(host => 'http://' + host);
    if (!hosts.includes(req.headers.host) || (req.headers.origin && !origins.includes(req.headers.origin))) {
      send(403, { error: 'This server accepts requests only from its local GRE Ready page.' });
      return;
    }
    try {
      let route;
      try { route = new URL(req.url, origins[0]).pathname; }
      catch { send(400, { error: 'Invalid request URL.' }); return; }
      if (req.method === 'GET' && (route === '/' || route === '/index.html')) {
        const html = await readFile(path.join(ROOT, 'index.html'), 'utf8');
        const boot = '<script>window.GRE_OPENAI_SERVER=' + JSON.stringify(status()) + ';</script>';
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html.replace('<script>', boot + '\n<script>'));
        return;
      }
      if (req.method === 'GET' && route === '/api/status') { send(200, status()); return; }
      if (req.method !== 'POST' || !['/api/configure', '/api/ai'].includes(route)) { send(404, { error: 'Not found.' }); return; }
      if (!origins.includes(req.headers.origin) || req.headers['content-type']?.split(';')[0] !== 'application/json') {
        send(403, { error: 'Use the local GRE Ready page to configure or call this service.' });
        return;
      }
      const input = await readJSON(req);
      if (!input || typeof input !== 'object' || Array.isArray(input)) { send(400, { error: 'Send a JSON object.' }); return; }
      if (route === '/api/configure') {
        if (typeof input.apiKey !== 'string' || input.apiKey.trim().length < 10 || input.apiKey.length > 512 || /\s/.test(input.apiKey.trim())) {
          send(400, { error: 'Enter a valid OpenAI API key.' }); return;
        }
        key = input.apiKey.trim(); // Memory only: never written to disk or sent back to the page.
        send(200, status()); return;
      }
      if (!key) { send(503, { error: 'Add your OpenAI API key in Settings. The local server keeps it in memory.' }); return; }
      if (!validMessages(input.messages) || (input.json !== undefined && typeof input.json !== 'boolean')) {
        send(400, { error: 'Provide valid text messages and an optional JSON flag.' }); return;
      }
      if (active >= 4) { send(429, { error: 'Four AI requests are already running. Wait for one to finish.' }); return; }
      active++;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), upstreamTimeoutMs);
      const abort = () => { if (!res.writableEnded) ctrl.abort(); };
      res.once('close', abort);
      // Capture the key for this request so rotating it doesn't alter error redaction.
      const requestKey = key;
      try {
        const body = {
          model: MODEL, reasoning: { effort: REASONING_EFFORT }, input: input.messages,
          max_output_tokens: OUTPUT_BUDGET, store: false,
          ...(input.json ? { text: { format: { type: 'json_object' } } } : {})
        };
        const upstream = await fetchImpl(API_URL, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + requestKey },
          body: JSON.stringify(body), signal: ctrl.signal
        });
        const data = await upstream.json();
        if (!upstream.ok) throw Object.assign(new Error(data.error?.message || 'OpenAI request failed.'), { status: upstream.status });
        const text = responseText(data);
        send(200, { text, model: data.model || MODEL, reasoningEffort: REASONING_EFFORT });
      } catch (error) {
        const message = ctrl.signal.aborted ? 'OpenAI took too long to respond. Please try again.' : String(error.message).split(requestKey).join('[redacted]').slice(0,400);
        if (!res.destroyed) send(ctrl.signal.aborted ? 504 : (error.status >= 400 && error.status < 500 ? error.status : 502), { error: message });
      } finally {
        active--;
        clearTimeout(timer);
        res.off('close', abort);
      }
    } catch (error) {
      if (!res.destroyed) send(error.status || 500, { error: error.status ? error.message : 'The local server could not complete this request.' });
    }
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const port = Number(process.env.GRE_PORT || 8787);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('GRE_PORT must be a port from 1024 to 65535.');
  const server = createGREServer();
  server.on('error', error => { console.error('GRE Ready server:', error.code === 'EADDRINUSE' ? 'Port is already in use. Stop the other instance or choose GRE_PORT.' : error.message); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => {
    console.log(`GRE Ready: http://127.0.0.1:${port}`);
    console.log(`AI: ${MODEL}, reasoning ${REASONING_EFFORT}. Add your API key in Settings if needed. Keys entered there stay only in server memory.`);
  });
}
