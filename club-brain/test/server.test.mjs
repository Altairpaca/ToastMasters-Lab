/**
 * 局域网服务端集成测试：真实起进程、真实 HTTP。
 * 运行：node --test test/server.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8899 + Math.floor(Math.random() * 100);
const BASE = `http://127.0.0.1:${PORT}`;
const dataFile = path.join(os.tmpdir(), `cc-state-${Date.now()}.json`);

let child;

const fixture = {
  version: 2,
  club: { name: '测试俱乐部', city: '广州' },
  activeMeetingId: 'm1',
  counterWords: ['嗯', '那个'],
  members: [{ id: 'a', name: '甲', capacity: 3, skills: {}, history: {}, unavailable: [] }],
  meetings: [{
    id: 'm1',
    meetingNo: 1,
    date: '2026-11-05',
    start: '19:30',
    end: '21:30',
    status: 'locked',
    segments: [
      { id: 's1', name: '开场', kind: 'opening', minutes: 5, owner: '甲', ownerStatus: 'confirmed' },
      { id: 's2', name: '即兴', kind: 'tabletopics', minutes: 15, owner: '甲', ownerStatus: 'confirmed' },
    ],
    speeches: [],
    notes: [],
    records: { timing: [], ah: {}, grammar: { good: [], issues: [] } },
    retro: null,
    live: null,
  }],
  dcp: { period: {}, awards: {}, newMembers: 0, officersTrained: {}, duesOnTime: true, history: [] },
};

async function waitHealthy(timeoutMs = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(BASE + '/health');
      if (res.ok) return await res.json();
    } catch (err) { /* 还没起来 */ }
    await new Promise((r) => setTimeout(r, 120));
  }
  throw new Error('服务端未在预期时间内启动');
}

test.before(async () => {
  child = spawn(process.execPath, [path.join(root, 'server', 'server.js'), '--port', String(PORT), '--data', dataFile], {
    cwd: root,
    stdio: 'ignore',
  });
  await waitHealthy();
});

test.after(() => {
  if (child) child.kill();
  try { fs.unlinkSync(dataFile); } catch (err) { /* ignore */ }
});

test('健康检查返回版本与状态', async () => {
  const res = await fetch(BASE + '/health');
  const body = await res.json();
  assert.strictEqual(body.ok, true);
  assert.ok(body.version);
});

test('空库时 GET /api/state 返回 null', async () => {
  const body = await (await fetch(BASE + '/api/state')).json();
  assert.strictEqual(body.state, null);
});

test('推送状态后应能读回', async () => {
  const post = await fetch(BASE + '/api/state', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(fixture),
  });
  assert.strictEqual(post.status, 200);
  const body = await (await fetch(BASE + '/api/state')).json();
  assert.strictEqual(body.state.meetings.length, 1);
  assert.strictEqual(body.state.club.name, '测试俱乐部');
});

test('命令：开始计时写入 runningSince', async () => {
  const res = await (await fetch(BASE + '/api/command', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'live.start', meetingId: 'm1' }),
  })).json();
  assert.strictEqual(res.changed, true);
  const { state } = await (await fetch(BASE + '/api/state')).json();
  assert.ok(state.meetings[0].live.runningSince > 0);
  assert.strictEqual(state.meetings[0].status, 'live');
});

test('命令：哼哈 +1 并广播到状态', async () => {
  await fetch(BASE + '/api/command', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'ah.add', meetingId: 'm1', person: '甲', word: '嗯' }),
  });
  const { state } = await (await fetch(BASE + '/api/state')).json();
  assert.strictEqual(state.meetings[0].records.ah['甲']['嗯'], 1);
});

test('命令：无效类型不改变状态', async () => {
  const res = await (await fetch(BASE + '/api/command', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'nope', meetingId: 'm1' }),
  })).json();
  assert.strictEqual(res.changed, false);
});

test('SSE：连上应立即收到当前状态', async () => {
  const controller = new AbortController();
  const res = await fetch(BASE + '/api/events', { signal: controller.signal });
  assert.strictEqual(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /event-stream/);
  const reader = res.body.getReader();
  const { value } = await reader.read();
  const text = new TextDecoder().decode(value);
  assert.match(text, /"type":"state"/);
  controller.abort();
});

test('手机遥控页可访问', async () => {
  const res = await fetch(BASE + '/remote');
  const html = await res.text();
  assert.strictEqual(res.status, 200);
  assert.match(html, /三官遥控|哼哈官/);
});

test('控制台首页返回构建产物', async () => {
  const res = await fetch(BASE + '/');
  const html = await res.text();
  assert.strictEqual(res.status, 200);
  assert.match(html, /Club Console/);
  assert.ok(html.length > 50000);
});

test('数据落盘后可被重新载入', async () => {
  await new Promise((r) => setTimeout(r, 700));
  assert.ok(fs.existsSync(dataFile), '状态文件应已写入');
  const saved = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  assert.strictEqual(saved.meetings[0].id, 'm1');
});
