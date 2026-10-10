/* tmc-miniprogram/components/report-view/report-view.js
 * 报告视图组件：接收 ReportViewModel，渲染三官报告（表格 + 摘要）。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

Component({
  properties: {
    /** @type {Object} ReportViewModel（由 report-kernel 生成） */
    vm: {
      type: Object,
      value: null,
      observer: function () { /* 视图由 WXML 直接绑定，无需额外处理 */ },
    },
  },
  data: {},
  methods: {
    /** 导出分享用的纯文本摘要（供页面 onShareAppMessage 使用）。 */
    plainText: function () {
      const vm = this.data.vm;
      if (!vm) return '';
      const lines = [];
      lines.push((vm.title && vm.title.zh) || '报告');
      if (vm.summary) lines.push(vm.summary);
      (vm.rows || []).forEach(function (r) { lines.push((r.cells || []).join(' | ')); });
      if (vm.footer) lines.push(vm.footer);
      return lines.join('\n');
    },
  },
});
