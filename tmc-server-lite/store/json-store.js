/* tmc-server-lite/store/json-store.js
 * 极简 JSON 文件存储：以 meeting_id 为键，落盘到 data/ 目录。
 * 零依赖，仅使用 Node 内置模块。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

const fs = require('fs');
const path = require('path');

/**
 * 创建 JSON 文件存储。
 * @param {string} baseDir 数据目录（相对或绝对路径）
 * @returns {Object} JsonStore
 */
function createJsonStore(baseDir) {
  const dir = path.resolve(baseDir || path.join(__dirname, '..', 'data'));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  /** 把 meeting_id 安全地映射为文件名（避免路径穿越）。 */
  function fileNameFor(id) {
    const safe = String(id || '').replace(/[^0-9A-Za-z_\u4e00-\u9fa5-]/g, '_');
    return path.join(dir, safe + '.json');
  }

  return {
    /** 数据目录绝对路径。 */
    dir: dir,

    /**
     * 列出所有已保存的会议 ID。
     * @returns {string[]}
     */
    list: function () {
      return fs.readdirSync(dir)
        .filter(function (f) { return /\.json$/.test(f); })
        .map(function (f) { return f.replace(/\.json$/, ''); });
    },

    /**
     * 读取指定会议；不存在返回 null。
     * @param {string} id
     * @returns {Object|null}
     */
    get: function (id) {
      const p = fileNameFor(id);
      if (!fs.existsSync(p)) return null;
      try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
      catch (e) { return null; }
    },

    /**
     * 保存会议（覆盖写）。返回保存后的对象。
     * @param {Object} meeting 必须含 meeting_id
     * @returns {Object}
     */
    save: function (meeting) {
      const m = meeting || {};
      if (!m.meeting_id) throw new Error('meeting.meeting_id 必填');
      const p = fileNameFor(m.meeting_id);
      fs.writeFileSync(p, JSON.stringify(m, null, 2), 'utf8');
      return m;
    },

    /**
     * 删除指定会议。
     * @param {string} id
     * @returns {boolean} 是否删除成功
     */
    remove: function (id) {
      const p = fileNameFor(id);
      if (!fs.existsSync(p)) return false;
      fs.unlinkSync(p);
      return true;
    },
  };
}

module.exports = { createJsonStore: createJsonStore };
