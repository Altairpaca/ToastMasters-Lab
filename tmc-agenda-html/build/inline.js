#!/usr/bin/env node
/* tmc-agenda-html/build/inline.js
 * 零依赖内联构建器：把 tmc-core 内核 + xlsx 模块 + UI + 宿主装配内联进单文件 HTML。
 * 用法：node build/inline.js
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CORE = path.resolve(ROOT, '../tmc-core');

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

function readCore(rel) { return fs.readFileSync(path.join(CORE, rel), 'utf8'); }

function bundleCore() {
  const parts = [];
  parts.push('var __TMC_MODULES__ = {}; var __TMC_CACHE__ = {};');
  parts.push('function __tmcResolve(from, req){');
  parts.push('  if (req.charAt(0) !== \'.\') return req;');
  parts.push('  var base = from.split(\'/\').slice(0, -1);');
  parts.push('  var seg = req.split(\'/\');');
  parts.push('  for (var i=0;i<seg.length;i++){ var s = seg[i];');
  parts.push('    if (s === \'.\' || s === \'\') continue;');
  parts.push('    if (s === \'..\') base.pop(); else base.push(s); }');
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
    parts.push(readCore(rel));
    parts.push('};');
  });
  parts.push('var TMC = __tmcRequire(\'\', \'index.js\');');
  parts.push('if (typeof globalThis !== \'undefined\') { globalThis.TMC = TMC; }');
  parts.push('if (typeof window !== \'undefined\') { window.TMC = TMC; }');
  return parts.join('\n');
}

/* xlsx 模块（浏览器可见，依赖 window.TMC） */
const XLSX_FILES = ['src/xlsx/zip.js', 'src/xlsx/xml-utils.js', 'src/xlsx/base-template.js'];
function xlsxScripts() {
  return XLSX_FILES.map(function (rel) {
    return '/* ==== ' + rel + ' ==== */\n' + fs.readFileSync(path.join(ROOT, rel), 'utf8');
  }).join('\n');
}

const VIEW_FILES = ['src/ui/view-agenda-form.js', 'src/ui/view-agenda-preview.js', 'src/ui/view-export.js'];
function viewScripts() {
  return VIEW_FILES.map(function (rel) {
    return '/* ==== ' + rel + ' ==== */\n' + fs.readFileSync(path.join(ROOT, rel), 'utf8');
  }).join('\n');
}

function bundleCss() { return fs.readFileSync(path.join(ROOT, 'src/ui/shell.css'), 'utf8'); }
function hostScript() { return fs.readFileSync(path.join(ROOT, 'src/host-web.js'), 'utf8'); }

function build(shellPath, outPath) {
  let shell = fs.readFileSync(shellPath, 'utf8');
  shell = shell.replace('/*__STYLE__*/', function () { return bundleCss(); });
  shell = shell.replace('/*__CORE__*/', function () { return bundleCore(); });
  shell = shell.replace('/*__XLSX__*/', function () { return xlsxScripts(); });
  shell = shell.replace('/*__VIEWS__*/', function () { return viewScripts(); });
  shell = shell.replace('/*__HOST__*/', function () { return hostScript(); });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, shell, 'utf8');
  const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log('✅ ' + path.relative(ROOT, outPath) + '  (' + kb + ' KB)');
}

build(path.join(ROOT, 'src/ui/shell.html'), path.join(ROOT, 'dist/agenda-builder.html'));
