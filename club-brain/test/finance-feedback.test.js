'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const { reconcile, dayDiff } = require('../src/core/dues-recon');
const { analyze } = require('../src/core/feedback-loop');

const ex = path.join(__dirname, '..', 'examples');
const readEx = (f) => JSON.parse(fs.readFileSync(path.join(ex, f), 'utf8'));

/* ---------------- dues-recon ---------------- */

test('对账：匹配数量正确', () => {
  const r = reconcile(readEx('dues.sample.json'));
  assert.strictEqual(r.summary.ledgerEntries, 3);
  assert.strictEqual(r.summary.bankEntries, 4);
  assert.strictEqual(r.summary.matched, 3);
});

test('对账：有流水没台账要被拎出来', () => {
  const r = reconcile(readEx('dues.sample.json'));
  assert.strictEqual(r.summary.unmatchedBank, 1);
  assert.strictEqual(r.unmatchedBank[0].amount, 500);
  assert.ok(r.issues.some((i) => i.code === 'E_BANK_UNMATCHED'));
  assert.strictEqual(r.ok, false);
});

test('对账：部分缴费识别为 partial', () => {
  const r = reconcile(readEx('dues.sample.json'));
  const zhang = r.obligations.find((o) => o.name === '张三');
  assert.strictEqual(zhang.status, 'partial');
  assert.strictEqual(zhang.gap, 300);
});

test('对账：完全未缴识别为 unpaid', () => {
  const r = reconcile(readEx('dues.sample.json'));
  const li = r.obligations.find((o) => o.name === '李四');
  assert.strictEqual(li.status, 'unpaid');
  assert.strictEqual(li.paid, 0);
});

test('对账：金额不符不得误匹配', () => {
  const r = reconcile({
    members: [],
    ledger: [{ id: 'L1', name: '王五', amount: 600, date: '2026-07-05' }],
    bank: [{ id: 'B1', amount: 599, date: '2026-07-05', memo: '王五' }],
  });
  assert.strictEqual(r.summary.matched, 0);
  assert.strictEqual(r.summary.unmatchedLedger, 1);
});

test('对账：超出时间窗口不得匹配', () => {
  const r = reconcile({
    members: [],
    ledger: [{ id: 'L1', name: '王五', amount: 600, date: '2026-07-05' }],
    bank: [{ id: 'B1', amount: 600, date: '2026-09-05', memo: '王五' }],
  }, { windowDays: 7 });
  assert.strictEqual(r.summary.matched, 0);
});

test('对账：备注含姓名优先匹配', () => {
  const r = reconcile({
    members: [],
    ledger: [{ id: 'L1', name: '张三', amount: 600, date: '2026-07-05' }],
    bank: [
      { id: 'B1', amount: 600, date: '2026-07-06', memo: '李四' },
      { id: 'B2', amount: 600, date: '2026-07-06', memo: '张三 会费' },
    ],
  });
  assert.strictEqual(r.matches[0].bankId, 'B2');
});

test('对账：重复缴费告警', () => {
  const r = reconcile({
    members: [],
    ledger: [
      { id: 'L1', name: '张三', amount: 600, date: '2026-07-05' },
      { id: 'L2', name: '张三', amount: 600, date: '2026-07-06' },
    ],
    bank: [
      { id: 'B1', amount: 600, date: '2026-07-05', memo: '张三' },
      { id: 'B2', amount: 600, date: '2026-07-06', memo: '张三' },
    ],
  });
  assert.strictEqual(r.duplicates.length, 1);
  assert.strictEqual(r.duplicates[0].count, 2);
});

test('对账：日期差计算', () => {
  assert.strictEqual(dayDiff('2026-07-05', '2026-07-08'), 3);
  assert.strictEqual(dayDiff('2026-07-05', '2026-07-05'), 0);
});

/* ---------------- feedback-loop ---------------- */

test('点评闭环：重复建议应被识别', () => {
  const r = analyze(readEx('feedback.sample.json'));
  const zhang = r.members.find((m) => m.member === '张三');
  assert.ok(zhang);
  const structural = zhang.repeated.find((x) => x.category === '结构');
  assert.ok(structural, '张三的「结构」应被识别为重复');
  assert.strictEqual(structural.count, 3);
  assert.ok(r.alerts.some((a) => a.code === 'W_REPEAT_ADVICE' && a.member === '张三'));
});

test('点评闭环：关闭率计算', () => {
  const r = analyze(readEx('feedback.sample.json'));
  assert.strictEqual(r.summary.items, 7);
  assert.strictEqual(r.summary.done, 2);
  assert.ok(r.summary.closureRate > 28 && r.summary.closureRate < 29);
});

test('点评闭环：陈旧未关闭应告警', () => {
  const r = analyze(readEx('feedback.sample.json'), { staleMeetings: 3 });
  assert.ok(r.alerts.some((a) => a.code === 'W_STALE_OPEN' && a.member === '张三'));
});

test('点评闭环：下一次焦点取最常见类别', () => {
  const r = analyze(readEx('feedback.sample.json'));
  const zhang = r.members.find((m) => m.member === '张三');
  assert.strictEqual(zhang.nextFocus, '结构');
});

test('点评闭环：阈值可配置', () => {
  const data = readEx('feedback.sample.json');
  const loose = analyze(data, { repeatThreshold: 4 });
  assert.ok(!loose.members.some((m) => m.repeated.some((x) => x.category === '结构')));
});

test('点评闭环：空输入不崩', () => {
  const r = analyze({});
  assert.strictEqual(r.summary.items, 0);
  assert.strictEqual(r.ok, true);
});
