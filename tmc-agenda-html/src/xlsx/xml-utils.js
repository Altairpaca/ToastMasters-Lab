/* tmc-agenda-html/src/xlsx/xml-utils.js
 * OOXML 单元格定位工具：在 sheet1.xml 中定位/读写单元格，管理 sharedStrings.xml。
 * 纯字符串处理，零依赖。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
(function (global) {
  'use strict';
  var TMC = global.TMC;
  var xmlEscape = TMC.xlsx.xmlEscape;

  /** 0-based 列号 → 列字母。 */
  function colLetter(c) {
    var n = c + 1, s = '';
    while (n > 0) { var r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
    return s;
  }

  /** 生成 A1 引用。 */
  function ref(c, row) { return colLetter(c) + row; }

  /** 解析 A1 引用 → {col, row}。 */
  function parseRef(a1) {
    var m = /^([A-Z]+)(\d+)$/.exec(String(a1).toUpperCase());
    if (!m) return null;
    var col = 0;
    for (var i = 0; i < m[1].length; i++) col = col * 26 + (m[1].charCodeAt(i) - 64);
    return { col: col - 1, row: parseInt(m[2], 10) };
  }

  /**
   * 在 sheet XML 中读取某单元格的原始 <c> 片段。
   * @param {string} sheetXml
   * @param {string} a1
   * @returns {string|null}
   */
  function getCell(sheetXml, a1) {
    var re = new RegExp('<c r="' + a1 + '"[^>]*?(\\/>|>[\\s\\S]*?<\\/c>)');
    var m = re.exec(sheetXml);
    return m ? m[0] : null;
  }

  /**
   * 在 sheet XML 中设置单元格（文本或公式）。复用 tmc-core xlsx-writer.setCell。
   * @param {string} sheetXml
   * @param {string} a1
   * @param {string} value
   * @param {boolean} [isFormula]
   * @returns {string}
   */
  function setCell(sheetXml, a1, value, isFormula) {
    return TMC.xlsx.setCell(sheetXml, a1, value, !!isFormula);
  }

  /**
   * 在 sharedStrings 中追加一个字符串，返回其索引。若已存在则复用。
   * @param {string} sstXml sharedStrings.xml 内容
   * @param {string} text
   * @returns {{xml:string, index:number}}
   */
  function addSharedString(sstXml, text) {
    var items = [];
    var re = /<si>([\s\S]*?)<\/si>/g;
    var m;
    while ((m = re.exec(sstXml)) !== null) {
      var inner = m[1];
      var t = /<t[^>]*>([\s\S]*?)<\/t>/.exec(inner);
      items.push(t ? t[1] : '');
    }
    var idx = items.indexOf(xmlEscape(text));
    if (idx >= 0) return { xml: sstXml, index: idx };

    idx = items.length;
    var si = '<si><t xml:space="preserve">' + xmlEscape(text) + '</t></si>';
    var newXml = sstXml.replace('</sst>', si + '</sst>');
    // 更新 count / uniqueCount
    newXml = newXml.replace(/(<sst[^>]*\buniqueCount=")(\d+)(")/, function (_a, p, n, s) {
      return p + (parseInt(n, 10) + 1) + s;
    }).replace(/(<sst[^>]*\bcount=")(\d+)(")/, function (_a, p, n, s) {
      return p + (parseInt(n, 10) + 1) + s;
    });
    return { xml: newXml, index: idx };
  }

  /**
   * 定位 sheetData 中所有行的行号。
   * @param {string} sheetXml
   * @returns {number[]}
   */
  function rowNumbers(sheetXml) {
    var out = [];
    var re = /<row r="(\d+)"/g;
    var m;
    while ((m = re.exec(sheetXml)) !== null) out.push(parseInt(m[1], 10));
    return out;
  }

  global.TMCXml = {
    colLetter: colLetter, ref: ref, parseRef: parseRef,
    getCell: getCell, setCell: setCell, addSharedString: addSharedString,
    rowNumbers: rowNumbers, xmlEscape: xmlEscape,
  };
})(typeof window !== 'undefined' ? window : globalThis);
