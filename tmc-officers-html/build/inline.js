#!/usr/bin/env node
/* tmc-officers-html/build/inline.js
 * 零依赖内联构建器：把 tmc-core 内核 + UI 样式 + 宿主装配内联进单文件 HTML。
 * 用法：node build/inline.js [--out dist]
 *
 * 原理：
 *  1) 读取 shell.html 的占位符（STYLE / CORE / STORE / VIEWS / HOST）并替换；
 *  2) 内核文件按固定依赖顺序转成 CJS 模块，注册进 bundle 模块表；
 *  3) 提供 require shim，把相对路径解析到模块表 —— 因此内核里 require('./x.js') 在浏览器可用。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CORE = path.resolve(ROOT, '../tmc-core');

/* 1) 按固定顺序收集内核文件（顺序即依赖顺序，显式声明避免时序问题） */
const CORE_FILES = [
  'ports/storage-port.js', 'ports/canvas-port.js', 'ports/clock-port.js',
  'ports/file-port.js', 'ports/net-port.js',
  'adapters/web-storage.js', 'adapters/web-canvas.js', 'adapters/system-clock.js',
  'adapters/web-file.js', 'adapters/null-net.js',
  'data/status-text.js', 'data/roles.js', 'data/wordlist-ah.js',
  'core/md-renderer.js', 'core/meeting-model.js', 'core/timer-core.js',
  'core/report-kernel.js', 'core/image-kernel.js', 'core/agenda-core.js',
  'core/xlsx-writer.js',
  'app/agenda-service.js', 'app/rsvp-service.js', 'app/officer-service.js',
  'app/minutes-service.js', 'index.js',
];

function read(rel) { return fs.readFileSync(path.join(CORE, rel), 'utf8'); }

/* 2) 组装内核：每个文件包成 (function(require,module,exports){...})，注册到模块表。
 *    require shim：把 './a.js' / '../data/b.js' 解析成相对 CORE 根的正规化路径。 */
function bundleCore() {
  const parts = [];
  parts.push('var __TMC_MODULES__ = {}; var __TMC_CACHE__ = {};');
  parts.push('function __tmcResolve(from, req){');
  parts.push('  if (req.charAt(0) !== \'.\') return req;');
  parts.push('  var base = from.split(\'/\').slice(0, -1);');
  parts.push('  var seg = req.split(\'/\');');
  parts.push('  for (var i=0;i<seg.length;i++){');
  parts.push('    var s = seg[i];');
  parts.push('    if (s === \'.\' || s === \'\') continue;');
  parts.push('    if (s === \'..\') base.pop(); else base.push(s);');
  parts.push('  }');
  parts.push('  return base.join(\'/\');');
  parts.push('}');
  parts.push('function __tmcRequire(from, req){');
  parts.push('  var id = __tmcResolve(from, req);');
  parts.push('  if (__TMC_CACHE__[id]) return __TMC_CACHE__[id].exports;');
  parts.push('  if (!__TMC_MODULES__[id]) throw new Error(\'module not found: \' + id);');
  parts.push('  var mod = { exports: {} };');
  parts.push('  __TMC_CACHE__[id] = mod;');
  parts.push('  __TMC_MODULES__[id](function(r){ return __tmcRequire(id, r); }, mod, mod.exports);');
  parts.push('  return mod.exports;');
  parts.push('}');

  CORE_FILES.forEach(function (rel) {
    const id = rel.replace(/\\/g, '/');
    parts.push('__TMC_MODULES__[' + JSON.stringify(id) + '] = function(require, module, exports){');
    parts.push(read(rel));
    parts.push('};');
  });

  // 暴露 window.TMC = require('index.js')
  parts.push('var TMC = __tmcRequire(\'\', \'index.js\');');
  parts.push('if (typeof globalThis !== \'undefined\') { globalThis.TMC = TMC; }');
  parts.push('if (typeof window !== \'undefined\') { window.TMC = TMC; }');
  return parts.join('\n');
}

function hostScript() { return fs.readFileSync(path.join(ROOT, 'src/host-web.js'), 'utf8'); }
function storeScript() { return fs.readFileSync(path.join(ROOT, 'src/store.js'), 'utf8'); }
function bundleCss() { return fs.readFileSync(path.join(ROOT, 'src/ui/shell.css'), 'utf8'); }

/* 视图脚本（按顺序拼接，作为宿主的一部分） */
const VIEW_FILES = [
  'src/ui/view-timer.js', 'src/ui/view-ah.js', 'src/ui/view-grammarian.js', 'src/ui/view-report.js',
];
function viewScripts() {
  return VIEW_FILES.map(function (rel) {
    return '/* ==== ' + rel + ' ==== */\n' + fs.readFileSync(path.join(ROOT, rel), 'utf8');
  }).join('\n');
}

function build(shellPath, outPath, defaultView) {
  let shell = fs.readFileSync(shellPath, 'utf8');
  shell = shell.replace('/*__STYLE__*/', function () { return bundleCss(); });
  shell = shell.replace('/*__CORE__*/', function () { return bundleCore(); });
  shell = shell.replace('/*__STORE__*/', function () { return storeScript(); });
  shell = shell.replace('/*__VIEWS__*/', function () { return viewScripts(); });
  shell = shell.replace('/*__HOST__*/', function () { return hostScript(); });
  shell = shell.replace(/__DEFAULT_VIEW__/g, function () { return defaultView || 'timer'; });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, shell, 'utf8');
  const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log('✅ ' + path.relative(ROOT, outPath) + '  (' + kb + ' KB)');
}

/* 3) 生成三个三官文件（同一外壳，不同默认视图） */
const DIST = path.join(ROOT, 'dist');
const SHELL = path.join(ROOT, 'src/ui/shell.html');
[
  { name: 'universal-timer', view: 'timer' },
  { name: 'ah-counter', view: 'ah' },
  { name: 'grammarian', view: 'grammarian' },
].forEach(function (item) {
  build(SHELL, path.join(DIST, item.name + '.html'), item.view);
});
