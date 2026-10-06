// Tiny static server for previewing docs/ locally: `npm run serve` then open http://localhost:8766/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/data.mjs';

const dir = path.join(ROOT, 'docs');
const port = Number(process.env.PORT || 8766);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.md': 'text/markdown' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(dir, p);
  if (!file.startsWith(dir)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(port, () => console.log(`Dashboard at http://localhost:${port}/`));
