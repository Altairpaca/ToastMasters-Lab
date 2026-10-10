/* tmc-core/ports/file-port.js
 * FilePort — 文件导出端口契约。
 * Web：URL.createObjectURL + <a download>；小程序：wx.getFileSystemManager。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

/**
 * 校验一个对象是否满足 FilePort 契约。
 * @param {*} obj 待校验对象
 * @returns {{ok:boolean, missing:string[]}}
 */
function checkFilePort(obj) {
  const missing = [];
  if (!obj || typeof obj !== 'object') return { ok: false, missing: ['save'] };
  if (typeof obj.save !== 'function') missing.push('save');
  return { ok: missing.length === 0, missing: missing };
}

/**
 * 空实现：保存为无操作（只在内存里记录最后一次保存请求）。
 * @returns {Object} FilePort
 */
function NullFilePort() {
  const log = [];
  return {
    save: function (name, data, mime) {
      log.push({ name: name, size: data ? (data.length || data.byteLength || 0) : 0, mime: mime || '' });
      return Promise.resolve();
    },
    _log: log,
  };
}

module.exports = {
  checkFilePort: checkFilePort,
  NullFilePort: NullFilePort,
};
