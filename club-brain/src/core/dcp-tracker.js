'use strict';

/**
 * dcp-tracker · DCP 十项目标缺口追踪与预测
 *
 * 说明：DCP（Distinguished Club Program）的官方口径以 Toastmasters International
 * 当年发布的 DCP 手册为准，且各年度会微调。本模块把目标做成**可配置**，
 * 默认值仅作示例，不在代码里硬编码"官方规则"。
 * 对应创新点：GV-040 DCP 仪表盘 / GV-041 缺口预测 / GV-042 行动建议 / ED-021 奖项路径
 */

const DEFAULT_GOALS = [
  { id: 'edu-l1', group: '教育', title: '2 位会员完成 Level 1', target: 2, source: 'awards.level1' },
  { id: 'edu-l2a', group: '教育', title: '2 位会员完成 Level 2', target: 2, source: 'awards.level2' },
  { id: 'edu-l2b', group: '教育', title: '再有 2 位会员完成 Level 2', target: 2, source: 'awards.level2', offset: 2 },
  { id: 'edu-l3', group: '教育', title: '2 位会员完成 Level 3', target: 2, source: 'awards.level3' },
  { id: 'edu-l45', group: '教育', title: '1 位会员完成 Level 4/5 或 DTM', target: 1, source: 'awards.level45' },
  { id: 'mem-1', group: '会员', title: '新增 1 位会员', target: 1, source: 'newMembers' },
  { id: 'mem-4', group: '会员', title: '新增 4 位会员', target: 4, source: 'newMembers' },
  { id: 'mem-8', group: '会员', title: '新增 8 位会员', target: 8, source: 'newMembers' },
  { id: 'off-1', group: '执委', title: '4 位执委参加第一期培训', target: 4, source: 'officersTrained.round1' },
  { id: 'off-2', group: '执委', title: '4 位执委参加第二期培训', target: 4, source: 'officersTrained.round2' },
];

const ACTIONS = {
  'edu-l1': '挑 2 位已完成第一个项目的会员，本周内确认 Level 1 提交材料是否齐全',
  'edu-l2a': '找 2 位 Level 1 已过的会员，锁定下两期备稿档期',
  'edu-l2b': '再找 2 位不同会员报 Level 2，注意不要与上一目标重复用人',
  'edu-l3': '为已完成两级的会员安排 Level 3 项目，优先选难度可控的',
  'edu-l45': '锁定 1 位资深会员冲 Level 4/5，配一位导师陪跑',
  'mem-1': '本期开放日至少邀 3 位宾客到场，按转化 SOP 跟进',
  'mem-4': '把招新目标拆到每季度 1 人，责任人写进执委会议程',
  'mem-8': '需要一次集中招新活动（开放日/联合会议），单靠自然到访难达标',
  'off-1': '核对第一期 COT 参训名单，未参训的执委补课',
  'off-2': '第二期培训提前 3 周锁定 4 位执委日程',
};

function pick(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/**
 * @param {object} input {
 *   period: {from, to}, awards: {level1, level2, level3, level45},
 *   newMembers, officersTrained: {round1, round2}, duesOnTime,
 *   members: [{name, level}], history: [{month, achieved}]
 * }
 * @param {object} [options] { goals }
 */
function trackDcp(input, options) {
  const data = input || {};
  const opts = options || {};
  const goals = opts.goals || DEFAULT_GOALS;

  const rows = goals.map((g) => {
    const raw = Number(pick(data, g.source)) || 0;
    const current = Math.max(0, raw - (g.offset || 0));
    const target = Number(g.target) || 1;
    const achieved = current >= target;
    const remaining = Math.max(0, target - current);
    return {
      id: g.id,
      group: g.group,
      title: g.title,
      target,
      current: Math.min(current, target),
      raw,
      remaining,
      achieved,
      progressPct: Math.min(100, Math.round((current / target) * 100)),
      action: achieved ? null : (ACTIONS[g.id] || '需要人工补充行动项'),
    };
  });

  const achievedCount = rows.filter((r) => r.achieved).length;
  const level = achievedCount >= 9 ? "President's Distinguished"
    : achievedCount >= 7 ? 'Select Distinguished'
      : achievedCount >= 5 ? 'Distinguished' : '未达区级';

  // —— 速度与预测 ——
  const history = Array.isArray(data.history) ? data.history : [];
  let velocity = null;
  let forecast = null;
  if (history.length >= 2) {
    const first = history[0];
    const last = history[history.length - 1];
    const months = Math.max(1, monthDiff(first.month, last.month));
    velocity = Number(((last.achieved - first.achieved) / months).toFixed(2));
    const need7 = Math.max(0, 7 - achievedCount);
    const need9 = Math.max(0, 9 - achievedCount);
    forecast = {
      velocityPerMonth: velocity,
      monthsToSelect: velocity > 0 ? Number((need7 / velocity).toFixed(1)) : null,
      monthsToPresidents: velocity > 0 ? Number((need9 / velocity).toFixed(1)) : null,
      note: velocity > 0 ? null : '本周期尚无推进速度，无法预测；先完成 1 个目标再评估',
    };
  }

  const warnings = [];
  if (data.duesOnTime === false) {
    warnings.push('会费未按期缴纳，可能影响 DCP 资格，请司库核对');
  }
  if (achievedCount >= 5 && achievedCount < 7) {
    warnings.push('已到 Distinguished（5 项），再完成 2 项可升 Select');
  }
  if (achievedCount >= 7 && achievedCount < 9) {
    warnings.push('已到 Select（7 项），再完成 2 项可升 President\'s');
  }
  const stuck = rows.filter((r) => r.progressPct === 0);
  if (stuck.length) {
    warnings.push('有 ' + stuck.length + ' 项完全未启动：' + stuck.map((s) => s.title).join('、'));
  }

  return {
    schema: 'dcp-tracker/v1',
    period: data.period || null,
    achievedCount,
    totalGoals: rows.length,
    level,
    score: Math.round((achievedCount / rows.length) * 100),
    goals: rows,
    byGroup: groupBy(rows),
    velocity,
    forecast,
    warnings,
    actions: rows.filter((r) => !r.achieved).map((r) => ({ id: r.id, title: r.title, action: r.action })),
  };
}

function groupBy(rows) {
  const out = {};
  rows.forEach((r) => {
    out[r.group] = out[r.group] || { achieved: 0, total: 0 };
    out[r.group].total += 1;
    if (r.achieved) out[r.group].achieved += 1;
  });
  return out;
}

function monthDiff(a, b) {
  const pa = String(a || '').split('-').map(Number);
  const pb = String(b || '').split('-').map(Number);
  if (!pa[0] || !pb[0]) return 0;
  return (pb[0] - pa[0]) * 12 + (pb[1] - pa[1]);
}

function toMarkdown(r) {
  const lines = [];
  lines.push('# DCP 进度 · ' + (r.period ? r.period.from + ' ~ ' + r.period.to : '本周期'));
  lines.push('');
  lines.push('| 指标 | 数值 |');
  lines.push('|---|---|');
  lines.push('| 已完成 | ' + r.achievedCount + ' / ' + r.totalGoals + ' |');
  lines.push('| 当前等级 | ' + r.level + ' |');
  lines.push('| 完成度 | ' + r.score + '% |');
  if (r.forecast) {
    lines.push('| 推进速度 | ' + r.forecast.velocityPerMonth + ' 项/月 |');
    lines.push('| 预计达 Select | ' +
      (r.forecast.monthsToSelect == null ? '—' : r.forecast.monthsToSelect + ' 个月') + ' |');
    lines.push('| 预计达 President\'s | ' +
      (r.forecast.monthsToPresidents == null ? '—' : r.forecast.monthsToPresidents + ' 个月') + ' |');
  }
  lines.push('');
  lines.push('## 十项目标');
  lines.push('');
  lines.push('| | 目标 | 进度 | 状态 |');
  lines.push('|---|---|---|--:|');
  r.goals.forEach((g) => {
    lines.push('| ' + (g.achieved ? '✅' : '⬜') + ' | ' + g.title + ' | ' + g.current + '/' + g.target +
      ' | ' + g.progressPct + '% |');
  });
  if (r.actions.length) {
    lines.push('');
    lines.push('## 下一步动作');
    lines.push('');
    r.actions.forEach((a) => lines.push('- **' + a.title + '**：' + a.action));
  }
  if (r.warnings.length) {
    lines.push('');
    lines.push('## 提醒');
    lines.push('');
    r.warnings.forEach((w) => lines.push('- ' + w));
  }
  return lines.join('\n');
}

module.exports = { trackDcp, toMarkdown, DEFAULT_GOALS };
