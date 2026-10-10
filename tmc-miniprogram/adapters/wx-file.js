/* tmc-miniprogram/adapters/wx-file.js
 * WxFileAdapter — 小程序文件导出：写入 USER_DATA_PATH 并可保存到本地。
 * data 支持 string / ArrayBuffer / Uint8Array。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

function toArrayBuffer(data) {
  if (typeof data === 'string') {
    // UTF-8 编码
    var enc = new TextEncoder();
    return enc.encode(data).buffer;
  }
  if (data instanceof ArrayBuffer) return data;
  if (data && data.buffer) return data.buffer;
  return data;
}

module.exports = {
  /**
   * 保存文件到小程序用户目录。
   * @param {string} name
   * @param {string|ArrayBuffer|Uint8Array} data
   * @param {string} mime
   * @returns {Promise<void>}
   */
  save: function (name, data, mime) {
    return new Promise(function (resolve, reject) {
      try {
        var fs = wx.getFileSystemManager();
        var path = wx.env.USER_DATA_PATH + '/' + name;
        fs.writeFile({
          filePath: path,
          data: toArrayBuffer(data),
          encoding: 'binary',
          success: function () { resolve(); },
          fail: function (err) { reject(new Error(err && err.errMsg ? err.errMsg : 'writeFile failed')); },
        });
      } catch (e) { reject(e); }
    });
  },
};
