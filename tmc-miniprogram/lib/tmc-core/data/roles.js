/* tmc-core/data/roles.js
 * 角色枚举与中英文名映射。
 * 官方 8 角色（来自 twin/tm-api）+ 中文俱乐部实际议程表扩展角色。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

/**
 * 角色定义表。key 为契约枚举值（snake_case），与 meeting.schema.json 的 roleEnum 一致。
 * group: 'official' = Toastmasters 官方角色；'extended' = 中文俱乐部扩展角色。
 */
const ROLES = [
  // ---- 官方 8 角色 ----
  { key: 'toastmaster_of_ceremony', zh: '总主持', en: 'Toastmaster', group: 'official' },
  { key: 'general_evaluator', zh: '总体点评', en: 'General Evaluator', group: 'official' },
  { key: 'speaker', zh: '备稿演讲者', en: 'Speaker', group: 'official' },
  { key: 'evaluator', zh: '点评师', en: 'Evaluator', group: 'official' },
  { key: 'table_topics_master', zh: '即兴主持', en: 'Table Topics Master', group: 'official' },
  { key: 'timer', zh: '计时官', en: 'Timer', group: 'official' },
  { key: 'ah_counter', zh: '哼哈官', en: 'Ah-Counter', group: 'official' },
  { key: 'grammarian', zh: '语法官', en: 'Grammarian', group: 'official' },

  // ---- 中文俱乐部扩展 ----
  { key: 'meeting_manager', zh: '会议经理', en: 'Meeting Manager', group: 'extended' },
  { key: 'opening', zh: '开场致辞', en: 'Opening Remarks', group: 'extended' },
  { key: 'facilitator', zh: '赘词/过渡词官', en: 'Facilitator', group: 'extended' },
  { key: 'photographer', zh: '摄影官', en: 'Photographer', group: 'extended' },
  { key: 'table_topics_evaluator', zh: '即兴点评', en: 'Table Topics Evaluator', group: 'extended' },
  { key: 'workshop_speaker', zh: '圆桌/工作坊主讲', en: 'Workshop Speaker', group: 'extended' },
  { key: 'ballot_officer', zh: '投票官', en: 'Ballot Officer', group: 'extended' },
  { key: 'receptionist', zh: '接待官', en: 'Receptionist', group: 'extended' },
  { key: 'slides_operator', zh: '幻灯片播放', en: 'Slides Operator', group: 'extended' },
  { key: 'computer_support', zh: '电脑支持', en: 'Computer Support', group: 'extended' },
  { key: 'president', zh: '会长/主席', en: 'President', group: 'extended' },
  { key: 'next_meeting_manager', zh: '下期会议经理', en: 'Next Meeting Manager', group: 'extended' },
];

/** 角色枚举（与 schema roleEnum 一致的字符串数组） */
const ROLE_ENUM = ROLES.map(function (r) { return r.key; });

/** key → 角色定义 */
const ROLE_MAP = {};
ROLES.forEach(function (r) { ROLE_MAP[r.key] = r; });

/**
 * 判断角色 key 是否合法。
 * @param {string} key
 * @returns {boolean}
 */
function isValidRole(key) {
  return Object.prototype.hasOwnProperty.call(ROLE_MAP, key);
}

/**
 * 取角色中文名，未知回退原 key。
 * @param {string} key
 * @returns {string}
 */
function roleZh(key) {
  return ROLE_MAP[key] ? ROLE_MAP[key].zh : String(key);
}

/**
 * 取角色英文名，未知回退原 key。
 * @param {string} key
 * @returns {string}
 */
function roleEn(key) {
  return ROLE_MAP[key] ? ROLE_MAP[key].en : String(key);
}

module.exports = {
  ROLES: ROLES,
  ROLE_ENUM: ROLE_ENUM,
  ROLE_MAP: ROLE_MAP,
  isValidRole: isValidRole,
  roleZh: roleZh,
  roleEn: roleEn,
};
