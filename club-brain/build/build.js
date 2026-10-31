#!/usr/bin/env node
'use strict';

/**
 * 构建：把 src/core（CommonJS 内核）+ app（视图层）+ styles.css
 * 打包成一个可双击打开的单文件 HTML。
 *
 * 零依赖，不引入任何打包器。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'dist');
const OUT_FILE = path.join(OUT_DIR, 'club-console.html');

const CORE = [
  ['util', 'src/core/util.js'],
  ['agenda-lint', 'src/core/agenda-lint.js'],
  ['brand-lint', 'src/core/brand-lint.js'],
  ['role-scheduler', 'src/core/role-scheduler.js'],
  ['meeting-retro', 'src/core/meeting-retro.js'],
  ['dcp-tracker', 'src/core/dcp-tracker.js'],
  ['dues-recon', 'src/core/dues-recon.js'],
  ['feedback-loop', 'src/core/feedback-loop.js'],
  ['survey-draft', 'src/core/survey-draft.js'],
  ['meeting-ops', 'src/core/meeting-ops.js'],
  ['member-profile', 'src/core/member-profile.js'],
];

const APP = [
  'app/ui/dom.js',
  'app/ui/chart.js',
  'app/seed.js',
  'app/state.js',
  'app/sync.js',
  'app/views/dashboard.js',
  'app/views/agenda.js',
  'app/views/live.js',
  'app/views/retro.js',
  'app/views/members.js',
  'app/views/projection.js',
  'app/app.js',
];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function wrapCore(key, code) {
  // 给 CommonJS 模块一个最小宿主：module.exports + require（只解析同目录相对路径）
  return [
    '(function(){',
    "var module={exports:{}};",
    "var require=function(p){var k=String(p).replace(/^\\.\\//,'');return CC.__core[k];};",
    code,
    "CC.__core['" + key + "']=module.exports;",
    '})();',
  ].join('\n');
}

function buildJs() {
  const parts = [];
  parts.push("'use strict';");
  parts.push('var CC = window.CC = window.CC || {};');
  parts.push('CC.__core = CC.__core || {};');
  parts.push('CC.VERSION = ' + JSON.stringify(require(path.join(ROOT, 'package.json')).version) + ';');
  CORE.forEach(([key, rel]) => parts.push(wrapCore(key, read(rel))));

  parts.push([
    'CC.core = Object.assign({}, CC.__core["util"], {',
    '  lintAgenda: CC.__core["agenda-lint"].lintAgenda,',
    '  buildTimeline: CC.__core["agenda-lint"].buildTimeline,',
    '  agendaMd: CC.__core["agenda-lint"].toMarkdown,',
    '  agendaHtml: CC.__core["agenda-lint"].toHtml,',
    '  lintBrand: CC.__core["brand-lint"].lintBrand,',
    '  brandMd: CC.__core["brand-lint"].toMarkdown,',
    '  schedule: CC.__core["role-scheduler"].schedule,',
    '  scheduleMd: CC.__core["role-scheduler"].toMarkdown,',
    '  buildRetro: CC.__core["meeting-retro"].buildRetro,',
    '  retroMd: CC.__core["meeting-retro"].toMarkdown,',
    '  trackDcp: CC.__core["dcp-tracker"].trackDcp,',
    '  dcpMd: CC.__core["dcp-tracker"].toMarkdown,',
    '  reconcile: CC.__core["dues-recon"].reconcile,',
    '  duesMd: CC.__core["dues-recon"].toMarkdown,',
    '  analyze: CC.__core["feedback-loop"].analyze,',
    '  feedbackMd: CC.__core["feedback-loop"].toMarkdown,',
    '  buildSurveyDraft: CC.__core["survey-draft"].buildSurveyDraft,',
    '  surveyJsonl: CC.__core["survey-draft"].toWjxJsonl,',
    '  surveyMd: CC.__core["survey-draft"].toMarkdown,',
    '  ops: CC.__core["meeting-ops"],',
    '  buildProfiles: CC.__core["member-profile"].buildProfiles,',
    '  profileMd: CC.__core["member-profile"].toMarkdown,',
    '});',
  ].join('\n'));

  APP.forEach((rel) => parts.push('/* ===== ' + rel + ' ===== */\n' + read(rel)));
  return parts.join('\n\n');
}

function build() {
  const tpl = read('app/index.html');
  const css = read('app/styles.css');
  const js = buildJs();
  const html = tpl
    .replace('/*__CSS__*/', () => css)
    .replace('/*__JS__*/', () => js);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, html, 'utf8');

  const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
  console.log('built ' + path.relative(ROOT, OUT_FILE) + '  ' + kb + ' KB');
  return { file: OUT_FILE, kb };
}

if (require.main === module) build();

module.exports = { build };
