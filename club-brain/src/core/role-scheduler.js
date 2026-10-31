'use strict';

/**
 * role-scheduler · 约束排班求解器
 *
 * 头马排班的本质是带约束的指派问题：人少、角色多、要公平、要照顾意愿和能力。
 * 这里用"成本矩阵 + 贪心 + 2-opt 局部搜索"求解，可比手工排班显著降低不公平度。
 * 对应创新点：SC-001 约束建模 / SC-002 最优解 / SC-005 连任惩罚 /
 *             SC-006 新人优先 / SC-010 缺口推荐 / SC-004 公平性度量
 */

const { gini } = require('./util');

const DEFAULT_MAX_PER_MEETING = 2;
const INF = Number.POSITIVE_INFINITY;

/**
 * 单人单角色的成本：越小越好
 * 成本 = 能力差 × 2 + 历史次数 × 1.4 − 意愿分
 */
function costOf(member, role) {
  const skill = Number((member.skills || {})[role]);
  const history = Number((member.history || {})[role]) || 0;
  const pref = Number((member.prefs || {})[role]) || 0;
  const skillTerm = Number.isFinite(skill) ? (5 - skill) * 2 : 4; // 未登记能力按中等略偏保守
  return skillTerm + history * 1.4 - pref;
}

function feasible(member, meeting, role, state, cfg) {
  if ((member.unavailable || []).includes(meeting.date)) return false;
  if (!(member.skills || {})[role] && (member.blockedRoles || []).includes(role)) return false;
  const maxPerMeeting = Number(member.maxPerMeeting) || cfg.maxPerMeeting;
  const inMeeting = state.perMeeting.get(member.id + '|' + meeting.id) || 0;
  if (inMeeting >= maxPerMeeting) return false;
  const total = state.perMember.get(member.id) || 0;
  const capacity = Number(member.capacity) || cfg.defaultCapacity;
  if (total >= capacity) return false;
  return true;
}

function assign(state, meeting, slot, member, cost) {
  const key = member.id + '|' + meeting.id;
  state.perMeeting.set(key, (state.perMeeting.get(key) || 0) + 1);
  state.perMember.set(member.id, (state.perMember.get(member.id) || 0) + 1);
  const record = {
    meetingId: meeting.id,
    date: meeting.date,
    role: slot.role,
    memberId: member.id,
    name: member.name,
    cost,
    reason: explain(member, slot.role),
  };
  state.assignments.push(record);
  return record;
}

function explain(member, role) {
  const skill = Number((member.skills || {})[role]);
  const history = Number((member.history || {})[role]) || 0;
  const pref = Number((member.prefs || {})[role]) || 0;
  const parts = [];
  if (Number.isFinite(skill)) parts.push('能力 ' + skill + '/5');
  if (history === 0) parts.push('首次担任');
  else parts.push('已做 ' + history + ' 次');
  if (pref > 0) parts.push('本人意愿 +' + pref);
  return parts.join('，');
}

function totalCost(assignments) {
  return assignments.reduce((s, a) => s + a.cost, 0);
}

/**
 * @param {object} input { meetings, members }
 * @param {object} [options] { maxPerMeeting, defaultCapacity, passes }
 */
function schedule(input, options) {
  const cfg = Object.assign({ maxPerMeeting: DEFAULT_MAX_PER_MEETING, defaultCapacity: 12, passes: 3 }, options || {});
  const meetings = (input && input.meetings) || [];
  const members = (input && input.members) || [];

  if (!meetings.length) return { schema: 'role-scheduler/v1', assignments: [], unassigned: [], fairness: { gini: 0 }, totalCost: 0, ok: false, note: '没有会议' };
  if (!members.length) {
    return {
      schema: 'role-scheduler/v1',
      assignments: [],
      unassigned: meetings.flatMap((m) => (m.slots || []).map((s) => ({ meetingId: m.id, date: m.date, role: s.role }))),
      fairness: { gini: 0 },
      totalCost: 0,
      ok: false,
      note: '没有可用成员',
    };
  }

  const state = { assignments: [], perMeeting: new Map(), perMember: new Map() };

  // —— 1. 生成候选并按成本升序贪心 ——
  const candidates = [];
  meetings.forEach((m) => {
    (m.slots || []).forEach((slot, si) => {
      members.forEach((mem) => {
        if (!feasible(mem, m, slot.role, state, cfg)) return;
        candidates.push({ meeting: m, slot, slotIndex: si, member: mem, cost: costOf(mem, slot.role) });
      });
    });
  });
  // 角色权重大的先排（weight 越大越关键）
  candidates.sort((a, b) => {
    const wa = Number(a.slot.weight) || 0;
    const wb = Number(b.slot.weight) || 0;
    if (wa !== wb) return wb - wa;
    if (a.cost !== b.cost) return a.cost - b.cost;
    return String(a.member.id).localeCompare(String(b.member.id));
  });

  const filled = new Set();
  const keyOf = (m, si) => m.id + '#' + si;
  candidates.forEach((c) => {
    const k = keyOf(c.meeting, c.slotIndex);
    if (filled.has(k)) return;
    if (!feasible(c.member, c.meeting, c.slot.role, state, cfg)) return;
    assign(state, c.meeting, c.slot, c.member, c.cost);
    filled.add(k);
  });

  // —— 2. 2-opt：尝试两两交换，能降总成本且不违反约束就换 ——
  const why = (a, b) => {
    // 交换后两人都必须在对方的位置可行
    const ma = members.find((m) => m.id === a.memberId);
    const mb = members.find((m) => m.id === b.memberId);
    if (!ma || !mb) return false;
    const meetA = meetings.find((m) => m.id === a.meetingId);
    const meetB = meetings.find((m) => m.id === b.meetingId);
    if (!meetA || !meetB) return false;
    if ((ma.unavailable || []).includes(meetB.date)) return false;
    if ((mb.unavailable || []).includes(meetA.date)) return false;
    return true;
  };

  for (let pass = 0; pass < cfg.passes; pass += 1) {
    let improved = false;
    const list = state.assignments;
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        if (a.memberId === b.memberId) continue;
        if (!why(a, b)) continue;
        const ma = members.find((m) => m.id === a.memberId);
        const mb = members.find((m) => m.id === b.memberId);
        const newA = costOf(mb, a.role);
        const newB = costOf(ma, b.role);
        const delta = newA + newB - (a.cost + b.cost);
        if (delta < -0.5) {
          const backup = { a: { ...a }, b: { ...b } };
          a.memberId = mb.id; a.name = mb.name; a.cost = newA; a.reason = explain(mb, a.role);
          b.memberId = ma.id; b.name = ma.name; b.cost = newB; b.reason = explain(ma, b.role);
          // 校验同一场不超上限
          const meetA = meetings.find((m) => m.id === a.meetingId);
          const meetB = meetings.find((m) => m.id === b.meetingId);
          const cntA = list.filter((x) => x.meetingId === meetA.id && x.memberId === mb.id).length;
          const cntB = list.filter((x) => x.meetingId === meetB.id && x.memberId === ma.id).length;
          if (cntA > cfg.maxPerMeeting || cntB > cfg.maxPerMeeting) {
            Object.assign(a, backup.a);
            Object.assign(b, backup.b);
          } else {
            improved = true;
          }
        }
      }
    }
    if (!improved) break;
  }

  // —— 3. 汇总 ——
  const unassigned = [];
  meetings.forEach((m) => {
    (m.slots || []).forEach((slot, si) => {
      if (!filled.has(keyOf(m, si))) {
        unassigned.push({
          meetingId: m.id, date: m.date, role: slot.role, weight: slot.weight || 0,
          candidates: recommend(m, slot, members, state),
        });
      }
    });
  });

  const perMember = members.map((m) => ({
    id: m.id,
    name: m.name,
    count: state.assignments.filter((a) => a.memberId === m.id).length,
    capacity: Number(m.capacity) || cfg.defaultCapacity,
  }));
  const fairness = {
    gini: Number(gini(perMember.map((p) => p.count)).toFixed(4)),
    min: Math.min(...perMember.map((p) => p.count)),
    max: Math.max(...perMember.map((p) => p.count)),
    perMember,
  };

  return {
    schema: 'role-scheduler/v1',
    ok: unassigned.length === 0,
    assignments: state.assignments,
    unassigned,
    fairness,
    totalCost: Number(totalCost(state.assignments).toFixed(2)),
    stats: {
      meetings: meetings.length,
      slots: meetings.reduce((s, m) => s + (m.slots || []).length, 0),
      filled: state.assignments.length,
      members: members.length,
    },
  };
}

/** 缺口候选：按成本给出前 3 人 */
function recommend(meeting, slot, members, state) {
  const list = members
    .filter((m) => !(m.unavailable || []).includes(meeting.date))
    .map((m) => ({ id: m.id, name: m.name, cost: Number(costOf(m, slot.role).toFixed(2)), reason: explain(m, slot.role) }))
    .sort((a, b) => a.cost - b.cost);
  return list.slice(0, 3);
}

function toMarkdown(report) {
  const lines = [];
  lines.push('# 排班结果');
  lines.push('');
  lines.push('| 项目 | 数值 |');
  lines.push('|---|---|');
  lines.push('| 场次 | ' + report.stats.meetings + ' |');
  lines.push('| 角色槽位 | ' + report.stats.slots + ' |');
  lines.push('| 已排 | ' + report.stats.filled + ' |');
  lines.push('| 缺口 | ' + report.unassigned.length + ' |');
  lines.push('| 总成本 | ' + report.totalCost + ' |');
  lines.push('| 公平性（基尼，越低越均） | ' + report.fairness.gini + ' |');
  lines.push('');
  const byMeeting = {};
  report.assignments.forEach((a) => {
    (byMeeting[a.meetingId] = byMeeting[a.meetingId] || []).push(a);
  });
  Object.keys(byMeeting).forEach((id) => {
    const rows = byMeeting[id];
    lines.push('## ' + id + ' · ' + rows[0].date);
    lines.push('');
    lines.push('| 角色 | 人选 | 依据 |');
    lines.push('|---|---|---|');
    rows.forEach((r) => lines.push('| ' + r.role + ' | ' + r.name + ' | ' + r.reason + ' |'));
    lines.push('');
  });
  if (report.unassigned.length) {
    lines.push('## 缺口');
    lines.push('');
    lines.push('| 场次 | 角色 | 推荐候选 |');
    lines.push('|---|---|---|');
    report.unassigned.forEach((u) => {
      const cand = (u.candidates || []).map((c) => c.name + '(' + c.cost + ')').join('、') || '无人可用';
      lines.push('| ' + u.date + ' | ' + u.role + ' | ' + cand + ' |');
    });
  }
  return lines.join('\n');
}

module.exports = { schedule, costOf, toMarkdown, DEFAULT_MAX_PER_MEETING };
