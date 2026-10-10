/* tmc-core/adapters/web-canvas.js
 * WebCanvasAdapter — 基于 document.createElement('canvas') 的 CanvasPort 实现。
 * 仅在 Web 宿主可用；内核本身不引用本文件。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

/**
 * @param {Document} [doc] 可注入的 document（默认 globalThis.document）
 * @returns {Object} CanvasPort
 */
function WebCanvas(doc) {
  const d = doc || (typeof globalThis !== 'undefined' ? globalThis.document : null);
  return {
    create: function (w, h) {
      if (!d || typeof d.createElement !== 'function') return null;
      const c = d.createElement('canvas');
      c.width = Math.max(1, Math.round(w || 1));
      c.height = Math.max(1, Math.round(h || 1));
      return c;
    },
    acquire: function () { return Promise.resolve(this.create(1, 1)); },
  };
}

module.exports = { WebCanvas: WebCanvas };
