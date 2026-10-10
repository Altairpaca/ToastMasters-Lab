/* tmc-core/app/officer-service.js
 * M10 · 三官应用服务：会中记录（计时/哼哈/语法）→ 报告 → PNG/JSON 导出。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

const timerCore = require('../core/timer-core.js');
const reportKernel = require('../core/report-kernel.js');
const imageKernel = require('../core/image-kernel.js');
const meetingModel = require('../core/meeting-model.js');
const { DEFAULT_WORDS, DEFAULT_AH_SETTINGS } = require('../data/wordlist-ah.js');

/**
 * 创建三官服务。
 * @param {Object} deps { storage:StoragePort, canvas:CanvasPort, clock:ClockPort, file:FilePort }
 * @returns {Object} OfficerService
 */
function createOfficerService(deps) {
  const storage = (deps && deps.storage) || null;
  const canvas = (deps && deps.canvas) || null;
  const clock = (deps && deps.clock) || null;
  const file = (deps && deps.file) || null;

  // 会话态记录（内存）
  const session = {
    timerRecords: [],          // [{speaker, role, time, status, overBy, green, red}]
    ahRecords: [],             // [{member_id, counts, minutes}]
    grammarianRecords: [],     // [{member_id, good_phrases, corrections, wod_count}]
    words: DEFAULT_WORDS.map(function (w) { return { w: w.w, cls: w.cls, lang: w.lang, gloss: w.gloss }; }),
    ahSettings: Object.assign({}, DEFAULT_AH_SETTINGS),
    meta: { meetingName: 'Toastmasters Meeting', date: '' },
    seg: null,                 // { total, elapsed, ended }
    stopwatch: null,
  };

  return {
    /** 设置会议元信息（会议名/日期）。 */
    setMeta: function (meta) {
      const m = meta || {};
      if (typeof m.meetingName === 'string') session.meta.meetingName = m.meetingName;
      if (typeof m.date === 'string') session.meta.date = m.date;
    },

    /** 取会议元信息。 */
    getMeta: function () { return Object.assign({}, session.meta); },

    /** 设置环节总计时（平行倒计时）。 */
    setSegment: function (totalSec) {
      session.seg = { total: Math.max(0, Math.round(totalSec || 0)), elapsed: 0, ended: false };
    },
    /** 更新环节已用时长。 */
    updateSegment: function (elapsedSec, ended) {
      if (!session.seg) return;
      session.seg.elapsed = Math.max(0, Math.round(elapsedSec || 0));
      if (typeof ended === 'boolean') session.seg.ended = ended;
    },
    /** 取环节计时。 */
    getSegment: function () { return session.seg ? Object.assign({}, session.seg) : null; },

    /**
     * 开始一个环节的计时（创建秒表）。
     * @param {string} segId
     * @param {number} plannedMin 计划时长（分钟）
     */
    startSegment: function (segId, plannedMin) {
      session.stopwatch = timerCore.createStopwatch(clock || { now: function () { return Date.now(); } });
      session.stopwatch.start();
      session.current = { segment_id: segId, planned_min: Number(plannedMin) || 0 };
    },

    /** 计时秒表（用于每帧读取）。 */
    stopwatch: function () { return session.stopwatch; },

    /** 重置当前秒表（暂停并清零），保留实例。 */
    stopwatchReset: function () {
      if (session.stopwatch) session.stopwatch.reset();
    },

    /**
     * 记录一条计时结果（结束当前环节）。
     * @param {Object} entry { segment_id?, planned_min?, status?, actual_sec?, speaker?, role?, green?, red? }
     * @returns {Object} 记录
     */
    recordTimer: function (entry) {
      const e = entry || {};
      const cur = session.current || {};
      const segId = e.segment_id || cur.segment_id || ('seg-' + (session.timerRecords.length + 1));
      const plannedMin = (typeof e.planned_min === 'number') ? e.planned_min : (cur.planned_min || 0);
      const green = (typeof e.green === 'number') ? e.green : Math.round(plannedMin * 60) - 60;
      const red = (typeof e.red === 'number') ? e.red : Math.round(plannedMin * 60);
      let actual = e.actual_sec;
      if (typeof actual !== 'number') {
        actual = session.stopwatch ? session.stopwatch.seconds() : 0;
      }
      const status = e.status || timerCore.judgeStatus(actual, green, red);
      const rec = {
        segment_id: segId,
        planned_min: plannedMin,
        speaker: e.speaker || '（未命名）',
        role: e.role || ('环节 ' + segId),
        time: actual,
        status: status,
        overBy: status === 'over' ? actual - red : 0,
        green: green,
        red: red,
      };
      session.timerRecords.push(rec);
      session.current = null;
      return rec;
    },

    /** 删除第 i 条计时记录。 */
    deleteTimer: function (i) {
      if (i >= 0 && i < session.timerRecords.length) session.timerRecords.splice(i, 1);
    },

    /** 清空计时记录。 */
    clearTimer: function () { session.timerRecords = []; },

    /** 取计时记录（副本）。 */
    getTimerRecords: function () { return session.timerRecords.slice(); },

    // ---- 哼哈官 ----
    /** 添加/设置一个讲者的赘词计数。 */
    bumpAh: function (memberId, word, delta) {
      const id = String(memberId || '（未命名）');
      let rec = session.ahRecords.find(function (r) { return r.member_id === id; });
      if (!rec) { rec = { member_id: id, counts: {}, minutes: 0 }; session.ahRecords.push(rec); }
      const key = String(word);
      rec.counts[key] = Math.max(0, (rec.counts[key] || 0) + (delta === undefined ? 1 : delta));
      return rec;
    },
    /** 设置讲者发言分钟数（用于频率计算）。 */
    setAhMinutes: function (memberId, minutes) {
      const id = String(memberId || '（未命名）');
      let rec = session.ahRecords.find(function (r) { return r.member_id === id; });
      if (!rec) { rec = { member_id: id, counts: {}, minutes: 0 }; session.ahRecords.push(rec); }
      rec.minutes = Math.max(0, Number(minutes) || 0);
      return rec;
    },
    /** 取哼哈记录。 */
    getAhRecords: function () { return session.ahRecords.slice(); },
    /** 设置哼哈词表。 */
    setAhWords: function (words) { if (Array.isArray(words)) session.words = words.slice(); },
    /** 取哼哈词表。 */
    getAhWords: function () { return session.words.slice(); },
    /** 设置哼哈阈值。 */
    setAhSettings: function (s) { session.ahSettings = Object.assign({}, session.ahSettings, s || {}); },

    // ---- 语法官 ----
    /** 添加语法官记录。 */
    addGrammarian: function (entry) {
      const e = entry || {};
      const id = String(e.member_id || '（未命名）');
      let rec = session.grammarianRecords.find(function (r) { return r.member_id === id; });
      if (!rec) { rec = { member_id: id, good_phrases: [], corrections: [], wod_count: 0 }; session.grammarianRecords.push(rec); }
      if (e.good) rec.good_phrases.push(String(e.good));
      if (e.correction) rec.corrections.push(String(e.correction));
      if (e.wod) rec.wod_count += 1;
      return rec;
    },
    /** 取语法官记录。 */
    getGrammarianRecords: function () { return session.grammarianRecords.slice(); },

    /**
     * 生成指定类型的报告视图模型。
     * @param {'timer'|'ah'|'grammarian'} kind
     * @returns {Object} ReportViewModel
     */
    getReport: function (kind) {
      if (kind === 'ah') {
        return reportKernel.buildAhReport(session.ahRecords, {
          meetingName: session.meta.meetingName, date: session.meta.date,
          words: session.words, settings: session.ahSettings,
        });
      }
      if (kind === 'grammarian') {
        return reportKernel.buildGrammarianReport(session.grammarianRecords, {
          meetingName: session.meta.meetingName, date: session.meta.date,
        });
      }
      return reportKernel.buildTimerReport(session.timerRecords, {
        meetingName: session.meta.meetingName, date: session.meta.date, seg: session.seg,
      });
    },

    /**
     * 导出报告为 PNG（经 CanvasPort），返回 dataURL / 文件路径。
     * @param {Object} vm ReportViewModel
     * @returns {Promise<string>}
     */
    exportPng: function (vm) {
      const c = imageKernel.render(vm, canvas, { scale: 2 });
      if (!c) return Promise.reject(new Error('CanvasPort 未注入或不可用'));
      return Promise.resolve(c.toDataURL ? c.toDataURL('image/png') : '');
    },

    /**
     * 把三官记录汇总为 officers_records（写入 meeting.json 结构）。
     * @param {Object} [base] 基础 meeting（可选）
     * @returns {Object} meeting
     */
    exportJson: function (base) {
      const m = meetingModel.normalize(base || {});
      m.officers_records.timer = session.timerRecords.map(function (r) {
        return {
          segment_id: r.segment_id,
          planned_min: r.planned_min,
          actual_sec: r.time,
          status: r.status === 'ok' ? 'green' : (r.status === 'under' ? 'green' : 'red'),
        };
      });
      m.officers_records.ah_counter = session.ahRecords.map(function (r) {
        const top = Object.keys(r.counts).sort(function (a, b) { return r.counts[b] - r.counts[a]; }).slice(0, 3);
        return { member_id: r.member_id, counts: Object.assign({}, r.counts), top3: top };
      });
      m.officers_records.grammarian = session.grammarianRecords.map(function (r) {
        return { member_id: r.member_id, good_phrases: r.good_phrases.slice(), corrections: r.corrections.slice() };
      });
      if (session.meta.meetingName) m.theme.zh = m.theme.zh || session.meta.meetingName;
      return m;
    },

    /** 直接导出到 JSON 文件（经 FilePort）。 */
    exportJsonFile: function (base) {
      if (!file) return Promise.reject(new Error('FilePort 未注入'));
      const m = this.exportJson(base);
      const name = 'meeting_' + (m.meeting_id || 'export') + '.json';
      return file.save(name, JSON.stringify(m, null, 2), 'application/json');
    },
  };
}

module.exports = { createOfficerService: createOfficerService };
