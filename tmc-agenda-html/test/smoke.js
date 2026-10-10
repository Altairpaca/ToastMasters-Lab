/* tmc-agenda-html/test/smoke.js
 * 构建产物冒烟检查。用法：node test/smoke.js
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

const fs = require('fs');
const path = require('path');

const p = path.resolve(__dirname, '../dist/agenda-builder.html');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  \u2705 ' + name); }
  else { fail++; console.log('  \u274c ' + name + (extra ? '\n     ' + extra : '')); }
}

console.log('=== agenda-builder.html ===');
if (!fs.existsSync(p)) { ok('文件存在', false, '请先运行 node build/inline.js'); }
else {
  const src = fs.readFileSync(p, 'utf8');
  const kb = fs.statSync(p).size / 1024;
  ok('大小 ≤ 220KB (' + kb.toFixed(1) + 'KB)', kb <= 220);
  ok('无外部 src="http', src.indexOf('src="http') < 0);
  ok('无外部 href="http', !/href=["']https?:\/\//.test(src));
  ok('无 @import url(http', src.indexOf('@import url(http') < 0);
  ok('无占位符残留', ['/*__CORE__*/', '/*__HOST__*/', '/*__STYLE__*/', '/*__VIEWS__*/', '/*__XLSX__*/'].every(function (s) { return src.indexOf(s) < 0; }));
  ok('含 TMCZip 符号', src.indexOf('TMCZip') > 0);
  ok('含 TMCXml 符号', src.indexOf('TMCXml') > 0);
  ok('含 TMCBaseTemplate 符号', src.indexOf('TMCBaseTemplate') > 0);
  let parseErr = null;
  (src.match(/<script>([\s\S]*?)<\/script>/g) || []).forEach(function (block) {
    try { new Function(block.replace(/^<script>/, '').replace(/<\/script>$/, '')); } catch (e) { parseErr = e.message; }
  });
  ok('内联脚本可解析', !parseErr, parseErr || '');
}

console.log('\n' + '='.repeat(46));
console.log('结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
