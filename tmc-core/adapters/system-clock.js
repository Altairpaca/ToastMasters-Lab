/* tmc-core/adapters/system-clock.js
 * SystemClockAdapter — 基于 Date.now / requestAnimationFrame 的 ClockPort 实现。
 * 无宿主环境（Node）时 raf 退化为 setTimeout(16ms)。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

/**
 * @returns {Object} ClockPort
 */
function SystemClock() {
  const g = typeof globalThis !== 'undefined' ? globalThis : {};
  const hasRaf = typeof g.requestAnimationFrame === 'function';
  const hasCancel = typeof g.cancelAnimationFrame === 'function';
  const timers = {};
  let timerId = 0;
  return {
    now: function () {
      // performance.now 单调，优先；退回 Date.now
      if (g.performance && typeof g.performance.now === 'function') return g.performance.now();
      return Date.now();
    },
    wallClock: function () { return Date.now(); },
    raf: function (cb) {
      if (hasRaf) return g.requestAnimationFrame(cb);
      timerId += 1;
      const id = timerId;
      timers[id] = setTimeout(function () { delete timers[id]; cb(Date.now()); }, 16);
      return id;
    },
    cancelRaf: function (h) {
      if (hasCancel) { g.cancelAnimationFrame(h); return; }
      if (timers[h]) { clearTimeout(timers[h]); delete timers[h]; }
    },
  };
}

module.exports = { SystemClock: SystemClock };
