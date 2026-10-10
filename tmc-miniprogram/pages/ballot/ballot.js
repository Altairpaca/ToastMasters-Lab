/* tmc-miniprogram/pages/ballot/ballot.js */
'use strict';
const app = getApp();

const CATEGORIES = [
  { key: 'best_speaker', label: '最佳演讲者' },
  { key: 'best_evaluator', label: '最佳点评师' },
  { key: 'best_table_topics', label: '最佳即兴' },
  { key: 'best_role', label: '最佳角色' },
];

Page({
  data: {
    meetingId: '',
    categories: CATEGORIES,
    category: 'best_speaker',
    candidatesText: '',
    votesText: '',
    result: null,
  },
  onLoad: function () {
    const id = (app.globalData && app.globalData.currentMeetingId) || '2026-10-08_第335次';
    this.setData({ meetingId: id });
  },
  onId: function (e) { this.setData({ meetingId: e.detail.value }); },
  onCat: function (e) { this.setData({ category: e.currentTarget.dataset.key }); },
  onCands: function (e) { this.setData({ candidatesText: e.detail.value }); },
  onVotes: function (e) { this.setData({ votesText: e.detail.value }); },
  tally: function () {
    const cands = this.data.candidatesText.split(/[\s,，、\n]+/).filter(Boolean);
    if (!cands.length) { wx.showToast({ title: '请填候选', icon: 'none' }); return; }
    // 每行一张选票，行内用分隔符分隔多选
    const votes = this.data.votesText.split('\n')
      .map(function (line) { return line.split(/[\s,，、]+/).filter(Boolean); })
      .filter(function (v) { return v.length; });
    const res = app.globalData.app.rsvp.tallyBallot(this.data.meetingId, this.data.category, cands, votes);
    this.setData({ result: res });
    wx.showToast({ title: '已计票', icon: 'success' });
  },
});
