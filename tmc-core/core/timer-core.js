/* tmc-core/core/timer-core.js
 * 计时内核：判色 / 时间格式化 / 解析 / 秒表。移植自 universal-timer.html。
 * 判色口径（不可动摇）：under < green ≤ ok ≤ red+30″ ；红牌后 30 秒宽限内收尾仍算 ok。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

/** 补零到两位。 */
function pad2(n) { return String(n).padStart(2, '0'); }

/**
 * 秒 → "M:SS"（如 5:30 / 0:35）。负数归零。
 * @param {number} sec
 * @returns {string}
 */
function formatTime(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  return Math.floor(s / 60) + ':' + pad2(s % 60);
}

/**
 * "M:SS" 或 "SS" → 秒，非法返回 null。
 * @param {string} str
 * @returns {number|null}
 */
function parseTime(str) {
  if (typeof str !== 'string') return null;
  const s = str.trim();
  if (!/^\d{1,3}(:\d{1,2})?$/.test(s)) return null;
  const parts = s.split(':');
  if (parts.length === 2 && parseInt(parts[1], 10) > 59) return null;
  const sec = parts.length === 2
    ? parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)
    : parseInt(parts[0], 10);
  return isNaN(sec) ? null : sec;
}

/**
 * 状态判定：under(<绿) / ok(绿~红+30″宽限内) / over(≥红+30″)。
 * @param {number} seconds 实际用时（秒）
 * @param {number} greenSec 绿牌阈值（秒）
 * @param {number} redSec 红牌阈值（秒）
 * @returns {'under'|'ok'|'over'}
 */
function judgeStatus(seconds, greenSec, redSec) {
  if (seconds < greenSec) return 'under';
  if (seconds >= redSec + 30) return 'over';
  return 'ok';
}

/**
 * 当前灯色：none / green / yellow / red / over（红后 30 秒仍继续）。
 * @param {number} seconds
 * @param {number} greenSec
 * @param {number} yellowSec
 * @param {number} redSec
 * @returns {'none'|'green'|'yellow'|'red'|'over'}
 */
function lightState(seconds, greenSec, yellowSec, redSec) {
  if (seconds >= redSec + 30) return 'over';
  if (seconds >= redSec) return 'red';
  if (seconds >= yellowSec) return 'yellow';
  if (seconds >= greenSec) return 'green';
  return 'none';
}

/**
 * 依据会议语言/轮次生成三色灯阈值。
 * 头马规则：≤4 分钟 剩 1′ 绿 / 30″ 黄 / 到时红；>4 分钟 剩 2′ 绿 / 1′ 黄 / 到时红。
 * @param {number} minutes 计划时长（分钟）
 * @returns {{green:number, yellow:number, red:number}} 单位：秒
 */
function quickThresholds(minutes) {
  const totalSec = Math.round(minutes * 60);
  if (minutes <= 4) {
    return { green: totalSec - 60, yellow: totalSec - 30, red: totalSec };
  }
  return { green: totalSec - 120, yellow: totalSec - 60, red: totalSec };
}

/**
 * 秒表：基于注入的 ClockPort，纯逻辑（不依赖宿主）。
 * @param {Object} clock ClockPort（需含 now()）
 * @returns {Object} Stopwatch
 */
function createStopwatch(clock) {
  let running = false;
  let startStamp = 0;
  let accruedMs = 0;

  function elapsedMs() {
    return running ? (clock.now() - startStamp) : accruedMs;
  }

  return {
    /** 开始/继续。 */
    start: function () {
      if (running) return;
      startStamp = clock.now() - accruedMs;
      running = true;
    },
    /** 暂停。 */
    pause: function () {
      if (!running) return;
      accruedMs = clock.now() - startStamp;
      running = false;
    },
    /** 复位。 */
    reset: function () { running = false; accruedMs = 0; startStamp = 0; },
    /** 是否在走。 */
    isRunning: function () { return running; },
    /** 已累计毫秒。 */
    ms: function () { return elapsedMs(); },
    /** 已累计秒（向下取整）。 */
    seconds: function () { return Math.floor(elapsedMs() / 1000); },
    /** 已累计 "M:SS"。 */
    display: function () { return formatTime(Math.floor(elapsedMs() / 1000)); },
  };
}

module.exports = {
  pad2: pad2,
  formatTime: formatTime,
  parseTime: parseTime,
  judgeStatus: judgeStatus,
  lightState: lightState,
  quickThresholds: quickThresholds,
  createStopwatch: createStopwatch,
};
