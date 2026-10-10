/* tmc-server-lite/server.js
 * 零依赖 HTTP 服务：为会议数据与报告生成提供 REST 接口。
 * 仅使用 Node 内置模块（http / url / path / fs）。
 *
 * 启动：node server.js [--port 8787] [--data ./data]
 *
 * 路由：
 *   GET    /api/health
 *   GET    /api/meetings
 *   GET    /api/meetings/:id
 *   POST   /api/meetings           (body = meeting.json)
 *   DELETE /api/meetings/:id
 *   POST   /api/reports/:kind      (kind ∈ timer|ah|grammarian)
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

const http = require('http');
const path = require('path');
const url = require('url');

const { createJsonStore } = require('./store/json-store.js');
const { createMeetingRoutes } = require('./routes/meetings.js');
const { createReportRoutes } = require('./routes/reports.js');

/** 解析命令行参数（--port / --data）。 */
function parseArgs(argv) {
  const out = { port: 8787, data: path.join(__dirname, 'data') };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--port' && argv[i + 1]) { out.port = parseInt(argv[i + 1], 10); i += 1; }
    else if (argv[i] === '--data' && argv[i + 1]) { out.data = argv[i + 1]; i += 1; }
  }
  if (!out.port || out.port <= 0) out.port = 8787;
  return out;
}

/** 读取并解析 JSON 请求体（上限 4MB）。 */
function readBody(req) {
  return new Promise(function (resolve, reject) {
    let size = 0;
    const chunks = [];
    req.on('data', function (c) {
      size += c.length;
      if (size > 4 * 1024 * 1024) { reject(new Error('payload_too_large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', function () {
      if (!chunks.length) { resolve(null); return; }
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (e) { reject(new Error('invalid_json')); }
    });
    req.on('error', reject);
  });
}

/** 统一 JSON 响应。 */
function sendJson(res, status, obj) {
  const payload = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(payload);
}

/**
 * 创建 HTTP 服务器实例。
 * @param {Object} [opts] { data?:string }
 * @returns {import('http').Server}
 */
function createServer(opts) {
  const o = opts || {};
  const store = createJsonStore(o.data);
  const meetingRoutes = createMeetingRoutes({ store: store });
  const reportRoutes = createReportRoutes({});

  const server = http.createServer(function (req, res) {
    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname || '/';

    // CORS 预检
    if (req.method === 'OPTIONS') { sendJson(res, 204, {}); return; }

    // 解析路径段：/api/<resource>[/<id>]
    const parts = pathname.replace(/^\/+|\/+$/g, '').split('/');
    const seg = parts[0];
    const resource = parts[1];
    const arg = parts[2];

    try {
      if (seg !== 'api') { sendJson(res, 404, { ok: false, error: 'not_found' }); return; }

      if (resource === 'health' && req.method === 'GET') {
        sendJson(res, 200, { ok: true, data: { status: 'up', ts: new Date().toISOString() } });
        return;
      }

      if (resource === 'meetings') {
        if (req.method === 'GET' && !arg) {
          const r = meetingRoutes.list(); sendJson(res, r.status, r.body); return;
        }
        if (req.method === 'GET' && arg) {
          const r = meetingRoutes.get({ id: decodeURIComponent(arg) }); sendJson(res, r.status, r.body); return;
        }
        if (req.method === 'POST') {
          readBody(req).then(function (body) {
            const r = meetingRoutes.create({}, body); sendJson(res, r.status, r.body);
          }).catch(function (e) { sendJson(res, 400, { ok: false, error: e.message }); });
          return;
        }
        if (req.method === 'DELETE' && arg) {
          const r = meetingRoutes.remove({ id: decodeURIComponent(arg) }); sendJson(res, r.status, r.body); return;
        }
      }

      if (resource === 'reports' && req.method === 'POST' && arg) {
        readBody(req).then(function (body) {
          const r = reportRoutes.generate({ kind: decodeURIComponent(arg) }, body);
          sendJson(res, r.status, r.body);
        }).catch(function (e) { sendJson(res, 400, { ok: false, error: e.message }); });
        return;
      }

      sendJson(res, 404, { ok: false, error: 'not_found' });
    } catch (e) {
      sendJson(res, 500, { ok: false, error: 'server_error', message: String(e && e.message) });
    }
  });

  // 便于测试/调用方访问
  server.store = store;
  return server;
}

module.exports = { createServer: createServer, parseArgs: parseArgs };

// 直接运行时启动监听
if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const server = createServer({ data: args.data });
  server.listen(args.port, function () {
    console.log('[tmc-server-lite] listening on http://127.0.0.1:' + args.port);
    console.log('[tmc-server-lite] data dir: ' + server.store.dir);
  });
}
