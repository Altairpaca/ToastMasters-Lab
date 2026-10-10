/* tmc-miniprogram/pages/index/index.js */
'use strict';
const app = getApp();

Page({
  data: {
    netAvailable: false,
    entries: [
      { key: 'rsvp', title: '报名接龙 RSVP', desc: '会员/来宾自助报名' },
      { key: 'speech', title: '备稿申请 Speech', desc: '提交备稿与项目要求' },
      { key: 'ballot', title: '评选投票 Ballot', desc: '候选与计票' },
      { key: 'agenda', title: '议程协作 Agenda', desc: '只读/协作查看议程' },
      { key: 'report', title: '报告 Report', desc: '三官报告查看' },
    ],
  },
  onShow: function () {
    this.setData({ netAvailable: (app.globalData && app.globalData.netAvailable) || false });
  },
  go: function (e) {
    const key = e.currentTarget.dataset.key;
    wx.navigateTo({ url: '/pages/' + key + '/' + key });
  },
});
