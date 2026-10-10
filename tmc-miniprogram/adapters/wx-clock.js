/* tmc-miniprogram/adapters/wx-clock.js
 * WxClockAdapter — 小程序时钟：Date.now + canvas.requestAnimationFrame（或 setTimeout 兜底）。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

var timers = {};
var timerId = 0;

module.exports = {
  now: function () { return Date.now(); },
  wallClock: function () { return Date.now(); },
  raf: function (cb) {
    timerId += 1;
    var id = timerId;
    // 小程序无全局 requestAnimationFrame；用 setTimeout(16) 兜底（足够计时精度）
    timers[id] = setTimeout(function () { delete timers[id]; cb(Date.now()); }, 16);
    return id;
  },
  cancelRaf: function (h) {
    if (timers[h]) { clearTimeout(timers[h]); delete timers[h]; }
  },
};
