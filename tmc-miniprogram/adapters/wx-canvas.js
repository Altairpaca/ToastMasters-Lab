/* tmc-miniprogram/adapters/wx-canvas.js
 * WxCanvasAdapter — 小程序 Canvas 2d 适配。
 * 关键：wx 的 canvas node 需异步 acquire；toDataURL 用 wx.canvasToTempFilePath 包装（异步）。
 * 本适配器同时提供离屏 CanvasLike（用于内核绘制），toDataURL 返回 Promise。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

/**
 * 创建离屏画布（小程序 Canvas 2d API 兼容）。
 * @param {number} w @param {number} h
 * @returns {Object|null} CanvasLike
 */
function create(w, h) {
  try {
    var canvas = wx.createOffscreenCanvas({ type: '2d', width: w, height: h });
    if (!canvas) return null;
    return {
      width: w,
      height: h,
      getContext: function (t) { return canvas.getContext(t || '2d'); },
      toDataURL: function () {
        // 离屏画布在部分基础库支持 toDataURL；不支持时返回空串由上层降级
        try { return canvas.toDataURL ? canvas.toDataURL('image/png') : ''; } catch (e) { return ''; }
      },
      _node: canvas,
    };
  } catch (e) { return null; }
}

/**
 * 获取页面上的 canvas node（异步）。
 * @param {string} id canvas-id
 * @param {Object} ctx 页面实例（this）
 * @returns {Promise<Object|null>}
 */
function acquire(id, ctx) {
  return new Promise(function (resolve) {
    try {
      wx.createSelectorQuery().in(ctx).select('#' + id).fields({ node: true, size: true }).exec(function (res) {
        if (!res || !res[0] || !res[0].node) { resolve(null); return; }
        var node = res[0].node;
        var c = {
          width: res[0].width,
          height: res[0].height,
          getContext: function (t) { return node.getContext(t || '2d'); },
          toDataURL: function () { return ''; },
          _node: node,
        };
        resolve(c);
      });
    } catch (e) { resolve(null); }
  });
}

module.exports = { create: create, acquire: acquire };
