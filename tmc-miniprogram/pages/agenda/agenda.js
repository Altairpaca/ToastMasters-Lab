/* tmc-miniprogram/pages/agenda/agenda.js
 * 议程协作页：只读 / 协作查看议程（调用 AgendaService，纯内核计算）。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

const app = getApp();

/** 默认议程样例（离线可用，不依赖网络）。 */
const DEFAULT_MEETING = {
  meeting_id: '2026-10-08_第335次',
  theme: { zh: '例会', en: '' },
  date: '2026-10-08',
  start_time: '19:00',
  end_time: '21:00',
  venue: '线上',
  agenda: [
    { segment_id: 'open', name_zh: '开场', presenter: '主持人', duration_min: 2 },
    { segment_id: 'tt', name_zh: '即兴演讲', presenter: '即兴主持', duration_min: 20 },
    { segment_id: 'prep1', name_zh: '备稿演讲 1', presenter: '演讲者', duration_min: 7 },
    { segment_id: 'eval1', name_zh: '点评 1', presenter: '点评师', duration_min: 3 },
    { segment_id: 'close', name_zh: '收尾与评选', presenter: '总主持', duration_min: 5 },
  ],
};

Page({
  data: {
    meetingId: '',
    netAvailable: false,
    plan: null,
    headers: [],
    rows: [],
    summary: '',
    warnings: [],
    totalMinutes: 0,
  },

  onLoad: function () {
    const id = (app.globalData && app.globalData.currentMeetingId) || DEFAULT_MEETING.meeting_id;
    this.setData({
      meetingId: id,
      netAvailable: !!(app.globalData && app.globalData.netAvailable),
    });
    this.build();
  },

  onId: function (e) { this.setData({ meetingId: e.detail.value }); },

  /** 用内核构建议程计划并整理为 WXML 可渲染结构。 */
  build: function () {
    const a = app.globalData && app.globalData.app;
    if (!a) { wx.showToast({ title: '内核未就绪', icon: 'none' }); return; }

    // 优先读取本地已保存的 meeting，否则使用内置样例
    let meeting = null;
    try {
      const saved = a.rsvp.getMeeting(this.data.meetingId);
      if (saved && saved.agenda && saved.agenda.length) meeting = saved;
    } catch (e) { meeting = null; }
    if (!meeting) meeting = DEFAULT_MEETING;

    const plan = a.agenda.buildAgenda(meeting, {});
    const vm = a.agenda.preview(plan);
    this.setData({
      plan: plan,
      headers: vm.headers,
      rows: vm.rows,
      summary: vm.summary,
      warnings: (plan && plan.warnings) || [],
      totalMinutes: (plan && plan.totalMinutes) || 0,
    });
  },
});
