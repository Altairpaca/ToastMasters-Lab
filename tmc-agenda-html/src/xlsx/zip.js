/* tmc-agenda-html/src/xlsx/zip.js
 * 零依赖 ZIP 读写（浏览器可用）。复用 tmc-core 的 xlsx-writer（同一套 CRC32 / ZIP 结构）。
 * 提供更直白的 API：unzip(bytes) → entries[]，zip(entries) → Uint8Array。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
(function (global) {
  'use strict';
  var TMC = global.TMC;
  var writer = TMC.xlsx; // tmc-core/core/xlsx-writer.js

  /**
   * 解包 ZIP。
   * @param {Uint8Array|ArrayBuffer} bytes
   * @returns {Array<{name:string, method:number, data:Uint8Array}>}
   */
  function unzip(bytes) {
    var b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    return writer.readZip(b).entries;
  }

  /**
   * 打包 ZIP（STORE 模式）。
   * @param {Array<{name:string, data:Uint8Array|string}>} entries
   * @returns {Uint8Array}
   */
  function zip(entries) {
    return writer.writeZip(entries);
  }

  /**
   * 以文本读取某个 entry。
   * @param {Array} entries
   * @param {string} name
   * @returns {string|null}
   */
  function readText(entries, name) {
    var e = entries.filter(function (x) { return x.name === name; })[0];
    return e ? writer._enc.utf8Decode(e.data) : null;
  }

  /**
   * 写入/替换某 entry 的文本内容（返回新的 entries 数组）。
   * @param {Array} entries
   * @param {string} name
   * @param {string} text
   * @returns {Array}
   */
  function writeText(entries, name, text) {
    var found = false;
    var out = entries.map(function (e) {
      if (e.name === name) { found = true; return { name: name, data: writer._enc.utf8Encode(text) }; }
      return { name: e.name, data: e.data };
    });
    if (!found) out.push({ name: name, data: writer._enc.utf8Encode(text) });
    return out;
  }

  /**
   * 删除某 entry。
   * 特别处理 calcChain.xml：同步清理 [Content_Types].xml 与
   * xl/_rels/workbook.xml.rels 中的悬空引用，避免 Excel 判为损坏。
   * @param {Array} entries
   * @param {string} name
   * @returns {Array}
   */
  function removeEntry(entries, name) {
    if (/^xl\/calcChain\.xml$/i.test(name)) {
      return writer.stripCalcChainEntries(entries).entries;
    }
    return entries.filter(function (e) { return e.name !== name; }).map(function (e) {
      return { name: e.name, data: e.data };
    });
  }

  /**
   * 显式删除 calcChain.xml 并清理悬空引用（幂等）。
   * @param {Array} entries
   * @returns {Array}
   */
  function stripCalcChain(entries) {
    return writer.stripCalcChainEntries(entries).entries;
  }

  global.TMCZip = {
    unzip: unzip, zip: zip, readText: readText, writeText: writeText, removeEntry: removeEntry,
    stripCalcChain: stripCalcChain,
    crc32: writer.crc32,
  };
})(typeof window !== 'undefined' ? window : globalThis);
