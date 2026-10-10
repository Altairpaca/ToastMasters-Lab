/* tmc-miniprogram/adapters/wx-net.js
 * WxNetAdapter — 小程序联网（wx.request）。isAvailable 依据网络状态探测；
 * 离线时上层隐藏联网入口，不报错。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

var BASE_URL = ''; // 如配置了 tmc-server-lite，填其地址，例如 'http://127.0.0.1:8787'

module.exports = {
  isAvailable: function () {
    try {
      // 简化判定：已配置 BASE_URL 且 wx.request 可用 → 视为联网增强可用
      return !!BASE_URL && typeof wx.request === 'function';
    } catch (e) { return false; }
  },
  /**
   * 发起请求。
   * @param {string} url
   * @param {Object} opts { method, data, header }
   * @returns {Promise<any>}
   */
  request: function (url, opts) {
    var o = opts || {};
    return new Promise(function (resolve, reject) {
      try {
        wx.request({
          url: BASE_URL + url,
          method: o.method || 'GET',
          data: o.data || {},
          header: o.header || { 'content-type': 'application/json' },
          success: function (res) { resolve(res.data); },
          fail: function (err) { reject(new Error(err && err.errMsg ? err.errMsg : 'request failed')); },
        });
      } catch (e) { reject(e); }
    });
  },
  asr: null,
};
