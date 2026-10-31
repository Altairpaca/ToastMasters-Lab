/* Club Console · 状态与领域操作
   单一事实源：一份 data 对象 → 五处渲染。所有写入走 commit()，自带撤销栈与持久化。 */
(function () {
  const CC = (window.CC = window.CC || {});
  const KEY = 'club-console/v2';
  const MAX_UNDO = 40;

  let data = null;
  let listeners = [];
  let undoStack = [];
  let redoStack = [];
  let storageOk = true;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 2) return null;
      return parsed;
    } catch (err) {
      storageOk = false;
      return null;
    }
  }

  function persist() {
    if (!storageOk) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (err) {
      storageOk = false;
    }
  }

  function notify() {
    listeners.forEach((fn) => {
      try { fn(data); } catch (e) { console.error(e); }
    });
  }

  function init() {
    data = load() || CC.seed.build();
    if (!data.activeMeetingId || !data.meetings.some((m) => m.id === data.activeMeetingId)) {
      data.activeMeetingId = data.meetings[0] ? data.meetings[0].id : null;
    }
    CC.state.data = data;
  }

  function commit(mutator, opts) {
    const o = opts || {};
    if (!o.noUndo) {
      undoStack.push(JSON.stringify(data));
      if (undoStack.length > MAX_UNDO) undoStack.shift();
      redoStack = [];
    }
    mutator(data);
    persist();
    if (!o.silent) notify();
  }

  function undo() {
    if (!undoStack.length) return false;
    redoStack.push(JSON.stringify(data));
    data = JSON.parse(undoStack.pop());
    CC.state.data = data;
    persist();
    notify();
    return true;
  }

  function redo() {
    if (!redoStack.length) return false;
    undoStack.push(JSON.stringify(data));
    data = JSON.parse(redoStack.pop());
    CC.state.data = data;
    persist();
    notify();
    return true;
  }

  /* ---------------- 查询 ---------------- */

  function meetings() { return data.meetings.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')); }
  function activeMeeting() {
    return data.meetings.find((m) => m.id === data.activeMeetingId) || null;
  }
  function meetingById(id) { return data.meetings.find((m) => m.id === id) || null; }
  function members() { return data.members; }

  function roster() {
    return {
      members: data.members.map((m) => ({
        name: m.name, english: m.english, aliases: m.aliases || [],
      })),
    };
  }

  function lint(meeting) {
    if (!meeting) return null;
    return CC.core.lintAgenda(meeting, { roster: roster(), defaultEnd: meeting.end || '21:30' });
  }

  /* ---------------- 会议 ---------------- */

  function setActive(id) { commit((d) => { d.activeMeetingId = id; }, { noUndo: true }); }

  function addMeeting() {
    const sorted = meetings();
    const last = sorted[0];
    const no = last ? Number(last.meetingNo) + 1 : 1;
    const id = CC.dom.uid('mtg');
    const date = nextThursday(last ? last.date : new Date().toISOString().slice(0, 10));
    const mtg = {
      id, meetingNo: no, date, weekday: weekdayZh(date), start: '19:30', end: '21:30',
      language: 'zh', theme: '（待定）', tableTopicsCount: 6, status: 'draft',
      segments: [
        { id: CC.dom.uid('sg'), name: '召集与开场', kind: 'opening', minutes: 5, owner: '', ownerStatus: 'pending' },
        { id: CC.dom.uid('sg'), name: '会议促进者介绍', kind: 'facilitator', minutes: 12, owner: '', ownerStatus: 'pending' },
        { id: CC.dom.uid('sg'), name: '备稿演讲 1', kind: 'speech', minutes: 10, owner: '', ownerStatus: 'pending' },
        { id: CC.dom.uid('sg'), name: '合影与休息', kind: 'break', minutes: 10, owner: '', ownerStatus: 'pending' },
        { id: CC.dom.uid('sg'), name: '即兴演讲', kind: 'tabletopics', minutes: 17, owner: '', ownerStatus: 'pending' },
        { id: CC.dom.uid('sg'), name: '促进者报告', kind: 'report', minutes: 15, owner: '', ownerStatus: 'pending' },
        { id: CC.dom.uid('sg'), name: '投票与颁奖', kind: 'vote', minutes: 5, owner: '', ownerStatus: 'pending' },
        { id: CC.dom.uid('sg'), name: '谢幕', kind: 'closing', minutes: 5, owner: '', ownerStatus: 'pending' },
      ],
      speeches: [{
        id: CC.dom.uid('sp'), path: 'PM', level: 1, title: '', requirement: '',
        speaker: '', evaluator: '', minutes: 7, evalMinutes: 3, status: 'pending',
      }],
      notes: [],
      records: emptyRecords(),
      retro: null,
      live: null,
    };
    commit((d) => { d.meetings.push(mtg); d.activeMeetingId = id; });
    return mtg;
  }

  function duplicateMeeting(id) {
    const src = meetingById(id);
    if (!src) return null;
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = CC.dom.uid('mtg');
    copy.meetingNo = Number(src.meetingNo) + 1;
    copy.date = nextThursday(src.date);
    copy.weekday = weekdayZh(copy.date);
    copy.status = 'draft';
    copy.records = emptyRecords();
    copy.retro = null;
    copy.live = null;
    copy.segments.forEach((s) => { s.id = CC.dom.uid('sg'); });
    copy.speeches.forEach((s) => { s.id = CC.dom.uid('sp'); });
    commit((d) => { d.meetings.push(copy); d.activeMeetingId = copy.id; });
    return copy;
  }

  function removeMeeting(id) {
    commit((d) => {
      d.meetings = d.meetings.filter((m) => m.id !== id);
      if (d.activeMeetingId === id) d.activeMeetingId = d.meetings[0] ? d.meetings[0].id : null;
    });
  }

  function updateMeeting(id, patch) {
    commit((d) => {
      const m = d.meetings.find((x) => x.id === id);
      if (m) Object.assign(m, patch);
    });
  }

  function setStage(id, status) {
    commit((d) => {
      const m = d.meetings.find((x) => x.id === id);
      if (m) m.status = status;
    });
  }

  /* ---------------- 环节 ---------------- */

  function addSegment(meetingId, afterIndex) {
    commit((d) => {
      const m = d.meetings.find((x) => x.id === meetingId);
      if (!m) return;
      const seg = { id: CC.dom.uid('sg'), name: '新环节', kind: 'special', minutes: 5, owner: '', ownerStatus: 'pending' };
      const at = afterIndex == null ? m.segments.length : afterIndex + 1;
      m.segments.splice(at, 0, seg);
    });
  }

  function updateSegment(meetingId, segId, patch) {
    commit((d) => {
      const m = d.meetings.find((x) => x.id === meetingId);
      const s = m && m.segments.find((x) => x.id === segId);
      if (s) Object.assign(s, patch);
    });
  }

  function removeSegment(meetingId, segId) {
    commit((d) => {
      const m = d.meetings.find((x) => x.id === meetingId);
      if (m) m.segments = m.segments.filter((s) => s.id !== segId);
    });
  }

  function moveSegment(meetingId, segId, dir) {
    commit((d) => {
      const m = d.meetings.find((x) => x.id === meetingId);
      if (!m) return;
      const i = m.segments.findIndex((s) => s.id === segId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= m.segments.length) return;
      const [item] = m.segments.splice(i, 1);
      m.segments.splice(j, 0, item);
    });
  }

  /* ---------------- 备稿 ---------------- */

  function addSpeech(meetingId) {
    commit((d) => {
      const m = d.meetings.find((x) => x.id === meetingId);
      if (!m) return;
      m.speeches.push({
        id: CC.dom.uid('sp'), path: 'PM', level: 1, title: '', requirement: '',
        speaker: '', evaluator: '', minutes: 7, evalMinutes: 3, status: 'pending',
      });
      m.segments.push({
        id: CC.dom.uid('sg'), name: '备稿演讲 ' + m.speeches.length, kind: 'speech', minutes: 10,
        owner: '', ownerStatus: 'pending',
      });
    });
  }

  function updateSpeech(meetingId, spId, patch) {
    commit((d) => {
      const m = d.meetings.find((x) => x.id === meetingId);
      const s = m && m.speeches.find((x) => x.id === spId);
      if (s) Object.assign(s, patch);
    });
  }

  function removeSpeech(meetingId, spId) {
    commit((d) => {
      const m = d.meetings.find((x) => x.id === meetingId);
      if (!m) return;
      m.speeches = m.speeches.filter((s) => s.id !== spId);
      // 同步移除最后一个备稿环节
      const idx = m.segments.map((s) => s.kind).lastIndexOf('speech');
      if (idx >= 0) m.segments.splice(idx, 1);
    });
  }

  /* ---------------- 备注 ---------------- */

  function addNote(meetingId, text) {
    commit((d) => {
      const m = d.meetings.find((x) => x.id === meetingId);
      if (m && text.trim()) m.notes.push(text.trim());
    });
  }
  function removeNote(meetingId, index) {
    commit((d) => {
      const m = d.meetings.find((x) => x.id === meetingId);
      if (m) m.notes.splice(index, 1);
    });
  }

  /* ---------------- 会中 ---------------- */

  function emptyRecords() {
    return { timing: [], ah: {}, grammar: { good: [], issues: [] }, ahByWord: {} };
  }

  function ensureLive(meeting) {
    if (!meeting) return null;
    if (!meeting.live) {
      meeting.live = { index: 0, elapsedMs: 0, runningSince: null, startedAt: Date.now(), log: [] };
    }
    return meeting.live;
  }

  function liveElapsedSeconds(meeting) {
    const l = meeting && meeting.live;
    if (!l) return 0;
    const running = l.runningSince ? Date.now() - l.runningSince : 0;
    return (l.elapsedMs + running) / 1000;
  }

  function liveStart(meetingId) {
    commit((d) => {
      const m = d.meetings.find((x) => x.id === meetingId);
      if (!m) return;
      const l = ensureLive(m);
      m.status = 'live';
      if (!l.runningSince) {
        l.runningSince = Date.now();
        l.log.push({ t: Date.now(), text: '开始计时：' + (m.segments[l.index] ? m.segments[l.index].name : '') });
      }
    });
  }

  function liveToggle(meetingId) {
    commit((d) => {
      const m = d.meetings.find((x) => x.id === meetingId);
      const l = m && ensureLive(m);
      if (!l) return;
      if (l.runningSince) {
        l.elapsedMs += Date.now() - l.runningSince;
        l.runningSince = null;
      } else {
        l.runningSince = Date.now();
      }
    }, { noUndo: true });
  }

  function liveReset(meetingId) {
    commit((d) => {
      const m = d.meetings.find((x) => x.id === meetingId);
      const l = m && ensureLive(m);
      if (l) { l.elapsedMs = 0; l.runningSince = null; }
    }, { noUndo: true });
  }

  /** 结束当前环节：写入记录、推进到下一环节 */
  function liveFinish(meetingId, opts) {
    commit((d) => {
      const m = d.meetings.find((x) => x.id === meetingId);
      const l = m && ensureLive(m);
      if (!m || !l) return;
      const seg = m.segments[l.index];
      if (!seg) return;
      const elapsed = liveElapsedSeconds(m);
      const actualMin = Number((elapsed / 60).toFixed(2));
      const record = {
        id: CC.dom.uid('tm'),
        segment: seg.name,
        speaker: seg.owner || '',
        planned: Number(seg.minutes) || 0,
        actual: actualMin,
        status: actualMin > seg.minutes ? 'over' : actualMin === 0 ? 'skip' : 'ok',
      };
      const exist = m.records.timing.findIndex((t) => t.segmentId === seg.id);
      if (exist >= 0) m.records.timing[exist] = { ...record, segmentId: seg.id };
      else m.records.timing.push({ ...record, segmentId: seg.id });
      l.log.push({ t: Date.now(), text: '完成：' + seg.name + ' ' + actualMin.toFixed(1) + '/' + seg.minutes + ' 分' });
      l.elapsedMs = 0;
      l.runningSince = null;
      l.index = Math.min(l.index + 1, m.segments.length - 1);
      if (opts && opts.last) l.runningSince = null;
    });
  }

  function livePrev(meetingId) {
    commit((d) => {
      const m = d.meetings.find((x) => x.id === meetingId);
      const l = m && ensureLive(m);
      if (!l) return;
      l.index = Math.max(0, l.index - 1);
      l.elapsedMs = 0;
      l.runningSince = null;
    }, { noUndo: true });
  }

  function liveNext(meetingId) { liveFinish(meetingId); }

  function liveEnd(meetingId) {
    commit((d) => {
      const m = d.meetings.find((x) => x.id === meetingId);
      if (!m) return;
      const l = ensureLive(m);
      const elapsed = liveElapsedSeconds(m);
      const seg = m.segments[l.index];
      if (seg && elapsed > 5) {
        const actualMin = Number((elapsed / 60).toFixed(2));
        const exist = m.records.timing.findIndex((t) => t.segmentId === seg.id);
        const rec = {
          id: CC.dom.uid('tm'), segmentId: seg.id, segment: seg.name, speaker: seg.owner || '',
          planned: Number(seg.minutes) || 0, actual: actualMin,
          status: actualMin > seg.minutes ? 'over' : 'ok',
        };
        if (exist >= 0) m.records.timing[exist] = rec; else m.records.timing.push(rec);
      }
      l.runningSince = null;
      m.status = 'done';
      m.endedAt = Date.now();
      m.retro = null;
      ensureRetro(m);
    });
  }

  /* ---------------- 三官记录 ---------------- */

  function addAh(meetingId, person, word) {
    commit((d) => {
      const m = d.meetings.find((x) => x.id === meetingId);
      if (!m) return;
      const key = person || '（未标注）';
      m.records.ah[key] = m.records.ah[key] || {};
      m.records.ah[key][word] = (m.records.ah[key][word] || 0) + 1;
    }, { noUndo: true });
  }

  function removeAh(meetingId, person, word) {
    commit((d) => {
      const m = d.meetings.find((x) => x.id === meetingId);
      if (!m) return;
      const key = person || '（未标注）';
      if (m.records.ah[key] && m.records.ah[key][word]) {
        m.records.ah[key][word] -= 1;
        if (m.records.ah[key][word] <= 0) delete m.records.ah[key][word];
      }
    }, { noUndo: true });
  }

  function addGrammar(meetingId, kind, payload) {
    commit((d) => {
      const m = d.meetings.find((x) => x.id === meetingId);
      if (!m) return;
      if (kind === 'good') m.records.grammar.good.push(payload);
      else m.records.grammar.issues.push(payload);
    });
  }

  function removeGrammar(meetingId, kind, index) {
    commit((d) => {
      const m = d.meetings.find((x) => x.id === meetingId);
      if (!m) return;
      m.records.grammar[kind].splice(index, 1);
    });
  }

  /* ---------------- 复盘 ---------------- */

  function ensureRetro(meeting) {
    if (!meeting) return null;
    if (meeting.retro) return meeting.retro;
    const timing = (meeting.records.timing || []).map((t) => ({
      segment: t.segment, speaker: t.speaker, planned: t.planned, actual: t.actual, status: t.status,
    }));
    const ah = Object.entries(meeting.records.ah || {}).map(([speaker, counts]) => ({ speaker, counts }));
    const retro = CC.core.buildRetro({
      meetingNo: meeting.meetingNo,
      date: meeting.date,
      timing,
      ah,
      grammar: meeting.records.grammar,
      attendance: meeting.attendance || null,
    });
    meeting.retro = retro;
    return retro;
  }

  /* ---------------- 导出 ---------------- */

  function timerCsv(meeting) {
    const rows = [['议程名', '总时长', '角色', '是否是大环节']];
    const bigKinds = ['tabletopics', 'workshop', 'special'];
    (meeting.segments || []).forEach((s) => {
      rows.push([s.name, String(s.minutes), s.owner || '', bigKinds.includes(s.kind) ? 'true' : 'false']);
    });
    return rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c)).join(',')).join('\n');
  }

  function sheetMarkdown(meeting) {
    const rep = lint(meeting);
    const tl = rep ? rep.timeline : [];
    const lines = [];
    lines.push('# 第 ' + meeting.meetingNo + ' 次例会 · ' + meeting.date + '（' + (meeting.weekday || '') + '）');
    lines.push('');
    lines.push('主题：' + (meeting.theme || '—') + '　｜　' + meeting.start + '–' + meeting.end);
    lines.push('');
    lines.push('| 时间 | 环节 | 时长 | 负责人 |');
    lines.push('|---|---|--:|---|');
    tl.forEach((s) => lines.push('| ' + s.startText + '–' + s.endText + ' | ' + s.name + ' | ' + s.minutes + "' | " + (s.owner || '—') + ' |'));
    if ((meeting.speeches || []).length) {
      lines.push('');
      lines.push('## 备稿');
      lines.push('');
      lines.push('| 题目 | 演讲人 | 点评人 | 项目要求 |');
      lines.push('|---|---|---|---|');
      meeting.speeches.forEach((s) => lines.push('| ' + (s.title || '（待定）') + ' | ' + (s.speaker || '—') +
        ' | ' + (s.evaluator || '—') + ' | ' + (s.requirement || '—') + ' |'));
    }
    if ((meeting.notes || []).length) {
      lines.push('');
      lines.push('## 备注');
      lines.push('');
      meeting.notes.forEach((n) => lines.push('- ' + n));
    }
    return lines.join('\n');
  }

  function surveyDraft(meeting) {
    return CC.core.buildSurveyDraft(meeting, { includeTableTopics: true, optionalAdvice: true });
  }

  function fullJson() { return JSON.stringify(data, null, 2); }

  function importJson(text) {
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.meetings)) throw new Error('不是有效的 Club Console 备份文件');
    undoStack.push(JSON.stringify(data));
    data = parsed;
    data.version = 2;
    CC.state.data = data;
    persist();
    notify();
  }

  function resetDemo() {
    undoStack.push(JSON.stringify(data));
    data = CC.seed.build();
    CC.state.data = data;
    persist();
    notify();
  }

  /* ---------------- 辅助 ---------------- */

  function weekdayZh(dateStr) {
    const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const wd = CC.core.weekdayOf(dateStr);
    return Number.isNaN(wd) ? '' : names[wd];
  }

  function nextThursday(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return dateStr;
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }

  function allPeople(meeting) {
    const set = new Set();
    (meeting.segments || []).forEach((s) => { if (s.owner) set.add(s.owner); });
    (meeting.speeches || []).forEach((s) => { if (s.speaker) set.add(s.speaker); if (s.evaluator) set.add(s.evaluator); });
    return [...set];
  }

  CC.state = {
    init, data: null,
    subscribe(fn) { listeners.push(fn); return () => { listeners = listeners.filter((x) => x !== fn); }; },
    notify, commit, undo, redo,
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    storageOk: () => storageOk,
    meetings, activeMeeting, meetingById, members, roster, lint,
    setActive, addMeeting, duplicateMeeting, removeMeeting, updateMeeting, setStage,
    addSegment, updateSegment, removeSegment, moveSegment,
    addSpeech, updateSpeech, removeSpeech,
    addNote, removeNote,
    ensureLive, liveElapsedSeconds, liveStart, liveToggle, liveReset, liveFinish, livePrev, liveNext, liveEnd,
    addAh, removeAh, addGrammar, removeGrammar,
    ensureRetro, timerCsv, sheetMarkdown, surveyDraft, fullJson, importJson, resetDemo,
    allPeople, weekdayZh, emptyRecords,
  };
})();
