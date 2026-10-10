/* tmc-miniprogram/app.js
 * 小程序入口：用 Wx 适配器装配 tmc-core 内核，挂到 globalData。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

const core = require('./lib/tmc-core/index.js');
const wxStorage = require('./adapters/wx-storage.js');
const wxCanvas = require('./adapters/wx-canvas.js');
const wxClock = require('./adapters/wx-clock.js');
const wxFile = require('./adapters/wx-file.js');
const wxNet = require('./adapters/wx-net.js');

App({
  globalData: {
    app: null,
    netAvailable: false,
    currentMeetingId: '',
  },

  onLaunch: function () {
    const app = core.createApp({
      storage: wxStorage,
      canvas: wxCanvas,
      clock: wxClock,
      file: wxFile,
      net: wxNet,
    });
    this.globalData.app = app;
    // 能力探测：离线时相关入口应隐藏
    try { this.globalData.netAvailable = app.netAvailable(); } catch (e) { this.globalData.netAvailable = false; }

    // 全局兜底错误记录（不联网上报）
    if (typeof wx !== 'undefined' && wx.onError) {
      wx.onError(function (msg) { console.warn('[TMC] error', msg); });
    }
  },
});
