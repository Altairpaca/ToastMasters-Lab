/* tmc-core/test/_selftest.js
 * 内核零依赖单测。移植原 _selftest.js 的 34 项断言，并新增内核断言（目标 ≥ 60）。
 * 用法： node test/_selftest.js
 * 全绿退出码 0，有失败退出码 1。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

const fs = require('fs');
const path = require('path');
const TMC = require('../index.js');

/* ---------- 断言框架 ---------- */
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  \u2705 ' + name); }
  else { fail++; console.log('  \u274c ' + name + (extra ? '\n     ' + extra : '')); }
}
function section(t) { console.log('\n=== ' + t + ' ==='); }

/* 从原 universal-timer.html 移植的测试数据 */
const records = [
  { speaker: '张三', role: '备稿演讲 Prepared Speech', time: 330, status: 'ok', overBy: 0, green: 300, red: 420 },
  { speaker: '李四', role: '备稿演讲 Prepared Speech', time: 455, status: 'over', overBy: 35, green: 300, red: 420 },
  { speaker: 'Wang', role: '点评 Evaluation', time: 95, status: 'under', overBy: 0, green: 120, red: 180 },
  { speaker: '陈五', role: '即兴演讲 Table Topics', time: 105, status: 'ok', overBy: 0, green: 60, red: 120 }
];

const md = TMC.md;
const timer = TMC.timer;
const report = TMC.report;
const meeting = TMC.meeting;

/* ============================================================
 * 1. Markdown 生成（移植）
 * ============================================================ */
section('1. Markdown 生成');
const seg = { total: 1800, elapsed: 1930, ended: true };
const reportMd = report.toMarkdown(report.buildTimerReport(records, { meetingName: '南沙港湾第335次例会', date: '2026-10-08', seg: seg }));
const lines = reportMd.split('\n');
const sep = lines.find(function (l) { return l.indexOf('|') === 0 && l.indexOf('-') > 0; });
const dataRows = lines.filter(function (l) { return /^\| \d+ \|/.test(l); });
ok('首行是一级标题', lines[0] === "# TIMER'S REPORT 计时员报告");
ok('分隔行被识别且有 5 列', md.isSepRow(sep) && md.splitRow(sep).length === 5);
ok('数据行 = 4 条', dataRows.length === 4);
ok('每行列数一致（不错位）', dataRows.every(function (l) { return md.splitRow(l).length === 5; }));
ok('超时行带 (+0:35)', reportMd.indexOf('(+0:35)') > 0);
ok('不足行带 (-0:25)', reportMd.indexOf('(-0:25)') > 0);
ok('合格率 50%', reportMd.indexOf('合格率 **50%**') > 0);
ok('含环节计时', reportMd.indexOf('环节计时 Segment') > 0);
ok('结尾署名斜体', reportMd.trim().endsWith('*Reported by Timer 计时员汇报完毕。*'));

/* ============================================================
 * 2. 分隔行解析（移植）
 * ============================================================ */
section('2. 分隔行解析');
ok("'---:' → right", md.alignOf('---:') === 'right');
ok("':---' → left", md.alignOf(':---') === 'left');
ok("':---:' → center", md.alignOf(':---:') === 'center');
ok("'---' → 无", md.alignOf('---') === '');
ok('数据行不会误判为分隔行', !md.isSepRow('| 1 | 张三 | 备稿 | 5:30 | 合格 |'));

/* ============================================================
 * 3. mdToHtml 渲染（移植）
 * ============================================================ */
section('3. mdToHtml 渲染');
const html = md.toHtml(reportMd);
ok('产出 <table class="md-table">', html.indexOf('<table class="md-table">') > 0);
ok('表头 5 个 <th>', (html.match(/<th[ >]/g) || []).length === 5);
ok('th 开闭配对', (html.match(/<th[ >]/g) || []).length === (html.match(/<\/th>/g) || []).length);
ok('数据 20 个 <td>', (html.match(/<td/g) || []).length === 20);
ok('td 开闭配对', (html.match(/<td/g) || []).length === (html.match(/<\/td>/g) || []).length);
ok('用时列右对齐', html.indexOf('style="text-align:right"') > 0);
ok('姓名列左对齐', html.indexOf('style="text-align:left"') > 0);
ok('渲染出 h1 / strong / hr', html.indexOf('<h1>') === 0 && html.indexOf('<strong>') > 0 && html.indexOf('<hr>') > 0);
ok('没有裸露的 | 或 ** 标记', html.indexOf('|') < 0 && html.indexOf('**') < 0);

/* ============================================================
 * 4. HTML 转义（防注入，移植）
 * ============================================================ */
section('4. HTML 转义（防注入）');
const evil = md.toHtml('| a | b |\n|---|---|\n| <img src=x onerror=alert(1)> | **<b>x</b>** |');
ok('尖括号被转义', evil.indexOf('&lt;img') > 0 && evil.indexOf('<img') < 0);
ok('转义后仍能加粗', evil.indexOf('<strong>&lt;b&gt;x&lt;/b&gt;</strong>') > 0);

/* ============================================================
 * 5. 自动折行 wrapByWidth（移植）
 * ============================================================ */
section('5. 自动折行 wrapByWidth');
const fakeCtx = { font: '', measureText: function (s) { return { width: s.split('').reduce(function (a, c) { return a + (/[\u4e00-\u9fff]/.test(c) ? 16 : 8); }, 0) }; } };
const wl = TMC.image.wrapByWidth(fakeCtx, '总结 Summary：'.repeat(6), 200);
ok('按宽度折行', wl.length > 1);
ok('每行不超宽', wl.every(function (l) { return fakeCtx.measureText(l).width <= 200; }));

/* ============================================================
 * 6. 边界：空记录（移植）
 * ============================================================ */
section('6. 边界：空记录');
const mdEmpty = report.toMarkdown(report.buildTimerReport([], { meetingName: '', date: '', seg: null }));
ok('不抛异常', typeof mdEmpty === 'string' && mdEmpty.length > 0);
ok('合格率 0%', mdEmpty.indexOf('合格率 **0%**') > 0);
ok('无环节块', mdEmpty.indexOf('环节计时') < 0);
const htmlEmpty = md.toHtml(mdEmpty);
ok('仍渲染出表格', htmlEmpty.indexOf('<table') > 0);
ok('空表 0 个 <td>', (htmlEmpty.match(/<td/g) || []).length === 0);

/* ============================================================
 * 7. 纯文本版（移植）
 * ============================================================ */
section('7. 纯文本版仍可用');
const plain = report.toPlain(report.buildTimerReport(records, { meetingName: 'M', date: '2026-10-08', seg: seg }));
ok('纯文本含表头', plain.indexOf('姓名 Speaker') > 0);
ok('纯文本含总结', plain.indexOf('Summary 总结') > 0);

/* ============================================================
 * 8. timer-core 判色 / 格式化（新增）
 * ============================================================ */
section('8. timer-core 判色 / 格式化');
ok('formatTime(330) === "5:30"', timer.formatTime(330) === '5:30');
ok('formatTime(35) === "0:35"', timer.formatTime(35) === '0:35');
ok('formatTime(-3) 归零 === "0:00"', timer.formatTime(-3) === '0:00');
ok('parseTime("5:30") === 330', timer.parseTime('5:30') === 330);
ok('parseTime("90") === 90', timer.parseTime('90') === 90);
ok('parseTime("5:99") === null', timer.parseTime('5:99') === null);
ok('parseTime("abc") === null', timer.parseTime('abc') === null);
ok('judgeStatus(299,300,420) → under', timer.judgeStatus(299, 300, 420) === 'under');
ok('judgeStatus(300,300,420) → ok', timer.judgeStatus(300, 300, 420) === 'ok');
ok('judgeStatus(420,300,420) → ok（红牌 30″ 宽限内）', timer.judgeStatus(420, 300, 420) === 'ok');
ok('judgeStatus(449,300,420) → ok（宽限内）', timer.judgeStatus(449, 300, 420) === 'ok');
ok('judgeStatus(450,300,420) → over（超宽限）', timer.judgeStatus(450, 300, 420) === 'over');
ok('lightState(450,300,360,420) → over', timer.lightState(450, 300, 360, 420) === 'over');
ok('lightState(449,300,360,420) → red（宽限内）', timer.lightState(449, 300, 360, 420) === 'red');
ok('lightState(360,300,360,420) → yellow', timer.lightState(360, 300, 360, 420) === 'yellow');
ok('quickThresholds(5) 红=300', timer.quickThresholds(5).red === 300);
ok('quickThresholds(3) 绿=120', timer.quickThresholds(3).green === 120);

/* 秒表（注入可控时钟） */
section('9. timer-core 秒表');
let fakeNow = 1000;
const stopwatch = timer.createStopwatch({ now: function () { return fakeNow; } });
stopwatch.start();
fakeNow = 1000 + 5300;
ok('秒表 seconds() === 5', stopwatch.seconds() === 5);
ok('秒表 display() === "0:05"', stopwatch.display() === '0:05');
stopwatch.pause();
fakeNow = 1000 + 30000;
ok('暂停后 reading 不变', stopwatch.seconds() === 5);
stopwatch.reset();
ok('复位后 seconds() === 0', stopwatch.seconds() === 0);

/* ============================================================
 * 10. meeting-model 校验 / 归一化 / 迁移（新增）
 * ============================================================ */
section('10. meeting-model');
const sample = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/meeting.sample.json'), 'utf8'));
ok('样例 validate().ok === true', meeting.validate(sample).ok === true, JSON.stringify(meeting.validate(sample).errors));
ok('缺 meeting_id 报错', meeting.validate({ meeting_number: 1, date: '2026-01-01', meta: {} }).ok === false);
ok('非法 meeting_id 格式报错', meeting.validate({ meeting_id: 'bad', meeting_number: 1, date: '2026-01-01', meta: {} }).errors.length > 0);
ok('end_time <= start_time 报错', meeting.validate({
  meeting_id: '2026-01-01_第1次', meeting_number: 1, date: '2026-01-01',
  start_time: '21:00', end_time: '19:00',
  meta: { version: '1.0', owner: 'Altair Li', updated_at: '2026-01-01T00:00:00Z' },
}).errors.some(function (e) { return e.indexOf('end_time') >= 0; }));
ok('未知角色进 errors', meeting.validate({
  meeting_id: '2026-01-01_第1次', meeting_number: 1, date: '2026-01-01',
  roles: [{ role: 'not_a_role' }],
  meta: { version: '1.0', owner: 'Altair Li', updated_at: '2026-01-01T00:00:00Z' },
}).errors.some(function (e) { return e.indexOf('未知角色') >= 0; }));
ok('meta 缺 updated_at 报错', meeting.validate({ meeting_id: '2026-01-01_第1次', meeting_number: 1, date: '2026-01-01', meta: { version: '1.0', owner: 'Altair Li' } }).ok === false);
const norm = meeting.normalize(sample);
ok('normalize 补齐 start_time', norm.start_time === '19:15');
ok('normalize 保留 officers_records.timer', norm.officers_records.timer.length === 1);
ok('normalize 数组字段齐全', Array.isArray(norm.roles) && Array.isArray(norm.agenda) && Array.isArray(norm.guests));
const emptyM = meeting.empty();
ok('empty 生成合法骨架（含 meta）', emptyM.meta.version === '1.0' && emptyM.meta.owner === 'Altair Li');
ok('makeMeetingId 拼接正确', meeting.makeMeetingId('2026-09-15', 333) === '2026-09-15_第333次');
const migrated = meeting.migrate({ meeting_id: '2020-01-01_第1次', meeting_number: 1, date: '2020-01-01', custom_old_field: 123, meta: { version: '0.9' } });
ok('migrate 升级 version 到 1.0', migrated.meta.version === '1.0');
ok('migrate 保留未知字段到 _extra', migrated._extra && migrated._extra.custom_old_field === 123);

/* ============================================================
 * 11. agenda-core（新增）
 * ============================================================ */
section('11. agenda-core');
const sorted = TMC.agendaCore.sortAgenda([
  { segment_id: 'c', type: 'closing' },
  { segment_id: 'o', type: 'opening' },
  { segment_id: 's', type: 'prepared_speech' },
]);
ok('sortAgenda 把 opening 排最前', sorted[0].type === 'opening');
ok('sortAgenda 把 closing 排最后', sorted[sorted.length - 1].type === 'closing');
const tc = TMC.agendaCore.timeColumn('19:15', [
  { segment_id: 'a', duration_min: 3 },
  { segment_id: 'b', duration_min: 30, buffer_min: 2 },
]);
ok('timeColumn 首行 start=19:15', tc[0].start === '19:15');
ok('timeColumn 首行 end=19:18', tc[0].end === '19:18');
ok('timeColumn 含缓冲（次行 end=19:50）', tc[1].end === '19:50');
ok('totalMinutes 含缓冲 = 35', TMC.agendaCore.totalMinutes([{ duration_min: 3 }, { duration_min: 30, buffer_min: 2 }]) === 35);
ok('nameWithEn 中英组合', TMC.agendaCore.nameWithEn('张三', 'Zhang San') === '张三(Zhang San)');
ok('nameWithEn 仅中文', TMC.agendaCore.nameWithEn('张三', '') === '张三');
const rows = TMC.agendaCore.buildRows(sample, {});
ok('buildRows 行数 = agenda 数', rows.rows.length === sample.agenda.length);
ok('buildRows 时间列非空', rows.rows[0].time.length > 0);
ok('rowDiffChecklist 插入计算', TMC.agendaCore.rowDiffChecklist(3, 5).insert === 2);
ok('validateTiming 超时不报错（在时段内）', TMC.agendaCore.validateTiming(sample).length === 0);

/* ============================================================
 * 12. report-kernel 三官报告（新增）
 * ============================================================ */
section('12. report-kernel 三官报告');
const vmT = report.buildTimerReport(records, { meetingName: 'M', date: 'D', seg: null });
ok('timer vm kind = timer', vmT.kind === 'timer');
ok('timer vm 5 列', vmT.headers.length === 5);
ok('timer vm rows = 4', vmT.rows.length === 4);
const colorized = report.colorizeCells(vmT);
ok('colorizeCells 命中 4 个状态格', colorized.length === 4);
ok('colorizeCells ok 状态 class = st-ok', colorized.some(function (c) { return c.cls === 'st-ok'; }));
const vmAh = report.buildAhReport([
  { member_id: 'Li Si', counts: { 'um': 3, '那个': 2 }, minutes: 5 },
], { meetingName: 'M', date: 'D', words: TMC.data.wordlistAh.DEFAULT_WORDS, settings: { fTh: 3, oTh: 5 } });
ok('ah vm kind = ah', vmAh.kind === 'ah');
ok('ah vm 汇总含总赘词 5', vmAh.summary.indexOf('5') >= 0);
const vmG = report.buildGrammarianReport([
  { member_id: 'Li Si', good_phrases: ['a leap'], corrections: ['x→y'], wod_count: 2 },
], { meetingName: 'M', date: 'D', word: { word: 'insight', pos: 'n.' } });
ok('grammarian vm kind = grammarian', vmG.kind === 'grammarian');
ok('grammarian vm 含每日一词块', vmG.extra.length === 1 && vmG.extra[0].text.indexOf('insight') >= 0);
ok('三官 Markdown 均可渲染 HTML', md.toHtml(report.toMarkdown(vmAh)).indexOf('<table') > 0);

/* ============================================================
 * 13. image-kernel（新增，用假 CanvasPort）
 * ============================================================ */
section('13. image-kernel');
function fakeCtxFactory() {
  const calls = { fillText: 0, fillRect: 0 };
  return {
    calls: calls,
    scale: function () {}, fillRect: function () { calls.fillRect++; },
    fillText: function () { calls.fillText++; }, beginPath: function () {},
    moveTo: function () {}, lineTo: function () {}, arcTo: function () {}, closePath: function () {},
    stroke: function () {}, fill: function () {},
    measureText: function (s) { return { width: String(s).split('').reduce(function (a, c) { return a + (/[\u4e00-\u9fff]/.test(c) ? 16 : 8); }, 0) }; },
    set font(v) {}, get font() { return ''; },
    fillStyle: '', strokeStyle: '', lineWidth: 1, textAlign: '', textBaseline: '',
  };
}
function fakeCanvasPort() {
  let lastW = 0, lastH = 0;
  return {
    create: function (w, h) {
      lastW = w; lastH = h;
      const ctx = fakeCtxFactory();
      return { width: w, height: h, getContext: function () { return ctx; }, toDataURL: function () { return 'data:image/png;base64,FAKE'; }, _ctx: ctx };
    },
    _size: function () { return { w: lastW, h: lastH }; },
  };
}
const cp = fakeCanvasPort();
const canvas = TMC.image.render(vmT, cp, { scale: 2 });
ok('render 返回 CanvasLike', !!canvas && typeof canvas.toDataURL === 'function');
ok('2× 像素密度（宽度翻倍）', cp._size().w >= 780 * 2);
ok('画布高度足够容纳 4 行', cp._size().h > 400);
ok('绘制了文本（fillText 被调用）', canvas._ctx.calls.fillText > 0);
ok('空记录也能渲染', !!TMC.image.render(report.buildTimerReport([], { meetingName: '', date: '' }), cp));
ok('端口缺失时 render 返回 null', TMC.image.render(vmT, null) === null);

/* ============================================================
 * 14. xlsx-writer（新增）
 * ============================================================ */
section('14. xlsx-writer');
const zipEntries = [
  { name: '[Content_Types].xml', data: TMC.xlsx._enc.utf8Encode('<Types/>') },
  { name: 'xl/worksheets/sheet1.xml', data: TMC.xlsx._enc.utf8Encode('<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>') },
  { name: 'xl/sharedStrings.xml', data: TMC.xlsx._enc.utf8Encode('<sst/>') },
  { name: 'xl/calcChain.xml', data: TMC.xlsx._enc.utf8Encode('<calcChain/>') },
];
const zipBytes = TMC.xlsx.writeZip(zipEntries);
ok('writeZip 产出 Uint8Array', zipBytes instanceof Uint8Array && zipBytes.length > 0);
const vres = TMC.xlsx.validate(zipBytes);
ok('validate 结构完整', vres.ok === true && vres.entries === 4);
ok('readZip 往返 entry 一致', TMC.xlsx.readZip(zipBytes).entries.length === 4);
const patched = TMC.xlsx.patch(zipBytes, [{ sheet: 'sheet1', ref: 'B3', value: '张三', isFormula: false }]);
const patchedZip = TMC.xlsx.readZip(patched);
ok('patch 后 calcChain.xml 被删除', patchedZip.entries.every(function (e) { return !/calcChain/.test(e.name); }));
const sheetEntry = patchedZip.entries.filter(function (e) { return /sheet1\.xml/.test(e.name); })[0];
const sheetXml = TMC.xlsx._enc.utf8Decode(sheetEntry.data);
ok('patch 写入了新单元格引用未破坏原内容', sheetXml.indexOf('A1') >= 0);
ok('xmlEscape 转义 < > &', TMC.xlsx.xmlEscape('<a>&"') === '&lt;a&gt;&amp;&quot;');
ok('stripCalcChain 幂等', TMC.xlsx.readZip(TMC.xlsx.stripCalcChain(zipBytes)).entries.every(function (e) { return !/calcChain/.test(e.name); }));
ok('setCell 替换已有单元格', TMC.xlsx.setCell('<row r="1"><c r="A1" t="s"><v>0</v></c></row>', 'A1', 'hello', false).indexOf('hello') > 0);

/* ============================================================
 * 15. 应用服务 + createApp（新增）
 * ============================================================ */
section('15. createApp / 应用服务');
const app = TMC.createApp({ storage: TMC.ports.StoragePort.MemoryStorage(), clock: TMC.ports.ClockPort.createClockPort(function () { return 0; }) });
ok('createApp 返回 meeting/agenda/rsvp/officer/minutes', !!(app.meeting && app.agenda && app.rsvp && app.officer && app.minutes));
ok('netAvailable() 离线默认 false', app.netAvailable() === false);
ok('agenda.buildAgenda 产出 rows', app.agenda.buildAgenda(sample, {}).rows.length === sample.agenda.length);
ok('agenda.preview 生成视图模型', app.agenda.preview(app.agenda.buildAgenda(sample, {})).kind === 'agenda');
const app2 = TMC.createApp({ storage: TMC.ports.StoragePort.MemoryStorage() });
const m2 = app2.rsvp.createRsvp('2026-01-01_第1次', { name: '张三', role_pref: '主持人', confirmed: true });
ok('rsvp.createRsvp 追加报名', m2.rsvp.length === 1);
app2.rsvp.addGuest('2026-01-01_第1次', { name: '来宾A' });
ok('rsvp.addGuest 追加来宾', app2.rsvp.getMeeting('2026-01-01_第1次').guests.length === 1);
const tallied = app2.rsvp.tallyBallot('2026-01-01_第1次', 'best_speaker', ['张三', '李四'], [['张三'], ['张三'], ['李四']]);
ok('rsvp.tallyBallot 统计正确', tallied.result[0] === '张三');
ok('rsvp.tallyBallot 票数 张三=2', tallied.tally['张三'] === 2);

const officer = TMC.createApp({ clock: TMC.ports.ClockPort.createClockPort(function () { return 0; }) }).officer;
officer.recordTimer({ segment_id: 'seg-1', planned_min: 5, actual_sec: 330, speaker: '张三', role: '备稿', green: 300, red: 420 });
officer.recordTimer({ segment_id: 'seg-2', planned_min: 5, actual_sec: 460, speaker: '李四', role: '备稿', green: 300, red: 420 });
const vt = officer.getReport('timer');
ok('officer.getReport(timer) rows=2', vt.rows.length === 2);
ok('officer 合格率 50%', vt.summary.indexOf('50%') > 0);
officer.bumpAh('Li Si', 'um', 3);
officer.bumpAh('Li Si', '那个', 2);
ok('officer.bumpAh 累加计数', officer.getAhRecords()[0].counts['um'] === 3);
const exported = officer.exportJson({ meeting_id: '2026-01-01_第1次', meeting_number: 1, date: '2026-01-01' });
ok('officer.exportJson 填充 officers_records.timer', exported.officers_records.timer.length === 2);

const app3 = TMC.createApp({ storage: TMC.ports.StoragePort.MemoryStorage() });
app3.rsvp.saveMeeting(sample);
const minutes = app3.minutes.generateMinutes(sample);
ok('minutes.generateMinutes 生成 Markdown 标题', minutes.indexOf('# 会议纪要') === 0);
ok('minutes 含角色分工表', minutes.indexOf('## 角色分工') > 0);
ok('minutes 含计时摘要', minutes.indexOf('## 计时摘要') > 0);
const growth = app3.minutes.growthSummary([sample, sample]);
ok('growthSummary 统计会议数 = 2', growth.meetingCount === 2);
ok('growthSummary 出勤趋势非空', growth.attendance.length === 2);
ok('growthFromStorage 可读存储', app3.minutes.growthFromStorage().meetingCount >= 1);

/* ============================================================
 * 16. 静态扫描：内核无宿主符号（新增）
 * ============================================================ */
section('16. 静态扫描：内核无宿主符号');
const coreDir = path.resolve(__dirname, '..');
const scanTargets = [
  'core/md-renderer.js', 'core/meeting-model.js', 'core/timer-core.js',
  'core/report-kernel.js', 'core/image-kernel.js', 'core/agenda-core.js',
  'core/xlsx-writer.js', 'app/agenda-service.js', 'app/rsvp-service.js',
  'app/officer-service.js', 'app/minutes-service.js',
  'data/roles.js', 'data/wordlist-ah.js', 'data/status-text.js',
];
const forbidden = [
  { re: /\bdocument\./, name: 'document' },
  { re: /\blocalStorage\b/, name: 'localStorage' },
  { re: /\bwx\./, name: 'wx.' },
  { re: /\bfetch\s*\(/, name: 'fetch' },
  { re: /require\(\s*['"]fs['"]\s*\)/, name: "require('fs')" },
];
let violations = [];
scanTargets.forEach(function (rel) {
  const src = fs.readFileSync(path.join(coreDir, rel), 'utf8');
  // 去掉注释行再扫描（注释里允许出现这些词作为说明）
  const codeOnly = src.split('\n').filter(function (l) {
    const t = l.trim();
    return !(t.indexOf('//') === 0 || t.indexOf('*') === 0 || t.indexOf('/*') === 0);
  }).join('\n');
  forbidden.forEach(function (f) {
    if (f.re.test(codeOnly)) violations.push(rel + ' 含 ' + f.name);
  });
  // window 单独判断：允许 `typeof window !== 'undefined'` 之类的能力探测？内核禁止，一律禁
  if (/\bwindow\./.test(codeOnly)) violations.push(rel + ' 含 window.');
});
ok('内核层无宿主符号违规', violations.length === 0, violations.join('\n     '));

/* ============================================================
 * 结果
 * ============================================================ */
console.log('\n' + '='.repeat(46));
console.log('结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
