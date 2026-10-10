/* tmc-miniprogram/pages/rsvp/rsvp.js */
'use strict';
const app = getApp();

Page({
  data: {
    meetingId: '',
    name: '',
    rolePref: '',
    rsvpList: [],
    guests: [],
    guestName: '',
  },
  onLoad: function () {
    const id = (app.globalData && app.globalData.currentMeetingId) || '2026-10-08_第335次';
    this.setData({ meetingId: id });
    this.refresh();
  },
  refresh: function () {
    const svc = app.globalData.app.rsvp;
    const m = svc.getMeeting(this.data.meetingId);
    this.setData({ rsvpList: m.rsvp || [], guests: m.guests || [] });
  },
  onId: function (e) { this.setData({ meetingId: e.detail.value }); this.refresh(); },
  onName: function (e) { this.setData({ name: e.detail.value }); },
  onRole: function (e) { this.setData({ rolePref: e.detail.value }); },
  onGuestName: function (e) { this.setData({ guestName: e.detail.value }); },
  submit: function () {
    if (!this.data.name.trim()) { wx.showToast({ title: '请填写姓名', icon: 'none' }); return; }
    app.globalData.app.rsvp.createRsvp(this.data.meetingId, {
      name: this.data.name.trim(), role_pref: this.data.rolePref.trim(), confirmed: true,
    });
    this.setData({ name: '', rolePref: '' });
    this.refresh();
    wx.showToast({ title: '已报名', icon: 'success' });
  },
  addGuest: function () {
    if (!this.data.guestName.trim()) { wx.showToast({ title: '请填来宾姓名', icon: 'none' }); return; }
    app.globalData.app.rsvp.addGuest(this.data.meetingId, { name: this.data.guestName.trim() });
    this.setData({ guestName: '' });
    this.refresh();
    wx.showToast({ title: '来宾已登记', icon: 'success' });
  },
});
