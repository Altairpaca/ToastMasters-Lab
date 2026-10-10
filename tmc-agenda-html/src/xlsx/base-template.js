/* tmc-agenda-html/src/xlsx/base-template.js
 * 底稿载入：读取用户选择的 xlsx（ArrayBuffer），校验结构，返回可编辑的 entries。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
(function (global) {
  'use strict';
  var Zip = global.TMCZip;

  /**
   * 载入底稿 xlsx。
   * @param {ArrayBuffer|Uint8Array} bytes
   * @returns {{ok:boolean, entries?:Array, errors:string[]}}
   */
  function load(bytes) {
    try {
      var entries = Zip.unzip(bytes);
      var names = entries.map(function (e) { return e.name; });
      var errors = [];
      if (names.indexOf('xl/worksheets/sheet1.xml') < 0) errors.push('底稿缺少 xl/worksheets/sheet1.xml');
      if (names.indexOf('xl/sharedStrings.xml') < 0) errors.push('底稿缺少 xl/sharedStrings.xml（可为空模板）');
      return { ok: errors.length === 0, entries: entries, errors: errors };
    } catch (e) {
      return { ok: false, errors: [String(e && e.message ? e.message : e)] };
    }
  }

  /**
   * 探测底稿数据行范围（粗略：找出含字符串单元格的行区间）。
   * @param {Array} entries
   * @returns {{minRow:number, maxRow:number, rows:number[]}}
   */
  function detectRows(entries) {
    var sheetXml = Zip.readText(entries, 'xl/worksheets/sheet1.xml') || '';
    var rows = global.TMCXml.rowNumbers(sheetXml);
    return {
      minRow: rows.length ? Math.min.apply(null, rows) : 0,
      maxRow: rows.length ? Math.max.apply(null, rows) : 0,
      rows: rows,
    };
  }

  /**
   * 保存：把 entries 重新打包回 Uint8Array，并确保删除 calcChain.xml。
   * @param {Array} entries
   * @returns {Uint8Array}
   */
  function save(entries) {
    var cleaned = Zip.removeEntry(entries, 'xl/calcChain.xml');
    return Zip.zip(cleaned);
  }

  global.TMCBaseTemplate = { load: load, detectRows: detectRows, save: save };
})(typeof window !== 'undefined' ? window : globalThis);
