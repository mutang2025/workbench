const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3110;
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://lgc2025:***@postgresql:5432/workbench';

const pool = new Pool({ connectionString: DATABASE_URL });

// Ensure bg image directory exists (under /app/data which has correct permissions)
const BG_DIR = path.join(__dirname, 'data', 'bg');
if (!fs.existsSync(BG_DIR)) fs.mkdirSync(BG_DIR, { recursive: true });

// Auto-migrate: ensure app_config table exists
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
    console.log('[migrate] app_config table ready');
  } catch (e) {
    console.error('[migrate] error:', e.message);
  }
})();

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
  const fs = require('fs');
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    const hdrs = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    if (ext === '.html') {
      hdrs['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      hdrs['Pragma'] = 'no-cache';
      hdrs['Expires'] = '0';
    }
    res.writeHead(200, hdrs);
    res.end(data);
  });
}

async function loadData() {
  const { rows: sites } = await pool.query('SELECT id, group_name AS "group", name, url, icon, sort FROM sites ORDER BY sort ASC, id ASC');
  const { rows: todos } = await pool.query('SELECT id, text, done, created_at, completed_at FROM todos ORDER BY id ASC');
  const { rows: bookmarks } = await pool.query('SELECT name, url, icon FROM bookmark_source ORDER BY id ASC');
  const { rows: groups } = await pool.query('SELECT name FROM app_groups ORDER BY id ASC');
  const { rows: configs } = await pool.query('SELECT key, value FROM app_config');
  const cfg = {};
  for (const c of configs) {
    try { cfg[c.key] = JSON.parse(c.value); } catch { cfg[c.key] = c.value; }
  }
  return {
    sites,
    todos,
    bookmarkSource: bookmarks,
    groups: groups.map(r => r.name),
    theme: cfg.theme || 'light',
    bgConfig: cfg.bgConfig || { type: 'gradient', value: 'linear-gradient(135deg,#e0eafc,#cfdef3)' },
  };
}

async function saveData(data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Batch upsert groups — DELETE + multi-row INSERT
    await client.query('DELETE FROM app_groups');
    if (data.groups && data.groups.length) {
      const vals = data.groups.map((_, i) => `($${i + 1})`).join(',');
      await client.query(`INSERT INTO app_groups (name) VALUES ${vals}`, data.groups);
    }

    // Batch upsert sites
    await client.query('DELETE FROM sites');
    if (data.sites && data.sites.length) {
      const cols = ['id', 'group_name', 'name', 'url', 'icon', 'sort'];
      const rows = data.sites.map(s => [s.id, s.group, s.name, s.url, s.icon || '', s.sort ?? 0]);
      const vals = rows.map((_, i) => {
        const base = i * cols.length + 1;
        return `($${base},$${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5})`;
      }).join(',');
      await client.query(`INSERT INTO sites (id, group_name, name, url, icon, sort) VALUES ${vals}`, rows.flat());
    }

    // Batch upsert todos
    await client.query('DELETE FROM todos');
    if (data.todos && data.todos.length) {
      const cols = ['id', 'text', 'done', 'created_at', 'completed_at'];
      const rows = data.todos.map(t => [t.id, t.text, t.done || false, t.created_at || new Date().toISOString(), t.completed_at || null]);
      const vals = rows.map((_, i) => {
        const base = i * cols.length + 1;
        return `($${base},$${base + 1},$${base + 2},$${base + 3},$${base + 4})`;
      }).join(',');
      await client.query(`INSERT INTO todos (id, text, done, created_at, completed_at) VALUES ${vals}`, rows.flat());
    }

    // Batch upsert bookmarks
    await client.query('DELETE FROM bookmark_source');
    if (data.bookmarkSource && data.bookmarkSource.length) {
      const cols = ['name', 'url', 'icon'];
      const rows = data.bookmarkSource.map(b => [b.name, b.url, b.icon || '']);
      const vals = rows.map((_, i) => {
        const base = i * cols.length + 1;
        return `($${base},$${base + 1},$${base + 2})`;
      }).join(',');
      await client.query(`INSERT INTO bookmark_source (name, url, icon) VALUES ${vals}`, rows.flat());
    }

    // Save config (theme + bgConfig) via upsert
    if (data.theme !== undefined) {
      await client.query(
        `INSERT INTO app_config (key, value) VALUES ('theme', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [JSON.stringify(data.theme)]
      );
    }
    if (data.bgConfig !== undefined) {
      await client.query(
        `INSERT INTO app_config (key, value) VALUES ('bgConfig', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [JSON.stringify(data.bgConfig)]
      );
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // GET /api/data
  if (req.method === 'GET' && req.url === '/api/data') {
    loadData()
      .then(data => {
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        });
        res.end(JSON.stringify(data));
      })
      .catch(err => {
        console.error('GET /api/data error:', err);
        res.writeHead(500);
        res.end(JSON.stringify({ error: '读取数据失败' }));
      });
    return;
  }

  // GET /api/todos/history?from=YYYY-MM-DD&to=YYYY-MM-DD
  if (req.method === 'GET' && req.url.startsWith('/api/todos/history')) {
    const url = new URL(req.url, 'http://localhost');
    const from = url.searchParams.get('from') || '1970-01-01';
    const to = url.searchParams.get('to') || '2099-12-31';
    pool.query(
      `SELECT id, text, done, created_at, completed_at FROM todos
       WHERE done = true AND completed_at IS NOT NULL
         AND completed_at >= $1::timestamp
         AND completed_at < ($2::timestamp + INTERVAL '1 day')
       ORDER BY completed_at DESC`,
      [from, to]
    )
      .then(result => {
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        });
        res.end(JSON.stringify(result.rows));
      })
      .catch(err => {
        console.error('GET /api/todos/history error:', err);
        res.writeHead(500);
        res.end(JSON.stringify({ error: '查询历史失败' }));
      });
    return;
  }

  // DELETE /api/todos — delete one or more todos by id
  if (req.method === 'DELETE' && req.url === '/api/todos') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { ids } = JSON.parse(body);
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
          res.writeHead(400);
          return res.end(JSON.stringify({ error: 'ids 不能为空' }));
        }
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
        pool.query(`DELETE FROM todos WHERE id IN (${placeholders})`, ids)
          .then(() => {
            res.end(JSON.stringify({ ok: true }));
          })
          .catch(err => {
            console.error('DELETE /api/todos error:', err);
            res.writeHead(500);
            res.end(JSON.stringify({ error: '删除失败' }));
          });
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ error: '无效的 JSON' }));
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
        saveData(data)
          .then(() => {
            res.end(JSON.stringify({ ok: true }));
          })
          .catch(err => {
            console.error('PUT /api/data error:', err);
            res.writeHead(500);
            res.end(JSON.stringify({ error: '保存数据失败' }));
          });
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ error: '无效的 JSON' }));
      }
    });
    return;
  }

  // POST /api/bg-image — upload background image, save to disk, return URL
  if (req.method === 'POST' && req.url === '/api/bg-image') {
    const chunks = [];
    let size = 0;
    const MAX_BG = 10 * 1024 * 1024; // 10MB limit
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BG) {
        res.writeHead(413);
        res.end(JSON.stringify({ error: '图片太大，最大 10MB' }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (res.writableEnded) return;
      const ext = req.headers['content-type']?.includes('png') ? '.png' : '.jpg';
      const name = crypto.randomUUID() + ext;
      const filePath = path.join(BG_DIR, name);
      fs.writeFile(filePath, Buffer.concat(chunks), err => {
        if (err) {
          console.error('POST /api/bg-image write error:', err);
          res.writeHead(500);
          return res.end(JSON.stringify({ error: '保存图片失败' }));
        }
        res.end(JSON.stringify({ url: `/bg/${name}` }));
      });
    });
    return;
  }

  // Static files
  let filePath;
  if (req.url === '/') filePath = '/workbench.html';
  else if (req.url === '/favicon.ico') filePath = '/favicon.ico';
  else if (req.url.startsWith('/bg/')) {
    serveFile(res, path.join(BG_DIR, req.url.replace('/bg/', '')));
    return;
  } else filePath = req.url;
  // Strip leading / to prevent path.join from treating it as absolute
  filePath = path.join(__dirname, filePath.replace(/^\//, ''));

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  serveFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`工作台服务已启动: http://localhost:${PORT}`);
});
