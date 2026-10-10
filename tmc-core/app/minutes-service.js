/* tmc-core/app/minutes-service.js
 * M11 · 纪要/复盘应用服务：汇总三阶段数据 → 纪要 Markdown + 成长数据。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

const meetingModel = require('../core/meeting-model.js');
const reportKernel = require('../core/report-kernel.js');
const { roleZh } = require('../data/roles.js');

/**
 * 创建纪要服务。
 * @param {Object} deps { storage:StoragePort }
 * @returns {Object} MinutesService
 */
function createMinutesService(deps) {
  const storage = (deps && deps.storage) || null;

  return {
    /**
     * 依据一份 meeting 生成结构化纪要 Markdown。
     * @param {Object} meeting
     * @returns {string} Markdown
     */
    generateMinutes: function (meeting) {
      const m = meetingModel.normalize(meeting);
      const L = [];
      L.push('# 会议纪要 · 第 ' + (m.meeting_number || '?') + ' 次例会');
      L.push('');
      L.push('**日期**：' + (m.date || '') + '　**地点**：' + (m.venue || ''));
      if (m.theme && (m.theme.zh || m.theme.en)) {
        L.push('**主题**：' + [m.theme.zh, m.theme.en].filter(Boolean).join(' / '));
      }
      if (m.word_of_the_day && m.word_of_the_day.en) {
        L.push('**每日一词**：' + m.word_of_the_day.en +
          (m.word_of_the_day.zh ? '（' + m.word_of_the_day.zh + '）' : ''));
      }
      L.push('');

      // 角色
      L.push('## 角色分工');
      L.push('');
      L.push('| 角色 Role | 姓名 Name |');
      L.push('|:---|:---|');
      (m.roles || []).forEach(function (r) {
        L.push('| ' + roleZh(r.role) + ' | ' + (r.name_zh || r.name_en || '—') + ' |');
      });
      L.push('');

      // 议程
      L.push('## 议程 Agenda');
      L.push('');
      L.push('| 环节 Segment | 呈现者 | 时长 |');
      L.push('|:---|:---|--:|');
      (m.agenda || []).forEach(function (s) {
        L.push('| ' + (s.title_zh || s.type) + ' | ' + (s.presenter || '—') + ' | ' +
          (Number(s.duration_min) || 0) + '′ |');
      });
      L.push('');

      // 备稿
      if ((m.speeches || []).length) {
        L.push('## 备稿演讲 Prepared Speeches');
        L.push('');
        (m.speeches || []).forEach(function (s) {
          L.push('- **' + s.member_id + '**：' + (s.project_title || '') +
            (s.project_level ? '（' + s.project_level + '）' : '') +
            (s.evaluator ? ' — 点评：' + s.evaluator : ''));
        });
        L.push('');
      }

      // 三官摘要
      const officers = m.officers_records || {};
      if (Array.isArray(officers.timer) && officers.timer.length) {
        const vmT = reportKernel.buildTimerReport(officers.timer.map(function (r) {
          const green = Math.round((r.planned_min || 0) * 60) - 60;
          const red = Math.round((r.planned_min || 0) * 60);
          return {
            speaker: r.segment_id, role: '环节', time: r.actual_sec || 0,
            status: r.status === 'green' ? 'ok' : (r.status === 'yellow' ? 'ok' : 'over'),
            overBy: 0, green: green, red: red,
          };
        }), { meetingName: m.meeting_id, date: m.date });
        L.push('## 计时摘要 Timer');
        L.push('');
        L.push(vmT.summary);
        L.push('');
      }
      if (Array.isArray(officers.ah_counter) && officers.ah_counter.length) {
        L.push('## 哼哈摘要 Ah-Counter');
        L.push('');
        officers.ah_counter.forEach(function (r) {
          const total = Object.keys(r.counts || {}).reduce(function (a, k) { return a + (r.counts[k] || 0); }, 0);
          L.push('- ' + r.member_id + '：赘词 ' + total + ' 次' +
            (r.top3 && r.top3.length ? '（高频：' + r.top3.join('、') + '）' : ''));
        });
        L.push('');
      }
      if (Array.isArray(officers.grammarian) && officers.grammarian.length) {
        L.push('## 语法摘要 Grammarian');
        L.push('');
        officers.grammarian.forEach(function (r) {
          L.push('- ' + r.member_id +
            (r.good_phrases && r.good_phrases.length ? '　✨ ' + r.good_phrases.join('；') : '') +
            (r.corrections && r.corrections.length ? '　⚠️ ' + r.corrections.join('；') : ''));
        });
        L.push('');
      }

      // 投票结果
      if ((m.ballot || []).length) {
        L.push('## 评选结果 Ballot');
        L.push('');
        (m.ballot || []).forEach(function (b) {
          L.push('- ' + b.category + '：' + ((b.result || []).join('、') || '—'));
        });
        L.push('');
      }

      // 来宾
      if ((m.guests || []).length) {
        L.push('## 来宾 Guests');
        L.push('');
        (m.guests || []).forEach(function (g) {
          L.push('- ' + g.name + (g.source ? '（' + g.source + '）' : ''));
        });
        L.push('');
      }

      if (m.minutes) {
        L.push('## 补充纪要');
        L.push('');
        L.push(m.minutes);
        L.push('');
      }

      L.push('---');
      L.push('');
      L.push('*本纪要由 TMC Toolkit 依据 meeting.json 自动生成。*');
      return L.join('\n');
    },

    /**
     * 跨期成长数据汇总。
     * @param {Array<Object>} meetings 多期 meeting
     * @returns {Object} GrowthSummary
     */
    growthSummary: function (meetings) {
      const list = Array.isArray(meetings) ? meetings.map(meetingModel.normalize) : [];
      const byDate = list.slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });

      // 出勤趋势
      const attendance = byDate.map(function (m) {
        const members = {};
        (m.roles || []).forEach(function (r) { if (r.name_zh) members[r.name_zh] = true; });
        (m.speeches || []).forEach(function (s) { if (s.member_id) members[s.member_id] = true; });
        return { date: m.date, count: Object.keys(members).length, guests: (m.guests || []).length };
      });

      // 角色分布
      const roleDist = {};
      list.forEach(function (m) {
        (m.roles || []).forEach(function (r) { roleDist[r.role] = (roleDist[r.role] || 0) + 1; });
      });

      // 备稿级别分布
      const levelDist = {};
      list.forEach(function (m) {
        (m.speeches || []).forEach(function (s) {
          const lv = s.project_level || '未标注';
          levelDist[lv] = (levelDist[lv] || 0) + 1;
        });
      });

      // 计时合格率
      let okCount = 0, totalCount = 0;
      list.forEach(function (m) {
        const t = (m.officers_records && m.officers_records.timer) || [];
        t.forEach(function (r) {
          totalCount += 1;
          if (r.status === 'green' || r.status === 'yellow') okCount += 1;
        });
      });

      return {
        meetingCount: list.length,
        attendance: attendance,
        roleDistribution: roleDist,
        levelDistribution: levelDist,
        timerPassRate: totalCount ? Math.round(okCount / totalCount * 100) : 0,
      };
    },

    /**
     * 从 StoragePort 拉取全部会议并生成成长数据。
     * @returns {Object} GrowthSummary
     */
    growthFromStorage: function () {
      if (!storage) return { meetingCount: 0, attendance: [], roleDistribution: {}, levelDistribution: {}, timerPassRate: 0 };
      const MEET_KEY = 'tmc:meeting:';
      const meetings = storage.keys()
        .filter(function (k) { return k.indexOf(MEET_KEY) === 0; })
        .map(function (k) {
          try { return JSON.parse(storage.get(k)); } catch (e) { return null; }
        })
        .filter(Boolean);
      return this.growthSummary(meetings);
    },
  };
}

module.exports = { createMinutesService: createMinutesService };
