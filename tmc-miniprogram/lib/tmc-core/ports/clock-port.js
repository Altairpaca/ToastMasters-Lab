/* tmc-core/ports/clock-port.js
 * ClockPort — 时钟端口契约（单调计时 / 墙钟 / 动画帧）。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

/**
 * 纯逻辑时钟：now/wallClock 由外部注入的取值函数驱动，无宿主依赖。
 * 适用于内核单测（可精确控制时间推进）。
 * @param {() => number} nowFn 单调时间取值（毫秒）
 * @param {() => number} [wallFn] 墙钟取值（毫秒），缺省复用 nowFn
 * @returns {Object} ClockPort
 */
function createClockPort(nowFn, wallFn) {
  let frameId = 0;
  const frames = {};
  return {
    now: function () { return nowFn(); },
    wallClock: function () { return (wallFn || nowFn)(); },
    raf: function (cb) {
      frameId += 1;
      const id = frameId;
      // 无宿主环境下用微任务兜底：下一时刻执行一次
      frames[id] = Promise.resolve().then(function () {
        delete frames[id];
        cb(nowFn());
      });
      return id;
    },
    cancelRaf: function (h) { delete frames[h]; },
  };
}

/**
 * 校验一个对象是否满足 ClockPort 契约。
 * @param {*} obj 待校验对象
 * @returns {{ok:boolean, missing:string[]}}
 */
function checkClockPort(obj) {
  const required = ['now', 'wallClock', 'raf', 'cancelRaf'];
  const missing = [];
  if (!obj || typeof obj !== 'object') return { ok: false, missing: required.slice() };
  required.forEach(function (m) { if (typeof obj[m] !== 'function') missing.push(m); });
  return { ok: missing.length === 0, missing: missing };
}

module.exports = {
  createClockPort: createClockPort,
  checkClockPort: checkClockPort,
};
