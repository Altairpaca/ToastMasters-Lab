/* tmc-core/core/report-kernel.js
 * 报告内核：记录数据 → 报告视图模型 → HTML / Markdown / 纯文本。
 * 移植 universal-timer.html 的 generateReport / generateReportMarkdown /
 * colorizeStatus，并扩展哼哈官 / 语法官报告。纯函数，无宿主依赖。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

const md = require('./md-renderer.js');
const timer = require('./timer-core.js');
const { STATUS_TEXT } = require('../data/status-text.js');

/**
 * 视图模型统一形状：
 * {
 *   kind: 'timer'|'ah'|'grammarian',
 *   title: { zh, en },       // 报告标题（双语）
 *   headers: string[],        // 表头
 *   aligns: string[],         // 每列对齐
 *   rows: Array<{ cells:string[], st?:string }>,   // st 用于状态列着色
 *   summary: string,          // 总结行（Markdown 片段）
 *   meta: { meetingName, date },
 *   extra: Array<{ label:string, text:string }>,   // 额外块（如环节计时）
 *   footer: string,          // 署名（Markdown 斜体）
 * }
 */

/**
 * 状态文案 → 双语。
 * @param {string} st
 * @returns {{zh:string,en:string}}
 */
function stText(st) { return STATUS_TEXT[st] || STATUS_TEXT.ok; }

/**
 * 构造计时官报告视图模型。
 * @param {Array<Object>} records 记录 [{speaker, role, time, status, overBy, green, red}]
 * @param {Object} meta { meetingName, date, seg? }
 * @returns {Object} ReportViewModel
 */
function buildTimerReport(records, meta) {
  const recs = Array.isArray(records) ? records : [];
  const m = meta || {};
  const seg = m.seg || null;
  const rows = recs.map(function (r, i) {
    const st = stText(r.status);
    let t = timer.formatTime(r.time);
    if (r.status === 'over' && r.overBy > 0) t += ' (+' + timer.formatTime(r.overBy) + ')';
    else if (r.status === 'under') t += ' (-' + timer.formatTime((r.green || 0) - r.time) + ')';
    return { cells: [String(i + 1), r.speaker, r.role, t, st.zh + ' ' + st.en], st: r.status };
  });
  const okCount = recs.filter(function (r) { return r.status === 'ok'; }).length;
  const pct = recs.length ? Math.round(okCount / recs.length * 100) : 0;
  const extra = [];
  if (seg && seg.total > 0) {
    const segOver = seg.elapsed > seg.total;
    extra.push({
      label: '环节计时 Segment',
      text: '限时 ' + timer.formatTime(seg.total) + '，实际 ' + timer.formatTime(seg.elapsed) +
        (segOver ? '，超时 +' + timer.formatTime(seg.elapsed - seg.total) : '，未超时') +
        (seg.ended ? '' : '（进行中）') + '。',
    });
  }
  return {
    kind: 'timer',
    title: { zh: '计时员报告', en: "TIMER'S REPORT" },
    headers: ['#', '姓名 Speaker', '角色 Role', '用时 Time', '状态 Status'],
    aligns: ['right', 'left', 'left', 'right', 'left'],
    rows: rows,
    summary: '共 ' + recs.length + ' 位演讲者，' + okCount + ' 位在合格时间内完成，合格率 **' + pct + '%**。',
    meta: { meetingName: m.meetingName || 'Toastmasters Meeting', date: m.date || '' },
    extra: extra,
    footer: 'Reported by Timer 计时员汇报完毕。',
  };
}

/**
 * 构造哼哈官报告视图模型。
 * @param {Array<Object>} records [{
 *   member_id, counts:{word:count}, top3?:string[],
 *   threshold?:{word:number}, minutes?:number
 * }]
 * @param {Object} meta { meetingName, date, words?:Array, settings?:{fTh,oTh} }
 * @returns {Object} ReportViewModel
 */
function buildAhReport(records, meta) {
  const recs = Array.isArray(records) ? records : [];
  const m = meta || {};
  const words = Array.isArray(m.words) ? m.words : [];
  const settings = m.settings || { fTh: 3, oTh: 5 };
  const clsOf = {};
  words.forEach(function (w) { clsOf[w.w] = w.cls; });

  const rows = recs.map(function (r, i) {
    const counts = r.counts || {};
    const total = Object.keys(counts).reduce(function (a, k) { return a + (Number(counts[k]) || 0); }, 0);
    // 取该讲者达标词（超过对应阈值）作为「高频赘词」
    const hot = Object.keys(counts).filter(function (w) {
      const th = clsOf[w] === 'overused' ? settings.oTh : settings.fTh;
      return (counts[w] || 0) >= th;
    }).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 3);
    const rate = (r.minutes && r.minutes > 0) ? (total / r.minutes) : 0;
    return {
      cells: [String(i + 1), r.member_id || '（未命名）', String(total),
        hot.length ? hot.join('、') : '—',
        r.minutes ? (Math.round(rate * 10) / 10) + ' 次/分' : '—'],
      st: '',
    };
  });
  const totalFillers = recs.reduce(function (a, r) {
    return a + Object.keys(r.counts || {}).reduce(function (b, k) { return b + (Number(r.counts[k]) || 0); }, 0);
  }, 0);
  const clean = recs.filter(function (r) {
    return Object.keys(r.counts || {}).every(function (w) {
      const th = clsOf[w] === 'overused' ? settings.oTh : settings.fTh;
      return (r.counts[w] || 0) < th;
    });
  }).map(function (r) { return r.member_id; });

  return {
    kind: 'ah',
    title: { zh: '哼哈官报告', en: "AH-COUNTER'S REPORT" },
    headers: ['#', '讲者 Speaker', '总赘词 Total', '高频赘词 Top', '频率 Rate'],
    aligns: ['right', 'left', 'right', 'left', 'right'],
    rows: rows,
    summary: '共 ' + recs.length + ' 位讲者，累计赘词 ' + totalFillers + ' 次；' +
      (clean.length ? '表现干净：' + clean.join('、') + '。' : '无人零赘词。'),
    meta: { meetingName: m.meetingName || 'Toastmasters Meeting', date: m.date || '' },
    extra: [],
    footer: 'Reported by Ah-Counter 哼哈官汇报完毕。',
  };
}

/**
 * 构造语法官报告视图模型。
 * @param {Array<Object>} records [{ member_id, good_phrases:string[], corrections:string[], wod_count?:number }]
 * @param {Object} meta { meetingName, date, word?:{word,pos,defEn,defZh} }
 * @returns {Object} ReportViewModel
 */
function buildGrammarianReport(records, meta) {
  const recs = Array.isArray(records) ? records : [];
  const m = meta || {};
  const w = m.word || {};
  const rows = recs.map(function (r, i) {
    return {
      cells: [String(i + 1), r.member_id || '（未命名）', String(r.wod_count || 0),
        (r.good_phrases && r.good_phrases.length) ? r.good_phrases.join('；') : '—',
        (r.corrections && r.corrections.length) ? r.corrections.join('；') : '—'],
      st: '',
    };
  });
  const totalWod = recs.reduce(function (a, r) { return a + (Number(r.wod_count) || 0); }, 0);
  const goods = recs.reduce(function (a, r) { return a + ((r.good_phrases || []).length); }, 0);
  const fixes = recs.reduce(function (a, r) { return a + ((r.corrections || []).length); }, 0);
  const extra = [];
  if (w.word) {
    extra.push({
      label: '每日一词 Word of the Day',
      text: '"' + w.word + '" (' + (w.pos || '') + ') — ' + (w.defEn || '') + (w.defZh ? ' ' + w.defZh : ''),
    });
  }
  return {
    kind: 'grammarian',
    title: { zh: '语法官报告', en: "GRAMMARIAN'S REPORT" },
    headers: ['#', '发言者 Speaker', '每日一词 WoD', '精彩表达 Good', '可改进 Improve'],
    aligns: ['right', 'left', 'right', 'left', 'left'],
    rows: rows,
    summary: recs.length + ' 位发言者 · 每日一词使用 ' + totalWod + ' 次 · 妙语 ' + goods + ' 条 · 改进 ' + fixes + ' 条。',
    meta: { meetingName: m.meetingName || 'Toastmasters Meeting', date: m.date || '' },
    extra: extra,
    footer: 'Reported by Grammarian 语法官汇报完毕。',
  };
}

/**
 * 视图模型 → Markdown（GFM 表格）。
 * @param {Object} vm ReportViewModel
 * @returns {string}
 */
function toMarkdown(vm) {
  const L = [];
  L.push('# ' + vm.title.en + ' ' + vm.title.zh);
  L.push('');
  L.push('**' + vm.meta.meetingName + '** ｜ ' + (vm.meta.date || ''));
  L.push('');
  L.push('| ' + vm.headers.join(' | ') + ' |');
  L.push('|' + vm.aligns.map(function (a) {
    if (a === 'right') return '---:';
    if (a === 'center') return ':---:';
    if (a === 'left') return ':---';
    return '---';
  }).join('|') + '|');
  vm.rows.forEach(function (r) {
    L.push('| ' + r.cells.join(' | ') + ' |');
  });
  L.push('');
  L.push('**总结 Summary**：' + vm.summary);
  (vm.extra || []).forEach(function (e) {
    L.push('');
    L.push('**' + e.label + '**：' + e.text);
  });
  L.push('');
  L.push('---');
  L.push('');
  L.push('*' + vm.footer + '*');
  return L.join('\n');
}

/**
 * 视图模型 → 纯文本（定宽 ASCII，兼容老习惯）。
 * @param {Object} vm
 * @returns {string}
 */
function toPlain(vm) {
  const L = [];
  L.push(vm.title.en + ' ' + vm.title.zh);
  L.push(vm.meta.meetingName + ' | ' + (vm.meta.date || ''));
  L.push('');
  L.push(vm.headers.join(' | '));
  L.push(vm.headers.map(function (h) { return '-'.repeat(Math.max(2, h.length)); }).join('-|-'));
  vm.rows.forEach(function (r) { L.push(r.cells.join(' | ')); });
  L.push('');
  L.push('Summary 总结: ' + vm.summary);
  (vm.extra || []).forEach(function (e) { L.push(e.label + ': ' + e.text); });
  L.push(vm.footer);
  return L.join('\n');
}

/**
 * 视图模型 → HTML（转义防注入，表格带 class）。
 * @param {Object} vm
 * @returns {string}
 */
function toHtml(vm) {
  return md.toHtml(toMarkdown(vm));
}

/**
 * 计算单元格着色（视图模型后处理，供 DOM / WXML 复用）。
 * 规则与 colorizeStatus 一致：状态列以「合格/超时/时间不足」开头 → 套胶囊 class。
 * @param {Object} vm
 * @returns {Array<{row:number, col:number, cls:string}>}
 */
function colorizeCells(vm) {
  const out = [];
  const statusCol = vm.headers.findIndex(function (h) { return h.indexOf('状态') >= 0 || h.indexOf('Status') >= 0; });
  if (statusCol < 0) return out;
  vm.rows.forEach(function (r, ri) {
    const t = r.cells[statusCol] || '';
    let cls = '';
    if (t.indexOf('合格') === 0 || t.indexOf('Qualified') === 0) cls = 'st-ok';
    else if (t.indexOf('超时') === 0 || t.indexOf('Over') === 0) cls = 'st-over';
    else if (t.indexOf('时间不足') === 0 || t.indexOf('Under') === 0) cls = 'st-under';
    if (cls) out.push({ row: ri, col: statusCol, cls: cls });
  });
  return out;
}

module.exports = {
  buildTimerReport: buildTimerReport,
  buildAhReport: buildAhReport,
  buildGrammarianReport: buildGrammarianReport,
  toMarkdown: toMarkdown,
  toPlain: toPlain,
  toHtml: toHtml,
  colorizeCells: colorizeCells,
};
