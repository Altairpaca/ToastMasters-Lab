'use strict';

/**
 * member-profile · 跨期会员成长档案
 *
 * 单场复盘告诉你"这次谁超时了"，档案回答的是"这个人三期下来在变好还是变差"。
 * 输入是全部会议数据，输出是每个会员的行为画像 + 一个下一步焦点。
 *
 * 对应创新点：OF-030 个人成长曲线 / MB-017 会员档案卡 / DT-017 留存曲线
 */

function num(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? n : (d || 0);
}

function emptyProfile(name) {
  return {
    name,
    meetings: 0,
    roles: {},
    speeches: 0,
    evaluations: 0,
    minutes: 0,
    plannedMinutes: 0,
    overCount: 0,
    timedSegments: 0,
    ahTotal: 0,
    ahByWord: {},
    firstDate: null,
    lastDate: null,
    dates: [],
  };
}

/** 这人在这场会里担任了什么 */
function rolesIn(meeting, name) {
  const roles = [];
  (meeting.segments || []).forEach((seg) => {
    if (seg.owner === name && seg.kind !== 'speech') roles.push(seg.name || seg.kind);
  });
  (meeting.speeches || []).forEach((sp) => {
    if (sp.speaker === name) roles.push('备稿演讲');
    if (sp.evaluator === name) roles.push('点评');
  });
  return roles;
}

/**
 * @param {object} input { members: [{name}], meetings: [...] }
 * @returns {{profiles: Array, club: object}}
 */
function buildProfiles(input) {
  const members = (input && input.members) || [];
  const meetings = ((input && input.meetings) || []).slice()
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const byName = new Map();
  members.forEach((m) => {
    if (m && m.name) byName.set(m.name, emptyProfile(m.name));
  });

  const ensure = (name) => {
    if (!byName.has(name)) byName.set(name, emptyProfile(name));
    return byName.get(name);
  };

  meetings.forEach((mt) => {
    const records = mt.records || {};
    const timing = records.timing || [];
    const ah = records.ah || {};
    const touched = new Set();

    (mt.segments || []).forEach((seg) => { if (seg.owner && seg.kind !== 'speech') touched.add(seg.owner); });
    (mt.speeches || []).forEach((sp) => {
      if (sp.speaker) touched.add(sp.speaker);
      if (sp.evaluator) touched.add(sp.evaluator);
    });
    Object.keys(ah).forEach((p) => touched.add(p));
    timing.forEach((t) => { if (t.speaker) touched.add(t.speaker); });

    touched.forEach((name) => {
      const p = ensure(name);
      p.meetings += 1;
      p.dates.push(mt.date);
      if (!p.firstDate) p.firstDate = mt.date;
      p.lastDate = mt.date;
      rolesIn(mt, name).forEach((r) => { p.roles[r] = (p.roles[r] || 0) + 1; });
    });

    (mt.speeches || []).forEach((sp) => {
      if (sp.speaker) {
        const p = ensure(sp.speaker);
        p.speeches += 1;
      }
      if (sp.evaluator) {
        const p = ensure(sp.evaluator);
        p.evaluations += 1;
      }
    });

    timing.forEach((t) => {
      if (!t.speaker) return;
      const p = ensure(t.speaker);
      const planned = num(t.planned);
      const actual = num(t.actual);
      p.timedSegments += 1;
      p.plannedMinutes += planned;
      p.minutes += actual;
      if (actual > planned) p.overCount += 1;
    });

    Object.entries(ah).forEach(([name, counts]) => {
      const p = ensure(name);
      Object.entries(counts || {}).forEach(([word, c]) => {
        p.ahTotal += num(c);
        p.ahByWord[word] = (p.ahByWord[word] || 0) + num(c);
      });
    });
  });

  const profiles = [...byName.values()].map((p) => {
    const onTimeRate = p.timedSegments ? Number((((p.timedSegments - p.overCount) / p.timedSegments) * 100).toFixed(1)) : null;
    const avgDelta = p.timedSegments ? Number(((p.minutes - p.plannedMinutes) / p.timedSegments).toFixed(2)) : null;
    const ahPerMinute = p.minutes ? Number((p.ahTotal / p.minutes).toFixed(2)) : null;
    const distinctRoles = Object.keys(p.roles).length;
    const topWord = Object.entries(p.ahByWord).sort((a, b) => b[1] - a[1])[0];
    const roleList = Object.entries(p.roles).sort((a, b) => b[1] - a[1]).map(([role, count]) => ({ role, count }));

    // 下一步焦点：只给一条，避免"什么都要改"
    let focus = null;
    let focusReason = '';
    if (p.timedSegments >= 2 && onTimeRate !== null && onTimeRate < 70) {
      focus = '时长控制';
      focusReason = '准时率 ' + onTimeRate + '%，平均每段' + (avgDelta > 0 ? '超 ' : '省 ') + Math.abs(avgDelta) + ' 分钟';
    } else if (ahPerMinute !== null && ahPerMinute >= 3) {
      focus = '赘词';
      focusReason = '每分钟 ' + ahPerMinute + ' 次，高频词「' + (topWord ? topWord[0] : '—') + '」';
    } else if (distinctRoles < 2 && p.meetings >= 3) {
      focus = '角色广度';
      focusReason = '连续 ' + p.meetings + ' 期只做同一类角色，建议换一个挑战';
    } else if (p.speeches === 0 && p.meetings >= 3) {
      focus = '备稿';
      focusReason = '已参与 ' + p.meetings + ' 期但还没有备稿记录';
    } else {
      focus = '下一级项目';
      focusReason = '基础表现稳定，可以推进 Pathways 的下一个项目';
    }

    return {
      name: p.name,
      meetings: p.meetings,
      firstDate: p.firstDate,
      lastDate: p.lastDate,
      speeches: p.speeches,
      evaluations: p.evaluations,
      minutes: Number(p.minutes.toFixed(1)),
      plannedMinutes: Number(p.plannedMinutes.toFixed(1)),
      timedSegments: p.timedSegments,
      overCount: p.overCount,
      onTimeRate,
      avgDelta,
      ahTotal: p.ahTotal,
      ahPerMinute,
      topWord: topWord ? { word: topWord[0], count: topWord[1] } : null,
      distinctRoles,
      roles: roleList,
      focus,
      focusReason,
    };
  }).sort((a, b) => b.meetings - a.meetings || b.timedSegments - a.timedSegments);

  const active = profiles.filter((p) => p.meetings > 0 || p.ahTotal > 0);
  const timed = profiles.filter((p) => p.timedSegments > 0);
  const bestOnTime = timed.slice().sort((a, b) => (b.onTimeRate || 0) - (a.onTimeRate || 0))[0] || null;
  const worstOnTime = timed.slice().sort((a, b) => (a.onTimeRate || 0) - (b.onTimeRate || 0))[0] || null;
  const mostFillers = profiles.slice().sort((a, b) => b.ahTotal - a.ahTotal)[0] || null;
  const mostVersatile = profiles.slice().sort((a, b) => b.distinctRoles - a.distinctRoles)[0] || null;

  return {
    schema: 'member-profile/v1',
    profiles,
    club: {
      members: members.length,
      activeMembers: active.length,
      meetings: meetings.length,
      range: meetings.length ? { from: meetings[0].date, to: meetings[meetings.length - 1].date } : null,
      avgOnTimeRate: timed.length
        ? Number((timed.reduce((s, p) => s + (p.onTimeRate || 0), 0) / timed.length).toFixed(1))
        : null,
      totalAh: profiles.reduce((s, p) => s + p.ahTotal, 0),
      bestOnTime: bestOnTime ? { name: bestOnTime.name, rate: bestOnTime.onTimeRate } : null,
      worstOnTime: worstOnTime ? { name: worstOnTime.name, rate: worstOnTime.onTimeRate } : null,
      mostFillers: mostFillers && mostFillers.ahTotal ? { name: mostFillers.name, total: mostFillers.ahTotal } : null,
      mostVersatile: mostVersatile && mostVersatile.distinctRoles
        ? { name: mostVersatile.name, roles: mostVersatile.distinctRoles } : null,
    },
  };
}

function toMarkdown(result) {
  const lines = [];
  const c = result.club;
  lines.push('# 会员成长档案');
  lines.push('');
  if (c.range) lines.push('统计区间：' + c.range.from + ' ~ ' + c.range.to + '　·　' + c.meetings + ' 场　·　' + c.activeMembers + ' 位活跃会员');
  lines.push('');
  if (c.bestOnTime) lines.push('- 最守时：**' + c.bestOnTime.name + '**（' + c.bestOnTime.rate + '%）');
  if (c.worstOnTime) lines.push('- 最需注意时长：**' + c.worstOnTime.name + '**（' + c.worstOnTime.rate + '%）');
  if (c.mostFillers) lines.push('- 赘词最多：**' + c.mostFillers.name + '**（' + c.mostFillers.total + ' 次）');
  if (c.mostVersatile) lines.push('- 角色最广：**' + c.mostVersatile.name + '**（' + c.mostVersatile.roles + ' 类）');
  lines.push('');
  lines.push('| 会员 | 参与 | 备稿 | 点评 | 准时率 | 平均偏差 | 赘词 | 每分钟 | 角色数 | 下一步 |');
  lines.push('|---|--:|--:|--:|--:|--:|--:|--:|--:|---|');
  result.profiles.forEach((p) => {
    lines.push('| ' + p.name + ' | ' + p.meetings + ' | ' + p.speeches + ' | ' + p.evaluations + ' | ' +
      (p.onTimeRate == null ? '—' : p.onTimeRate + '%') + ' | ' +
      (p.avgDelta == null ? '—' : (p.avgDelta > 0 ? '+' : '') + p.avgDelta) + ' | ' +
      p.ahTotal + ' | ' + (p.ahPerMinute == null ? '—' : p.ahPerMinute) + ' | ' +
      p.distinctRoles + ' | ' + (p.focus || '—') + ' |');
  });
  lines.push('');
  lines.push('## 逐人建议');
  lines.push('');
  result.profiles.filter((p) => p.meetings > 0).forEach((p) => {
    lines.push('- **' + p.name + '**：' + p.focusReason);
  });
  return lines.join('\n');
}

module.exports = { buildProfiles, toMarkdown };
