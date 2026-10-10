#!/usr/bin/env node
/* tmc-miniprogram/build/sync-core.js
 * 把 tmc-core 的纯逻辑内核同步到 lib/tmc-core/（小程序可 require）。
 * 仅拷贝 core/ ports/ data/ app/ index.js；跳过 adapters/web-*（小程序用 wx-* 适配器）。
 * 用法：node build/sync-core.js
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.resolve(ROOT, '../tmc-core');
const DEST = path.join(ROOT, 'lib/tmc-core');

const DIRS = ['core', 'ports', 'data', 'app'];
const FILES = ['index.js', 'package.json', 'LICENSE'];

function rmrf(p) {
  if (!fs.existsSync(p)) return;
  if (fs.statSync(p).isDirectory()) {
    fs.readdirSync(p).forEach(function (f) { rmrf(path.join(p, f)); });
    fs.rmdirSync(p);
  } else { fs.unlinkSync(p); }
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from).forEach(function (f) {
    const s = path.join(from, f);
    const d = path.join(to, f);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  });
}

function main() {
  rmrf(DEST);
  fs.mkdirSync(DEST, { recursive: true });
  DIRS.forEach(function (dir) {
    const from = path.join(SRC, dir);
    if (fs.existsSync(from)) copyDir(from, path.join(DEST, dir));
  });
  FILES.forEach(function (f) {
    const from = path.join(SRC, f);
    if (fs.existsSync(from)) fs.copyFileSync(from, path.join(DEST, f));
  });
  console.log('✅ 已同步内核到 ' + path.relative(ROOT, DEST));
}

main();
