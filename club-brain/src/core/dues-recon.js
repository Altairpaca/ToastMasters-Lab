'use strict';

/**
 * dues-recon · 会费对账器
 *
 * 司库每个月最痛的事：银行/微信流水与自己的台账对不上。
 * 本模块做三件事：① 流水与台账自动匹配；② 算出每人每期的缴费状态；
 * ③ 把"两边对不上"的部分单独列出来，而不是让人对着两张表瞪眼。
 *
 * 对应创新点：FI-005 对账器 / FI-006 未匹配告警 / FI-023 重复缴费检测
 */

const SEVERITY = { error: 'error', warn: 'warn', info: 'info' };

function dayDiff(a, b) {
  const pa = String(a || '').split('-').map(Number);
  const pb = String(b || '').split('-').map(Number);
  if (!pa[0] || !pb[0]) return Infinity;
  const ta = Date.UTC(pa[0], pa[1] - 1, pa[2]);
  const tb = Date.UTC(pb[0], pb[1] - 1, pb[2]);
  return Math.abs(ta - tb) / 86400000;
}

function norm(s) {
  return String(s || '').toLowerCase().replace(/\s|先生|女士|会员/g, '');
}

/** 单条台账与单条流水的匹配得分，0 表示不匹配 */
function score(ledger, bank, opts) {
  const amountDiff = Math.abs(Number(ledger.amount) - Number(bank.amount));
  if (amountDiff > opts.amountTolerance) return 0;
  const dd = dayDiff(ledger.date, bank.date);
  if (dd > opts.windowDays) return 0;
  let s = 60;
  if (amountDiff === 0) s += 20;
  s += Math.max(0, 20 - dd * 4);
  const name = norm(ledger.name || ledger.memberName);
  const memo = norm(bank.memo);
  if (name && memo) {
    if (memo.includes(name) || name.includes(memo)) s += 30;
    else s -= 15; // 名字对不上要降权，避免张冠李戴
  }
  return s;
}

/**
 * @param {object} input { ledger[], bank[], members[] }
 * @param {object} [options] { windowDays, amountTolerance, staleDays }
 */
function reconcile(input, options) {
  const opts = Object.assign({ windowDays: 7, amountTolerance: 0.01, staleDays: 60 }, options || {});
  const ledger = Array.isArray(input && input.ledger) ? input.ledger : [];
  const bank = Array.isArray(input && input.bank) ? input.bank : [];

  const candidates = [];
  ledger.forEach((l, li) => {
    bank.forEach((b, bi) => {
      const s = score(l, b, opts);
      if (s > 0) candidates.push({ li, bi, score: s });
    });
  });
  candidates.sort((a, b) => b.score - a.score);

  const usedL = new Set();
  const usedB = new Set();
  const matches = [];
  candidates.forEach((c) => {
    if (usedL.has(c.li) || usedB.has(c.bi)) return;
    usedL.add(c.li);
    usedB.add(c.bi);
    matches.push({
      ledgerId: ledger[c.li].id || 'L' + (c.li + 1),
      bankId: bank[c.bi].id || 'B' + (c.bi + 1),
      name: ledger[c.li].name || ledger[c.li].memberName || '',
      amount: Number(ledger[c.li].amount),
      ledgerDate: ledger[c.li].date,
      bankDate: bank[c.bi].date,
      dayGap: dayDiff(ledger[c.li].date, bank[c.bi].date),
      score: c.score,
    });
  });

  const unmatchedLedger = ledger.filter((_, i) => !usedL.has(i)).map((l, i) => ({
    id: l.id || 'L' + (i + 1),
    name: l.name || l.memberName || '',
    amount: Number(l.amount) || 0,
    date: l.date,
    reason: '台账有记录但没找到对应流水（可能未到账或金额/日期不符）',
    severity: SEVERITY.warn,
  }));
  const unmatchedBank = bank.filter((_, i) => !usedB.has(i)).map((b, i) => ({
    id: b.id || 'B' + (i + 1),
    amount: Number(b.amount) || 0,
    date: b.date,
    memo: b.memo || '',
    reason: '有流水但没有台账（可能是新会员、误转或未登记）',
    severity: SEVERITY.error,
  }));

  // —— 每人每期缴费状态 ——
  const obligations = [];
  (input && input.members ? input.members : []).forEach((m) => {
    (m.periods || []).forEach((p) => {
      const paid = matches
        .filter((x) => norm(x.name) === norm(m.name) && (!p.period || !x.period || x.period === p.period))
        .reduce((s, x) => s + x.amount, 0);
      const due = Number(p.amount) || 0;
      const status = paid >= due - 0.01 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
      obligations.push({
        memberId: m.id || m.name,
        name: m.name,
        period: p.period || '',
        due,
        paid,
        status,
        gap: Number((due - paid).toFixed(2)),
        dueDate: p.due || '',
        overdueDays: status === 'paid' || !p.due ? 0 : Math.max(0, Math.round(dayDiff(p.due, todayStr()))),
      });
    });
  });

  // —— 重复缴费检测 ——
  const duplicates = [];
  const byAmountDate = new Map();
  matches.forEach((m) => {
    const key = norm(m.name) + '|' + m.amount;
    if (!byAmountDate.has(key)) byAmountDate.set(key, []);
    byAmountDate.get(key).push(m);
  });
  byAmountDate.forEach((list, key) => {
    if (list.length > 1) {
      duplicates.push({
        name: key.split('|')[0],
        amount: list[0].amount,
        count: list.length,
        dates: list.map((x) => x.bankDate),
        reason: '同一人同金额出现 ' + list.length + ' 笔，可能是重复缴费或分期',
        severity: SEVERITY.warn,
      });
    }
  });

  const issues = []
    .concat(unmatchedBank.map((u) => ({ code: 'E_BANK_UNMATCHED', severity: SEVERITY.error, message: u.reason + '：' + u.date + ' ¥' + u.amount + ' ' + u.memo })))
    .concat(unmatchedLedger.map((u) => ({ code: 'W_LEDGER_UNMATCHED', severity: SEVERITY.warn, message: u.reason + '：' + u.date + ' ' + u.name + ' ¥' + u.amount })))
    .concat(duplicates.map((d) => ({ code: 'W_DUPLICATE', severity: SEVERITY.warn, message: d.reason + '：' + d.name + ' ¥' + d.amount })))
    .concat(obligations.filter((o) => o.status !== 'paid').map((o) => ({
      code: 'W_UNPAID',
      severity: SEVERITY.warn,
      message: o.name + ' ' + (o.period || '本期') + ' 欠 ¥' + o.gap + (o.overdueDays ? '（逾期 ' + o.overdueDays + ' 天）' : ''),
    })));

  const totalDue = obligations.reduce((s, o) => s + o.due, 0);
  const totalPaid = obligations.reduce((s, o) => s + o.paid, 0);

  return {
    schema: 'dues-recon/v1',
    ok: unmatchedBank.length === 0 && obligations.every((o) => o.status === 'paid'),
    summary: {
      ledgerEntries: ledger.length,
      bankEntries: bank.length,
      matched: matches.length,
      unmatchedLedger: unmatchedLedger.length,
      unmatchedBank: unmatchedBank.length,
      totalDue: Number(totalDue.toFixed(2)),
      totalPaid: Number(totalPaid.toFixed(2)),
      collectionRate: totalDue ? Number(((totalPaid / totalDue) * 100).toFixed(1)) : null,
    },
    matches,
    unmatchedLedger,
    unmatchedBank,
    duplicates,
    obligations,
    issues,
  };
}

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function toMarkdown(r) {
  const lines = [];
  lines.push('# 会费对账');
  lines.push('');
  lines.push('| 指标 | 数值 |');
  lines.push('|---|---|');
  lines.push('| 台账 / 流水 | ' + r.summary.ledgerEntries + ' / ' + r.summary.bankEntries + ' |');
  lines.push('| 已匹配 | ' + r.summary.matched + ' |');
  lines.push('| 台账未匹配 | ' + r.summary.unmatchedLedger + ' |');
  lines.push('| 流水未记账 | ' + r.summary.unmatchedBank + ' |');
  lines.push('| 应收 / 实收 | ¥' + r.summary.totalDue + ' / ¥' + r.summary.totalPaid + ' |');
  lines.push('| 收缴率 | ' + (r.summary.collectionRate == null ? '—' : r.summary.collectionRate + '%') + ' |');
  lines.push('');
  if (r.unmatchedBank.length) {
    lines.push('## 有流水没台账（优先处理）');
    lines.push('');
    r.unmatchedBank.forEach((u) => lines.push('- ' + u.date + ' ¥' + u.amount + '　' + (u.memo || '(无备注)')));
    lines.push('');
  }
  if (r.unmatchedLedger.length) {
    lines.push('## 有台账没流水');
    lines.push('');
    r.unmatchedLedger.forEach((u) => lines.push('- ' + u.date + ' ' + u.name + ' ¥' + u.amount));
    lines.push('');
  }
  const unpaid = r.obligations.filter((o) => o.status !== 'paid');
  if (unpaid.length) {
    lines.push('## 未缴清');
    lines.push('');
    lines.push('| 会员 | 期次 | 应收 | 已收 | 差额 | 逾期 |');
    lines.push('|---|---|--:|--:|--:|--:|');
    unpaid.forEach((o) => lines.push('| ' + o.name + ' | ' + (o.period || '—') + ' | ' + o.due + ' | ' + o.paid +
      ' | ' + o.gap + ' | ' + (o.overdueDays || 0) + ' 天 |'));
  }
  return lines.join('\n');
}

module.exports = { reconcile, toMarkdown, dayDiff, score };
