#!/usr/bin/env node
'use strict';

/**
 * Club Console · 局域网会中服务
 *
 * 零依赖：只用 Node 内置 http。作用是把"笔记本投屏 + 手机三官遥控"连起来，
 * 数据不出局域网，不依赖任何云服务。
 *
 * 用法：
 *   node server/server.js                 # http://<本机IP>:8787
 *   node server/server.js --port 9000 --open
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ops = require('../src/core/meeting-ops');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist', 'club-console.html');
const REMOTE = path.join(__dirname, 'remote.html');

function parseArgs(argv) {
  const out = { port: 8787, host: '0.0.0.0', data: path.join(ROOT, 'data', 'state.json'), open: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--port') out.port = Number(argv[++i]);
    else if (a === '--host') out.host = argv[++i];
    else if (a === '--data') out.data = path.resolve(argv[++i]);
    else if (a === '--open') out.open = true;
  }
  return out;
}

const ARGS = parseArgs(process.argv);

/* ---------------- 状态仓库 ---------------- */

let state = null;
let savedAt = 0;
let saveTimer = null;

function loadState() {
  try {
    const raw = fs.readFileSync(ARGS.data, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.meetings)) state = parsed;
  } catch (err) {
    state = null;
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(ARGS.data), { recursive: true });
      fs.writeFileSync(ARGS.data, JSON.stringify(state, null, 2), 'utf8');
      savedAt = Date.now();
    } catch (err) {
      console.error('[save] 写入失败：' + err.message);
    }
  }, 400);
}

/* ---------------- SSE ---------------- */

const clients = new Set();

function broadcast() {
  const payload = 'data: ' + JSON.stringify({ type: 'state', state, at: Date.now() }) + '\n\n';
  for (const res of clients) {
    try { res.write(payload); } catch (err) { clients.delete(res); }
  }
}

setInterval(() => {
  for (const res of clients) {
    try { res.write(': ping\n\n'); } catch (err) { clients.delete(res); }
  }
}, 25000).unref();

/* ---------------- HTTP ---------------- */

function json(res, code, body) {
  const text = JSON.stringify(body);
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(text),
  });
  res.end(text);
}

function sendFile(res, file, type) {
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('找不到文件：' + path.basename(file) + '\n先运行 npm run build');
      return;
    }
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store', 'content-length': buf.length });
    res.end(buf);
  });
}

function readBody(req, limitMb) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > (limitMb || 8) * 1024 * 1024) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve(null);
      try { resolve(JSON.parse(raw)); } catch (err) { reject(new Error('JSON 解析失败')); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const route = url.pathname;

  if (req.method === 'GET' && (route === '/' || route === '/index.html')) {
    return sendFile(res, DIST, 'text/html; charset=utf-8');
  }
  if (req.method === 'GET' && route === '/remote') {
    return sendFile(res, REMOTE, 'text/html; charset=utf-8');
  }
  if (req.method === 'GET' && route === '/health') {
    return json(res, 200, {
      ok: true,
      hasState: !!state,
      clients: clients.size,
      savedAt,
      version: require('../package.json').version,
    });
  }

  if (route === '/api/state' && req.method === 'GET') {
    return json(res, 200, { state, savedAt });
  }

  if (route === '/api/state' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      if (!body || !Array.isArray(body.meetings)) return json(res, 400, { error: 'state.meetings 必填' });
      state = body;
      state.version = 2;
      scheduleSave();
      broadcast();
      return json(res, 200, { ok: true });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (route === '/api/command' && req.method === 'POST') {
    try {
      const cmd = await readBody(req, 1);
      if (!cmd || !cmd.type) return json(res, 400, { error: 'type 必填' });
      if (!state) return json(res, 409, { error: '服务端还没有数据，请先在电脑上打开控制台' });
      const changed = ops.applyCommand(state, cmd);
      if (changed) {
        scheduleSave();
        broadcast();
      }
      return json(res, 200, { ok: true, changed });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (route === '/api/events' && req.method === 'GET') {
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    res.write('retry: 2000\n\n');
    if (state) {
      res.write('data: ' + JSON.stringify({ type: 'state', state, at: Date.now() }) + '\n\n');
    }
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return undefined;
  }

  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('404 ' + route);
});

function lanAddresses() {
  const out = [];
  const nets = os.networkInterfaces();
  Object.values(nets).forEach((list) => {
    (list || []).forEach((net) => {
      if (net.family === 'IPv4' && !net.internal) out.push(net.address);
    });
  });
  return out;
}

loadState();

server.listen(ARGS.port, ARGS.host, () => {
  const addrs = lanAddresses();
  console.log('');
  console.log('  Club Console 已启动');
  console.log('  控制台   http://localhost:' + ARGS.port + '/');
  addrs.forEach((ip) => {
    console.log('  局域网    http://' + ip + ':' + ARGS.port + '/');
    console.log('  手机遥控  http://' + ip + ':' + ARGS.port + '/remote');
  });
  console.log('  数据文件  ' + ARGS.data + (state ? '（已载入）' : '（等待电脑端推送）'));
  console.log('  按 Ctrl+C 停止');
  console.log('');
});
