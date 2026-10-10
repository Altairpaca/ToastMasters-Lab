/* tmc-miniprogram/adapters/wx-storage.js
 * WxStorageAdapter — 基于 wx.getStorageSync / wx.setStorageSync 的 StoragePort 实现。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

var KEY_INDEX = 'tmc:__keys__';

function readIndex() {
  try { return wx.getStorageSync(KEY_INDEX) || []; } catch (e) { return []; }
}

function writeIndex(keys) {
  try { wx.setStorageSync(KEY_INDEX, keys); } catch (e) { /* noop */ }
}

module.exports = {
  get: function (key) {
    try {
      var v = wx.getStorageSync(key);
      return (v === '' || v === undefined || v === null) ? null : String(v);
    } catch (e) { console.warn('[tmc] wx.storage.get failed', e); return null; }
  },
  set: function (key, value) {
    try {
      wx.setStorageSync(key, String(value));
      var keys = readIndex();
      if (keys.indexOf(key) < 0) { keys.push(key); writeIndex(keys); }
    } catch (e) { console.warn('[tmc] wx.storage.set failed', e); }
  },
  remove: function (key) {
    try {
      wx.removeStorageSync(key);
      var keys = readIndex().filter(function (k) { return k !== key; });
      writeIndex(keys);
    } catch (e) { /* noop */ }
  },
  keys: function () { return readIndex(); },
  /** 小程序异步读（可选）。 */
  getAsync: function (key, cb) {
    wx.getStorage({ key: key, success: function (r) { cb(r.data === undefined ? null : String(r.data)); }, fail: function () { cb(null); } });
  },
};
