'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const { lintAgenda, buildTimeline, toMarkdown, toHtml } = require('../src/core/agenda-lint');

const ex = path.join(__dirname, '..', 'examples');
const readEx = (f) => JSON.parse(fs.readFileSync(path.join(ex, f), 'utf8'));

test('合规样例应通过且满分', () => {
  const r = lintAgenda(readEx('meeting.sample.json'), { roster: readEx('roster.sample.json') });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.counts.error, 0);
  assert.strictEqual(r.score, 100);
});

test('时间线累加正确', () => {
  const r = lintAgenda(readEx('meeting.sample.json'), { roster: readEx('roster.sample.json') });
  assert.strictEqual(r.totals.plannedMinutes, 113);
  assert.strictEqual(r.timeline[0].startText, '19:30');
  assert.strictEqual(r.timeline[0].endText, '19:35');
  assert.strictEqual(r.totals.endText, '21:23');
  assert.strictEqual(r.totals.slackMinutes, 7);
});

test('问题样例应被阻断并命中关键规则', () => {
  const r = lintAgenda(readEx('meeting.broken.json'), { roster: readEx('roster.sample.json') });
  assert.strictEqual(r.ok, false);
  const codes = r.issues.map((i) => i.code);
  [
    'E_WEEKDAY_MISMATCH',
    'E_END_OVERRUN',
    'E_PENDING_IN_MAIN',
    'E_REQUIREMENT_TOO_LONG',
    'E_ENGLISH_IN_NOTES',
    'E_SELF_EVAL',
    'E_TOO_MANY_ROLES',
    'W_SPEECH_ORDER',
  ].forEach((c) => assert.ok(codes.includes(c), '缺少规则 ' + c + '，实际：' + codes.join(',')));
});

test('评分随问题数下降', () => {
  const r = lintAgenda(readEx('meeting.broken.json'), { roster: readEx('roster.sample.json') });
  assert.ok(r.score < 60, '应显著扣分，实际 ' + r.score);
  assert.ok(r.score >= 0);
});

test('项目要求字数边界：42 通过，43 报错', () => {
  const base = {
    date: '2026-11-05',
    start: '19:30',
    end: '21:30',
    segments: [{ id: 'a', name: '开场', kind: 'opening', minutes: 5, owner: '张三' }],
    speeches: [{ speaker: '李四', evaluator: '王五', minutes: 7, evalMinutes: 3, requirement: '字'.repeat(42) }],
  };
  const ok = lintAgenda(base);
  assert.ok(!ok.issues.some((i) => i.code === 'E_REQUIREMENT_TOO_LONG'), '42 字不应报错');

  const bad = JSON.parse(JSON.stringify(base));
  bad.speeches[0].requirement = '字'.repeat(43);
  const r2 = lintAgenda(bad);
  assert.ok(r2.issues.some((i) => i.code === 'E_REQUIREMENT_TOO_LONG'), '43 字应报错');
});

test('未知人员应被拦截', () => {
  const m = {
    date: '2026-11-05',
    start: '19:30',
    end: '21:30',
    segments: [{ id: 'a', name: '开场', kind: 'opening', minutes: 5, owner: '外号不明的某人' }],
    speeches: [{ speaker: '张三', evaluator: '李四' }],
  };
  const roster = { members: [{ name: '张三' }, { name: '李四' }] };
  const r = lintAgenda(m, { roster });
  assert.ok(r.issues.some((i) => i.code === 'E_UNKNOWN_PERSON'));
});

test('别名的写法也应被识别为同一人', () => {
  const m = {
    date: '2026-11-05',
    start: '19:30',
    end: '21:30',
    segments: [{ id: 'a', name: '开场', kind: 'opening', minutes: 5, owner: '733' }],
  };
  const roster = readEx('roster.sample.json');
  const r = lintAgenda(m, { roster });
  assert.ok(!r.issues.some((i) => i.code === 'E_UNKNOWN_PERSON'));
});

test('时长为 0 应报错', () => {
  const m = {
    date: '2026-11-05',
    start: '19:30',
    segments: [{ id: 'a', name: '空环节', kind: 'opening', minutes: 0, owner: '张三' }],
  };
  const r = lintAgenda(m);
  assert.ok(r.issues.some((i) => i.code === 'E_ZERO_MINUTES'));
});

test('即兴时长与人数不符应告警', () => {
  const m = {
    date: '2026-11-05',
    start: '19:30',
    end: '21:30',
    tableTopicsCount: 10,
    segments: [
      { id: 'a', name: '开场', kind: 'opening', minutes: 5, owner: '张三' },
      { id: 'b', name: '即兴', kind: 'tabletopics', minutes: 15, owner: '李四' },
    ],
  };
  const r = lintAgenda(m);
  assert.ok(r.issues.some((i) => i.code === 'W_TT_FORMULA'));
});

test('缺必填字段应报错', () => {
  const r = lintAgenda({ start: '19:30' });
  const codes = r.issues.map((i) => i.code);
  assert.ok(codes.includes('E_MISSING_FIELD'));
  assert.strictEqual(r.ok, false);
});

test('buildTimeline 可独立使用', () => {
  const tl = buildTimeline({
    start: '19:30',
    segments: [
      { name: 'A', minutes: 10 },
      { name: 'B', minutes: 20 },
    ],
  });
  assert.strictEqual(tl.length, 2);
  assert.strictEqual(tl[1].startText, '19:40');
  assert.strictEqual(tl[1].endText, '20:00');
});

test('Markdown 与 HTML 报告可生成', () => {
  const r = lintAgenda(readEx('meeting.broken.json'), { roster: readEx('roster.sample.json') });
  const md = toMarkdown(r);
  const html = toHtml(r);
  assert.ok(md.includes('阻断'));
  assert.ok(md.includes('E_END_OVERRUN'));
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes('议程体检报告'));
});

test('HTML 转义防止注入', () => {
  const r = lintAgenda({
    date: '2026-11-05',
    start: '19:30',
    end: '21:30',
    segments: [{ id: 'a', name: '<script>alert(1)</script>', kind: 'opening', minutes: 5, owner: '张三' }],
  });
  const html = toHtml(r);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});
