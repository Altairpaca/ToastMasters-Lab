/* tmc-core/app/rsvp-service.js
 * M9 · 接龙/报名应用服务：来宾、报名、备稿申请、投票统计（依赖 StoragePort）。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

const meetingModel = require('../core/meeting-model.js');

const KEY_PREFIX = 'tmc:meeting:';

/**
 * 创建 rsvp 服务。
 * @param {Object} deps { storage:StoragePort, clock:ClockPort }
 * @returns {Object} RsvpService
 */
function createRsvpService(deps) {
  const storage = (deps && deps.storage) || null;
  const clock = (deps && deps.clock) || null;

  function storageKey(meetingId) { return KEY_PREFIX + meetingId; }

  function loadMeeting(meetingId) {
    if (!storage) { const e = meetingModel.empty(); if (meetingId) e.meeting_id = meetingId; return e; }
    const raw = storage.get(storageKey(meetingId));
    if (!raw) { const e = meetingModel.empty(); if (meetingId) e.meeting_id = meetingId; return e; }
    try {
      const m = meetingModel.migrate(JSON.parse(raw));
      if (!m.meeting_id && meetingId) m.meeting_id = meetingId;
      return m;
    } catch (e) { const em = meetingModel.empty(); if (meetingId) em.meeting_id = meetingId; return em; }
  }

  function saveMeeting(meeting) {
    if (!storage) return;
    const m = meetingModel.normalize(meeting);
    if (clock) m.meta.updated_at = new Date(clock.wallClock()).toISOString().replace(/\.\d{3}Z$/, 'Z');
    storage.set(storageKey(m.meeting_id), JSON.stringify(m));
  }

  return {
    /** 列出所有已存会议的 meeting_id。 */
    listMeetings: function () {
      if (!storage) return [];
      return storage.keys()
        .filter(function (k) { return k.indexOf(KEY_PREFIX) === 0; })
        .map(function (k) { return k.slice(KEY_PREFIX.length); });
    },

    /** 读取一份会议（归一化后）。 */
    getMeeting: function (meetingId) { return loadMeeting(meetingId); },

    /** 创建/覆盖会议。 */
    saveMeeting: function (meeting) { saveMeeting(meeting); },

    /**
     * 发起报名接龙：在 meeting.rsvp 追加一条。
     * @param {string} meetingId
     * @param {Object} entry { name, role_pref, confirmed }
     * @returns {Object} 更新后的 meeting
     */
    createRsvp: function (meetingId, entry) {
      const m = loadMeeting(meetingId);
      const e = entry || {};
      if (e.name) {
        m.rsvp.push({ name: String(e.name), role_pref: e.role_pref || '', confirmed: !!e.confirmed });
      }
      saveMeeting(m);
      return m;
    },

    /**
     * 添加来宾。
     * @param {string} meetingId
     * @param {Object} guest { name, contact, source, is_new }
     * @returns {Object} 更新后的 meeting
     */
    addGuest: function (meetingId, guest) {
      const m = loadMeeting(meetingId);
      const g = guest || {};
      if (g.name) {
        m.guests.push({
          name: String(g.name), contact: g.contact || '', source: g.source || '',
          is_new: g.is_new === false ? false : true,
        });
      }
      saveMeeting(m);
      return m;
    },

    /**
     * 备稿申请：追加到 speeches。
     * @param {string} meetingId
     * @param {Object} speech { member_id, project_level, project_title, pathway, evaluator, requirements }
     * @returns {Object} 更新后的 meeting
     */
    applySpeech: function (meetingId, speech) {
      const m = loadMeeting(meetingId);
      const s = speech || {};
      if (s.member_id) {
        const item = {
          member_id: String(s.member_id),
          project_level: s.project_level || '',
          project_title: s.project_title || '',
          pathway: s.pathway || '',
          evaluator: typeof s.evaluator === 'string' ? s.evaluator : null,
        };
        if (s.requirements && typeof s.requirements === 'object') {
          item.requirements = {};
          if (typeof s.requirements.min_min === 'number') item.requirements.min_min = s.requirements.min_min;
          if (typeof s.requirements.max_min === 'number') item.requirements.max_min = s.requirements.max_min;
        }
        m.speeches.push(item);
      }
      saveMeeting(m);
      return m;
    },

    /**
     * 生成候选列表并接收选票，统计结果。
     * @param {string} meetingId
     * @param {string} category 投票类别
     * @param {string[]} candidates 候选
     * @param {Array<string[]>} votes 每张选票（每人可投多个）
     * @returns {Object} { category, candidates, tally:{name:count}, result:string[] }
     */
    tallyBallot: function (meetingId, category, candidates, votes) {
      const cands = (candidates || []).map(String);
      const tally = {};
      cands.forEach(function (c) { tally[c] = 0; });
      (votes || []).forEach(function (v) {
        (v || []).forEach(function (name) {
          if (Object.prototype.hasOwnProperty.call(tally, name)) tally[name] += 1;
        });
      });
      const max = cands.reduce(function (a, c) { return Math.max(a, tally[c]); }, 0);
      const result = cands.filter(function (c) { return max > 0 && tally[c] === max; });

      const m = loadMeeting(meetingId);
      const idx = m.ballot.findIndex(function (b) { return b.category === category; });
      const rec = { category: category, candidates: cands, result: result };
      if (idx >= 0) m.ballot[idx] = rec; else m.ballot.push(rec);
      saveMeeting(m);

      return { category: category, candidates: cands, tally: tally, result: result };
    },
  };
}

module.exports = { createRsvpService: createRsvpService, KEY_PREFIX: KEY_PREFIX };
