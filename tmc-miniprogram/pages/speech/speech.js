/* tmc-miniprogram/pages/speech/speech.js */
'use strict';
const app = getApp();

Page({
  data: {
    meetingId: '',
    memberId: '',
    level: 'L2',
    title: '',
    pathway: 'Presentation Mastery',
    evaluator: '',
    minMin: '',
    maxMin: '',
    speeches: [],
  },
  onLoad: function () {
    const id = (app.globalData && app.globalData.currentMeetingId) || '2026-10-08_第335次';
    this.setData({ meetingId: id });
    this.refresh();
  },
  refresh: function () {
    const m = app.globalData.app.rsvp.getMeeting(this.data.meetingId);
    this.setData({ speeches: m.speeches || [] });
  },
  onId: function (e) { this.setData({ meetingId: e.detail.value }); this.refresh(); },
  onMember: function (e) { this.setData({ memberId: e.detail.value }); },
  onLevel: function (e) { this.setData({ level: e.detail.value }); },
  onTitle: function (e) { this.setData({ title: e.detail.value }); },
  onPathway: function (e) { this.setData({ pathway: e.detail.value }); },
  onEvaluator: function (e) { this.setData({ evaluator: e.detail.value }); },
  onMin: function (e) { this.setData({ minMin: e.detail.value }); },
  onMax: function (e) { this.setData({ maxMin: e.detail.value }); },
  submit: function () {
    if (!this.data.memberId.trim()) { wx.showToast({ title: '请填会员名', icon: 'none' }); return; }
    const req = {};
    if (this.data.minMin !== '') req.min_min = Number(this.data.minMin);
    if (this.data.maxMin !== '') req.max_min = Number(this.data.maxMin);
    app.globalData.app.rsvp.applySpeech(this.data.meetingId, {
      member_id: this.data.memberId.trim(),
      project_level: this.data.level,
      project_title: this.data.title.trim(),
      pathway: this.data.pathway.trim(),
      evaluator: this.data.evaluator.trim() || null,
      requirements: req,
    });
    this.setData({ memberId: '', title: '', evaluator: '', minMin: '', maxMin: '' });
    this.refresh();
    wx.showToast({ title: '已提交备稿', icon: 'success' });
  },
});
