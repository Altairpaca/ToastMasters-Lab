'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const { lintBrand, contrastRatio, isNeutral } = require('../src/core/brand-lint');
const { schedule, costOf } = require('../src/core/role-scheduler');
const { buildRetro } = require('../src/core/meeting-retro');
const { trackDcp, DEFAULT_GOALS } = require('../src/core/dcp-tracker');
const { gini, parseHHMM, fmtHHMM, weekdayOf, displayWidth } = require('../src/core/util');

const ex = path.join(__dirname, '..', 'examples');
const readEx = (f) => JSON.parse(fs.readFileSync(path.join(ex, f), 'utf8'));

/* ---------------- util ---------------- */

test('时间解析与格式化互逆', () => {
  assert.strictEqual(parseHHMM('19:30'), 1170);
  assert.strictEqual(fmtHHMM(1170), '19:30');
  assert.ok(Number.isNaN(parseHHMM('25:00')));
  assert.ok(Number.isNaN(parseHHMM('1930')));
});

test('星期计算正确', () => {
  assert.strictEqual(weekdayOf('2026-11-05'), 4); // 周四
  assert.strictEqual(weekdayOf('2026-10-31'), 6); // 周六
});

test('显示宽度：中文 1、ASCII 0.5', () => {
  assert.strictEqual(displayWidth('中文'), 2);
  assert.strictEqual(displayWidth('abcd'), 2);
});

test('基尼系数边界', () => {
  assert.strictEqual(gini([2, 2, 2, 2]), 0);
  assert.ok(gini([0, 0, 4]) > 0.5);
  assert.strictEqual(gini([]), 0);
});

/* ---------------- brand ---------------- */

test('品牌样例应可发布', () => {
  const r = lintBrand(readEx('asset.sample.json'));
  assert.strictEqual(r.ok, true, JSON.stringify(r.issues));
  assert.ok(r.measured.neutralRatio > 0, '白色应计入中性色');
});

test('问题样例应被拦下并命中关键规则', () => {
  const r = lintBrand(readEx('asset.broken.json'));
  assert.strictEqual(r.ok, false);
  const codes = r.issues.map((i) => i.code);
  ['E_PRIMARY_LOW', 'E_QR_MODULE', 'E_QR_QUIET', 'E_QR_CONTRAST', 'E_NO_DISCLAIMER',
    'E_LOGO_MISSING', 'E_TEXT_OVERFLOW', 'W_ABSOLUTE_CLAIM', 'W_SAFE_AREA'].forEach((c) => {
    assert.ok(codes.includes(c), '缺少 ' + c + '，实际：' + codes.join(','));
  });
});

test('对比度与中性色', () => {
  assert.strictEqual(Math.round(contrastRatio('#000000', '#FFFFFF')), 21);
  assert.ok(isNeutral('#FFFFFF'));
  assert.ok(isNeutral('#808080'));
  assert.ok(!isNeutral('#772432'));
});

test('缺配色清单应报错', () => {
  const r = lintBrand({ name: 'x', kind: 'poster' });
  assert.ok(r.issues.some((i) => i.code === 'E_NO_PALETTE'));
});

/* ---------------- scheduler ---------------- */

test('排班应填满所有槽位', () => {
  const r = schedule(readEx('schedule.sample.json'));
  assert.strictEqual(r.stats.slots, 12);
  assert.strictEqual(r.stats.filled, 12, '未排：' + JSON.stringify(r.unassigned));
  assert.strictEqual(r.ok, true);
});

test('排班不得超出个人容量与单场上限', () => {
  const input = readEx('schedule.sample.json');
  const r = schedule(input);
  input.members.forEach((m) => {
    const count = r.assignments.filter((a) => a.memberId === m.id).length;
    assert.ok(count <= m.capacity, m.name + ' 超出容量：' + count + ' > ' + m.capacity);
  });
  ['M335', 'M336'].forEach((mid) => {
    input.members.forEach((m) => {
      const c = r.assignments.filter((a) => a.meetingId === mid && a.memberId === m.id).length;
      assert.ok(c <= 2, m.name + ' 在 ' + mid + ' 担任 ' + c + ' 个角色');
    });
  });
});

test('排班应尊重不可用日期', () => {
  const input = readEx('schedule.sample.json');
  const r = schedule(input);
  const wang = input.members.find((m) => m.name === '王五');
  const onHoliday = r.assignments.filter((a) => a.memberId === wang.id && a.date === '2026-11-12');
  assert.strictEqual(onHoliday.length, 0, '王五 11-12 不可用却被排了');
});

test('公平性基尼系数应较低', () => {
  const r = schedule(readEx('schedule.sample.json'));
  assert.ok(r.fairness.gini < 0.45, '基尼过高：' + r.fairness.gini);
});

test('无人可用时应返回缺口与说明', () => {
  const r = schedule({ meetings: [{ id: 'M1', date: '2026-11-05', slots: [{ role: '主持' }] }], members: [] });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.unassigned.length, 1);
});

test('成本函数：能力越高成本越低，历史越多成本越高', () => {
  const strong = { id: 'a', name: 'a', skills: { 主持: 5 } };
  const weak = { id: 'b', name: 'b', skills: { 主持: 1 } };
  assert.ok(costOf(strong, '主持') < costOf(weak, '主持'));
  const veteran = { id: 'c', name: 'c', skills: { 主持: 5 }, history: { 主持: 10 } };
  assert.ok(costOf(veteran, '主持') > costOf(strong, '主持'));
});

/* ---------------- retro ---------------- */

test('复盘：准时度与超时环节', () => {
  const r = buildRetro(readEx('retro.sample.json'));
  assert.strictEqual(r.totals.segments, 6);
  assert.strictEqual(r.totals.overruns, 4);
  assert.ok(r.punctuality < 100);
  assert.ok(r.insights.length >= 3);
});

test('复盘：按人聚合赘词', () => {
  const r = buildRetro(readEx('retro.sample.json'));
  const zhao = r.persons.find((p) => p.speaker === '赵六');
  assert.ok(zhao);
  assert.strictEqual(zhao.ahTotal, 10);
  assert.strictEqual(zhao.topFiller.word, '那个');
  assert.ok(zhao.ahPerMinute > 0);
});

test('复盘：与上期对比', () => {
  const cur = readEx('retro.sample.json');
  const r = buildRetro(cur, { history: [{ meetingNo: 334, punctuality: 80, actualMinutes: 110 }] });
  assert.ok(r.trend);
  assert.strictEqual(r.trend.prevMeetingNo, 334);
  assert.ok(typeof r.trend.deltaPunctuality === 'number');
});

test('复盘：无数据时不崩', () => {
  const r = buildRetro({});
  assert.strictEqual(r.totals.segments, 0);
  assert.ok(Array.isArray(r.insights));
});

/* ---------------- dcp ---------------- */

test('DCP：样例已达 Distinguished', () => {
  const r = trackDcp(readEx('dcp.sample.json'));
  assert.strictEqual(r.totalGoals, 10);
  assert.strictEqual(r.achievedCount, 5);
  assert.strictEqual(r.level, 'Distinguished');
  assert.strictEqual(r.actions.length, 5);
});

test('DCP：速度与预测', () => {
  const r = trackDcp(readEx('dcp.sample.json'));
  assert.strictEqual(r.velocity, 1.33);
  assert.ok(r.forecast.monthsToSelect > 0);
  assert.ok(r.forecast.monthsToPresidents > r.forecast.monthsToSelect);
});

test('DCP：二级目标使用 offset 不重复用人', () => {
  const r = trackDcp({
    awards: { level2: 3 },
    newMembers: 0,
    officersTrained: { round1: 0, round2: 0 },
  });
  const l2a = r.goals.find((g) => g.id === 'edu-l2a');
  const l2b = r.goals.find((g) => g.id === 'edu-l2b');
  assert.strictEqual(l2a.achieved, true);
  assert.strictEqual(l2b.achieved, false);
  assert.strictEqual(l2b.current, 1);
});

test('DCP：目标可配置', () => {
  const goals = DEFAULT_GOALS.slice(0, 3);
  const r = trackDcp({ newMembers: 0 }, { goals });
  assert.strictEqual(r.totalGoals, 3);
});

test('DCP：会费未缴应有提醒', () => {
  const r = trackDcp({ newMembers: 0, duesOnTime: false });
  assert.ok(r.warnings.some((w) => w.includes('会费')));
});
