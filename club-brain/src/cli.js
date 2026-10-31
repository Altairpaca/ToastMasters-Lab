#!/usr/bin/env node
'use strict';

/**
 * club-brain CLI
 *
 *   club-brain lint <meeting.json> [--json] [--html out.html]
 *   club-brain brand <asset.json> [--json]
 *   club-brain schedule <input.json> [--json]
 *   club-brain retro <input.json> [--json]
 *   club-brain dcp <input.json> [--json]
 *   club-brain demo [--out dir]
 *
 * 退出码：0 通过 / 1 阻断（有 error）/ 2 用法错误
 */

const fs = require('fs');
const path = require('path');
const brain = require('./index');

function readJson(file) {
  const abs = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}

function writeFile(file, content) {
  const abs = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
  return abs;
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const body = arg.slice(2);
      const eq = body.indexOf('=');
      if (eq >= 0) {
        flags[body.slice(0, eq)] = body.slice(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith('--')) {
          flags[body] = next;
          i += 1;
        } else {
          flags[body] = true;
        }
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function usage() {
  return [
    'club-brain ' + brain.version + ' · 头马俱乐部运营工具集',
    '',
    '用法：',
    '  club-brain lint <meeting.json> [--json] [--html out.html] [--md out.md]',
    '  club-brain brand <asset.json> [--json] [--md out.md]',
    '  club-brain schedule <input.json> [--json] [--md out.md]',
    '  club-brain retro <input.json> [--json] [--md out.md]',
    '  club-brain dcp <input.json> [--json] [--md out.md]',
    '  club-brain dues <input.json> [--json] [--md out.md]',
    '  club-brain feedback <input.json> [--json] [--md out.md]',
    '  club-brain demo [--out <dir>]',
    '',
    '所有命令都可加 --json 输出机器可读结果。有 error 时退出码为 1，可直接用于流水线阻断。',
  ].join('\n');
}

const commands = {
  lint(file, flags) {
    const meeting = readJson(file);
    const rosterPath = flags.roster;
    const opts = {};
    if (rosterPath) opts.roster = readJson(rosterPath);
    if (flags.expectedNo) opts.expectedNo = Number(flags.expectedNo);
    if (flags.today) opts.today = flags.today;
    const report = brain.lintAgenda(meeting, opts);
    if (flags.html) writeFile(flags.html, brain.agendaHtml(report));
    if (flags.md) writeFile(flags.md, brain.agendaMd(report));
    if (flags.json) return { code: report.ok ? 0 : 1, out: JSON.stringify(report, null, 2) };
    return { code: report.ok ? 0 : 1, out: brain.agendaMd(report) };
  },

  brand(file, flags) {
    const asset = readJson(file);
    const report = brain.lintBrand(asset, flags.kind ? { kind: flags.kind } : {});
    if (flags.md) writeFile(flags.md, brain.brandMd(report));
    if (flags.json) return { code: report.ok ? 0 : 1, out: JSON.stringify(report, null, 2) };
    return { code: report.ok ? 0 : 1, out: brain.brandMd(report) };
  },

  schedule(file, flags) {
    const input = readJson(file);
    const report = brain.schedule(input);
    if (flags.md) writeFile(flags.md, brain.scheduleMd(report));
    if (flags.json) return { code: report.ok ? 0 : 0, out: JSON.stringify(report, null, 2) };
    return { code: 0, out: brain.scheduleMd(report) };
  },

  retro(file, flags) {
    const input = readJson(file);
    const report = brain.buildRetro(input);
    if (flags.md) writeFile(flags.md, brain.retroMd(report));
    if (flags.json) return { code: 0, out: JSON.stringify(report, null, 2) };
    return { code: 0, out: brain.retroMd(report) };
  },

  dcp(file, flags) {
    const input = readJson(file);
    const report = brain.trackDcp(input);
    if (flags.md) writeFile(flags.md, brain.dcpMd(report));
    if (flags.json) return { code: 0, out: JSON.stringify(report, null, 2) };
    return { code: 0, out: brain.dcpMd(report) };
  },

  dues(file, flags) {
    const input = readJson(file);
    const report = brain.reconcile(input);
    if (flags.md) writeFile(flags.md, brain.duesMd(report));
    if (flags.json) return { code: report.ok ? 0 : 1, out: JSON.stringify(report, null, 2) };
    return { code: report.ok ? 0 : 1, out: brain.duesMd(report) };
  },

  feedback(file, flags) {
    const input = readJson(file);
    const report = brain.analyzeFeedback(input);
    if (flags.md) writeFile(flags.md, brain.feedbackMd(report));
    if (flags.json) return { code: 0, out: JSON.stringify(report, null, 2) };
    return { code: 0, out: brain.feedbackMd(report) };
  },

  demo(flags) {
    const outDir = path.resolve(process.cwd(), flags.out || 'out');
    const ex = path.join(__dirname, '..', 'examples');
    const results = [];
    const jobs = [
      ['meeting.sample.json', 'lint', 'agenda-report.html'],
      ['asset.sample.json', 'brand', null],
      ['schedule.sample.json', 'schedule', null],
      ['retro.sample.json', 'retro', null],
      ['dcp.sample.json', 'dcp', null],
      ['dues.sample.json', 'dues', null],
      ['feedback.sample.json', 'feedback', null],
    ];
    jobs.forEach(([file, cmd]) => {
      const input = JSON.parse(fs.readFileSync(path.join(ex, file), 'utf8'));
      if (cmd === 'lint') {
        const r = brain.lintAgenda(input, { roster: JSON.parse(fs.readFileSync(path.join(ex, 'roster.sample.json'), 'utf8')) });
        writeFile(path.join(outDir, 'agenda-report.html'), brain.agendaHtml(r));
        writeFile(path.join(outDir, 'agenda-report.md'), brain.agendaMd(r));
        writeFile(path.join(outDir, 'agenda-report.json'), JSON.stringify(r, null, 2));
        results.push('lint     → ' + (r.ok ? '通过' : '阻断') + '，评分 ' + r.score);
      } else if (cmd === 'brand') {
        const r = brain.lintBrand(input);
        writeFile(path.join(outDir, 'brand-report.md'), brain.brandMd(r));
        results.push('brand    → ' + (r.ok ? '可发布' : '不可发布') + '，评分 ' + r.score);
      } else if (cmd === 'schedule') {
        const r = brain.schedule(input);
        writeFile(path.join(outDir, 'schedule.md'), brain.scheduleMd(r));
        results.push('schedule → ' + r.stats.filled + '/' + r.stats.slots + ' 已排，基尼 ' + r.fairness.gini);
      } else if (cmd === 'retro') {
        const r = brain.buildRetro(input);
        writeFile(path.join(outDir, 'retro.md'), brain.retroMd(r));
        results.push('retro    → 准时度 ' + r.punctuality + '，超时 ' + r.totals.overruns + ' 个环节');
      } else if (cmd === 'dcp') {
        const r = brain.trackDcp(input);
        writeFile(path.join(outDir, 'dcp.md'), brain.dcpMd(r));
        results.push('dcp      → ' + r.achievedCount + '/10，' + r.level);
      } else if (cmd === 'dues') {
        const r = brain.reconcile(input);
        writeFile(path.join(outDir, 'dues.md'), brain.duesMd(r));
        results.push('dues     → 匹配 ' + r.summary.matched + ' 笔，收缴率 ' + r.summary.collectionRate + '%');
      } else if (cmd === 'feedback') {
        const r = brain.analyzeFeedback(input);
        writeFile(path.join(outDir, 'feedback.md'), brain.feedbackMd(r));
        results.push('feedback → 关闭率 ' + r.summary.closureRate + '%，' + r.alerts.length + ' 条需干预');
      }
    });
    return { code: 0, out: ['已写入 ' + outDir, ''].concat(results).join('\n') };
  },
};

function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const [cmd, file] = positional;
  if (!cmd || cmd === 'help' || flags.help) {
    console.log(usage());
    process.exit(cmd ? 0 : 2);
  }
  const handler = commands[cmd];
  if (!handler) {
    console.error('未知命令：' + cmd + '\n\n' + usage());
    process.exit(2);
  }
  if (cmd !== 'demo' && !file) {
    console.error('缺少输入文件\n\n' + usage());
    process.exit(2);
  }
  try {
    const result = cmd === 'demo' ? handler(flags) : handler(file, flags);
    const { code, out } = result;
    if (out) console.log(out);
    process.exit(code);
  } catch (err) {
    console.error('执行失败：' + err.message);
    process.exit(2);
  }
}

main();
