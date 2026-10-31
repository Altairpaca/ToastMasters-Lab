/**
 * 单文件应用的端到端冒烟测试（真实 DOM，jsdom）
 * 运行：node test/smoke.mjs
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JSDOM_PATH = process.env.JSDOM_PATH || 'F:/Programs/俱乐部/_tools/domtest/node_modules/jsdom';
const { JSDOM, VirtualConsole } = require(JSDOM_PATH);

const file = path.join(root, 'dist', 'club-console.html');
if (!fs.existsSync(file)) {
  console.error('缺少产物，先运行 node build/build.js');
  process.exit(1);
}
const html = fs.readFileSync(file, 'utf8');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push(e.message + (e.detail ? '\n' + e.detail : '')));
vc.on('error', (m) => errors.push(String(m)));

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'http://localhost/',
  virtualConsole: vc,
});

const { window } = dom;
const doc = window.document;

function assert(cond, msg) {
  if (!cond) {
    console.error('✗ ' + msg);
    process.exitCode = 1;
  } else {
    console.log('✓ ' + msg);
  }
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

await wait(120);

assert(!!window.CC, 'CC 命名空间已挂载');
assert(!!window.CC.core && typeof window.CC.core.lintAgenda === 'function', '内核已注入 CC.core');
assert(!!window.CC.state && !!window.CC.app, '状态与路由已初始化');

const tabs = doc.querySelectorAll('.tab');
assert(tabs.length === 6, '顶部有 6 个视图标签，实际 ' + tabs.length);

const view = doc.getElementById('view');
assert(view.childElementCount > 0, '总览已渲染内容');
assert(/议程评分|预计结束/.test(view.textContent), '总览包含关键指标');

// 议程
window.CC.app.go('agenda');
await wait(30);
assert(view.querySelectorAll('table.data tr').length > 8, '议程表渲染出环节行');
assert(view.querySelectorAll('.issue').length >= 0, '断言面板存在');
const inputs = view.querySelectorAll('input');
assert(inputs.length > 20, '议程字段可编辑，输入框 ' + inputs.length + ' 个');

// 修改一个环节时长并观察评分变化
const before = window.CC.state.lint(window.CC.state.activeMeeting()).score;
const m0 = window.CC.state.activeMeeting();
window.CC.state.updateSegment(m0.id, m0.segments[0].id, { minutes: 200 });
await wait(30);
const after = window.CC.state.lint(window.CC.state.activeMeeting()).score;
assert(after <= before - 8, '改时长后评分显著下降（' + before + ' → ' + after + '）');

// 撤销
window.CC.state.undo();
await wait(30);
assert(window.CC.state.lint(window.CC.state.activeMeeting()).score === before, '撤销恢复原状态');

// 会中
window.CC.app.go('live');
await wait(20);
const m1 = window.CC.state.activeMeeting();
if (m1.status === 'draft') window.CC.state.setStage(m1.id, 'locked');
window.CC.state.liveStart(m1.id);
window.CC.app.go('live');
await wait(120);
assert(!!view.querySelector('.clock-time'), '会中驾驶舱显示计时器');
assert(view.querySelectorAll('.queue-item').length > 0, '流程队列已渲染');
assert(view.querySelectorAll('.counter').length > 0, '哼哈计数卡已渲染');

// 计时在走
const t1 = view.querySelector('.clock-time').textContent;
await wait(900);
const t2 = view.querySelector('.clock-time').textContent;
assert(t1 !== t2, '计时器在走动（' + t1 + ' → ' + t2 + '）');

// 完成一项 → 产生记录
const recBefore = window.CC.state.activeMeeting().records.timing.length;
window.CC.state.liveFinish(m1.id);
await wait(40);
assert(window.CC.state.activeMeeting().records.timing.length >= recBefore, '完成环节后写入计时记录');

// 结束本场 → 生成复盘
window.CC.state.liveEnd(m1.id);
await wait(60);
assert(window.CC.state.activeMeeting().status === 'done', '结束后状态为已归档');
assert(!!window.CC.state.activeMeeting().retro, '复盘已生成');

// 复盘视图
window.CC.app.go('retro');
await wait(40);
assert(/准时度/.test(view.textContent), '复盘显示准时度');
assert(view.querySelectorAll('.bar-row').length > 0, '复盘显示环节偏差条');

// 投屏
window.CC.app.go('live');
await wait(20);
const m2 = window.CC.state.activeMeeting();
if (!m2.live) window.CC.state.liveStart(m2.id);
window.CC.app.go('projection');
await wait(80);
assert(!!view.querySelector('.proj-time'), '投屏模式显示倒计时');
assert(doc.title.indexOf('·') > 0, '投屏更新了窗口标题');

// 问卷草稿
const draft = window.CC.state.surveyDraft(m2);
assert(draft.questions.length >= 3, '问卷草稿生成 ' + draft.questions.length + ' 题');
assert(draft.questions[0].uplimit === 2, '最佳角色名额为 2');
assert(window.CC.core.surveyJsonl(draft).split('\n').length === draft.questions.length, 'JSONL 行数等于题数');

// 会员视图
window.CC.app.go('members');
await wait(40);
assert(view.querySelectorAll('table.data tbody tr').length >= 8, '会员台账渲染');
assert(/DCP/.test(view.textContent), 'DCP 面板存在');

// 排班求解
const sched = window.CC.core.schedule({
  meetings: [{ id: 'x', date: '2026-11-19', slots: [{ role: '主持', weight: 5 }, { role: '时间官', weight: 3 }] }],
  members: [{ id: 'a', name: 'A', capacity: 2, skills: { 主持: 5, 时间官: 4 }, history: {} }],
});
assert(sched.assignments.length === 2, '排班引擎可独立求解');

// 持久化
const raw = window.localStorage.getItem('club-console/v2');
assert(!!raw && JSON.parse(raw).meetings.length >= 3, '数据已写入 localStorage');

assert(errors.length === 0, '运行期间无脚本错误' + (errors.length ? '：\n' + errors.join('\n') : ''));

dom.window.close();
console.log('\n冒烟测试完成');
process.exit(process.exitCode || 0);
