/* tmc-core/core/meeting-model.js
 * meeting.json 单一事实源：校验 / 归一化 / 迁移 / 空骨架。
 * 零依赖手写校验器（不引入 ajv），覆盖 docs/ARCHITECTURE.md §5.3 规则。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

const { ROLE_ENUM, isValidRole } = require('../data/roles.js');

const CURRENT_VERSION = '1.0';
const OWNER = 'Altair Li';

const MEETING_ID_RE = /^\d{4}-\d{2}-\d{2}_第\d+次$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM_RE = /^\d{2}:\d{2}$/;
const AGENDA_TYPES = ['opening', 'facilitator', 'table_topics', 'prepared_speech',
  'evaluation', 'workshop', 'report', 'voting', 'closing'];
const LANGUAGES = ['zh', 'en', 'bilingual'];
const BALLOT_CATEGORIES = ['best_speaker', 'best_evaluator', 'best_table_topics', 'best_role'];
const TIMER_STATUSES = ['green', 'yellow', 'red'];

const TOP_LEVEL_KEYS = ['meeting_id', 'meeting_number', 'date', 'start_time', 'end_time',
  'language', 'theme', 'word_of_the_day', 'venue', 'roles', 'agenda', 'speeches', 'guests',
  'rsvp', 'ballot', 'officers_records', 'minutes', 'attachments', 'meta'];

/**
 * 是否普通对象（非 null、非数组）。
 * @param {*} v
 * @returns {boolean}
 */
function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

/**
 * 是否为合法 ISO 8601 时间戳（宽松：Date.parse 可解析）。
 * @param {string} s
 * @returns {boolean}
 */
function isIsoDateTime(s) {
  if (typeof s !== 'string') return false;
  const t = Date.parse(s);
  return !isNaN(t);
}

/**
 * 校验 meeting 对象。不抛异常，返回 {ok, errors, warnings}。
 * @param {*} raw 待校验对象
 * @returns {{ok:boolean, errors:string[], warnings:string[]}}
 */
function validate(raw) {
  const errors = [];
  const warnings = [];
  if (!isObj(raw)) {
    return { ok: false, errors: ['根对象必须是 JSON object'], warnings: warnings };
  }

  // ---- 必填 ----
  if (typeof raw.meeting_id !== 'string' || !MEETING_ID_RE.test(raw.meeting_id)) {
    errors.push('meeting_id 必填且格式应为 YYYY-MM-DD_第N次');
  }
  if (!Number.isInteger(raw.meeting_number) || raw.meeting_number < 1) {
    errors.push('meeting_number 必填且为 ≥1 的整数');
  }
  if (typeof raw.date !== 'string' || !DATE_RE.test(raw.date)) {
    errors.push('date 必填且格式应为 YYYY-MM-DD');
  }
  if (!isObj(raw.meta)) {
    errors.push('meta 必填');
  } else {
    if (typeof raw.meta.version !== 'string' || raw.meta.version === '') errors.push('meta.version 必填');
    if (typeof raw.meta.owner !== 'string' || raw.meta.owner === '') errors.push('meta.owner 必填');
    if (!isIsoDateTime(raw.meta.updated_at)) errors.push('meta.updated_at 必填且为 ISO8601 时间戳');
  }

  // ---- 时间格式 ----
  if (raw.start_time !== undefined && !HHMM_RE.test(String(raw.start_time))) {
    errors.push('start_time 格式应为 HH:MM');
  }
  if (raw.end_time !== undefined && !HHMM_RE.test(String(raw.end_time))) {
    errors.push('end_time 格式应为 HH:MM');
  }
  // ---- 时间一致性：end_time > start_time ----
  if (HHMM_RE.test(String(raw.start_time)) && HHMM_RE.test(String(raw.end_time))) {
    if (toMinutes(raw.end_time) <= toMinutes(raw.start_time)) {
      errors.push('end_time 必须晚于 start_time');
    }
  }

  // ---- language ----
  if (raw.language !== undefined && LANGUAGES.indexOf(raw.language) < 0) {
    errors.push('language 必须是 zh / en / bilingual');
  }

  // ---- roles ----
  if (raw.roles !== undefined) {
    if (!Array.isArray(raw.roles)) {
      errors.push('roles 必须是数组');
    } else {
      raw.roles.forEach(function (r, i) {
        if (!isObj(r) || typeof r.role !== 'string') {
          errors.push('roles[' + i + '] 缺少 role');
          return;
        }
        if (!isValidRole(r.role)) {
          // 未知角色进 errors 但不阻断其余校验
          errors.push('roles[' + i + '].role 未知角色: ' + r.role);
        }
      });
    }
  }

  // ---- agenda ----
  if (raw.agenda !== undefined) {
    if (!Array.isArray(raw.agenda)) {
      errors.push('agenda 必须是数组');
    } else {
      raw.agenda.forEach(function (s, i) {
        if (!isObj(s) || typeof s.segment_id !== 'string') errors.push('agenda[' + i + '] 缺少 segment_id');
        if (!isObj(s) || AGENDA_TYPES.indexOf(s.type) < 0) {
          errors.push('agenda[' + i + '].type 非法或缺失');
        }
        if (isObj(s) && s.duration_min !== undefined && !(typeof s.duration_min === 'number' && s.duration_min >= 0)) {
          errors.push('agenda[' + i + '].duration_min 必须 ≥0');
        }
      });
    }
  }

  // ---- 引用完整性：speeches[].evaluator 匹配 roles ----
  if (Array.isArray(raw.speeches) && Array.isArray(raw.roles)) {
    const evaluators = raw.roles
      .filter(function (r) { return isObj(r) && r.role === 'evaluator'; })
      .map(function (r) { return r.name_zh || r.name_en || r.member_id; })
      .filter(Boolean);
    raw.speeches.forEach(function (sp, i) {
      if (isObj(sp) && typeof sp.evaluator === 'string' && sp.evaluator !== '' &&
          evaluators.length > 0 && evaluators.indexOf(sp.evaluator) < 0) {
        warnings.push('speeches[' + i + '].evaluator "' + sp.evaluator + '" 未在 roles 中匹配到 evaluator');
      }
    });
  }

  // ---- 枚举校验：ballot / officers_records ----
  if (raw.ballot !== undefined) {
    if (!Array.isArray(raw.ballot)) errors.push('ballot 必须是数组');
    else raw.ballot.forEach(function (b, i) {
      if (!isObj(b) || BALLOT_CATEGORIES.indexOf(b.category) < 0) {
        errors.push('ballot[' + i + '].category 非法或缺失');
      }
    });
  }
  if (raw.officers_records !== undefined) {
    if (!isObj(raw.officers_records)) {
      errors.push('officers_records 必须是对象');
    } else {
      const t = raw.officers_records.timer;
      if (t !== undefined && !Array.isArray(t)) errors.push('officers_records.timer 必须是数组');
      if (Array.isArray(t)) t.forEach(function (r, i) {
        if (!isObj(r) || typeof r.segment_id !== 'string') errors.push('officers_records.timer[' + i + '] 缺少 segment_id');
        if (isObj(r) && r.status !== undefined && TIMER_STATUSES.indexOf(r.status) < 0) {
          errors.push('officers_records.timer[' + i + '].status 非法');
        }
      });
    }
  }

  // ---- 未知顶层字段（以 _ 开头视为允许的扩展） ----
  Object.keys(raw).forEach(function (k) {
    if (TOP_LEVEL_KEYS.indexOf(k) < 0 && k.charAt(0) !== '_') {
      warnings.push('未知顶层字段: ' + k);
    }
  });

  return { ok: errors.length === 0, errors: errors, warnings: warnings };
}

/**
 * "HH:MM" → 分钟数（用于比较）。
 * @param {string} hhmm
 * @returns {number}
 */
function toMinutes(hhmm) {
  const p = String(hhmm).split(':');
  return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
}

/**
 * 归一化：补齐默认值、规整类型、保证数组字段存在。不抛异常。
 * @param {Object} m
 * @returns {Object} 新的归一化对象
 */
function normalize(m) {
  const src = isObj(m) ? m : {};
  const out = {};
  out.meeting_id = typeof src.meeting_id === 'string' ? src.meeting_id : '';
  out.meeting_number = Number.isInteger(src.meeting_number) ? src.meeting_number : 0;
  out.date = typeof src.date === 'string' ? src.date : '';
  out.start_time = HHMM_RE.test(String(src.start_time)) ? src.start_time : '19:15';
  out.end_time = HHMM_RE.test(String(src.end_time)) ? src.end_time : '21:30';
  out.language = LANGUAGES.indexOf(src.language) >= 0 ? src.language : 'bilingual';
  out.theme = isObj(src.theme) ? { zh: str(src.theme.zh), en: str(src.theme.en) } : { zh: '', en: '' };
  out.word_of_the_day = isObj(src.word_of_the_day)
    ? { zh: str(src.word_of_the_day.zh), en: str(src.word_of_the_day.en),
        pos: str(src.word_of_the_day.pos), example: str(src.word_of_the_day.example) }
    : { zh: '', en: '', pos: '', example: '' };
  out.venue = typeof src.venue === 'string' ? src.venue : '广州南沙';
  out.roles = Array.isArray(src.roles) ? src.roles.map(normalizeRole) : [];
  out.agenda = Array.isArray(src.agenda) ? src.agenda.map(normalizeAgenda) : [];
  out.speeches = Array.isArray(src.speeches) ? src.speeches.map(normalizeSpeech) : [];
  out.guests = Array.isArray(src.guests) ? src.guests.map(function (g) {
    return { name: str(g && g.name), contact: str(g && g.contact), source: str(g && g.source),
      is_new: (g && g.is_new === false) ? false : true };
  }) : [];
  out.rsvp = Array.isArray(src.rsvp) ? src.rsvp.map(function (r) {
    return { name: str(r && r.name), role_pref: str(r && r.role_pref),
      confirmed: !!(r && r.confirmed) };
  }) : [];
  out.ballot = Array.isArray(src.ballot) ? src.ballot.map(function (b) {
    return { category: str(b && b.category), candidates: strArr(b && b.candidates),
      result: strArr(b && b.result) };
  }) : [];
  out.officers_records = normalizeOfficers(src.officers_records);
  out.minutes = typeof src.minutes === 'string' ? src.minutes : '';
  out.attachments = Array.isArray(src.attachments) ? src.attachments.map(function (a) {
    return { name: str(a && a.name), path: str(a && a.path) };
  }) : [];
  out.meta = isObj(src.meta)
    ? { version: str(src.meta.version) || CURRENT_VERSION,
        owner: str(src.meta.owner) || OWNER,
        updated_at: isIsoDateTime(src.meta.updated_at) ? src.meta.updated_at : new Date(0).toISOString() }
    : { version: CURRENT_VERSION, owner: OWNER, updated_at: new Date(0).toISOString() };
  // 保留未知字段（下划线命名）
  Object.keys(src).forEach(function (k) {
    if (TOP_LEVEL_KEYS.indexOf(k) < 0 && k.charAt(0) === '_') out[k] = src[k];
  });
  return out;
}

function str(v) { return typeof v === 'string' ? v : ''; }
function strArr(v) { return Array.isArray(v) ? v.map(str) : []; }

function normalizeRole(r) {
  const o = isObj(r) ? r : {};
  return {
    role: str(o.role),
    member_id: typeof o.member_id === 'string' ? o.member_id : null,
    name_zh: typeof o.name_zh === 'string' ? o.name_zh : null,
    name_en: typeof o.name_en === 'string' ? o.name_en : null,
    note: str(o.note),
  };
}

function normalizeAgenda(s) {
  const o = isObj(s) ? s : {};
  return {
    segment_id: str(o.segment_id),
    type: str(o.type),
    title_zh: str(o.title_zh),
    title_en: str(o.title_en),
    presenter: str(o.presenter),
    duration_min: typeof o.duration_min === 'number' ? o.duration_min : 0,
    project: typeof o.project === 'string' ? o.project : null,
    buffer_min: typeof o.buffer_min === 'number' ? o.buffer_min : 0,
  };
}

function normalizeSpeech(s) {
  const o = isObj(s) ? s : {};
  const req = isObj(o.requirements)
    ? { min_min: typeof o.requirements.min_min === 'number' ? o.requirements.min_min : undefined,
        max_min: typeof o.requirements.max_min === 'number' ? o.requirements.max_min : undefined }
    : undefined;
  const out = {
    member_id: str(o.member_id),
    project_level: str(o.project_level),
    project_title: str(o.project_title),
    pathway: str(o.pathway),
    evaluator: typeof o.evaluator === 'string' ? o.evaluator : null,
  };
  if (req && req.min_min !== undefined) {
    out.requirements = {};
    if (req.min_min !== undefined) out.requirements.min_min = req.min_min;
    if (req.max_min !== undefined) out.requirements.max_min = req.max_min;
  }
  return out;
}

function normalizeOfficers(o) {
  const src = isObj(o) ? o : {};
  return {
    timer: Array.isArray(src.timer) ? src.timer.map(function (r) {
      return { segment_id: str(r && r.segment_id),
        planned_min: typeof (r && r.planned_min) === 'number' ? r.planned_min : 0,
        actual_sec: typeof (r && r.actual_sec) === 'number' ? r.actual_sec : 0,
        status: TIMER_STATUSES.indexOf(r && r.status) >= 0 ? r.status : 'green' };
    }) : [],
    ah_counter: Array.isArray(src.ah_counter) ? src.ah_counter.map(function (r) {
      return { member_id: str(r && r.member_id),
        counts: isObj(r && r.counts) ? Object.assign({}, r.counts) : {},
        top3: strArr(r && r.top3) };
    }) : [],
    grammarian: Array.isArray(src.grammarian) ? src.grammarian.map(function (r) {
      return { member_id: str(r && r.member_id),
        good_phrases: strArr(r && r.good_phrases),
        corrections: strArr(r && r.corrections) };
    }) : [],
  };
}

/**
 * 迁移：旧版本 → 当前版本。不丢未知字段（保留在 _extra）。
 * @param {*} raw
 * @returns {Object} 归一化后的 meeting
 */
function migrate(raw) {
  const src = isObj(raw) ? raw : {};
  const normalized = normalize(src);
  // 保留原始未知字段到 _extra（若尚未存在）
  const extra = {};
  Object.keys(src).forEach(function (k) {
    if (TOP_LEVEL_KEYS.indexOf(k) < 0 && k.charAt(0) !== '_') extra[k] = src[k];
  });
  if (Object.keys(extra).length > 0) normalized._extra = extra;
  normalized.meta.version = CURRENT_VERSION;
  return normalized;
}

/**
 * 生成空骨架（合法最小实例）。
 * @param {Object} [template] 可选覆盖字段
 * @returns {Object}
 */
function empty(template) {
  const t = isObj(template) ? template : {};
  const now = isObj(t.meta) && isIsoDateTime(t.meta.updated_at)
    ? t.meta.updated_at
    : '1970-01-01T00:00:00Z';
  const base = {
    meeting_id: typeof t.meeting_id === 'string' ? t.meeting_id : '',
    meeting_number: Number.isInteger(t.meeting_number) ? t.meeting_number : 0,
    date: typeof t.date === 'string' ? t.date : '',
    start_time: typeof t.start_time === 'string' ? t.start_time : '19:15',
    end_time: typeof t.end_time === 'string' ? t.end_time : '21:30',
    language: 'bilingual',
    theme: { zh: '', en: '' },
    word_of_the_day: { zh: '', en: '', pos: '', example: '' },
    venue: typeof t.venue === 'string' ? t.venue : '广州南沙',
    roles: Array.isArray(t.roles) ? t.roles : [],
    agenda: Array.isArray(t.agenda) ? t.agenda : [],
    speeches: [],
    guests: [],
    rsvp: [],
    ballot: [],
    officers_records: { timer: [], ah_counter: [], grammarian: [] },
    minutes: '',
    attachments: [],
    meta: { version: CURRENT_VERSION, owner: OWNER, updated_at: now },
  };
  return base;
}

/**
 * 依据日期与期数生成规范 meeting_id。
 * @param {string} date YYYY-MM-DD
 * @param {number} number 期数
 * @returns {string}
 */
function makeMeetingId(date, number) {
  return String(date) + '_第' + String(number) + '次';
}

/** 生成当前时间 ISO8601 UTC 字符串。 */
function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

module.exports = {
  CURRENT_VERSION: CURRENT_VERSION,
  OWNER: OWNER,
  ROLE_ENUM: ROLE_ENUM,
  validate: validate,
  normalize: normalize,
  migrate: migrate,
  empty: empty,
  makeMeetingId: makeMeetingId,
  nowIso: nowIso,
  toMinutes: toMinutes,
};
