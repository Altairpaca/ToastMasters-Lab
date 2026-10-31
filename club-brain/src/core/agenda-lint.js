'use strict';

/**
 * agenda-lint · 议程规则断言引擎
 *
 * 设计原则：不生成，只验真。生成器可以很笨，校验器必须很严。
 * 对应创新点：AG-001 时间线断言 / AG-002 三态人员 / AG-003 字数闸 /
 *             AG-004 备注禁英文名 / AG-029 完整性评分 / AG-049 合规自检 / AG-089 规则回归
 */

const { parseHHMM, fmtHHMM, weekdayOf, WEEKDAY_ZH, displayWidth, hasCJK } = require('./util');

const SEVERITY = { error: 'error', warn: 'warn', info: 'info' };
const PENALTY = { error: 8, warn: 3, info: 1 };

/** 各类环节的合理时长区间（分钟） */
const DURATION_BOUNDS = {
  opening: [3, 10],
  facilitator: [5, 20],
  speech: [4, 20],
  break: [5, 20],
  tabletopics: [10, 45],
  workshop: [15, 90],
  report: [5, 20],
  special: [2, 30],
  vote: [3, 15],
  closing: [2, 10],
};

/** 项目要求的合并单元格可容纳字数（B:G 约 41–42 中文字） */
const REQUIREMENT_MAX_WIDTH = 42;

/** 单场会议单人最多兼任角色数 */
const MAX_ROLES_PER_PERSON = 2;

const REQUIRED_FIELDS = ['date', 'start', 'segments'];

function issue(code, severity, message, extra) {
  return Object.assign({ code, severity, message }, extra || {});
}

/** 按顺序累加，得到每段的起止时间 */
function buildTimeline(meeting) {
  let cursor = parseHHMM(meeting.start);
  return (meeting.segments || []).map((seg, idx) => {
    const minutes = Number(seg.minutes) || 0;
    const start = cursor;
    cursor += minutes;
    return {
      index: idx,
      id: seg.id || 'seg' + (idx + 1),
      name: seg.name || '',
      kind: seg.kind || 'special',
      minutes,
      start,
      end: cursor,
      startText: fmtHHMM(start),
      endText: fmtHHMM(cursor),
      owner: seg.owner || '',
    };
  });
}

/** 统计每人承担的角色数 */
function collectAssignments(meeting) {
  const acc = new Map();
  const add = (person, role) => {
    if (!person) return;
    const key = String(person).trim();
    if (!key) return;
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key).push(role);
  };
  (meeting.segments || []).forEach((s) => {
    // 备稿环节的负责人就是演讲人，已由 speeches 统计，跳过以免重复计数
    if (s.kind === 'speech') return;
    add(s.owner, s.name || s.kind || '环节');
  });
  (meeting.speeches || []).forEach((s) => {
    add(s.speaker, '备稿');
    add(s.evaluator, '点评');
  });
  return acc;
}

function checkDateFormat(meeting, opts, out) {
  const wd = weekdayOf(meeting.date);
  if (Number.isNaN(wd)) {
    out.push(issue('E_DATE_FORMAT', SEVERITY.error, '日期格式应为 YYYY-MM-DD，当前：' + meeting.date, { field: 'date' }));
    return;
  }
  if (meeting.weekday != null && meeting.weekday !== '') {
    const declared = String(meeting.weekday).trim();
    const expected = WEEKDAY_ZH[wd];
    const expectsNum = /^\d$/.test(declared);
    const ok = expectsNum ? Number(declared) === wd : declared === expected;
    if (!ok) {
      out.push(issue('E_WEEKDAY_MISMATCH', SEVERITY.error,
        '日期与星期不符：' + meeting.date + ' 实际是 ' + expected + '，但写的是 ' + declared,
        { field: 'weekday' }));
    }
  }
  if (opts.today) {
    const today = weekdayOf(opts.today);
    if (!Number.isNaN(today) && meeting.date < opts.today) {
      out.push(issue('I_PAST_DATE', SEVERITY.info, '会议日期早于今天（' + opts.today + '）', { field: 'date' }));
    }
  }
}

function checkTimeline(timeline, meeting, opts, out) {
  const startMin = parseHHMM(meeting.start);
  const endMin = parseHHMM(meeting.end || opts.defaultEnd || '21:30');
  if (Number.isNaN(startMin)) {
    out.push(issue('E_START_FORMAT', SEVERITY.error, '开始时间格式应为 HH:MM', { field: 'start' }));
    return { startMin, endMin, lastEnd: NaN };
  }
  if (Number.isNaN(endMin)) {
    out.push(issue('E_END_FORMAT', SEVERITY.error, '结束时间格式应为 HH:MM', { field: 'end' }));
    return { startMin, endMin, lastEnd: NaN };
  }
  const lastEnd = timeline.length ? timeline[timeline.length - 1].end : startMin;
  if (lastEnd > endMin) {
    out.push(issue('E_END_OVERRUN', SEVERITY.error,
      '总时长超出：按当前环节累加将在 ' + fmtHHMM(lastEnd) + ' 结束，超过预定 ' + fmtHHMM(endMin) +
      '（超 ' + (lastEnd - endMin) + ' 分钟）',
      { field: 'segments', overrunMinutes: lastEnd - endMin }));
  } else {
    const slack = endMin - lastEnd;
    if (slack <= 2) {
      out.push(issue('W_NO_BUFFER', SEVERITY.warn, '没有缓冲：全部环节排满后只剩 ' + slack + ' 分钟余量', { field: 'segments' }));
    } else if (slack >= 20) {
      out.push(issue('W_TOO_LOOSE', SEVERITY.warn, '余量过大：还剩 ' + slack + ' 分钟未安排，可加环节或延长互动', { field: 'segments' }));
    }
  }
  timeline.forEach((seg) => {
    if (seg.minutes <= 0) {
      out.push(issue('E_ZERO_MINUTES', SEVERITY.error, '环节「' + seg.name + '」时长为 0', { field: seg.id }));
      return;
    }
    const bounds = DURATION_BOUNDS[seg.kind];
    if (bounds && (seg.minutes < bounds[0] || seg.minutes > bounds[1])) {
      out.push(issue('W_DURATION_RANGE', SEVERITY.warn,
        '环节「' + seg.name + '」时长 ' + seg.minutes + ' 分钟，超出该类型常见区间 ' +
        bounds[0] + '–' + bounds[1] + ' 分钟', { field: seg.id }));
    }
  });
  return { startMin, endMin, lastEnd };
}

function checkPeople(meeting, opts, out) {
  const roster = opts.roster;
  const names = roster && roster.members ? new Set(roster.members.map((m) => String(m.name).trim())) : null;
  const aliasMap = new Map();
  if (roster && roster.members) {
    roster.members.forEach((m) => {
      (m.aliases || []).forEach((a) => aliasMap.set(String(a).trim(), m.name));
      if (m.english) aliasMap.set(String(m.english).trim(), m.name);
    });
  }
  const known = (name) => {
    const key = String(name || '').trim();
    if (!key) return true;
    if (names && names.has(key)) return true;
    if (aliasMap.has(key)) return true;
    return !names; // 未提供花名册时不做判断
  };

  (meeting.segments || []).forEach((seg) => {
    if (seg.owner && !known(seg.owner)) {
      out.push(issue('E_UNKNOWN_PERSON', SEVERITY.error, '环节「' + seg.name + '」负责人「' + seg.owner + '」不在花名册', { field: seg.id }));
    }
    if (seg.ownerStatus === 'pending' || seg.status === 'pending') {
      out.push(issue('E_PENDING_IN_MAIN', SEVERITY.error,
        '环节「' + seg.name + '」负责人「' + (seg.owner || '空') + '」仍是待确认状态，不得进入正式名单',
        { field: seg.id }));
    }
    if (seg.ownerStatus === 'omitted' && seg.owner) {
      out.push(issue('I_OMITTED_HAS_OWNER', SEVERITY.info, '环节「' + seg.name + '」标记为主动省略却填了负责人', { field: seg.id }));
    }
  });

  (meeting.speeches || []).forEach((sp, i) => {
    const tag = sp.id || 'speech' + (i + 1);
    if (!sp.speaker) {
      out.push(issue('E_SPEECH_NO_SPEAKER', SEVERITY.error, '第 ' + (i + 1) + ' 篇备稿没有演讲人', { field: tag }));
    } else if (!known(sp.speaker)) {
      out.push(issue('E_UNKNOWN_PERSON', SEVERITY.error, '演讲人「' + sp.speaker + '」不在花名册', { field: tag }));
    }
    if (!sp.evaluator) {
      out.push(issue('E_SPEECH_NO_EVALUATOR', SEVERITY.error, '第 ' + (i + 1) + ' 篇备稿没有点评人', { field: tag }));
    } else if (!known(sp.evaluator)) {
      out.push(issue('E_UNKNOWN_PERSON', SEVERITY.error, '点评人「' + sp.evaluator + '」不在花名册', { field: tag }));
    }
    if (sp.speaker && sp.evaluator && String(sp.speaker).trim() === String(sp.evaluator).trim()) {
      out.push(issue('E_SELF_EVAL', SEVERITY.error, '「' + sp.speaker + '」自己点评自己', { field: tag }));
    }
    if (sp.status === 'pending') {
      out.push(issue('E_PENDING_IN_MAIN', SEVERITY.error, '备稿「' + (sp.title || sp.speaker) + '」仍为待确认', { field: tag }));
    }
  });

  if (names) {
    const counts = collectAssignments(meeting);
    counts.forEach((roles, person) => {
      if (roles.length > MAX_ROLES_PER_PERSON) {
        out.push(issue('E_TOO_MANY_ROLES', SEVERITY.error,
          '「' + person + '」一场担任 ' + roles.length + ' 个角色（' + roles.join('、') + '），上限 ' + MAX_ROLES_PER_PERSON,
          { field: person }));
      }
    });
  }
}

function checkSpeechDetail(meeting, out) {
  const speeches = meeting.speeches || [];
  speeches.forEach((sp, i) => {
    const tag = sp.id || 'speech' + (i + 1);
    if (sp.requirement) {
      const w = displayWidth(sp.requirement);
      if (w > REQUIREMENT_MAX_WIDTH) {
        out.push(issue('E_REQUIREMENT_TOO_LONG', SEVERITY.error,
          '项目要求 ' + w.toFixed(1) + ' 字，超过 B:G 合并单元格上限 ' + REQUIREMENT_MAX_WIDTH +
          ' 字，会被裁成三行：' + sp.requirement.slice(0, 20) + '…',
          { field: tag }));
      }
    }
    const minutes = Number(sp.minutes) || 0;
    if (minutes && (minutes < 4 || minutes > 20)) {
      out.push(issue('W_SPEECH_MINUTES', SEVERITY.warn, '备稿「' + (sp.title || sp.speaker || tag) + '」时长 ' + minutes + ' 分钟异常', { field: tag }));
    }
    const evalMinutes = Number(sp.evalMinutes) || 0;
    if (evalMinutes && evalMinutes < 3) {
      out.push(issue('W_EVAL_TOO_SHORT', SEVERITY.warn, '点评时长 ' + evalMinutes + ' 分钟偏短（建议 ≥3）', { field: tag }));
    }
    if (i > 0) {
      const prev = speeches[i - 1];
      const a = Number(prev.level) || 0;
      const b = Number(sp.level) || 0;
      if (a && b && b < a) {
        out.push(issue('W_SPEECH_ORDER', SEVERITY.warn,
          '备稿顺序应按等级升序：「' + (prev.title || prev.speaker) + '」(L' + a + ') 排在「' +
          (sp.title || sp.speaker) + '」(L' + b + ') 之前', { field: tag }));
      }
    }
  });
  const needEval = speeches.filter((s) => s.speaker && !s.evaluator).length;
  if (needEval === 0 && speeches.length > 0) {
    const evalCount = new Set(speeches.map((s) => s.evaluator).filter(Boolean)).size;
    if (evalCount !== speeches.length) {
      out.push(issue('I_EVAL_REUSE', SEVERITY.info,
        speeches.length + ' 篇备稿只有 ' + evalCount + ' 位点评人，存在一人评多篇', { field: 'speeches' }));
    }
  }
}

function checkNotes(meeting, out) {
  const notes = meeting.notes || [];
  const isZh = (meeting.language || 'zh') === 'zh';
  notes.forEach((note, i) => {
    const text = typeof note === 'string' ? note : note.text || '';
    if (!isZh || !text) return;
    // 中文例会备注列不应出现英文名/拼音名
    const latin = text.match(/[A-Za-z][A-Za-z'’-]{1,}/g) || [];
    const suspicious = latin.filter((w) => !/^(OK|AI|PPT|DCP|ID|QR|URL|VIP|MC)$/i.test(w));
    if (suspicious.length && hasCJK(text)) {
      out.push(issue('E_ENGLISH_IN_NOTES', SEVERITY.error,
        '中文例会备注列出现英文名/拼音「' + suspicious.join('、') + '」，应按规则留空：' + text.slice(0, 24),
        { field: 'notes[' + i + ']' }));
    }
  });
}

function checkTableTopics(meeting, timeline, out) {
  const seg = timeline.find((s) => s.kind === 'tabletopics');
  const count = Number(meeting.tableTopicsCount);
  if (!seg || !count) return;
  const expected = 5 + 2 * count;
  if (Math.abs(seg.minutes - expected) > 2) {
    out.push(issue('W_TT_FORMULA', SEVERITY.warn,
      '即兴环节 ' + seg.minutes + ' 分钟，按「5 + 2×' + count + ' 人」应为 ' + expected + ' 分钟',
      { field: seg.id }));
  }
  if (count > 0 && seg.minutes < 6) {
    out.push(issue('W_TT_TOO_SHORT', SEVERITY.warn, '即兴点评时间可能不足（环节仅 ' + seg.minutes + ' 分钟）', { field: seg.id }));
  }
}

function checkMeetingNo(meeting, opts, out) {
  if (!opts.expectedNo || !meeting.meetingNo) return;
  if (Number(meeting.meetingNo) !== Number(opts.expectedNo)) {
    out.push(issue('E_MEETING_NO', SEVERITY.error,
      '期号不符：议程写第 ' + meeting.meetingNo + ' 次，按上期推算应为第 ' + opts.expectedNo + ' 次',
      { field: 'meetingNo' }));
  }
}

function checkStructure(meeting, out) {
  REQUIRED_FIELDS.forEach((f) => {
    const v = meeting[f];
    const empty = v == null || v === '' || (Array.isArray(v) && v.length === 0);
    if (empty) {
      out.push(issue('E_MISSING_FIELD', SEVERITY.error, '缺少必填字段：' + f, { field: f }));
    }
  });
  const kinds = (meeting.segments || []).map((s) => s.kind);
  const order = ['opening', 'facilitator', 'speech', 'break', 'tabletopics', 'workshop', 'report', 'special', 'vote', 'closing'];
  let lastPos = -1;
  (meeting.segments || []).forEach((seg) => {
    const pos = order.indexOf(seg.kind);
    if (pos === -1) return;
    if (pos < lastPos) {
      out.push(issue('W_ORDER', SEVERITY.warn,
        '环节顺序异常：「' + seg.name + '」出现在不应出现的位置（标准顺序：召集→开场→促进者→备稿→休息→下半场→报告→特殊→投票→谢幕）',
        { field: seg.id }));
    } else {
      lastPos = pos;
    }
  });
  if (!kinds.includes('opening') && !kinds.includes('facilitator')) {
    out.push(issue('I_NO_WARMUP', SEVERITY.info, '没有开场或促进者环节，新人可能不知道流程', { field: 'segments' }));
  }
}

/**
 * 主入口
 * @param {object} meeting 议程数据
 * @param {object} [options] { roster, expectedNo, today, defaultEnd }
 */
function lintAgenda(meeting, options) {
  const opts = Object.assign({ defaultEnd: '21:30' }, options || {});
  const out = [];
  const data = meeting || {};

  checkStructure(data, out);
  checkDateFormat(data, opts, out);
  const timeline = buildTimeline(data);
  const span = checkTimeline(timeline, data, opts, out);
  checkPeople(data, opts, out);
  checkSpeechDetail(data, out);
  checkNotes(data, out);
  checkTableTopics(data, timeline, out);
  checkMeetingNo(data, opts, out);

  const rank = { error: 0, warn: 1, info: 2 };
  out.sort((a, b) => rank[a.severity] - rank[b.severity] || a.code.localeCompare(b.code));

  const counts = { error: 0, warn: 0, info: 0 };
  out.forEach((i) => { counts[i.severity] += 1; });
  const score = Math.max(0, 100 - counts.error * PENALTY.error - counts.warn * PENALTY.warn - counts.info * PENALTY.info);

  return {
    schema: 'agenda-lint/v1',
    meetingNo: data.meetingNo || null,
    date: data.date || null,
    ok: counts.error === 0,
    score,
    counts,
    issues: out,
    timeline,
    totals: {
      segments: timeline.length,
      plannedMinutes: timeline.reduce((a, s) => a + s.minutes, 0),
      startText: Number.isNaN(span.startMin) ? '' : fmtHHMM(span.startMin),
      endText: Number.isNaN(span.lastEnd) ? '' : fmtHHMM(span.lastEnd),
      deadlineText: Number.isNaN(span.endMin) ? '' : fmtHHMM(span.endMin),
      slackMinutes: Number.isNaN(span.endMin) || Number.isNaN(span.lastEnd) ? null : span.endMin - span.lastEnd,
      speeches: (data.speeches || []).length,
    },
  };
}

function toMarkdown(report) {
  const lines = [];
  lines.push('# 议程体检报告' + (report.meetingNo ? ' · 第 ' + report.meetingNo + ' 次' : ''));
  lines.push('');
  lines.push('| 项目 | 结果 |');
  lines.push('|---|---|');
  lines.push('| 日期 | ' + (report.date || '—') + ' |');
  lines.push('| 结论 | ' + (report.ok ? '✅ 通过' : '❌ 阻断') + ' |');
  lines.push('| 评分 | ' + report.score + ' / 100 |');
  lines.push('| 问题 | ' + report.counts.error + ' 错误 / ' + report.counts.warn + ' 告警 / ' + report.counts.info + ' 提示 |');
  lines.push('| 时长 | ' + report.totals.startText + '–' + report.totals.endText +
    '（截止 ' + report.totals.deadlineText + '，余 ' + (report.totals.slackMinutes == null ? '—' : report.totals.slackMinutes) + ' 分钟） |');
  lines.push('| 备稿 | ' + report.totals.speeches + ' 篇 |');
  lines.push('');
  if (!report.issues.length) {
    lines.push('未发现问题。');
    return lines.join('\n');
  }
  lines.push('## 问题清单');
  lines.push('');
  lines.push('| 级别 | 代码 | 说明 |');
  lines.push('|---|---|---|');
  const label = { error: '❌ 错误', warn: '⚠️ 告警', info: 'ℹ️ 提示' };
  report.issues.forEach((i) => {
    lines.push('| ' + label[i.severity] + ' | `' + i.code + '` | ' + i.message.replace(/\|/g, '\\|') + ' |');
  });
  return lines.join('\n');
}

function toHtml(report) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const color = { error: '#d9363e', warn: '#d48806', info: '#1677ff' };
  const rows = report.timeline.map((s) => '<tr><td>' + s.startText + '–' + s.endText + '</td><td>' + esc(s.name) +
    '</td><td class="num">' + s.minutes + "'</td><td>" + esc(s.owner || '—') + '</td></tr>').join('');
  const issues = report.issues.map((i) => '<li class="' + i.severity + '"><code>' + i.code + '</code> ' + esc(i.message) + '</li>').join('');
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>议程体检 · ${esc(report.date || '')}</title>
<style>
:root{--bg:#0f1115;--fg:#e6e6e6;--muted:#9aa0a6;--line:#262a31;--card:#171a20}
*{box-sizing:border-box}
body{margin:0;padding:32px;background:var(--bg);color:var(--fg);font:15px/1.7 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
h1{font-size:22px;margin:0 0 4px}
.sub{color:var(--muted);font-size:13px;margin-bottom:24px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:24px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px}
.card .k{color:var(--muted);font-size:12px}
.card .v{font-size:20px;font-weight:600;margin-top:4px}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}
th,td{padding:8px 12px;border-bottom:1px solid var(--line);text-align:left;font-size:14px}
th{color:var(--muted);font-weight:500;font-size:12px}
td.num{font-variant-numeric:tabular-nums}
ul.issues{list-style:none;padding:0;margin:0}
ul.issues li{background:var(--card);border:1px solid var(--line);border-left:3px solid;border-radius:8px;padding:10px 14px;margin-bottom:8px}
li.error{border-left-color:${color.error}}li.warn{border-left-color:${color.warn}}li.info{border-left-color:${color.info}}
code{background:#20242c;padding:1px 6px;border-radius:4px;font-size:12px;color:#9ecbff}
.pass{color:#3fb950}.fail{color:#f85149}
</style></head><body>
<h1>议程体检报告${report.meetingNo ? ' · 第 ' + esc(report.meetingNo) + ' 次' : ''}</h1>
<div class="sub">${esc(report.date || '')}　·　生成于 agenda-lint v1</div>
<div class="grid">
  <div class="card"><div class="k">结论</div><div class="v ${report.ok ? 'pass' : 'fail'}">${report.ok ? '通过' : '阻断'}</div></div>
  <div class="card"><div class="k">评分</div><div class="v">${report.score}</div></div>
  <div class="card"><div class="k">错误 / 告警 / 提示</div><div class="v">${report.counts.error} · ${report.counts.warn} · ${report.counts.info}</div></div>
  <div class="card"><div class="k">结束时间（截止 ${esc(report.totals.deadlineText)}）</div><div class="v">${esc(report.totals.endText)}</div></div>
</div>
<h2 style="font-size:16px">时间线</h2>
<table><thead><tr><th>时间</th><th>环节</th><th>时长</th><th>负责人</th></tr></thead><tbody>${rows}</tbody></table>
<h2 style="font-size:16px;margin-top:28px">问题清单（${report.issues.length}）</h2>
<ul class="issues">${issues || '<li class="info">未发现问题</li>'}</ul>
</body></html>`;
}

module.exports = { lintAgenda, buildTimeline, toMarkdown, toHtml, DURATION_BOUNDS, REQUIREMENT_MAX_WIDTH };
