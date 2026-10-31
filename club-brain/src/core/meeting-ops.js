'use strict';

/**
 * meeting-ops · 会中操作的纯函数内核
 *
 * 浏览器、Node 服务端、手机遥控页三端共用同一套会中语义：
 * 谁也不能自己发明一套"完成环节"的规则。
 *
 * 所有函数直接修改传入的 meeting 对象（服务端持有唯一副本），
 * 返回 true 表示状态有变化，调用方据此广播。
 */

function nowMs(now) {
  return typeof now === 'number' ? now : Date.now();
}

function ensureLive(meeting, now) {
  if (!meeting.live) {
    meeting.live = {
      index: 0,
      elapsedMs: 0,
      runningSince: null,
      startedAt: nowMs(now),
      log: [],
    };
  }
  if (!Array.isArray(meeting.live.log)) meeting.live.log = [];
  return meeting.live;
}

function elapsedSeconds(meeting, now) {
  const l = meeting && meeting.live;
  if (!l) return 0;
  const running = l.runningSince != null ? nowMs(now) - l.runningSince : 0;
  return (l.elapsedMs + running) / 1000;
}

function currentSegment(meeting) {
  const l = meeting && meeting.live;
  if (!l) return null;
  return meeting.segments[l.index] || null;
}

function logEvent(l, text, now) {
  l.log.push({ t: nowMs(now), text });
  if (l.log.length > 200) l.log = l.log.slice(-200);
}

function start(meeting, now) {
  if (!meeting) return false;
  const l = ensureLive(meeting, now);
  meeting.status = 'live';
  if (l.runningSince == null) {
    l.runningSince = nowMs(now);
    logEvent(l, '开始计时：' + (currentSegment(meeting) ? currentSegment(meeting).name : ''), now);
  }
  return true;
}

function toggle(meeting, now) {
  if (!meeting) return false;
  const l = ensureLive(meeting, now);
  if (l.runningSince != null) {
    l.elapsedMs += nowMs(now) - l.runningSince;
    l.runningSince = null;
    logEvent(l, '暂停', now);
  } else {
    l.runningSince = nowMs(now);
    logEvent(l, '继续', now);
  }
  return true;
}

function reset(meeting, now) {
  if (!meeting) return false;
  const l = ensureLive(meeting, now);
  l.elapsedMs = 0;
  l.runningSince = null;
  return true;
}

function writeRecord(meeting, seg, actualMin, now) {
  if (!meeting.records) meeting.records = { timing: [], ah: {}, grammar: { good: [], issues: [] } };
  if (!Array.isArray(meeting.records.timing)) meeting.records.timing = [];
  const record = {
    id: 'tm-' + Math.random().toString(36).slice(2, 8),
    segmentId: seg.id,
    segment: seg.name,
    speaker: seg.owner || '',
    planned: Number(seg.minutes) || 0,
    actual: actualMin,
    status: actualMin > (Number(seg.minutes) || 0) ? 'over' : 'ok',
  };
  const idx = meeting.records.timing.findIndex((t) => t.segmentId === seg.id);
  if (idx >= 0) meeting.records.timing[idx] = Object.assign(meeting.records.timing[idx], record);
  else meeting.records.timing.push(record);
  return record;
}

/** 完成当前环节并推进；不动 meeting.status */
function finish(meeting, now, opts) {
  if (!meeting) return false;
  const l = ensureLive(meeting, now);
  const seg = meeting.segments[l.index];
  if (!seg) return false;
  const elapsed = elapsedSeconds(meeting, now);
  const actualMin = Number((elapsed / 60).toFixed(2));
  if (elapsed > 0.5) writeRecord(meeting, seg, actualMin, now);
  logEvent(l, '完成：' + seg.name + ' ' + actualMin.toFixed(1) + '/' + seg.minutes + ' 分', now);
  l.elapsedMs = 0;
  l.runningSince = (opts && opts.keepRunning) ? nowMs(now) : null;
  l.index = Math.min(l.index + 1, Math.max(0, meeting.segments.length - 1));
  return true;
}

function prev(meeting, now) {
  if (!meeting) return false;
  const l = ensureLive(meeting, now);
  l.index = Math.max(0, l.index - 1);
  l.elapsedMs = 0;
  l.runningSince = null;
  return true;
}

/** 结束整场：补写当前段记录，归档，交给调用方计算复盘 */
function end(meeting, now) {
  if (!meeting) return false;
  const l = ensureLive(meeting, now);
  const elapsed = elapsedSeconds(meeting, now);
  const seg = meeting.segments[l.index];
  if (seg && elapsed > 5) writeRecord(meeting, seg, Number((elapsed / 60).toFixed(2)), now);
  l.runningSince = null;
  meeting.status = 'done';
  meeting.endedAt = nowMs(now);
  meeting.retro = null;
  logEvent(l, '本场结束', now);
  return true;
}

function addAh(meeting, person, word, delta) {
  if (!meeting || !word) return false;
  if (!meeting.records) meeting.records = { timing: [], ah: {}, grammar: { good: [], issues: [] } };
  if (!meeting.records.ah) meeting.records.ah = {};
  const key = person || '（未标注）';
  meeting.records.ah[key] = meeting.records.ah[key] || {};
  const next = (meeting.records.ah[key][word] || 0) + (delta || 1);
  if (next > 0) meeting.records.ah[key][word] = next;
  else delete meeting.records.ah[key][word];
  return true;
}

function addGrammar(meeting, kind, payload) {
  if (!meeting) return false;
  if (!meeting.records) meeting.records = { timing: [], ah: {}, grammar: { good: [], issues: [] } };
  if (!meeting.records.grammar) meeting.records.grammar = { good: [], issues: [] };
  if (kind === 'good') meeting.records.grammar.good.push(payload);
  else meeting.records.grammar.issues.push(payload);
  return true;
}

function removeGrammar(meeting, kind, index) {
  if (!meeting) return false;
  const g = meeting.records && meeting.records.grammar;
  if (!g) return false;
  const list = kind === 'good' ? g.good : g.issues;
  if (index < 0 || index >= list.length) return false;
  list.splice(index, 1);
  return true;
}

/**
 * 统一命令入口：服务端与客户端都走这里
 * @param {object} state { meetings, activeMeetingId, ... }
 * @param {object} cmd { type, meetingId, ...payload }
 * @returns {boolean} 是否改动
 */
function applyCommand(state, cmd, now) {
  if (!state || !cmd || !cmd.type) return false;
  const meeting = state.meetings.find((m) => m.id === cmd.meetingId) ||
    state.meetings.find((m) => m.id === state.activeMeetingId);
  switch (cmd.type) {
    case 'meeting.setActive':
      if (!state.meetings.some((m) => m.id === cmd.meetingId)) return false;
      state.activeMeetingId = cmd.meetingId;
      return true;
    case 'live.start': return start(meeting, now);
    case 'live.toggle': return toggle(meeting, now);
    case 'live.reset': return reset(meeting, now);
    case 'live.finish': return finish(meeting, now, { keepRunning: !!cmd.keepRunning });
    case 'live.prev': return prev(meeting, now);
    case 'live.end': return end(meeting, now);
    case 'ah.add': return addAh(meeting, cmd.person, cmd.word, cmd.delta || 1);
    case 'grammar.add': return addGrammar(meeting, cmd.kind, cmd.payload);
    case 'grammar.remove': return removeGrammar(meeting, cmd.kind, cmd.index);
    default: return false;
  }
}

module.exports = {
  ensureLive, elapsedSeconds, currentSegment,
  start, toggle, reset, finish, prev, end,
  addAh, addGrammar, removeGrammar,
  applyCommand,
};
