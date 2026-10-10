/* tmc-officers-html/src/store.js
 * 三官助手持久化：经 StoragePort（Web 适配器）读写 localStorage。
 * 本文件在浏览器内联运行，可访问 window.TMC。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
(function (global) {
  'use strict';
  var TMC = global.TMC;
  var store = TMC.adapters.WebStorage();

  var KEY = function (kind) { return 'tmc:officers:' + kind; };

  function save(kind, obj) {
    try { store.set(KEY(kind), JSON.stringify(obj || {})); }
    catch (e) { /* 私密模式等静默失败 */ }
  }

  function load(kind) {
    try {
      var raw = store.get(KEY(kind));
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function clear(kind) { store.remove(KEY(kind)); }

  global.TMCStore = { save: save, load: load, clear: clear, port: store };
})(typeof window !== 'undefined' ? window : globalThis);
