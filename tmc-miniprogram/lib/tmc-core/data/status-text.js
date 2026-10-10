/* tmc-core/data/status-text.js
 * 计时状态文案（中英双语集中管理，UI 引用而非硬编码）。
 * 移植自 universal-timer.html 的 STATUS_TEXT。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

/** 计时状态 → 双语文案 */
const STATUS_TEXT = {
  under: { zh: '时间不足', en: 'Under time' },
  ok: { zh: '合格', en: 'Qualified' },
  over: { zh: '超时', en: 'Over time' },
};

/** 灯色文案（三色灯 UI 用） */
const LIGHT_TEXT = {
  none: { zh: '就绪', en: 'Ready' },
  green: { zh: '已达最短合格时间', en: 'Minimum reached' },
  yellow: { zh: '注意时间', en: 'Watch the time' },
  red: { zh: '时间到，请收尾', en: 'Time is up, please wrap up' },
  over: { zh: '已超时', en: 'Over time' },
};

/**
 * 取状态文案，未知状态回退 ok。
 * @param {string} status 'under'|'ok'|'over'
 * @returns {{zh:string, en:string}}
 */
function statusText(status) {
  return STATUS_TEXT[status] || STATUS_TEXT.ok;
}

module.exports = {
  STATUS_TEXT: STATUS_TEXT,
  LIGHT_TEXT: LIGHT_TEXT,
  statusText: statusText,
};
