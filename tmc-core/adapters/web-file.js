/* tmc-core/adapters/web-file.js
 * WebFileAdapter — 基于 Blob + <a download> 的 FilePort 实现（Web 宿主）。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

/**
 * @param {Document} [doc] 可注入的 document（默认 globalThis.document）
 * @returns {Object} FilePort
 */
function WebFile(doc) {
  const d = doc || (typeof globalThis !== 'undefined' ? globalThis.document : null);
  return {
    save: function (name, data, mime) {
      return new Promise(function (resolve, reject) {
        try {
          if (!d || typeof d.createElement !== 'function' || typeof Blob === 'undefined') {
            return reject(new Error('file export unavailable'));
          }
          const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' });
          const url = (typeof URL !== 'undefined' && URL.createObjectURL) ? URL.createObjectURL(blob) : '';
          if (!url) return reject(new Error('URL.createObjectURL unavailable'));
          const a = d.createElement('a');
          a.href = url;
          a.download = name;
          a.click();
          setTimeout(function () {
            if (URL.revokeObjectURL) URL.revokeObjectURL(url);
          }, 1000);
          resolve();
        } catch (e) { reject(e); }
      });
    },
  };
}

module.exports = { WebFile: WebFile };
