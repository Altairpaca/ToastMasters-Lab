'use strict';

/**
 * feedback-loop · 点评建议闭环
 *
 * 头马最普遍的浪费：点评师每次都认真给建议，但没人跟踪"下个月改了没有"。
 * 本模块把零散的建议变成可追踪的条目，识别"同一建议反复出现"——
 * 这是最值得警惕的信号（说明改不动）。
 *
 * 对应创新点：OF-033 点评建议追踪闭环 / OF-031 点评师能力画像 / MB-039 会员目标
 */

const SEVERITY = { warn: 'warn', info: 'info' };

/**
 * @param {object} input { items: [{ id, member, from, meetingNo, date, category, text, status }] }
 * @param {object} [options] { repeatThreshold, staleMeetings }
 */
function analyze(input, options) {
  const opts = Object.assign({ repeatThreshold: 2, staleMeetings: 3 }, options || {});
  const items = ((input && input.items) || []).map((it, i) => ({
    id: it.id || 'F' + (i + 1),
    member: String(it.member || '').trim(),
    from: it.from || '',
    meetingNo: Number(it.meetingNo) || null,
    date: it.date || '',
    category: String(it.category || '未分类').trim(),
    text: String(it.text || '').trim(),
    status: it.status === 'done' ? 'done' : 'open',
  }));

  const latestMeeting = items.reduce((m, it) => Math.max(m, it.meetingNo || 0), 0);

  // —— 按人聚合 ——
  const byMember = new Map();
  items.forEach((it) => {
    if (!byMember.has(it.member)) {
      byMember.set(it.member, { member: it.member, total: 0, open: 0, done: 0, categories: {}, items: [] });
    }
    const m = byMember.get(it.member);
    m.total += 1;
    m[it.status] += 1;
    m.categories[it.category] = (m.categories[it.category] || 0) + 1;
    m.items.push(it);
  });

  const members = [...byMember.values()].map((m) => {
    const cats = Object.entries(m.categories).sort((a, b) => b[1] - a[1]);
    const repeated = cats.filter(([, c]) => c >= opts.repeatThreshold);
    const openItems = m.items.filter((i) => i.status === 'open');
    const oldestOpen = openItems
      .filter((i) => i.meetingNo)
      .sort((a, b) => a.meetingNo - b.meetingNo)[0] || null;
    const stale = oldestOpen && latestMeeting - oldestOpen.meetingNo >= opts.staleMeetings;
    return {
      member: m.member,
      total: m.total,
      open: m.open,
      done: m.done,
      closureRate: m.total ? Number(((m.done / m.total) * 100).toFixed(1)) : null,
      topCategory: cats[0] ? { category: cats[0][0], count: cats[0][1] } : null,
      repeated: repeated.map(([category, count]) => ({ category, count })),
      stale: Boolean(stale),
      oldestOpenMeeting: oldestOpen ? oldestOpen.meetingNo : null,
      nextFocus: cats[0] ? cats[0][0] : null,
      openItems,
    };
  }).sort((a, b) => b.repeated.length - a.repeated.length || (b.closureRate || 0) - (a.closureRate || 0));

  const repeatAlerts = [];
  members.forEach((m) => {
    m.repeated.forEach((r) => {
      repeatAlerts.push({
        code: 'W_REPEAT_ADVICE',
        severity: SEVERITY.warn,
        member: m.member,
        category: r.category,
        count: r.count,
        message: '「' + m.member + '」的「' + r.category + '」类建议已出现 ' + r.count +
          ' 次仍未关闭——下一次点评应换一种练法，而不是重复提醒',
      });
    });
    if (m.stale) {
      repeatAlerts.push({
        code: 'W_STALE_OPEN',
        severity: SEVERITY.warn,
        member: m.member,
        message: '「' + m.member + '」自第 ' + m.oldestOpenMeeting + ' 次起有未关闭建议，已隔 ' +
          (latestMeeting - m.oldestOpenMeeting) + ' 期',
      });
    }
  });

  const totalItems = items.length;
  const doneItems = items.filter((i) => i.status === 'done').length;

  return {
    schema: 'feedback-loop/v1',
    ok: repeatAlerts.length === 0,
    summary: {
      items: totalItems,
      open: totalItems - doneItems,
      done: doneItems,
      closureRate: totalItems ? Number(((doneItems / totalItems) * 100).toFixed(1)) : null,
      members: members.length,
      latestMeeting: latestMeeting || null,
    },
    members,
    alerts: repeatAlerts,
    byCategory: categoryStats(items),
  };
}

function categoryStats(items) {
  const map = new Map();
  items.forEach((it) => {
    if (!map.has(it.category)) map.set(it.category, { category: it.category, total: 0, done: 0 });
    const c = map.get(it.category);
    c.total += 1;
    if (it.status === 'done') c.done += 1;
  });
  return [...map.values()]
    .map((c) => ({ ...c, closureRate: Number(((c.done / c.total) * 100).toFixed(1)) }))
    .sort((a, b) => b.total - a.total);
}

function toMarkdown(r) {
  const lines = [];
  lines.push('# 点评建议闭环');
  lines.push('');
  lines.push('| 指标 | 数值 |');
  lines.push('|---|---|');
  lines.push('| 建议条目 | ' + r.summary.items + ' |');
  lines.push('| 已关闭 / 未关闭 | ' + r.summary.done + ' / ' + r.summary.open + ' |');
  lines.push('| 关闭率 | ' + (r.summary.closureRate == null ? '—' : r.summary.closureRate + '%') + ' |');
  lines.push('| 涉及会员 | ' + r.summary.members + ' |');
  lines.push('');
  lines.push('## 按会员');
  lines.push('');
  lines.push('| 会员 | 建议数 | 未关闭 | 关闭率 | 最常见类别 | 重复出现 | 下一步焦点 |');
  lines.push('|---|--:|--:|--:|---|---|---|');
  r.members.forEach((m) => {
    lines.push('| ' + m.member + ' | ' + m.total + ' | ' + m.open + ' | ' +
      (m.closureRate == null ? '—' : m.closureRate + '%') + ' | ' +
      (m.topCategory ? m.topCategory.category + '×' + m.topCategory.count : '—') + ' | ' +
      (m.repeated.length ? m.repeated.map((x) => x.category + '×' + x.count).join('、') : '—') + ' | ' +
      (m.nextFocus || '—') + ' |');
  });
  if (r.alerts.length) {
    lines.push('');
    lines.push('## 需要干预');
    lines.push('');
    r.alerts.forEach((a) => lines.push('- ' + a.message));
  }
  if (r.byCategory.length) {
    lines.push('');
    lines.push('## 按类别');
    lines.push('');
    lines.push('| 类别 | 总数 | 已关闭 | 关闭率 |');
    lines.push('|---|--:|--:|--:|');
    r.byCategory.forEach((c) => lines.push('| ' + c.category + ' | ' + c.total + ' | ' + c.done + ' | ' + c.closureRate + '% |'));
  }
  return lines.join('\n');
}

module.exports = { analyze, toMarkdown };
