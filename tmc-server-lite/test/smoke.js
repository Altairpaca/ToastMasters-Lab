/* tmc-server-lite/test/smoke.js
 * 冒烟测试：在内存端口上启动服务，验证核心路由；零依赖。
 * 运行：node test/smoke.js
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');
const http = require('http');

const { createServer, parseArgs } = require('../server.js');

let passed = 0;
let failed = 0;

function check(name, cond) {
  if (cond) { passed += 1; console.log('  ok   ' + name); }
  else { failed += 1; console.log('  FAIL ' + name); }
}

/** 发起 HTTP 请求，返回 { status, body }。 */
function request(port, method, p, payload) {
  return new Promise(function (resolve, reject) {
    const data = payload ? JSON.stringify(payload) : null;
    const req = http.request({
      host: '127.0.0.1', port: port, method: method, path: p,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
    }, function (res) {
      const chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        const text = Buffer.concat(chunks).toString('utf8');
        let body = null;
        try { body = text ? JSON.parse(text) : null; } catch (e) { body = text; }
        resolve({ status: res.statusCode, body: body });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async function main() {
  // parseArgs 单测
  check('parseArgs 默认端口', parseArgs([]).port === 8787);
  check('parseArgs --port', parseArgs(['--port', '9001']).port === 9001);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tmc-srv-'));
  const server = createServer({ data: tmp });

  await new Promise(function (resolve) { server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;

  let r = await request(port, 'GET', '/api/health');
  check('GET /api/health → 200', r.status === 200 && r.body && r.body.data.status === 'up');

  r = await request(port, 'GET', '/api/meetings');
  check('GET /api/meetings 空列表', r.status === 200 && Array.isArray(r.body.data) && r.body.data.length === 0);

  r = await request(port, 'POST', '/api/meetings', { meeting_id: '2026-10-08_第335次', theme: { zh: '例会' } });
  check('POST /api/meetings 新增', r.status === 200 && r.body.data.meeting_id === '2026-10-08_第335次');

  const mid = encodeURIComponent('2026-10-08_第335次');
  r = await request(port, 'GET', '/api/meetings/' + mid);
  check('GET /api/meetings/:id 读取', r.status === 200 && r.body.data.theme.zh === '例会');

  r = await request(port, 'GET', '/api/meetings');
  check('GET /api/meetings 非空', r.status === 200 && r.body.data.length === 1);

  r = await request(port, 'POST', '/api/meetings', { theme: {} });
  check('POST /api/meetings 缺 meeting_id → 400', r.status === 400);

  r = await request(port, 'POST', '/api/reports/timer', {
    timerRecords: [{ segment_id: 'prep1', planned_min: 5, time: 330, status: 'ok' }],
    meta: { meetingName: '例会' },
  });
  check('POST /api/reports/timer', r.status === 200 && r.body.data && Array.isArray(r.body.data.rows));

  r = await request(port, 'POST', '/api/reports/unknown', {});
  check('POST /api/reports/unknown → 400', r.status === 400);

  r = await request(port, 'DELETE', '/api/meetings/' + mid);
  check('DELETE /api/meetings/:id', r.status === 200 && r.body.data.removed === '2026-10-08_第335次');

  r = await request(port, 'GET', '/api/meetings/' + mid);
  check('GET 删除后 → 404', r.status === 404);

  r = await request(port, 'GET', '/nope');
  check('未知路径 → 404', r.status === 404);

  await new Promise(function (resolve) { server.close(resolve); });
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* ignore */ }

  console.log('\ntmc-server-lite smoke: ' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed === 0 ? 0 : 1);
})();
