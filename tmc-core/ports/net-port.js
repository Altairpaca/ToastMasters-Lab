/* tmc-core/ports/net-port.js
 * NetPort — 联网增强端口契约（ASR / 在线协作，可空实现，支持优雅降级）。
 * 约定：应用层启动时调用 isAvailable()；为 false 则隐藏联网入口，不抛异常、不弹错。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

/**
 * 空实现（离线默认）：isAvailable 恒为 false，request 永远 reject。
 * @returns {Object} NetPort
 */
const NullNetPort = {
  isAvailable: function () { return false; },
  request: function () { return Promise.reject(new Error('offline')); },
  asr: null,
};

/**
 * 校验一个对象是否满足 NetPort 契约。
 * @param {*} obj 待校验对象
 * @returns {{ok:boolean, missing:string[]}}
 */
function checkNetPort(obj) {
  const required = ['isAvailable', 'request'];
  const missing = [];
  if (!obj || typeof obj !== 'object') return { ok: false, missing: required.slice() };
  required.forEach(function (m) { if (typeof obj[m] !== 'function') missing.push(m); });
  return { ok: missing.length === 0, missing: missing };
}

module.exports = {
  NullNetPort: NullNetPort,
  checkNetPort: checkNetPort,
};
