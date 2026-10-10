/* tmc-server-lite/routes/reports.js
 * 报告相关路由：POST /api/reports/:kind 用内核生成报告视图模型。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

const path = require('path');

/**
 * 解析 tmc-core 的 report-kernel：
 * 依次尝试 ① 作为依赖包 ② 同级 ../tmc-core 目录，保证本地开发零配置可用。
 * @returns {Object|null}
 */
function resolveReportKernel() {
  const candidates = [
    'tmc-core/core/report-kernel.js',
    path.join(__dirname, '..', '..', 'tmc-core', 'core', 'report-kernel.js'),
  ];
  for (let i = 0; i < candidates.length; i += 1) {
    try { return require(candidates[i]); } catch (e) { /* 尝试下一个 */ }
  }
  return null;
}

const reportKernel = resolveReportKernel();

/**
 * 创建报告路由处理器集合。
 * @param {Object} deps { core?:Object } core 为 tmc-core/index.js 导出的模块
 * @returns {Object} 路由表
 */
function createReportRoutes(deps) {
  const core = (deps && deps.core) || null;
  const kernel = (core && core.report) || reportKernel;

  return {
    /**
     * POST /api/reports/:kind
     * body: { timerRecords?:[], ahRecords?:[], grammarianRecords?:[], meta?:{} }
     * @returns {{status:number, body:Object}}
     */
    generate: function (params, body) {
      if (!kernel) {
        return { status: 503, body: { ok: false, error: 'kernel_unavailable' } };
      }
      const b = body || {};
      const meta = b.meta || {};
      let vm = null;
      if (params.kind === 'ah') {
        vm = kernel.buildAhReport(b.ahRecords || [], meta);
      } else if (params.kind === 'grammarian') {
        vm = kernel.buildGrammarianReport(b.grammarianRecords || [], meta);
      } else if (params.kind === 'timer') {
        vm = kernel.buildTimerReport(b.timerRecords || [], meta);
      } else {
        return { status: 400, body: { ok: false, error: 'unknown_kind' } };
      }
      return { status: 200, body: { ok: true, data: vm } };
    },
  };
}

module.exports = { createReportRoutes: createReportRoutes };
