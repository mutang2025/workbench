const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3110;
const DATA_FILE = path.join(__dirname, 'data', 'data.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
};

function serveFile(res, filePath) {
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    const hdrs = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    // Prevent caching of HTML to ensure latest code
    if (ext === '.html') {
      hdrs['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      hdrs['Pragma'] = 'no-cache';
      hdrs['Expires'] = '0';
    }
    res.writeHead(200, hdrs);
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // GET /api/data
  if (req.method === 'GET' && req.url === '/api/data') {
    fs.readFile(DATA_FILE, 'utf-8', (err, raw) => {
      const hdrs = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache, no-store, must-revalidate' };
      if (err) {
        res.writeHead(200, hdrs);
        return res.end(JSON.stringify({}));
      }
      try {
        res.writeHead(200, hdrs);
        res.end(raw);
      } catch {
        res.end(JSON.stringify({}));
      }
    });
    return;
  }

  // PUT /api/data
  if (req.method === 'PUT' && req.url === '/api/data') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8', (err) => {
          if (err) {
            res.writeHead(500);
            return res.end(JSON.stringify({ error: '写入失败' }));
          }
          res.end(JSON.stringify({ ok: true }));
        });
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ error: '无效的 JSON' }));
      }
    });
    return;
  }

  // Static files — default to workbench.html
  let filePath = req.url === '/' ? '/workbench.html' : req.url;
  filePath = path.join(__dirname, filePath);

  // Security: prevent escaping the directory
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  serveFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`工作台服务已启动: http://localhost:${PORT}`);
});
