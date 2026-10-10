/* tmc-core/test/qa-core.test.js
 * QA 独立测试（由 QA 工程师严过关编写，不复用工程师自测断言）。
 * 目标：对内核关键纯函数做边界与异常测试，验证真实行为而非空断言。
 * 用法： node test/qa-core.test.js
 * 全绿退出码 0，有失败退出码 1。
 *
 * @author Yan (QA) · TMC Toolkit
 * @license MIT
 */
'use strict';

const fs = require('fs');
const path = require('path');
const TMC = require('../index.js');

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  \u2705 ' + name); }
  else { fail++; failures.push(name); console.log('  \u274c ' + name + (extra ? '\n     ' + extra : '')); }
}
function section(t) { console.log('\n=== ' + t + ' ==='); }

const md = TMC.md;
const meeting = TMC.meeting;
const timer = TMC.timer;

/* ============================================================
 * 1. mdToHtml —— 注入转义 / 表格对齐 / 空输入 / 超长单元格
 * ============================================================ */
section('1. mdToHtml 边界与注入');

// 1.1 <img onerror> 注入必须被转义，且不能出现可执行的原始标签
const inj = md.toHtml('<img src=x onerror=alert(1)>');
ok('img onerror 标签整体被转义', inj.indexOf('&lt;img') >= 0 && inj.indexOf('<img') < 0, inj);
ok('onerror 中的 "=" 保留为纯文本（无属性注入）', inj.indexOf('onerror=alert') >= 0);

// 1.2 表格单元格中的注入
const tblInj = md.toHtml('| a | b |\n|---|---|\n| <script>alert(1)</script> | x |');
ok('表格单元格 script 被转义', tblInj.indexOf('&lt;script&gt;') >= 0 && tblInj.indexOf('<script>') < 0);

// 1.3 引用符号转义（& 必须先于 < > 处理，避免二次转义）
ok('escapeHtml(&) 优先处理，不产生 &amp;lt;', md.escapeHtml('<a&b') === '&lt;a&amp;b');

// 1.4 空输入
// 注：实现为 String(md)，故 null/undefined 会被字面量化（"null"/"undefined"）；
// 关键不变式是「不抛异常且始终返回字符串」，不做空串假设。
ok('toHtml("") 返回空串', md.toHtml('') === '');
ok('toHtml(null) 不抛异常且返回字符串', typeof md.toHtml(null) === 'string', JSON.stringify(md.toHtml(null)));
ok('toHtml(undefined) 不抛异常且返回字符串', typeof md.toHtml(undefined) === 'string');
ok('toHtml(0) 不抛异常且返回字符串', typeof md.toHtml(0) === 'string');

// 1.5 表格对齐行解析（:--- / ---: / :---: / ---）
const alignHtml = md.toHtml('| l | c | r | n |\n|:---|:---:|---:|---|\n| 1 | 2 | 3 | 4 |');
ok('左对齐产生 text-align:left', alignHtml.indexOf('text-align:left') >= 0);
ok('居中产生 text-align:center', alignHtml.indexOf('text-align:center') >= 0);
ok('右对齐产生 text-align:right', alignHtml.indexOf('text-align:right') >= 0);
ok('无对齐标记不产生 style', /<th\>n<\/th>/.test(alignHtml), alignHtml);

// 1.6 分隔行识别边界：单横线（|-|）不是分隔行；两横线起算
// 注：'|---|' 实为 3 个横线，按 GFM 是合法分隔行（-{2,}）。
ok('isSepRow("|-|") 为 false（仅 1 个横线）', md.isSepRow('|-|') === false);
ok('isSepRow("|--|") 为 true（2 个横线起算）', md.isSepRow('|--|') === true);
ok('isSepRow("|---|") 为 true（3 个横线）', md.isSepRow('|---|') === true);
ok('isSepRow("|----|") 为 true', md.isSepRow('|----|') === true);
ok('isSepRow("") 为 false', md.isSepRow('') === false);

// 1.7 超长单元格（10000 字符）不丢数据
const longCell = 'x'.repeat(10000);
const longHtml = md.toHtml('| a | b |\n|---|---|\n| ' + longCell + ' | y |');
ok('超长单元格内容完整保留', longHtml.indexOf(longCell) >= 0);

// 1.8 支持 CRLF 换行
ok('CRLF 换行被归一处理（含 <table>）',
  md.toHtml('| a | b |\r\n|---|---|\r\n| 1 | 2 |').indexOf('<table') >= 0);

// 1.9 行内：先转义再加粗（顺序不可颠倒，否则 < 会被吃掉）
const inl = md.inline('**<b>x</b>**');
ok('inline 先转义再套 strong', inl.indexOf('<strong>&lt;b&gt;x&lt;/b&gt;</strong>') >= 0, inl);

/* ============================================================
 * 2. meetingModel.validate —— 必填 / 枚举 / 合法最小实例
 * ============================================================ */
section('2. meetingModel.validate');

const minPath = path.resolve(__dirname, '../../tmc-toolkit/examples/meeting.min.json');
const minSample = JSON.parse(fs.readFileSync(minPath, 'utf8'));

// 2.1 合法最小实例（架构 §5.2 官方样例）
const minRes = meeting.validate(minSample);
ok('examples/meeting.min.json 校验通过', minRes.ok === true, JSON.stringify(minRes.errors));

// 2.2 缺必填字段逐一命中
function base(over) {
  return Object.assign({
    meeting_id: '2026-01-01_第1次', meeting_number: 1, date: '2026-01-01',
    meta: { version: '1.0', owner: 'Altair Li', updated_at: '2026-01-01T00:00:00Z' },
  }, over || {});
}
ok('缺 meeting_id 报错', meeting.validate(base({ meeting_id: undefined })).ok === false);
ok('缺 meeting_number 报错', meeting.validate(base({ meeting_number: undefined })).ok === false);
ok('缺 date 报错', meeting.validate(base({ date: undefined })).ok === false);
ok('缺 meta 报错', meeting.validate(base({ meta: undefined })).ok === false);
ok('meta 缺 updated_at 报错', meeting.validate(base({ meta: { version: '1.0', owner: 'Altair Li' } })).ok === false);

// 2.3 格式错误
ok('meeting_id 非法格式报错', meeting.validate(base({ meeting_id: '2026/01/01-1' })).ok === false);
ok('date 非法格式报错', meeting.validate(base({ date: '2026.01.01' })).ok === false);
ok('meeting_number 为 0 报错', meeting.validate(base({ meeting_number: 0 })).ok === false);
ok('meeting_number 为小数报错', meeting.validate(base({ meeting_number: 1.5 })).ok === false);

// 2.4 非法枚举
ok('language 非法枚举报错', meeting.validate(base({ language: 'jp' })).errors.some(function (e) { return e.indexOf('language') >= 0; }));
ok('agenda.type 非法枚举报错', meeting.validate(base({ agenda: [{ segment_id: 'x', type: 'bogus' }] })).errors.some(function (e) { return e.indexOf('type') >= 0; }));
ok('roles[].role 未知角色进 errors', meeting.validate(base({ roles: [{ role: 'not_a_role' }] })).errors.some(function (e) { return e.indexOf('未知角色') >= 0; }));
ok('ballot.category 非法枚举报错', meeting.validate(base({ ballot: [{ category: 'best_pizza' }] })).errors.some(function (e) { return e.indexOf('category') >= 0; }));
ok('officers_records.timer.status 非法报错', meeting.validate(base({ officers_records: { timer: [{ segment_id: 's', status: 'blue' }] } })).errors.some(function (e) { return e.indexOf('status') >= 0; }));

// 2.5 时间一致性：end_time 必须晚于 start_time
ok('end_time == start_time 报错', meeting.validate(base({ start_time: '19:00', end_time: '19:00' })).errors.some(function (e) { return e.indexOf('end_time') >= 0; }));
ok('end_time < start_time 报错', meeting.validate(base({ start_time: '20:00', end_time: '19:00' })).errors.some(function (e) { return e.indexOf('end_time') >= 0; }));
ok('end_time > start_time 通过', meeting.validate(base({ start_time: '19:15', end_time: '21:30' })).ok === true);

// 2.6 非对象 / 数组根
ok('根为数组报错', meeting.validate([]).ok === false);
ok('根为 null 报错', meeting.validate(null).ok === false);
ok('根为字符串报错', meeting.validate('x').ok === false);

// 2.7 未知角色不阻断其余错误收集（同时命中多条）
const multi = meeting.validate(base({ meeting_id: 'bad', roles: [{ role: 'nope' }] }));
ok('多条错误同时收集（≥2）', multi.errors.length >= 2, JSON.stringify(multi.errors));

// 2.8 唯一性/引用完整性：evaluator 不匹配 → warnings 而非 errors
const warnRes = meeting.validate(base({
  roles: [{ role: 'evaluator', name_zh: '王芳' }],
  speeches: [{ member_id: 'Li Si', evaluator: '张三' }],
}));
ok('evaluator 未匹配进 warnings 而非 errors', warnRes.ok === true && warnRes.warnings.some(function (w) { return w.indexOf('evaluator') >= 0; }), JSON.stringify(warnRes));

/* ============================================================
 * 3. timerCore.judgeStatus —— 边界值
 * ============================================================ */
section('3. timerCore.judgeStatus 边界');

// 口径：under < green ≤ ok ≤ red+30″; over ≥ red+30″
ok('恰好绿色线 (300,300,420) → ok', timer.judgeStatus(300, 300, 420) === 'ok');
ok('绿线前一秒 (299,300,420) → under', timer.judgeStatus(299, 300, 420) === 'under');
ok('恰好红色线 (420,300,420) → ok（宽限起点）', timer.judgeStatus(420, 300, 420) === 'ok');
ok('红牌后 29 秒 (449,300,420) → ok（宽限内）', timer.judgeStatus(449, 300, 420) === 'ok');
ok('红牌后 30 秒整 (450,300,420) → over', timer.judgeStatus(450, 300, 420) === 'over');
ok('红牌后 31 秒 (451,300,420) → over', timer.judgeStatus(451, 300, 420) === 'over');

// 非整数 / 负值容错（判色基于秒）
ok('judgeStatus(0,0,0) → ok（0≥0 且 <30）', timer.judgeStatus(0, 0, 0) === 'ok');
ok('judgeStatus(-5,0,10) → under', timer.judgeStatus(-5, 0, 10) === 'under');

// formatTime 边界
ok('formatTime(0) === "0:00"', timer.formatTime(0) === '0:00');
ok('formatTime(59) === "0:59"', timer.formatTime(59) === '0:59');
ok('formatTime(60) === "1:00"', timer.formatTime(60) === '1:00');
ok('formatTime(3599) === "59:59"', timer.formatTime(3599) === '59:59');
ok('formatTime(-1) 归零 "0:00"', timer.formatTime(-1) === '0:00');
ok('formatTime("abc") 归零 "0:00"', timer.formatTime('abc') === '0:00');

// parseTime 边界
ok('parseTime("0:00") === 0', timer.parseTime('0:00') === 0);
ok('parseTime("59") === 59', timer.parseTime('59') === 59);
ok('parseTime("1:60") === null（秒 >59）', timer.parseTime('1:60') === null);
ok('parseTime("") === null', timer.parseTime('') === null);
ok('parseTime(null) === null', timer.parseTime(null) === null);
ok('parseTime("12:5") === 725（宽松一位秒）', timer.parseTime('12:5') === 725);

/* ============================================================
 * 4. imageKernel.wrapByWidth —— 空串 / 单字符 / 超宽字符
 * ============================================================ */
section('4. imageKernel.wrapByWidth');

const wrap = TMC.image.wrapByWidth;
function mkCtx(perChar) {
  return { font: '', measureText: function (s) { return { width: String(s).length * perChar }; } };
}

const wEmpty = wrap(mkCtx(10), '', 100);
ok('空串 → 返回 [""]（至少一行）', Array.isArray(wEmpty) && wEmpty.length === 1 && wEmpty[0] === '');

const wSingle = wrap(mkCtx(10), 'A', 100);
ok('单字符 → ["A"]', wSingle.length === 1 && wSingle[0] === 'A');

const wOne = wrap(mkCtx(10), 'A', 5);
ok('单字符超宽时仍不丢字（["A"]）', wOne.length === 1 && wOne[0] === 'A');

const wOver = wrap(mkCtx(10), 'ABCDEFGHIJ', 25);
ok('超宽字符按宽度折行（每行 ≤25）', wOver.every(function (l) { return l.length * 10 <= 25; }), JSON.stringify(wOver));
ok('折行后拼接等于原文（无丢字）', wOver.join('') === 'ABCDEFGHIJ');

const wCJK = wrap(mkCtx(16), '中文字符测试内容很长需要折行', 48);
ok('中文按宽度折行（每行 ≤48）', wCJK.every(function (l) { return l.length * 16 <= 48; }));
ok('中文折行无丢字', wCJK.join('') === '中文字符测试内容很长需要折行');

/* ============================================================
 * 5. agendaCore —— 时间规范校验 + 行插入 checklist 行号位移
 * ============================================================ */
section('5. agendaCore');

// 5.1 时间规范：结束不晚于 21:30
// 会议 19:15–21:30 = 135 分钟；构造 3 行合计恰好 135 → 应在时段内（无警告）
const fit = TMC.agendaCore.timeColumn('19:15', [
  { segment_id: 'a', duration_min: 45 }, { segment_id: 'b', duration_min: 45 }, { segment_id: 'c', duration_min: 45 },
]);
ok('timeColumn 累计到 21:30', fit[fit.length - 1].end === '21:30', JSON.stringify(fit));

const okTiming = TMC.agendaCore.validateTiming({
  start_time: '19:15', end_time: '21:30',
  agenda: [{ duration_min: 45 }, { duration_min: 45 }, { duration_min: 45 }],
});
ok('合计等于时段（135）不告警', okTiming.length === 0, JSON.stringify(okTiming));

const overTiming = TMC.agendaCore.validateTiming({
  start_time: '19:15', end_time: '21:30',
  agenda: [{ duration_min: 100 }, { duration_min: 60 }],
});
ok('合计超过时段（160>135）告警', overTiming.length === 1 && overTiming[0].indexOf('超过') >= 0, JSON.stringify(overTiming));

// fromMin 跨午夜回绕 + 补零
ok('fromMin(0) === "00:00"', TMC.agendaCore.fromMin(0) === '00:00');
ok('fromMin(1290) === "21:30"（19:15+135）', TMC.agendaCore.fromMin(1155 + 135) === '21:30');
ok('fromMin 跨午夜回绕 (1440) === "00:00"', TMC.agendaCore.fromMin(1440) === '00:00');

// 5.2 行插入 checklist 的行号位移计算
const diffIns = TMC.agendaCore.rowDiffChecklist(3, 5);
ok('rowDiffChecklist(3,5).insert === 2', diffIns.insert === 2);
ok('rowDiffChecklist(3,5).remove === 0', diffIns.remove === 0);
ok('rowDiffChecklist(3,5) 提示含「插入 2 行」', diffIns.note.indexOf('插入 2 行') >= 0, diffIns.note);

const diffRem = TMC.agendaCore.rowDiffChecklist(5, 3);
ok('rowDiffChecklist(5,3).remove === 2', diffRem.remove === 2);
ok('rowDiffChecklist(5,3).insert === 0', diffRem.insert === 0);

const diffSame = TMC.agendaCore.rowDiffChecklist(4, 4);
ok('rowDiffChecklist(4,4) 无位移', diffSame.insert === 0 && diffSame.remove === 0);

// 负数 / 非法输入容错
const diffNeg = TMC.agendaCore.rowDiffChecklist(-1, -1);
ok('rowDiffChecklist(-1,-1) 归零', diffNeg.insert === 0 && diffNeg.remove === 0);

// 5.3 buildRows 行计划：时间列随行位移正确
const built = TMC.agendaCore.buildRows({
  start_time: '19:15',
  agenda: [
    { segment_id: 'o', type: 'opening', duration_min: 15 },
    { segment_id: 's', type: 'prepared_speech', duration_min: 30, buffer_min: 5 },
    { segment_id: 'c', type: 'closing', duration_min: 10 },
  ],
  roles: [{ role: 'speaker', name_zh: '李四', name_en: 'Li Si' }],
}, {});
ok('buildRows 行数 = 3', built.rows.length === 3);
ok('buildRows 首行 19:15-19:30', built.rows[0].time === '19:15-19:30', built.rows[0].time);
ok('buildRows 次行含缓冲 19:30-20:05', built.rows[1].time === '19:30-20:05', built.rows[1].time);
ok('buildRows 末行起点随位移 20:05', built.rows[2].time.indexOf('20:05-') === 0, built.rows[2].time);
ok('buildRows 时间单元格数与行数一致', built.timeCells.length === built.rows.length);
ok('buildRows 选用 speaker 角色名作 presenter', built.rows[1].presenter === '李四(Li Si)', built.rows[1].presenter);

/* ============================================================
 * 6. 结果
 * ============================================================ */
console.log('\n' + '='.repeat(46));
console.log('结果: ' + pass + ' 通过, ' + fail + ' 失败');
if (fail) console.log('失败用例:\n  - ' + failures.join('\n  - '));
process.exit(fail ? 1 : 0);
