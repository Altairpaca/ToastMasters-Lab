/* tmc-officers-html/test/smoke.js
 * 构建产物冒烟检查：大小 / 零外部引用 / 无占位符残留 / 可解析 / 关键符号。
 * 用法：node test/smoke.js
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DIST = path.resolve(__dirname, '../dist');
const FILES = ['universal-timer.html', 'ah-counter.html', 'grammarian.html'];

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  \u2705 ' + name); }
  else { fail++; console.log('  \u274c ' + name + (extra ? '\n     ' + extra : '')); }
}

FILES.forEach(function (f) {
  const p = path.join(DIST, f);
  console.log('\n=== ' + f + ' ===');
  if (!fs.existsSync(p)) { ok('文件存在', false, p + ' 不存在，请先运行 node build/inline.js'); return; }
  const src = fs.readFileSync(p, 'utf8');
  const kb = fs.statSync(p).size / 1024;
  ok('大小 ≤ 200KB (' + kb.toFixed(1) + 'KB)', kb <= 200);
  ok('无外部 src="http', src.indexOf('src="http') < 0 && src.indexOf("src='http") < 0);
  ok('无外部 href="http（注释除外）', !/href=["']https?:\/\//.test(src));
  ok('无 @import url(http', src.indexOf('@import url(http') < 0);
  ok('无占位符残留', src.indexOf('/*__CORE__*/') < 0 && src.indexOf('/*__HOST__*/') < 0 &&
    src.indexOf('/*__STYLE__*/') < 0 && src.indexOf('/*__VIEWS__*/') < 0 && src.indexOf('/*__STORE__*/') < 0);
  ok('无 __DEFAULT_VIEW__ 残留', src.indexOf('__DEFAULT_VIEW__') < 0);
  ok('含 createApp 符号', src.indexOf('createApp') > 0);
  ok('含 buildReportImage/render 符号', src.indexOf('buildReportImage') > 0 || src.indexOf('function render') > 0);
  ok('含 mdToHtml 等价（toHtml）', src.indexOf('function toHtml') > 0);
  // 检查所有内联 <script> 可被 new Function 解析
  let parseErr = null;
  const scripts = src.match(/<script>([\s\S]*?)<\/script>/g) || [];
  scripts.forEach(function (block) {
    const code = block.replace(/^<script>/, '').replace(/<\/script>$/, '');
    try { new Function(code); } catch (e) { parseErr = e.message; }
  });
  ok('内联脚本可解析', !parseErr, parseErr || '');
});

console.log('\n' + '='.repeat(46));
console.log('结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
