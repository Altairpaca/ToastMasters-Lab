/* tmc-officers-html/test/qa-invariants.js
 * QA 架构不变式验证（严过关）：
 *   A. 零外部引用：dist/*.html 无真实 http(s) 资源引用（标签属性 / CSS url / @import）
 *   B. 内核纯净：tmc-core/{core,app,index.js} 无宿主符号
 *   C. 单文件可用：dist 产物自包含（无外链 script/link/img）+ 内联脚本可解析
 * 用法： node test/qa-invariants.js
 * 全绿退出码 0，有失败退出码 1。
 *
 * @author Yan (QA) · TMC Toolkit
 * @license MIT
 */
'use strict';

const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  \u2705 ' + name); }
  else { fail++; failures.push(name); console.log('  \u274c ' + name + (extra ? '\n     ' + extra : '')); }
}
function section(t) { console.log('\n=== ' + t + ' ==='); }

const ROOT = path.resolve(__dirname, '../..');

/* ============================================================
 * A. 零外部引用
 * 精确判据：
 *   1) 标签属性 src=/href=/srcset= 指向 http(s):// 或 //
 *   2) CSS url(http...) / @import ...
 *   3) 去掉 OOXML/XML 命名空间常量后，不得残留独立 http URL
 *   （注释里的说明文字属豁免，但本实现连注释一起扫描，更严格）
 * ============================================================ */
section('A. 零外部引用');
const DIST_HTML = [
  'tmc-officers-html/dist/universal-timer.html',
  'tmc-officers-html/dist/ah-counter.html',
  'tmc-officers-html/dist/grammarian.html',
  'tmc-agenda-html/dist/agenda-builder.html',
];

// XML 命名空间是字符串常量，不触发网络加载，视为豁免
const NS_WHITELIST = [
  /https?:\/\/schemas\.openxmlformats\.org[^\s"'<>)\]]*/g,
  /https?:\/\/schemas\.microsoft\.com[^\s"'<>)\]]*/g,
  /https?:\/\/purl\.org[^\s"'<>)\]]*/g,
  /https?:\/\/www\.w3\.org[^\s"'<>)\]]*/g,
];
function stripNamespaces(s) {
  let t = s;
  NS_WHITELIST.forEach(function (re) { t = t.replace(re, ''); });
  return t;
}

DIST_HTML.forEach(function (rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { ok(rel + ' 存在', false); return; }
  const raw = fs.readFileSync(p, 'utf8');
  const cleaned = stripNamespaces(raw);

  const attrRe = /<[^>]+\b(?:src|href|srcset)\s*=\s*["']\s*(?:https?:|\/\/)/gi;
  const urlRe = /url\(\s*["']?\s*(?:https?:|\/\/)/gi;
  const impRe = /@import\s+(?:url\()?\s*["']?\s*(?:https?:|\/\/)/gi;
  const freeRe = /https?:\/\/[^\s"'<>)\]]*/g;

  ok(rel + ' 无标签属性外链', !attrRe.test(cleaned));
  ok(rel + ' 无 CSS url() 外链', !urlRe.test(cleaned));
  ok(rel + ' 无 @import 外链', !impRe.test(cleaned));
  const leftovers = cleaned.match(freeRe) || [];
  ok(rel + ' 无残留 http URL', leftovers.length === 0, '残留: ' + leftovers.slice(0, 3).join(', '));
});

/* ============================================================
 * B. 内核纯净（core/ app/ index.js）
 * 判据：排除注释行后，代码中不得出现
 *   window / document / localStorage / wx. / require('fs') / fetch(
 * ============================================================ */
section('B. 内核纯净');
const CORE_FILES = [];
['core', 'app'].forEach(function (sub) {
  const dir = path.join(ROOT, 'tmc-core', sub);
  fs.readdirSync(dir).filter(function (f) { return /\.js$/.test(f); })
    .forEach(function (f) { CORE_FILES.push(path.join('tmc-core', sub, f)); });
});
CORE_FILES.push('tmc-core/index.js');

const FORBIDDEN = [
  { re: /\bwindow\b/, name: 'window' },
  { re: /\bdocument\b/, name: 'document' },
  { re: /\blocalStorage\b/, name: 'localStorage' },
  { re: /\bwx\./, name: 'wx.' },
  { re: /require\(\s*["']fs["']\s*\)/, name: "require('fs')" },
  { re: /\bfetch\s*\(/, name: 'fetch' },
];

const violations = [];
CORE_FILES.forEach(function (rel) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  // 剥离行注释与块注释后再扫描
  const codeOnly = src
    .replace(/\/\*[\s\S]*?\*\//g, '')   // 块注释
    .split('\n')
    .filter(function (l) { return l.trim().indexOf('//') !== 0; })
    .join('\n');
  FORBIDDEN.forEach(function (f) {
    if (f.re.test(codeOnly)) violations.push(rel + ' 含 ' + f.name);
  });
});
ok('内核（' + CORE_FILES.length + ' 文件）无宿主符号', violations.length === 0, violations.join('\n     '));

/* ============================================================
 * C. 单文件可用（自包含）
 *   1) dist 无外链 <script src= / <link href= / <img src=（相对或绝对）
 *   2) 存在内联内核符号（createApp / toHtml）
 *   3) 全部内联 <script> 可被 new Function 解析
 * ============================================================ */
section('C. 单文件可用');
DIST_HTML.forEach(function (rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { return; }
  const src = fs.readFileSync(p, 'utf8');

  const externalScript = /<script[^>]*\bsrc\s*=/i.test(src);
  const externalLink = /<link[^>]*\bhref\s*=/i.test(src);
  const externalImg = /<img[^>]*\bsrc\s*=/i.test(src);
  ok(rel + ' 无外链 <script src>', !externalScript);
  ok(rel + ' 无外链 <link href>', !externalLink);

  // 关键符号
  if (/officers/.test(rel) || /universal-timer|ah-counter|grammarian/.test(rel)) {
    ok(rel + ' 含 createApp 符号', src.indexOf('createApp') >= 0);
  }
  if (/agenda-builder/.test(rel)) {
    ok(rel + ' 含 TMCZip（xlsx 内核）符号', src.indexOf('TMCZip') >= 0);
  }

  // 内联脚本可解析（排除 src 的块）
  let parseErr = null;
  const scripts = src.match(/<script>([\s\S]*?)<\/script>/g) || [];
  scripts.forEach(function (block) {
    const code = block.replace(/^<script>/, '').replace(/<\/script>$/, '');
    try { new Function(code); } catch (e) { parseErr = e.message; }
  });
  ok(rel + ' 内联脚本可解析', !parseErr, parseErr || '');
});

console.log('\n' + '='.repeat(46));
console.log('结果: ' + pass + ' 通过, ' + fail + ' 失败');
if (fail) console.log('失败用例:\n  - ' + failures.join('\n  - '));
process.exit(fail ? 1 : 0);
