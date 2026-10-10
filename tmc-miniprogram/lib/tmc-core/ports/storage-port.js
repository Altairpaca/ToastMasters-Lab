/* tmc-core/ports/storage-port.js
 * StoragePort — 键值存储端口契约 + 空实现。
 * 只声明接口语义，具体实现见各宿主 adapters/。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

/**
 * 校验一个对象是否满足 StoragePort 契约（鸭子类型）。
 * @param {*} obj 待校验对象
 * @returns {{ok:boolean, missing:string[]}}
 */
function checkStoragePort(obj) {
  const required = ['get', 'set', 'remove', 'keys'];
  const missing = [];
  if (!obj || typeof obj !== 'object') return { ok: false, missing: required.slice() };
  required.forEach(function (m) {
    if (typeof obj[m] !== 'function') missing.push(m);
  });
  return { ok: missing.length === 0, missing: missing };
}

/**
 * 空实现：所有读返回 null，写为无操作。用于无持久化场景。
 * @returns {Object} StoragePort
 */
function NullStorage() {
  return {
    get: function () { return null; },
    set: function () { /* noop */ },
    remove: function () { /* noop */ },
    keys: function () { return []; },
  };
}

/**
 * 内存实现：基于普通对象，进程内有效。用于测试与降级兜底。
 * @param {Object<string,string>} [seed] 初始键值
 * @returns {Object} StoragePort
 */
function MemoryStorage(seed) {
  const store = {};
  if (seed && typeof seed === 'object') {
    Object.keys(seed).forEach(function (k) { store[k] = String(seed[k]); });
  }
  return {
    get: function (key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    set: function (key, value) { store[key] = String(value); },
    remove: function (key) { delete store[key]; },
    keys: function () { return Object.keys(store); },
  };
}

module.exports = {
  checkStoragePort: checkStoragePort,
  NullStorage: NullStorage,
  MemoryStorage: MemoryStorage,
};
