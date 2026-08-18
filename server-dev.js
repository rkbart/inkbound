import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env manually
const envPath = join(__dirname, '.env');
try {
  const envFile = readFileSync(envPath, 'utf-8');
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch (e) { /* no .env file, rely on exported env vars */ }

if (!process.env.TURSO_DATABASE_URL) {
  console.error('ERROR: TURSO_DATABASE_URL not set. Create a .env file with your Turso credentials.');
  process.exit(1);
}

const PORT = 3001;

async function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
  });
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  try {
    if (path === '/api/interact' && req.method === 'POST') {
      const { interactWithDiary } = await import('./api/_lib/diary.js');
      const body = await parseBody(req);
      if (!body.content) { res.writeHead(400); res.end(JSON.stringify({ error: 'Content required' })); return; }
      const result = await interactWithDiary(body.content.trim(), body.personaName || 'Tom Riddle', body.username || 'anonymous');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } else if (path === '/api/entries' && req.method === 'GET') {
      const { dbService } = await import('./api/_lib/db.js');
      const username = url.searchParams.get('username') || 'anonymous';
      const entries = await dbService.getEntries(username);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(entries));
    } else if (path === '/api/memories' && req.method === 'GET') {
      const { dbService } = await import('./api/_lib/db.js');
      const username = url.searchParams.get('username') || 'anonymous';
      const memories = await dbService.getMemories(username);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(memories));
    } else if (path === '/api/reset' && req.method === 'POST') {
      const { dbService } = await import('./api/_lib/db.js');
      const body = await parseBody(req);
      if (body.username) {
        await dbService.clearUserData(body.username);
      } else {
        await dbService.clearAllData();
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Diary memory cleared' }));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  } catch (err) {
    console.error('API Error:', err);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`Local API server running on http://localhost:${PORT}`);
  console.log('Waiting for Vite to start on http://localhost:5173...');
});
