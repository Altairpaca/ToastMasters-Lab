/* tmc-agenda-html/test/xlsx.test.js
 * xlsx 保真导出测试（Node 环境，直接 require tmc-core 的 xlsx-writer）。
 * 覆盖：ZIP 读写往返、XML 转义、calcChain 删除、空记录边界、单元格替换。
 * 用法：node test/xlsx.test.js
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

const path = require('path');
const TMC = require(path.resolve(__dirname, '../../tmc-core/index.js'));

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  \u2705 ' + name); }
  else { fail++; console.log('  \u274c ' + name + (extra ? '\n     ' + extra : '')); }
}
function section(t) { console.log('\n=== ' + t + ' ==='); }

const enc = TMC.xlsx._enc;

/* 1. ZIP 读写往返 */
section('1. ZIP 读写往返');
const entries = [
  { name: '[Content_Types].xml', data: enc.utf8Encode('<Types/>') },
  { name: 'xl/workbook.xml', data: enc.utf8Encode('<workbook/>') },
  { name: 'xl/worksheets/sheet1.xml', data: enc.utf8Encode('<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>') },
  { name: 'xl/sharedStrings.xml', data: enc.utf8Encode('<sst count="1" uniqueCount="1"><si><t>Hello</t></si></sst>') },
];
const bytes = TMC.xlsx.writeZip(entries);
ok('writeZip → Uint8Array', bytes instanceof Uint8Array && bytes.length > 0);
const back = TMC.xlsx.readZip(bytes);
ok('readZip entry 数一致', back.entries.length === 4);
ok('entry 名一致', back.entries.map(function (e) { return e.name; }).join(',') === entries.map(function (e) { return e.name; }).join(','));
ok('entry 内容一致', enc.utf8Decode(back.entries[3].data) === enc.utf8Decode(entries[3].data));
ok('validate 结构完整', TMC.xlsx.validate(bytes).ok === true);

/* 2. CRC32 */
section('2. CRC32');
ok('crc32 稳定（同输入同输出）', TMC.xlsx.crc32(enc.utf8Encode('abc')) === TMC.xlsx.crc32(enc.utf8Encode('abc')));
ok('crc32 不同输入不同', TMC.xlsx.crc32(enc.utf8Encode('abc')) !== TMC.xlsx.crc32(enc.utf8Encode('abd')));

/* 3. XML 转义 */
section('3. XML 转义');
ok('xmlEscape < > & " \'', TMC.xlsx.xmlEscape('<a>&"\'') === '&lt;a&gt;&amp;&quot;&apos;');

/* 4. 单元格替换 */
section('4. 单元格替换');
const sheet = '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>';
ok('setCell 替换已有 A1', TMC.xlsx.setCell(sheet, 'A1', '5', false).indexOf('<v>5</v>') > 0);
ok('setCell 保留原内容（不误删）', TMC.xlsx.setCell(sheet, 'A1', '5', false).indexOf('<row r="1"') >= 0);
ok('setCell 公式模式含 <f>', TMC.xlsx.setCell('<row r="2"></row>', 'B2', 'SUM(A1:A2)', true).indexOf('<f>SUM(A1:A2)</f>') > 0);

/* 5. patch + 删除 calcChain */
section('5. patch + 删除 calcChain');
const withChain = TMC.xlsx.writeZip(entries.concat([{ name: 'xl/calcChain.xml', data: enc.utf8Encode('<calcChain/>') }]));
ok('patch 前含 calcChain', TMC.xlsx.readZip(withChain).entries.some(function (e) { return /calcChain/.test(e.name); }));
const patched = TMC.xlsx.patch(withChain, [{ sheet: 'sheet1', ref: 'B1', value: '张三', isFormula: false }]);
ok('patch 后 calcChain 已删除', !TMC.xlsx.readZip(patched).entries.some(function (e) { return /calcChain/.test(e.name); }));
ok('patch 后 sheet1 仍存在', TMC.xlsx.readZip(patched).entries.some(function (e) { return /sheet1\.xml/.test(e.name); }));
ok('stripCalcChain 独立可用', !TMC.xlsx.readZip(TMC.xlsx.stripCalcChain(withChain)).entries.some(function (e) { return /calcChain/.test(e.name); }));

/* 6. 边界 */
section('6. 边界');
ok('空 edits 不报错', TMC.xlsx.patch(bytes, []).length > 0);
ok('validate 非法字节返回 ok:false', TMC.xlsx.validate(enc.utf8Encode('not a zip')).ok === false);
ok('readZip 非法字节抛错被 validate 捕获', (function () {
  try { TMC.xlsx.readZip(enc.utf8Encode('junk')); return false; } catch (e) { return true; }
})());

/* 7. 议程服务 buildCellEdits */
section('7. 议程 CellEdit 生成');
const app = TMC.createApp({});
const plan = app.agenda.buildAgenda({
  meeting_id: '2026-10-08_第335次', meeting_number: 335, date: '2026-10-08',
  start_time: '19:15', end_time: '21:30',
  agenda: [
    { segment_id: 'a', type: 'opening', title_zh: '召集', duration_min: 3 },
    { segment_id: 'b', type: 'closing', title_zh: '尾声', duration_min: 5 },
  ],
  meta: { version: '1.0', owner: 'Altair Li', updated_at: '2026-10-08T00:00:00Z' },
}, {});
const edits = app.agenda.buildCellEdits(plan, 3, 1);
ok('edits 数量 = 行数 × 3', edits.length === plan.rows.length * 3);
ok('首个 edit reference 为 B3', edits[0].ref === 'B3');
ok('时间列 edit 存在', edits.some(function (e) { return /^\d{2}:\d{2}-/.test(e.value); }));

console.log('\n' + '='.repeat(46));
console.log('结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
