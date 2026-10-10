/* tmc-miniprogram/pages/report/report.js
 * 报告页：选择三官类型，调用 OfficerService.getReport 生成报告视图模型。
 * 使用 report-view 组件渲染；导出走 FilePort（离线可用）。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

const app = getApp();

const KINDS = [
  { key: 'timer', label: '时间官' },
  { key: 'ah', label: '哼哈官' },
  { key: 'grammarian', label: '语法官' },
];

Page({
  data: {
    kinds: KINDS,
    kind: 'timer',
    vm: null,
    md: '',
    view: 'render', // render | markdown
  },

  onLoad: function () {
    this.build();
  },

  onKind: function (e) {
    this.setData({ kind: e.currentTarget.dataset.key });
    this.build();
  },

  onView: function (e) {
    this.setData({ view: e.currentTarget.dataset.view });
  },

  /** 生成当前类型的报告视图模型与 Markdown 文本。 */
  build: function () {
    const a = app.globalData && app.globalData.app;
    if (!a) { this.setData({ vm: null, md: '' }); return; }
    const vm = a.officer.getReport(this.data.kind);
    let md = '';
    try { md = (a.officer && a.officer.getReport) ? reportMd(vm) : ''; } catch (e) { md = ''; }
    this.setData({ vm: vm, md: md });
  },

  /** 复制 Markdown 到剪贴板。 */
  copyMd: function () {
    if (!this.data.md) { wx.showToast({ title: '暂无内容', icon: 'none' }); return; }
    wx.setClipboardData({
      data: this.data.md,
      success: function () { wx.showToast({ title: '已复制', icon: 'success' }); },
    });
  },

  onShareAppMessage: function () {
    const vm = this.data.vm;
    const title = vm && vm.title ? vm.title.zh : '三官报告';
    return { title: 'TMC ' + title };
  },
});

/**
 * 由视图模型拼装 Markdown（与内核 report-kernel.toMarkdown 保持一致的简化版，
 * 用于页面内复制分享，避免额外依赖）。
 * @param {Object} vm ReportViewModel
 * @returns {string}
 */
function reportMd(vm) {
  if (!vm) return '';
  const lines = [];
  lines.push('## ' + ((vm.title && vm.title.zh) || '报告'));
  if (vm.meta && (vm.meta.meetingName || vm.meta.date)) {
    lines.push('');
    lines.push([vm.meta.meetingName, vm.meta.date].filter(Boolean).join(' · '));
  }
  lines.push('');
  if (vm.headers && vm.headers.length) {
    lines.push('| ' + vm.headers.join(' | ') + ' |');
    lines.push('| ' + vm.headers.map(function () { return '---'; }).join(' | ') + ' |');
    (vm.rows || []).forEach(function (r) {
      lines.push('| ' + (r.cells || []).join(' | ') + ' |');
    });
    lines.push('');
  }
  if (vm.summary) lines.push(vm.summary);
  if (vm.footer) lines.push('', '> ' + vm.footer);
  return lines.join('\n');
}
