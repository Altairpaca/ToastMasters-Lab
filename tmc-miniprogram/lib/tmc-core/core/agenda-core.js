/* tmc-core/core/agenda-core.js
 * 议程内核：环节顺序 / 时间列公式 / 行结构 / 名称映射 / 名称中英组合。
 * 与 xlsx 保真导出耦合（提供替换表锚点），但自身是纯函数。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

const meetingModel = require('./meeting-model.js');

/** 环节类型的默认中文标题。 */
const TYPE_TITLE = {
  opening: '会议召集',
  facilitator: '赘词官环节',
  table_topics: '即兴演讲',
  prepared_speech: '备稿演讲',
  evaluation: '点评',
  workshop: '工作坊',
  report: '报告环节',
  voting: '投票环节',
  closing: '会议尾声',
};

/** 环节类型排序权重（用于规范议程顺序）。 */
const TYPE_ORDER = {
  opening: 10, facilitator: 20, prepared_speech: 30, table_topics: 40,
  workshop: 50, evaluation: 60, voting: 70, report: 80, closing: 90,
};

/**
 * 依据类型排序议程段（稳定排序，同类保持原相对顺序）。
 * @param {Array<Object>} agenda
 * @returns {Array<Object>}
 */
function sortAgenda(agenda) {
  const arr = Array.isArray(agenda) ? agenda.slice() : [];
  return arr
    .map(function (s, i) { return { s: s, i: i }; })
    .sort(function (a, b) {
      const oa = TYPE_ORDER[a.s.type] || 999;
      const ob = TYPE_ORDER[b.s.type] || 999;
      return oa === ob ? a.i - b.i : oa - ob;
    })
    .map(function (x) { return x.s; });
}

/**
 * "HH:MM" → 分钟数。
 * @param {string} hhmm
 * @returns {number}
 */
function toMin(hhmm) { return meetingModel.toMinutes(hhmm); }

/**
 * 分钟数 → "HH:MM"。
 * @param {number} min
 * @returns {string}
 */
function fromMin(min) {
  const m = ((Math.round(min) % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm;
}

/**
 * 生成时间列（每行起止时间）。含大环节缓冲（buffer_min）。
 * @param {string} startTime "HH:MM"
 * @param {Array<Object>} rows 行（每行需 duration_min、可选 buffer_min）
 * @returns {Array<{segment_id:string, start:string, end:string, duration_min:number}>}
 */
function timeColumn(startTime, rows) {
  const arr = Array.isArray(rows) ? rows : [];
  let cur = toMin(/^\d{2}:\d{2}$/.test(startTime) ? startTime : '19:15');
  return arr.map(function (r) {
    const dur = Number(r.duration_min) || 0;
    const buf = Number(r.buffer_min) || 0;
    const start = cur;
    const end = cur + dur + buf;
    cur = end;
    return {
      segment_id: r.segment_id || '',
      start: fromMin(start),
      end: fromMin(end),
      duration_min: dur + buf,
    };
  });
}

/**
 * 计算总时长（分钟，含缓冲）。
 * @param {Array<Object>} agenda
 * @returns {number}
 */
function totalMinutes(agenda) {
  return (Array.isArray(agenda) ? agenda : []).reduce(function (a, s) {
    return a + (Number(s.duration_min) || 0) + (Number(s.buffer_min) || 0);
  }, 0);
}

/**
 * 校验议程时间一致性：明细时长和 ≤ 大环节时长（PRD 缓冲规则）。
 * 这里以「会议总时长」为上限做整体校验，返回警告列表。
 * @param {Object} meeting
 * @returns {string[]} warnings
 */
function validateTiming(meeting) {
  const warnings = [];
  if (!meeting || typeof meeting !== 'object') return warnings;
  const total = totalMinutes(meeting.agenda);
  if (/^\d{2}:\d{2}$/.test(String(meeting.start_time)) && /^\d{2}:\d{2}$/.test(String(meeting.end_time))) {
    const limit = toMin(meeting.end_time) - toMin(meeting.start_time);
    if (total > limit) {
      warnings.push('议程总时长 ' + total + ' 分钟超过会议时段 ' + limit + ' 分钟');
    }
  }
  return warnings;
}

/**
 * 名称中英组合（中文名写正文，英文名写备注）。移植议程规则 §三.2。
 * @param {string} zh 中文名
 * @param {string} en 英文名
 * @returns {string}
 */
function nameWithEn(zh, en) {
  const z = (zh || '').trim();
  const e = (en || '').trim();
  if (z && e) return z + '(' + e + ')';
  return z || e || '';
}

/**
 * 构建行计划（RowPlan）：结合底稿锚点信息，输出每行应写入哪些单元格 + 时间列公式。
 * @param {Object} meeting 归一化后的 meeting
 * @param {Object} [anchors] 底稿锚点 { startTime?:string }
 * @returns {{rows:Array<Object>, timeCells:Array<Object>, totalMinutes:number}}
 */
function buildRows(meeting, anchors) {
  const m = meeting || {};
  const a = anchors || {};
  const agenda = sortAgenda(m.agenda);
  const times = timeColumn(a.startTime || m.start_time || '19:15', agenda);
  const rolesByName = {};
  (m.roles || []).forEach(function (r) {
    const key = r.role;
    rolesByName[key] = nameWithEn(r.name_zh, r.name_en);
  });

  const rows = agenda.map(function (s, i) {
    const t = times[i];
    const presenter = s.presenter ||
      (s.type === 'prepared_speech' ? rolesByName.speaker : '') ||
      (s.type === 'evaluation' ? rolesByName.evaluator : '') || '';
    return {
      segment_id: s.segment_id,
      type: s.type,
      title_zh: s.title_zh || TYPE_TITLE[s.type] || '',
      title_en: s.title_en || '',
      presenter: presenter,
      time: t ? (t.start + '-' + t.end) : '',
      duration_min: t ? t.duration_min : (Number(s.duration_min) || 0),
    };
  });

  return { rows: rows, timeCells: times, totalMinutes: totalMinutes(agenda) };
}

/**
 * 行插入 checklist：对比底稿行数与新议程行数，输出需要插入/删除的行数建议。
 * @param {number} baseRows 底稿已有数据行数
 * @param {number} newRows 新议程行数
 * @returns {{insert:number, remove:number, note:string}}
 */
function rowDiffChecklist(baseRows, newRows) {
  const b = Math.max(0, Number(baseRows) || 0);
  const n = Math.max(0, Number(newRows) || 0);
  let note;
  if (n > b) note = '需在底稿中插入 ' + (n - b) + ' 行（复制相邻行样式保真）';
  else if (n < b) note = '需删除底稿中多余 ' + (b - n) + ' 行';
  else note = '行数一致，仅替换单元格内容';
  return { insert: Math.max(0, n - b), remove: Math.max(0, b - n), note: note };
}

module.exports = {
  TYPE_TITLE: TYPE_TITLE,
  TYPE_ORDER: TYPE_ORDER,
  sortAgenda: sortAgenda,
  timeColumn: timeColumn,
  totalMinutes: totalMinutes,
  validateTiming: validateTiming,
  nameWithEn: nameWithEn,
  buildRows: buildRows,
  rowDiffChecklist: rowDiffChecklist,
  fromMin: fromMin,
  toMin: toMin,
};
