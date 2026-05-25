import http from 'node:http';
import { upsert, dismiss, flush } from '../src/lib/job-history.mjs';

const PORT = process.env.JOBOPS_HISTORY_PORT || 3001;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const server = http.createServer((req, res) => {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/dismiss') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { job_id, title, company, url, score, reason } = JSON.parse(body);
        if (!job_id) { res.writeHead(400); res.end('job_id required'); return; }
        upsert({ job_id, title, company, url, score });
        dismiss(job_id, reason);
        flush();
        console.error(`[history] dismissed: "${title}" — ${reason || '(sin razón)'}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400);
        res.end(e.message);
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.error(`[history-server] http://localhost:${PORT} — esperando descartes del dashboard`);
});
