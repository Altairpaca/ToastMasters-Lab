/* tmc-core/adapters/web-storage.js
 * WebStorageAdapter — 基于 localStorage 的 StoragePort 实现（Web 宿主）。
 * 读失败/私密模式：try/catch 包裹，返回 null + console.warn，不阻断。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

/**
 * @param {Storage} [ls] 可注入的存储对象（默认 globalThis.localStorage）
 * @returns {Object} StoragePort
 */
function WebStorage(ls) {
  const store = ls || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
  if (!store) {
    // 无 localStorage 时降级为内存存储，保证不崩
    const mem = {};
    return {
      get: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      set: function (k, v) { mem[k] = String(v); },
      remove: function (k) { delete mem[k]; },
      keys: function () { return Object.keys(mem); },
    };
  }
  return {
    get: function (key) {
      try { return store.getItem(key); }
      catch (e) { if (typeof console !== 'undefined') console.warn('[tmc] storage.get failed', e); return null; }
    },
    set: function (key, value) {
      try { store.setItem(key, String(value)); }
      catch (e) { if (typeof console !== 'undefined') console.warn('[tmc] storage.set failed', e); }
    },
    remove: function (key) {
      try { store.removeItem(key); }
      catch (e) { if (typeof console !== 'undefined') console.warn('[tmc] storage.remove failed', e); }
    },
    keys: function () {
      try {
        const out = [];
        for (let i = 0; i < store.length; i++) out.push(store.key(i));
        return out;
      } catch (e) { return []; }
    },
  };
}

module.exports = { WebStorage: WebStorage };
