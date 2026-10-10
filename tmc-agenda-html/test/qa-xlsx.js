/* tmc-agenda-html/test/qa-xlsx.js
 * QA 独立测试（严过关）：xlsx 保真导出的结构与完整性验证。
 * 关注点：
 *   1) 导出产物保留 xl/media/*（Logo/二维码）与 xl/drawings/*（EMF/Drawing）
 *   2) 已删除 xl/calcChain.xml（改公式/行结构后必须删）
 *   3) [Content_Types].xml 与 xl/_rels/workbook.xml.rels 无「悬空引用」
 *      （即：引用了已被删除的 part，如 calcChain）
 *   4) ZIP 读写往返一致性
 *
 * 用法： node test/qa-xlsx.js
 * 全绿退出码 0，有失败退出码 1。
 *
 * @author Yan (QA) · TMC Toolkit
 * @license MIT
 */
'use strict';

const path = require('path');
const TMC = require(path.resolve(__dirname, '../../tmc-core/index.js'));

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  \u2705 ' + name); }
  else { fail++; failures.push(name); console.log('  \u274c ' + name + (extra ? '\n     ' + extra : '')); }
}
function section(t) { console.log('\n=== ' + t + ' ==='); }

const enc = TMC.xlsx._enc;
const U = function (s) { return enc.utf8Encode(s); };

/* ============================================================
 * 构造一份「结构逼真」的底稿 xlsx（含 media/drawings/calcChain/rels）
 * STORE 模式（与生产写回一致），二进制 media 用伪 PNG 字节。
 * ============================================================ */
function buildBaseXlsx() {
  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Default Extension="png" ContentType="image/png"/>' +
    '<Default Extension="emf" ContentType="image/x-emf"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' +
    '<Override PartName="/xl/calcChain.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.calcChain+xml"/>' +
    '</Types>';

  // 真实结构：drawing 由 worksheet 引用（worksheet _rels），workbook.rels 仅引用
  // worksheet / sharedStrings / calcChain。这样悬空检查不会因我造的结构不合规而误报。
  const workbookRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>' +
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/calcChain" Target="calcChain.xml"/>' +
    '</Relationships>';

  const sheetRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>' +
    '</Relationships>';

  const sheet1 =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetData>' +
    '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>' +
    '<row r="2"><c r="A2" t="s"><v>2</v></c></row>' +
    '<row r="3"><c r="A3"><f>SUM(1,2)</f><v>3</v></c></row>' +
    '</sheetData>' +
    '<drawing r:id="rId1"/>' +
    '</worksheet>';

  const drawing1 =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing">' +
    '<xdr:twoCellAnchor><xdr:pic><xdr:blipFill>' +
    '<a:blip xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" r:embed="rId1"/>' +
    '</xdr:blipFill></xdr:pic></xdr:twoCellAnchor></xdr:wsDr>';

  const mediaPng = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3, 4, 5]);
  const mediaEmf = new Uint8Array([0x01, 0x00, 0x00, 0x00, 0x9A, 0x9B, 0xAA, 0xBB]);

  return TMC.xlsx.writeZip([
    { name: '[Content_Types].xml', data: U('') && U(contentTypes) },
    { name: '_rels/.rels', data: U('<?xml version="1.0"?><Relationships/>') },
    { name: 'xl/workbook.xml', data: U('<?xml version="1.0"?><workbook><sheets><sheet name="议程" sheetId="1" r:id="rId1"/></sheets></workbook>') },
    { name: 'xl/_rels/workbook.xml.rels', data: U(workbookRels) },
    { name: 'xl/worksheets/sheet1.xml', data: U(sheet1) },
    { name: 'xl/worksheets/_rels/sheet1.xml.rels', data: U(sheetRels) },
    { name: 'xl/sharedStrings.xml', data: U('<?xml version="1.0"?><sst count="3" uniqueCount="3"><si><t>环节</t></si><si><t>时间</t></si><si><t>会议召集</t></si></sst>') },
    { name: 'xl/drawings/drawing1.xml', data: U(drawing1) },
    { name: 'xl/drawings/_rels/drawing1.xml.rels', data: U('<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>') },
    { name: 'xl/media/image1.png', data: mediaPng },
    { name: 'xl/media/image2.emf', data: mediaEmf },
    { name: 'xl/calcChain.xml', data: U('<?xml version="1.0"?><calcChain xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><c r="A3" i="1"/></calcChain>') },
  ]);
}

const base = buildBaseXlsx();
const names = function (bytes) { return TMC.xlsx.readZip(bytes).entries.map(function (e) { return e.name; }); };
const decodeEntry = function (bytes, n) {
  const e = TMC.xlsx.readZip(bytes).entries.filter(function (x) { return x.name === n; })[0];
  return e ? enc.utf8Decode(e.data) : null;
};
const bytesEqual = function (a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

/* ============================================================
 * 1. 底稿构造自检
 * ============================================================ */
section('1. 底稿构造自检');
const baseNames = names(base);
ok('底稿含 xl/media/image1.png', baseNames.indexOf('xl/media/image1.png') >= 0);
ok('底稿含 xl/media/image2.emf（EMF 对象）', baseNames.indexOf('xl/media/image2.emf') >= 0);
ok('底稿含 xl/drawings/drawing1.xml', baseNames.indexOf('xl/drawings/drawing1.xml') >= 0);
ok('底稿含 xl/calcChain.xml', baseNames.indexOf('xl/calcChain.xml') >= 0);

/* ============================================================
 * 2. patch 后：media / drawings 保真
 * ============================================================ */
section('2. patch 后 media / drawings 保真');
const edited = TMC.xlsx.patch(base, [
  { sheet: 'sheet1', ref: 'B1', value: '环节名称', isFormula: false },
  { sheet: 'sheet1', ref: 'A2', value: '会议召集', isFormula: false },
  { sheet: 'sheet1', ref: 'A3', value: 'SUM(A1:A2)', isFormula: true },
]);
const editedNames = names(edited);

ok('patch 后仍保留 xl/media/image1.png（Logo/二维码）', editedNames.indexOf('xl/media/image1.png') >= 0);
ok('patch 后仍保留 xl/media/image2.emf', editedNames.indexOf('xl/media/image2.emf') >= 0);
ok('patch 后仍保留 xl/drawings/drawing1.xml（Drawing）', editedNames.indexOf('xl/drawings/drawing1.xml') >= 0);
ok('patch 后仍保留 drawing1.xml.rels', editedNames.indexOf('xl/drawings/_rels/drawing1.xml.rels') >= 0);

// 二进制保真：media 字节必须一字不差
const onPng = TMC.xlsx.readZip(edited).entries.filter(function (e) { return e.name === 'xl/media/image1.png'; })[0];
const onEmf = TMC.xlsx.readZip(edited).entries.filter(function (e) { return e.name === 'xl/media/image2.emf'; })[0];
const basePng = TMC.xlsx.readZip(base).entries.filter(function (e) { return e.name === 'xl/media/image1.png'; })[0].data;
const baseEmf = TMC.xlsx.readZip(base).entries.filter(function (e) { return e.name === 'xl/media/image2.emf'; })[0].data;
ok('PNG 字节级保真', bytesEqual(onPng.data, basePng));
ok('EMF 字节级保真', bytesEqual(onEmf.data, baseEmf));

/* ============================================================
 * 3. calcChain 删除 + 悬空引用检查
 * ============================================================ */
section('3. calcChain 删除与引用完整性');
ok('patch 后 xl/calcChain.xml 已删除', editedNames.indexOf('xl/calcChain.xml') < 0);

const editedCT = decodeEntry(edited, '[Content_Types].xml');
const editedRels = decodeEntry(edited, 'xl/_rels/workbook.xml.rels');

ok('[Content_Types].xml 仍存在且可解析', editedCT !== null && editedCT.indexOf('<Types') >= 0);

// 悬空引用判据：任何 Override PartName 若指向不存在的 entry → 悬空
const overrideParts = [];
const ovRe = /PartName="([^"]+)"/g;
let m;
while ((m = ovRe.exec(editedCT)) !== null) { overrideParts.push(m[1].replace(/^\//, '')); }
const danglingCT = overrideParts.filter(function (p) { return editedNames.indexOf(p) < 0; });
ok('[Content_Types].xml 无悬空 Override 引用', danglingCT.length === 0,
  '悬空: ' + JSON.stringify(danglingCT) + ' | 现有: ' + JSON.stringify(editedNames));

// 若仍存在 calcChain 的 Override，则明确标注
ok('[Content_Types].xml 不再声明 calcChain', editedCT.indexOf('calcChain') < 0,
  '仍含 calcChain 声明');

// workbook.xml.rels 悬空引用：Target 相对 xl/ 解析后指向不存在的 part
const relTargets = [];
const tgtRe = /Target="([^"]+)"/g;
while ((m = tgtRe.exec(editedRels)) !== null) { relTargets.push(m[1]); }
const danglingRels = relTargets.filter(function (t) {
  if (/^https?:/.test(t)) return false;
  const resolved = t.replace(/^\.\.\//, '').replace(/^\//, '');
  const full = t.indexOf('../') === 0 ? resolved : ('xl/' + resolved);
  return editedNames.indexOf(full) < 0;
});
ok('xl/_rels/workbook.xml.rels 无悬空引用', danglingRels.length === 0,
  '悬空: ' + JSON.stringify(danglingRels));
ok('workbook.xml.rels 不再引用 calcChain', editedRels.indexOf('calcChain') < 0,
  '仍含 calcChain 关系');

// worksheet 级 rels 的 drawing 引用是否仍能被满足（Drawing 保真链路）
const editedSheetRels = decodeEntry(edited, 'xl/worksheets/_rels/sheet1.xml.rels');
const srTarget = /Target="([^"]+)"/.exec(editedSheetRels || '');
const srFull = srTarget ? ('xl/' + srTarget[1].replace(/^\.\.\//, '')) : null;
ok('sheet1.xml.rels 的 drawing 引用目标存在（Drawing 保真）',
  !!srFull && editedNames.indexOf(srFull) >= 0, String(srFull));

/* ============================================================
 * 4. 单元格写入正确性
 * ============================================================ */
section('4. 单元格写入正确性');
const sheetOut = decodeEntry(edited, 'xl/worksheets/sheet1.xml');
ok('sheet1 写入新文本单元格（环节名称）', sheetOut.indexOf('环节名称') >= 0);
ok('sheet1 写入公式单元格（<f>SUM(A1:A2)</f>）', sheetOut.indexOf('<f>SUM(A1:A2)</f>') >= 0);
ok('sheet1 未破坏既有单元格引用（A1 仍在）', sheetOut.indexOf('r="A1"') >= 0);

/* ============================================================
 * 5. ZIP 读写往返一致性
 * ============================================================ */
section('5. ZIP 读写往返一致性');
const roundtrip = TMC.xlsx.writeZip(
  TMC.xlsx.readZip(edited).entries.map(function (e) { return { name: e.name, data: e.data }; })
);
ok('往返后 entry 数一致', names(roundtrip).length === editedNames.length);
ok('往返后 entry 名集合一致', names(roundtrip).join(',') === editedNames.join(','));
ok('往返后 media 字节仍一致',
  bytesEqual(
    TMC.xlsx.readZip(roundtrip).entries.filter(function (e) { return e.name === 'xl/media/image1.png'; })[0].data,
    onPng.data));
ok('往返后 validate 结构完整', TMC.xlsx.validate(roundtrip).ok === true);

/* ============================================================
 * 6. stripCalcChain 独立可用 + 幂等
 * ============================================================ */
section('6. stripCalcChain');
const stripped = TMC.xlsx.stripCalcChain(base);
ok('stripCalcChain 删除 calcChain', names(stripped).indexOf('xl/calcChain.xml') < 0);
ok('stripCalcChain 保留 media', names(stripped).indexOf('xl/media/image1.png') >= 0);
ok('stripCalcChain 幂等（二次调用不变）',
  names(TMC.xlsx.stripCalcChain(stripped)).join(',') === names(stripped).join(','));

/* ============================================================
 * 7. 边界
 * ============================================================ */
section('7. 边界');
ok('空 edits 不抛异常且保留结构', names(TMC.xlsx.patch(base, [])).indexOf('xl/media/image1.png') >= 0);
ok('validate 非法字节返回 ok:false', TMC.xlsx.validate(U('not a zip')).ok === false);

/* ============================================================
 * 8. calcChain 引用清理的对抗性检查
 * ============================================================ */
section('8. calcChain 引用清理（对抗性）');

// 8.1 无 calcChain 底稿：patch 不应改动 CT / rels 的既有语义（幂等保护）
const noCC = TMC.xlsx.writeZip([
  { name: '[Content_Types].xml', data: U('<Types><Override PartName="/xl/worksheets/sheet1.xml" ContentType="x"/></Types>') },
  { name: 'xl/_rels/workbook.xml.rels', data: U('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>') },
  { name: 'xl/worksheets/sheet1.xml', data: U('<worksheet><sheetData><row r="1"><c r="A1"><v>1</v></c></row></sheetData></worksheet>') },
]);
const noCCOut = TMC.xlsx.patch(noCC, [{ sheet: 'sheet1', ref: 'A1', value: '2', isFormula: false }]);
ok('无 calcChain 时 CT 语义保留',
  decodeEntry(noCCOut, '[Content_Types].xml').indexOf('worksheets/sheet1.xml') >= 0);
ok('无 calcChain 时 rels 语义保留',
  decodeEntry(noCCOut, 'xl/_rels/workbook.xml.rels').indexOf('worksheets/sheet1.xml') >= 0);

// 8.2 多关系 + calcChain：清理 calcChain 的同时保留其余关系
const multi = TMC.xlsx.writeZip([
  { name: '[Content_Types].xml', data: U('<Types><Override PartName="/xl/worksheets/sheet1.xml" ContentType="x"/><Override PartName="/xl/sharedStrings.xml" ContentType="s"/><Override PartName="/xl/calcChain.xml" ContentType="c"/></Types>') },
  { name: 'xl/_rels/workbook.xml.rels', data: U('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="sharedStrings.xml"/><Relationship Id="rId3" Target="calcChain.xml"/></Relationships>') },
  { name: 'xl/worksheets/sheet1.xml', data: U('<worksheet><sheetData><row r="1"><c r="A1"><f>1+1</f><v>2</v></c></row></sheetData></worksheet>') },
  { name: 'xl/calcChain.xml', data: U('<calcChain/>') },
]);
const multiOut = TMC.xlsx.patch(multi, [{ sheet: 'sheet1', ref: 'A1', value: 'SUM(1,2)', isFormula: true }]);
const mCT = decodeEntry(multiOut, '[Content_Types].xml');
const mRels = decodeEntry(multiOut, 'xl/_rels/workbook.xml.rels');
ok('多关系：CT 的 calcChain Override 已除', mCT.indexOf('calcChain') < 0);
ok('多关系：CT 的 sheet + sharedStrings Override 保留',
  mCT.indexOf('worksheets/sheet1.xml') >= 0 && mCT.indexOf('sharedStrings.xml') >= 0);
ok('多关系：rels 的 calcChain 已除', mRels.indexOf('calcChain') < 0);
ok('多关系：rels 其余关系保留',
  mRels.indexOf('worksheets/sheet1.xml') >= 0 && mRels.indexOf('sharedStrings.xml') >= 0);

// 8.3 幂等：对已清理结果再次 patch 不报错且仍无 calcChain
const again = TMC.xlsx.patch(multiOut, [{ sheet: 'sheet1', ref: 'A2', value: '3', isFormula: false }]);
ok('二次 patch 结构完整', TMC.xlsx.validate(again).ok === true);
ok('二次 patch 仍无 calcChain 声明', decodeEntry(again, '[Content_Types].xml').indexOf('calcChain') < 0);

console.log('\n' + '='.repeat(46));
console.log('结果: ' + pass + ' 通过, ' + fail + ' 失败');
if (fail) console.log('失败用例:\n  - ' + failures.join('\n  - '));
process.exit(fail ? 1 : 0);
