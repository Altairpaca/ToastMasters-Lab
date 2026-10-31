'use strict';

/**
 * survey-draft · 从议程生成投票问卷草稿
 *
 * 头马例会的评奖投票每期都要重建：最佳角色、最佳备稿、最佳点评、最佳即兴。
 * 手工建题最容易错的两件事：① 名额写错（奖项只能选 1 个却设成多选）
 * ② 把"待确认"的人放进选项。本模块把这两条变成规则。
 *
 * 对应创新点：AG-043 议程与问卷联动 / PR-040 投票设计
 *
 * 输出为通用结构，可再转为问卷星 JSONL（字段见 toWjxJsonl）。
 */

const ROLE_LIMIT = 2;

/** 促进者环节里已确定的角色 —— 从环节名/负责人推断，排除"宣导/介绍/小环节"等非角色 */
const NON_ROLE_HINTS = /宣导|介绍|说明|小环节|规则|串场|暖场|预告/;

function cleanOptions(list) {
  const seen = new Set();
  return list
    .map((x) => String(x || '').trim())
    .filter((x) => x && !seen.has(x) && seen.add(x))
    .map((text) => ({ text }));
}

/**
 * @param {object} meeting
 * @param {object} [options] { includeTableTopics, optionalAdvice }
 */
function buildSurveyDraft(meeting, options) {
  const opts = Object.assign({ includeTableTopics: true, optionalAdvice: true }, options || {});
  const m = meeting || {};
  const questions = [];

  // —— 1. 最佳会议角色（多选，最多 2 项）——
  const roleOptions = [];
  (m.segments || []).forEach((seg) => {
    if (seg.ownerStatus !== 'confirmed' || !seg.owner) return;
    if (NON_ROLE_HINTS.test(seg.name || '')) return;
    // 只收"角色型"环节：开场/促进者/报告/即兴主持/三官
    const isRole = ['opening', 'facilitator', 'report', 'tabletopics'].includes(seg.kind);
    if (!isRole) return;
    roleOptions.push(seg.owner + '（' + seg.name + '）');
  });
  // 三官从备注/环节里补充
  if (m.officers) {
    ['时间官', '哼哈官', '语法官', '总评'].forEach((role) => {
      if (m.officers[role]) roleOptions.push(m.officers[role] + '（' + role + '）');
    });
  }
  if (roleOptions.length) {
    questions.push({
      id: 'best-role',
      type: 'multi',
      title: '最佳会议角色（最多选 ' + ROLE_LIMIT + ' 项）',
      uplimit: ROLE_LIMIT,
      required: true,
      options: cleanOptions(roleOptions),
    });
  }

  // —— 2. 最佳备稿（单选）——
  const speechOptions = (m.speeches || [])
    .filter((s) => s.status !== 'pending' && s.speaker)
    .map((s) => '《' + (s.title || '题目待定') + '》' + s.speaker);
  if (speechOptions.length) {
    questions.push({
      id: 'best-speech',
      type: 'single',
      title: '最佳备稿演讲',
      uplimit: 1,
      required: true,
      options: cleanOptions(speechOptions),
    });
  }

  // —— 3. 最佳点评（单选）——
  const evalOptions = [];
  (m.speeches || []).forEach((s) => {
    if (s.evaluator && s.speaker) evalOptions.push((s.title ? '《' + s.title + '》' : '') + '的点评：' + s.evaluator);
  });
  // 总评与即兴点评
  const reportOwner = (m.segments || []).find((s) => s.kind === 'report' && s.owner);
  if (reportOwner) evalOptions.push('总体点评：' + reportOwner.owner);
  const ttOwner = (m.segments || []).find((s) => s.kind === 'tabletopics' && s.owner);
  if (ttOwner) evalOptions.push('即兴点评：' + ttOwner.owner);
  if (evalOptions.length) {
    questions.push({
      id: 'best-eval',
      type: 'single',
      title: '最佳点评',
      uplimit: 1,
      required: true,
      options: cleanOptions(evalOptions),
    });
  }

  // —— 4. 最佳即兴（选项留空，会中按实际上台者填）——
  if (opts.includeTableTopics && (m.segments || []).some((s) => s.kind === 'tabletopics')) {
    questions.push({
      id: 'best-tabletopics',
      type: 'single',
      title: '最佳即兴演讲',
      uplimit: 1,
      required: true,
      options: [],
      note: '选项留空，会中按实际上台者补充',
    });
  }

  // —— 5. 建议（简答，选填）——
  if (opts.optionalAdvice) {
    questions.push({
      id: 'advice',
      type: 'text',
      title: '给会议的建议',
      required: false,
      options: [],
    });
  }

  const warnings = [];
  if (roleOptions.length < 2) warnings.push('可选的会议角色不足 2 个，检查是否有角色未确认');
  if (!speechOptions.length) warnings.push('没有可投的备稿（全部待确认或未填演讲人）');
  (m.segments || []).forEach((seg) => {
    if (seg.ownerStatus === 'pending' && seg.owner) {
      warnings.push('环节「' + seg.name + '」负责人仍是待确认，未进入选项：' + seg.owner);
    }
  });

  return {
    schema: 'survey-draft/v1',
    title: '第 ' + (m.meetingNo || '') + ' 次例会 · ' + (m.theme || '') + ' · 投票',
    meetingNo: m.meetingNo || null,
    date: m.date || null,
    questions,
    warnings,
  };
}

/** 问卷星 JSONL：一行一题，多选对应 q_type=4，单选 q_type=3，简答 q_type=5 */
function toWjxJsonl(draft) {
  return draft.questions.map((q) => {
    const typeMap = { multi: 4, single: 3, text: 5 };
    const row = {
      q_type: typeMap[q.type] || 3,
      title: q.title,
      required: q.required !== false,
      options: (q.options || []).map((o) => o.text),
    };
    if (q.type === 'multi' && q.uplimit) row.uplimit = q.uplimit;
    return JSON.stringify(row);
  }).join('\n');
}

function toMarkdown(draft) {
  const lines = ['# ' + draft.title, ''];
  draft.questions.forEach((q, i) => {
    const kind = { multi: '多选', single: '单选', text: '简答' }[q.type] || q.type;
    lines.push('**' + (i + 1) + '. ' + q.title + '**（' + kind + (q.uplimit ? '，最多 ' + q.uplimit + ' 项' : '') +
      (q.required ? '' : '，选填') + '）');
    (q.options || []).forEach((o) => lines.push('- ' + o.text));
    if (q.note) lines.push('- _' + q.note + '_');
    lines.push('');
  });
  if (draft.warnings.length) {
    lines.push('## 提示');
    draft.warnings.forEach((w) => lines.push('- ' + w));
  }
  return lines.join('\n');
}

module.exports = { buildSurveyDraft, toWjxJsonl, toMarkdown, ROLE_LIMIT };
