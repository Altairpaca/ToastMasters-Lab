'use strict';

/**
 * meeting-retro · 三官数据 → 结构化复盘
 *
 * 三官（计时/哼哈/语法官）每期都在产出数据，但几乎没有人把它变成可累积的档案。
 * 本模块把零散记录规范成一份 retro.json，并算出个人趋势与本期结论。
 * 对应创新点：OF-029 三官数据入档 / OF-030 个人成长曲线 / OF-046 计划vs实测 / ME-078 会议质量
 */

function num(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? n : (d || 0);
}

function pct(a, b) {
  if (!b) return null;
  return Number(((a / b) * 100).toFixed(1));
}

/**
 * @param {object} input { meetingNo, date, timing[], ah[], grammar{}, ratings[], attendance{} }
 * @param {object} [options] { history[] }
 */
function buildRetro(input, options) {
  const data = input || {};
  const opts = options || {};
  const timing = Array.isArray(data.timing) ? data.timing : [];
  const ah = Array.isArray(data.ah) ? data.ah : [];

  const segments = timing.map((t, i) => {
    const planned = num(t.planned);
    const actual = num(t.actual);
    const delta = actual - planned;
    return {
      index: i + 1,
      segment: t.segment || '环节' + (i + 1),
      speaker: t.speaker || '（全场）',
      planned,
      actual,
      delta,
      deviationPct: pct(delta, planned),
      status: t.status || (delta > 0 ? 'over' : delta < 0 ? 'under' : 'on'),
    };
  });

  const overruns = segments.filter((s) => s.delta > 0).sort((a, b) => b.delta - a.delta);

  // —— 按人汇总 ——
  const byPerson = new Map();
  segments.forEach((s) => {
    const key = s.speaker;
    if (!byPerson.has(key)) {
      byPerson.set(key, { speaker: key, segments: 0, planned: 0, actual: 0, delta: 0, over: 0, ah: {} });
    }
    const p = byPerson.get(key);
    p.segments += 1;
    p.planned += s.planned;
    p.actual += s.actual;
    p.delta += s.delta;
    if (s.delta > 0) p.over += 1;
  });
  ah.forEach((a) => {
    const key = a.speaker || '（未标注）';
    if (!byPerson.has(key)) {
      byPerson.set(key, { speaker: key, segments: 0, planned: 0, actual: 0, delta: 0, over: 0, ah: {} });
    }
    const p = byPerson.get(key);
    Object.entries(a.counts || {}).forEach(([word, c]) => {
      p.ah[word] = (p.ah[word] || 0) + num(c);
    });
  });

  const persons = [...byPerson.values()].map((p) => {
    const ahTotal = Object.values(p.ah).reduce((s, v) => s + v, 0);
    const top = Object.entries(p.ah).sort((a, b) => b[1] - a[1])[0];
    return {
      speaker: p.speaker,
      segments: p.segments,
      plannedMinutes: p.planned,
      actualMinutes: p.actual,
      deltaMinutes: p.delta,
      overCount: p.over,
      onTimeRate: p.segments ? Number(((p.segments - p.over) / p.segments * 100).toFixed(1)) : null,
      ahTotal,
      ahPerMinute: p.actual ? Number((ahTotal / p.actual).toFixed(2)) : null,
      topFiller: top ? { word: top[0], count: top[1] } : null,
    };
  }).sort((a, b) => b.ahTotal - a.ahTotal || b.deltaMinutes - a.deltaMinutes);

  // —— 评分 ——
  const plannedTotal = segments.reduce((s, x) => s + x.planned, 0);
  const actualTotal = segments.reduce((s, x) => s + x.actual, 0);
  const overPenalty = Math.min(60, overruns.reduce((s, x) => s + x.delta * 0.8, 0));
  const ahTotalAll = persons.reduce((s, p) => s + p.ahTotal, 0);
  const ahPenalty = Math.min(25, ahTotalAll * 0.3);
  const punctuality = Math.max(0, Math.round(100 - overPenalty - ahPenalty));

  // —— 自动结论 ——
  const insights = [];
  if (overruns.length) {
    const worst = overruns[0];
    insights.push('最大超时：' + worst.segment + '（' + worst.speaker + '）计划 ' + worst.planned +
      ' 分钟，实测 ' + worst.actual + ' 分钟，超 ' + worst.delta + ' 分钟' +
      (worst.deviationPct != null ? '（+' + worst.deviationPct + '%）' : ''));
  } else if (segments.length) {
    insights.push('全场无超时，节奏控制良好');
  }
  if (plannedTotal) {
    insights.push('全场计划 ' + plannedTotal + ' 分钟，实测 ' + actualTotal + ' 分钟，偏差 ' +
      (actualTotal - plannedTotal >= 0 ? '+' : '') + (actualTotal - plannedTotal) + ' 分钟（' +
      pct(actualTotal - plannedTotal, plannedTotal) + '%）');
  }
  const fillerKing = persons.filter((p) => p.ahTotal > 0)[0];
  if (fillerKing) {
    insights.push('赘词最多：' + fillerKing.speaker + ' 共 ' + fillerKing.ahTotal + ' 次' +
      (fillerKing.topFiller ? '，高频词「' + fillerKing.topFiller.word + '」' + fillerKing.topFiller.count + ' 次' : '') +
      (fillerKing.ahPerMinute != null ? '，每分钟 ' + fillerKing.ahPerMinute + ' 次' : ''));
  }
  const grammar = data.grammar || {};
  if ((grammar.issues || []).length) {
    insights.push('语法官标记 ' + grammar.issues.length + ' 处问题，好词好句 ' + (grammar.good || []).length + ' 条');
  }

  // —— 历史趋势 ——
  let trend = null;
  if (Array.isArray(opts.history) && opts.history.length) {
    const prev = opts.history[opts.history.length - 1];
    trend = {
      prevMeetingNo: prev.meetingNo || null,
      prevPunctuality: prev.punctuality ?? null,
      deltaPunctuality: prev.punctuality != null ? punctuality - prev.punctuality : null,
      prevActualMinutes: prev.actualMinutes ?? null,
      deltaActualMinutes: prev.actualMinutes != null ? actualTotal - prev.actualMinutes : null,
    };
  }

  return {
    schema: 'meeting-retro/v1',
    meetingNo: data.meetingNo || null,
    date: data.date || null,
    attendance: data.attendance || null,
    totals: {
      segments: segments.length,
      plannedMinutes: plannedTotal,
      actualMinutes: actualTotal,
      deltaMinutes: actualTotal - plannedTotal,
      overruns: overruns.length,
      ahTotal: ahTotalAll,
    },
    punctuality,
    segments,
    persons,
    grammar: {
      good: grammar.good || [],
      issues: grammar.issues || [],
    },
    ratings: data.ratings || [],
    insights,
    trend,
  };
}

function toMarkdown(r) {
  const lines = [];
  lines.push('# 会议复盘 · 第 ' + (r.meetingNo || '—') + ' 次（' + (r.date || '—') + '）');
  lines.push('');
  lines.push('| 指标 | 数值 |');
  lines.push('|---|---|');
  lines.push('| 准时度 | ' + r.punctuality + ' / 100 |');
  lines.push('| 计划 / 实测 | ' + r.totals.plannedMinutes + ' / ' + r.totals.actualMinutes + ' 分钟 |');
  lines.push('| 偏差 | ' + (r.totals.deltaMinutes >= 0 ? '+' : '') + r.totals.deltaMinutes + ' 分钟 |');
  lines.push('| 超时环节 | ' + r.totals.overruns + ' 个 |');
  lines.push('| 赘词总计 | ' + r.totals.ahTotal + ' 次 |');
  lines.push('');
  lines.push('## 环节偏差');
  lines.push('');
  lines.push('| 环节 | 负责人 | 计划 | 实测 | 偏差 |');
  lines.push('|---|---|--:|--:|--:|');
  r.segments.forEach((s) => {
    lines.push('| ' + s.segment + ' | ' + s.speaker + ' | ' + s.planned + ' | ' + s.actual +
      ' | ' + (s.delta >= 0 ? '+' : '') + s.delta + ' |');
  });
  lines.push('');
  lines.push('## 个人表现');
  lines.push('');
  lines.push('| 人 | 时长段 | 计划 | 实测 | 超时次数 | 准时率 | 赘词 | 每分钟 | 高频词 |');
  lines.push('|---|--:|--:|--:|--:|--:|--:|--:|---|');
  r.persons.forEach((p) => {
    lines.push('| ' + p.speaker + ' | ' + p.segments + ' | ' + p.plannedMinutes + ' | ' + p.actualMinutes +
      ' | ' + p.overCount + ' | ' + (p.onTimeRate == null ? '—' : p.onTimeRate + '%') + ' | ' + p.ahTotal +
      ' | ' + (p.ahPerMinute == null ? '—' : p.ahPerMinute) + ' | ' +
      (p.topFiller ? p.topFiller.word + '×' + p.topFiller.count : '—') + ' |');
  });
  if (r.insights.length) {
    lines.push('');
    lines.push('## 结论');
    lines.push('');
    r.insights.forEach((i) => lines.push('- ' + i));
  }
  if (r.trend) {
    lines.push('');
    lines.push('## 与上期对比');
    lines.push('');
    lines.push('- 准时度 ' + (r.trend.deltaPunctuality >= 0 ? '+' : '') + r.trend.deltaPunctuality + ' 分');
    lines.push('- 总时长 ' + (r.trend.deltaActualMinutes >= 0 ? '+' : '') + r.trend.deltaActualMinutes + ' 分钟');
  }
  return lines.join('\n');
}

module.exports = { buildRetro, toMarkdown };
