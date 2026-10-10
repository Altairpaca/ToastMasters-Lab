/* tmc-core/app/agenda-service.js
 * M8 · 议程应用服务：会前制表用例编排（依赖注入 ports）。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

const meetingModel = require('../core/meeting-model.js');
const agendaCore = require('../core/agenda-core.js');
const reportKernel = require('../core/report-kernel.js');

/**
 * 创建议程服务。
 * @param {Object} deps { storage:StoragePort, file:FilePort }
 * @returns {Object} AgendaService
 */
function createAgendaService(deps) {
  const storage = (deps && deps.storage) || null;
  const file = (deps && deps.file) || null;

  const service = {
    /**
     * 构建议程计划（排序 + 时间列 + 行结构）。
     * @param {Object} meeting
     * @param {Object} [opts] { templateId?:string, anchors?:Object }
     * @returns {Object} AgendaPlan
     */
    buildAgenda: function (meeting, opts) {
      const o = opts || {};
      const m = meetingModel.normalize(meeting);
      const built = agendaCore.buildRows(m, o.anchors || {});
      const warnings = agendaCore.validateTiming(m);
      return {
        meetingId: m.meeting_id,
        templateId: o.templateId || 'default',
        rows: built.rows,
        timeCells: built.timeCells,
        totalMinutes: built.totalMinutes,
        warnings: warnings,
      };
    },

    /**
     * 议程预览 → 报告视图模型（可渲染 HTML/Markdown/文本）。
     * @param {Object} plan AgendaPlan
     * @returns {Object} ReportViewModel
     */
    preview: function (plan) {
      const rows = (plan && plan.rows) || [];
      const vmRows = rows.map(function (r, i) {
        return {
          cells: [String(i + 1), r.title_zh, r.presenter || '—', r.time, String(r.duration_min) + '′'],
          st: '',
        };
      });
      return {
        kind: 'agenda',
        title: { zh: '议程预览', en: 'AGENDA PREVIEW' },
        headers: ['#', '环节 Segment', '呈现者 Presenter', '时间 Time', '时长 Duration'],
        aligns: ['right', 'left', 'left', 'left', 'right'],
        rows: vmRows,
        summary: '共 ' + rows.length + ' 个环节，预计总时长 ' + ((plan && plan.totalMinutes) || 0) + ' 分钟。',
        meta: { meetingName: (plan && plan.meetingId) || '', date: '' },
        extra: (plan && plan.warnings && plan.warnings.length)
          ? [{ label: '时间校验', text: plan.warnings.join('；') }] : [],
        footer: 'Agenda 议程自动生成。',
      };
    },

    /**
     * 导出 agenda 为 JSON 文件（经 FilePort）。
     * @param {Object} plan
     * @returns {Promise<void>}
     */
    exportJson: function (plan) {
      if (!file) return Promise.reject(new Error('FilePort 未注入'));
      const name = 'agenda_' + ((plan && plan.meetingId) || 'meeting') + '.json';
      return file.save(name, JSON.stringify(plan, null, 2), 'application/json');
    },

    /**
     * 构建 xlsx 替换表（供 xlsxWriter.patch 使用）。
     * 纯计算，不产生字节；真实写盘由 xlsx-writer 完成。
     * @param {Object} plan AgendaPlan
     * @param {number} startRow 底稿数据起始行（1-based）
     * @param {number} startCol 底稿起始列（0-based，A=0）
     * @returns {Array<Object>} CellEdit[]
     */
    buildCellEdits: function (plan, startRow, startCol) {
      const edits = [];
      const r0 = Math.max(1, Number(startRow) || 2);
      const c0 = Math.max(0, Number(startCol) || 0);
      ((plan && plan.rows) || []).forEach(function (r, i) {
        const row = r0 + i;
        edits.push({ sheet: 'sheet1', ref: colRef(c0, row), value: r.title_zh || '', isFormula: false });
        edits.push({ sheet: 'sheet1', ref: colRef(c0 + 1, row), value: r.presenter || '', isFormula: false });
        edits.push({ sheet: 'sheet1', ref: colRef(c0 + 2, row), value: r.time || '', isFormula: false });
      });
      return edits;
    },
  };

  return service;
}

/**
 * 0-based 列号 → 列字母（A/B.../AA）。
 * @param {number} c
 * @returns {string}
 */
function colLetter(c) {
  let n = c + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * 生成 A1 引用。
 * @param {number} c 0-based 列
 * @param {number} row 1-based 行
 * @returns {string}
 */
function colRef(c, row) { return colLetter(c) + row; }

module.exports = {
  createAgendaService: createAgendaService,
  colLetter: colLetter,
  colRef: colRef,
};
