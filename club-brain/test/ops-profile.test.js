'use strict';

const test = require('node:test');
const assert = require('node:assert');
const ops = require('../src/core/meeting-ops');
const { buildProfiles, toMarkdown } = require('../src/core/member-profile');

function meeting() {
  return {
    id: 'm1',
    meetingNo: 1,
    status: 'locked',
    segments: [
      { id: 's1', name: '开场', kind: 'opening', minutes: 5, owner: '甲', ownerStatus: 'confirmed' },
      { id: 's2', name: '即兴', kind: 'tabletopics', minutes: 15, owner: '乙', ownerStatus: 'confirmed' },
    ],
    speeches: [],
    records: { timing: [], ah: {}, grammar: { good: [], issues: [] } },
    live: null,
  };
}

/* ---------------- meeting-ops ---------------- */

test('start 写入 runningSince 并切到进行中', () => {
  const m = meeting();
  assert.strictEqual(ops.start(m, 1000), true);
  assert.strictEqual(m.status, 'live');
  assert.strictEqual(m.live.runningSince, 1000);
  assert.strictEqual(m.live.elapsedMs, 0);
});

test('elapsedSeconds 按注入的时间推进', () => {
  const m = meeting();
  ops.start(m, 1000);
  assert.strictEqual(ops.elapsedSeconds(m, 1000 + 90000), 90);
});

test('暂停后时间冻结', () => {
  const m = meeting();
  ops.start(m, 0);
  ops.toggle(m, 90000);
  assert.strictEqual(m.live.runningSince, null);
  assert.strictEqual(ops.elapsedSeconds(m, 999999), 90);
});

test('再次切换恢复计时', () => {
  const m = meeting();
  ops.start(m, 0);
  ops.toggle(m, 60000);
  ops.toggle(m, 60000);
  assert.ok(m.live.runningSince);
  assert.strictEqual(ops.elapsedSeconds(m, 90000), 90);
});

test('finish 写入记录并推进到下一环节', () => {
  const m = meeting();
  ops.start(m, 0);
  ops.finish(m, 90000);
  assert.strictEqual(m.records.timing.length, 1);
  const rec = m.records.timing[0];
  assert.strictEqual(rec.segment, '开场');
  assert.strictEqual(rec.planned, 5);
  assert.strictEqual(rec.actual, 1.5);
  assert.strictEqual(rec.status, 'ok');
  assert.strictEqual(m.live.index, 1);
  assert.strictEqual(m.live.elapsedMs, 0);
});

test('超时记录状态为 over', () => {
  const m = meeting();
  ops.start(m, 0);
  ops.finish(m, 60 * 9 * 1000); // 9 分钟 vs 计划 5 分钟
  assert.strictEqual(m.records.timing[0].status, 'over');
  assert.ok(m.records.timing[0].actual > 5);
});

test('最后一项完成不越界', () => {
  const m = meeting();
  m.live = { index: 1, elapsedMs: 0, runningSince: null, log: [] };
  ops.start(m, 0);
  ops.finish(m, 60000);
  assert.strictEqual(m.live.index, 1);
});

test('prev 回退并清零', () => {
  const m = meeting();
  m.live = { index: 1, elapsedMs: 30000, runningSince: null, log: [] };
  ops.prev(m);
  assert.strictEqual(m.live.index, 0);
  assert.strictEqual(m.live.elapsedMs, 0);
});

test('end 归档并清空复盘缓存', () => {
  const m = meeting();
  ops.start(m, 0);
  m.retro = { stale: true };
  ops.end(m, 120000);
  assert.strictEqual(m.status, 'done');
  assert.strictEqual(m.retro, null);
  assert.ok(m.endedAt > 0);
});

test('同段落重复完成只保留一条记录', () => {
  const m = meeting();
  ops.start(m, 0);
  ops.finish(m, 60000);
  ops.prev(m);
  ops.start(m, 0);
  ops.finish(m, 120000);
  const forFirst = m.records.timing.filter((t) => t.segment === '开场');
  assert.strictEqual(forFirst.length, 1);
  assert.strictEqual(forFirst[0].actual, 2);
});

test('哼哈计数可增可减，减到 0 删除键', () => {
  const m = meeting();
  ops.addAh(m, '甲', '嗯', 1);
  ops.addAh(m, '甲', '嗯', 1);
  assert.strictEqual(m.records.ah['甲']['嗯'], 2);
  ops.addAh(m, '甲', '嗯', -1);
  assert.strictEqual(m.records.ah['甲']['嗯'], 1);
  ops.addAh(m, '甲', '嗯', -1);
  assert.strictEqual(m.records.ah['甲']['嗯'], undefined);
});

test('applyCommand 路由与非法命令', () => {
  const state = { meetings: [meeting()], activeMeetingId: 'm1' };
  assert.strictEqual(ops.applyCommand(state, { type: 'live.start', meetingId: 'm1' }, 0), true);
  assert.strictEqual(state.meetings[0].status, 'live');
  assert.strictEqual(ops.applyCommand(state, { type: 'unknown', meetingId: 'm1' }), false);
  assert.strictEqual(ops.applyCommand(state, { type: 'live.toggle', meetingId: '不存在' }), true);
});

/* ---------------- member-profile ---------------- */

function profileFixture() {
  return {
    members: [{ name: '甲' }, { name: '乙' }, { name: '丙' }],
    meetings: [
      {
        date: '2026-10-01', meetingNo: 1,
        segments: [{ id: 'a', name: '主持', kind: 'opening', minutes: 5, owner: '甲', ownerStatus: 'confirmed' }],
        speeches: [{ speaker: '乙', evaluator: '丙' }],
        records: {
          timing: [
            { segment: '主持', speaker: '甲', planned: 5, actual: 8, status: 'over' },
            { segment: '备稿', speaker: '乙', planned: 7, actual: 7, status: 'ok' },
          ],
          ah: { 甲: { 嗯: 6, 然后: 2 }, 乙: { 嗯: 1 } },
          grammar: { good: [], issues: [] },
        },
      },
      {
        date: '2026-10-08', meetingNo: 2,
        segments: [
          { id: 'b', name: '主持', kind: 'opening', minutes: 5, owner: '甲', ownerStatus: 'confirmed' },
          { id: 'c', name: '即兴主持', kind: 'tabletopics', minutes: 15, owner: '甲', ownerStatus: 'confirmed' },
        ],
        speeches: [{ speaker: '乙', evaluator: '丙' }],
        records: {
          timing: [
            { segment: '主持', speaker: '甲', planned: 5, actual: 9, status: 'over' },
            { segment: '即兴主持', speaker: '甲', planned: 15, actual: 14, status: 'ok' },
          ],
          ah: { 甲: { 嗯: 5 } },
          grammar: { good: [], issues: [] },
        },
      },
    ],
  };
}

test('档案：参与次数与角色统计', () => {
  const r = buildProfiles(profileFixture());
  const jia = r.profiles.find((p) => p.name === '甲');
  assert.strictEqual(jia.meetings, 2);
  assert.strictEqual(jia.distinctRoles, 2);
  assert.strictEqual(jia.timedSegments, 3);
  assert.strictEqual(jia.overCount, 2);
});

test('档案：准时率与平均偏差', () => {
  const r = buildProfiles(profileFixture());
  const jia = r.profiles.find((p) => p.name === '甲');
  assert.strictEqual(jia.onTimeRate, 33.3);
  assert.ok(jia.avgDelta > 0);
});

test('档案：赘词按人聚合', () => {
  const r = buildProfiles(profileFixture());
  const jia = r.profiles.find((p) => p.name === '甲');
  assert.strictEqual(jia.ahTotal, 13);
  assert.strictEqual(jia.topWord.word, '嗯');
});

test('档案：焦点优先给时长控制', () => {
  const r = buildProfiles(profileFixture());
  const jia = r.profiles.find((p) => p.name === '甲');
  assert.strictEqual(jia.focus, '时长控制');
});

test('档案：无计时数据的人不硬造准时率', () => {
  const r = buildProfiles(profileFixture());
  const bing = r.profiles.find((p) => p.name === '丙');
  assert.strictEqual(bing.onTimeRate, null);
  assert.strictEqual(bing.evaluations, 2);
});

test('档案：俱乐部级汇总', () => {
  const r = buildProfiles(profileFixture());
  assert.strictEqual(r.club.meetings, 2);
  assert.strictEqual(r.club.range.from, '2026-10-01');
  assert.ok(r.club.bestOnTime);
  assert.ok(r.club.mostFillers.name === '甲');
});

test('档案：Markdown 报告可生成', () => {
  const md = toMarkdown(buildProfiles(profileFixture()));
  assert.ok(md.includes('会员成长档案'));
  assert.ok(md.includes('甲'));
  assert.ok(md.includes('逐人建议'));
});

test('档案：空输入不崩', () => {
  const r = buildProfiles({});
  assert.deepStrictEqual(r.profiles, []);
  assert.strictEqual(r.club.meetings, 0);
});
