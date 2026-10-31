'use strict';

/**
 * club-brain · 头马俱乐部运营工具集
 * 零依赖 / 离线可用 / 纯函数内核
 *
 * 作者：Altair Li <altairpaca@gmail.com>
 * 许可：MIT
 */

const { lintAgenda, buildTimeline, toMarkdown: agendaMd, toHtml: agendaHtml } = require('./core/agenda-lint');
const { lintBrand, toMarkdown: brandMd, colorDistance, contrastRatio } = require('./core/brand-lint');
const { schedule, costOf, toMarkdown: scheduleMd } = require('./core/role-scheduler');
const { buildRetro, toMarkdown: retroMd } = require('./core/meeting-retro');
const { trackDcp, toMarkdown: dcpMd, DEFAULT_GOALS } = require('./core/dcp-tracker');
const util = require('./core/util');

module.exports = {
  // 议程
  lintAgenda,
  buildTimeline,
  agendaMd,
  agendaHtml,
  // 品牌
  lintBrand,
  brandMd,
  colorDistance,
  contrastRatio,
  // 排班
  schedule,
  costOf,
  scheduleMd,
  // 复盘
  buildRetro,
  retroMd,
  // DCP
  trackDcp,
  dcpMd,
  DEFAULT_GOALS,
  // 工具
  util,
  version: require('../package.json').version,
};
