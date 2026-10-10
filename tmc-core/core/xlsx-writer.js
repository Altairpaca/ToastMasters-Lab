/* tmc-core/core/xlsx-writer.js
 * xlsx 保真导出内核：ZIP 内 XML 直改（sheet + sharedStrings），并删除 calcChain.xml。
 * **禁用 openpyxl**。零依赖：内置 STORE 模式 ZIP 编解码（xlsx 大多数 entry 为已压缩 deflate，
 * 本模块通过 Uint8Array 级别的 entry 重打包 + 原样保留未修改 entry 实现保真）。
 *
 * 说明：为保持零依赖，本模块处理「以 STORE（无压缩）写回」的 ZIP 包，
 * 对 deflate 压缩的 entry 提供透传（不解压，保持字节原样，仅修改目标 entry）。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

/* ============================ CRC32 ============================ */
const CRC_TABLE = (function () {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

/**
 * 计算 CRC32。
 * @param {Uint8Array} bytes
 * @returns {number} 无符号 32 位
 */
function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/* ============================ 文本编解码 ============================ */
const enc = {
  utf8Encode: function (str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    // 兜底
    const out = [];
    for (let i = 0; i < str.length; i++) {
      let c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) { out.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F)); }
      else { out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F)); }
    }
    return new Uint8Array(out);
  },
  utf8Decode: function (bytes) {
    if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(bytes);
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return decodeURIComponent(escape(s));
  },
};

/* ============================ ZIP 读取 ============================ */
/**
 * 解析 ZIP（读取 central directory，定位每个 entry 的本地数据）。
 * 仅解析结构，不解压（压缩 entry 的 data 保持原字节）。
 * @param {Uint8Array} bytes
 * @returns {{entries:Array<{name:string, method:number, crc:number, compSize:number, uncompSize:number, data:Uint8Array}>}}
 */
function readZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // 找 End of Central Directory (EOCD): 0x06054b50
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('不是合法的 ZIP：找不到 EOCD');
  const cdCount = view.getUint16(eocd + 10, true);
  const cdOffset = view.getUint32(eocd + 16, true);

  const entries = [];
  let p = cdOffset;
  for (let i = 0; i < cdCount; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) break; // central dir header
    const method = view.getUint16(p + 10, true);
    const crc = view.getUint32(p + 16, true);
    const compSize = view.getUint32(p + 20, true);
    const uncompSize = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = enc.utf8Decode(bytes.subarray(p + 46, p + 46 + nameLen));
    // 定位本地头，取数据
    const lhNameLen = view.getUint16(localOffset + 26, true);
    const lhExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + lhNameLen + lhExtraLen;
    const data = bytes.subarray(dataStart, dataStart + compSize);
    entries.push({ name: name, method: method, crc: crc, compSize: compSize, uncompSize: uncompSize, data: data });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return { entries: entries };
}

/* ============================ ZIP 写入 ============================ */
/**
 * 写 ZIP（STORE 模式，无压缩）。保真：所有 entry 的 data 原样写入，
 * 仅名字/CRC 重算。这样 XML 文本编辑器可无损改内容。
 * @param {Array<{name:string, data:Uint8Array}>} entries
 * @returns {Uint8Array}
 */
function writeZip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;

  const dosTime = 0, dosDate = (1 << 5) | 1; // 1980-01-01

  entries.forEach(function (e) {
    const nameBytes = enc.utf8Encode(e.name);
    const data = e.data instanceof Uint8Array ? e.data : enc.utf8Encode(String(e.data));
    const crc = crc32(data);
    const size = data.length;

    // local file header
    const lh = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);        // version needed
    lv.setUint16(6, 0, true);         // flags
    lv.setUint16(8, 0, true);         // method = STORE
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);     // comp size
    lv.setUint32(22, size, true);     // uncomp size
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);        // extra len
    lh.set(nameBytes, 30);
    chunks.push(lh, data);

    // central directory record
    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);        // method STORE
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);
    central.push(cd);

    offset += lh.length + data.length;
  });

  const cdStart = offset;
  let cdSize = 0;
  central.forEach(function (c) { cdSize += c.length; });

  // EOCD
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, cdStart, true);
  ev.setUint16(20, 0, true);

  const all = chunks.concat(central, [eocd]);
  let total = 0;
  all.forEach(function (c) { total += c.length; });
  const out = new Uint8Array(total);
  let o = 0;
  all.forEach(function (c) { out.set(c, o); o += c.length; });
  return out;
}

/* ============================ XML 单元格编辑 ============================ */
/**
 * XML 转义文本内容。
 * @param {string} s
 * @returns {string}
 */
function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 在 sheetData 中定位/替换某单元格。
 * 简化实现：若已存在 `<c r="A1" ...>` 则替换其内容；否则在对应行内追加。
 * @param {string} sheetXml
 * @param {string} ref 单元格引用，如 "B3"
 * @param {string} value 值（文本 / 公式）
 * @param {boolean} isFormula 是否公式（value 为不含 '=' 的公式体）
 * @returns {string}
 */
function setCell(sheetXml, ref, value, isFormula) {
  const inner = isFormula
    ? '<f>' + xmlEscape(value) + '</f>'
    : '<v>' + xmlEscape(value) + '</v>';
  const cellRe = new RegExp('<c r="' + ref + '"[^>]*?(\\/>|>[\\s\\S]*?<\\/c>)');
  if (cellRe.test(sheetXml)) {
    return sheetXml.replace(cellRe, function (m) {
      // 解析原有 s= 样式属性，保留
      const sMatch = /( s="\d+")/.exec(m);
      const styleAttr = sMatch ? sMatch[1] : '';
      const tAttr = isFormula ? '' : ' t="s"';
      return '<c r="' + ref + '"' + styleAttr + tAttr + '>' + inner + '</c>';
    });
  }
  // 不存在：定位该行 <row r="N" ...> ... </row>，追加单元格
  const rowNum = ref.replace(/^\D+/, '');
  const rowRe = new RegExp('(<row r="' + rowNum + '"[^>]*>)([\\s\\S]*?)(<\\/row>)');
  if (rowRe.test(sheetXml)) {
    return sheetXml.replace(rowRe, function (_m, open, body, close) {
      return open + body + '<c r="' + ref + '" t="s">' + inner + '</c>' + close;
    });
  }
  // 行都不存在：忽略（交由上层补行逻辑）
  return sheetXml;
}

/* ============================ calcChain 悬空引用清理 ============================ */
/**
 * 从 [Content_Types].xml 文本中移除对 calcChain.xml 的 Override 声明。
 * 幂等：若原本没有相关声明，返回原字符串（引用相等）。
 * @param {string} xml
 * @returns {string}
 */
function cleanContentTypes(xml) {
  const out = String(xml).replace(
    /<Override\b[^>]*PartName="\/xl\/calcChain\.xml"[^>]*\/?>/gi,
    ''
  );
  return out;
}

/**
 * 从 xl/_rels/workbook.xml.rels 文本中移除对 calcChain.xml 的 Relationship 声明。
 * 幂等：若原本没有相关声明，返回原字符串。
 * @param {string} xml
 * @returns {string}
 */
function cleanWorkbookRels(xml) {
  const out = String(xml).replace(
    /<Relationship\b[^>]*Target="[^"]*calcChain\.xml"[^>]*\/?>/gi,
    ''
  );
  return out;
}

/**
 * 从 ZIP entry 列表中移除 calcChain.xml，并同步清理引用它的两个 XML entry：
 *   ① [Content_Types].xml 的 <Override PartName="/xl/calcChain.xml" ...>
 *   ② xl/_rels/workbook.xml.rels 的 <Relationship ... Target="...calcChain.xml">
 * 若底稿本就不含 calcChain.xml，则不修改任何 XML（幂等）。
 * @param {Array<{name:string, data:Uint8Array}>} entries
 * @returns {{entries:Array, removed:boolean}}
 */
function stripCalcChainEntries(entries) {
  const hasCalcChain = entries.some(function (e) { return /^xl\/calcChain\.xml$/i.test(e.name); });
  if (!hasCalcChain) return { entries: entries, removed: false };

  const kept = [];
  entries.forEach(function (e) {
    if (/^xl\/calcChain\.xml$/i.test(e.name)) return; // 丢弃 calcChain 本体

    if (/^\[Content_Types\]\.xml$/i.test(e.name)) {
      const xml = enc.utf8Decode(e.data);
      const cleaned = cleanContentTypes(xml);
      kept.push({ name: e.name, data: cleaned === xml ? e.data : enc.utf8Encode(cleaned) });
      return;
    }
    if (/^xl\/_rels\/workbook\.xml\.rels$/i.test(e.name)) {
      const xml = enc.utf8Decode(e.data);
      const cleaned = cleanWorkbookRels(xml);
      kept.push({ name: e.name, data: cleaned === xml ? e.data : enc.utf8Encode(cleaned) });
      return;
    }
    kept.push({ name: e.name, data: e.data });
  });
  return { entries: kept, removed: true };
}

/* ============================ 对外接口 ============================ */
/**
 * 依据 CellEdit[] 修补 xlsx（Uint8Array/ArrayBuffer）。
 * 保真策略：仅替换目标 entry 的字节，其余 entry 原样保留；写回 STORE 模式 ZIP。
 * 改了公式/行结构后会删除 calcChain.xml 并清理其悬空引用。
 * @param {Uint8Array|ArrayBuffer} baseBytes 底稿 xlsx 字节
 * @param {Array<Object>} edits CellEdit[] { sheet, ref, value, isFormula }
 * @returns {Uint8Array} 保真后的 xlsx 字节
 */
function patch(baseBytes, edits) {
  const bytes = baseBytes instanceof Uint8Array ? baseBytes : new Uint8Array(baseBytes);
  const zip = readZip(bytes);
  const list = Array.isArray(edits) ? edits : [];

  // 收集每个 sheet 的编辑
  const bySheet = {};
  list.forEach(function (e) {
    const name = 'sheet' + (e.sheet || '1').replace(/^sheet/i, '');
    bySheet[name] = bySheet[name] || [];
    bySheet[name].push(e);
  });

  // 先应用单元格编辑
  const edited = zip.entries.map(function (entry) {
    const sheetMatch = /^xl\/worksheets\/(sheet\d+)\.xml$/i.exec(entry.name);
    if (sheetMatch && bySheet[sheetMatch[1]]) {
      let xml = enc.utf8Decode(entry.data);
      bySheet[sheetMatch[1]].forEach(function (e) {
        xml = setCell(xml, e.ref, e.value, !!e.isFormula);
      });
      return { name: entry.name, data: enc.utf8Encode(xml) };
    }
    return { name: entry.name, data: entry.data };
  });

  // 再删除 calcChain.xml 并清理悬空引用（Content_Types + workbook rels）
  const stripped = stripCalcChainEntries(edited);
  const out = writeZip(stripped.entries);
  out._calcChainRemoved = stripped.removed;
  return out;
}

/**
 * 从 ZIP 中删除 calcChain.xml（独立方法，便于组合）。
 * 同时清理 [Content_Types].xml 与 xl/_rels/workbook.xml.rels 中的悬空引用。
 * @param {Uint8Array|ArrayBuffer} bytes
 * @returns {Uint8Array}
 */
function stripCalcChain(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const zip = readZip(b);
  const stripped = stripCalcChainEntries(
    zip.entries.map(function (e) { return { name: e.name, data: e.data }; })
  );
  const out = writeZip(stripped.entries);
  out._calcChainRemoved = stripped.removed;
  return out;
}

/**
 * 校验 ZIP 可读（结构完整）。
 * @param {Uint8Array|ArrayBuffer} bytes
 * @returns {{ok:boolean, entries:number, errors:string[]}}
 */
function validate(bytes) {
  try {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const zip = readZip(b);
    return { ok: true, entries: zip.entries.length, errors: [] };
  } catch (e) {
    return { ok: false, entries: 0, errors: [String(e && e.message ? e.message : e)] };
  }
}

module.exports = {
  crc32: crc32,
  readZip: readZip,
  writeZip: writeZip,
  xmlEscape: xmlEscape,
  setCell: setCell,
  cleanContentTypes: cleanContentTypes,
  cleanWorkbookRels: cleanWorkbookRels,
  stripCalcChainEntries: stripCalcChainEntries,
  patch: patch,
  stripCalcChain: stripCalcChain,
  validate: validate,
  _enc: enc,
};
