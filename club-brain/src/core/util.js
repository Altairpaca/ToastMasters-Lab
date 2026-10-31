'use strict';

/**
 * 通用小工具：时间与数值。
 * 保持零依赖、纯函数，Node 与浏览器共用。
 */

/** "19:30" -> 1170（分钟） */
function parseHHMM(text) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(text || '').trim());
  if (!m) return NaN;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h > 23 || mm > 59) return NaN;
  return h * 60 + mm;
}

/** 1170 -> "19:30" */
function fmtHHMM(minutes) {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

/** 秒或分钟转可读时长："1:05" / "45s" */
function fmtDuration(minutes) {
  const total = Math.round(minutes * 60);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return s + 's';
  return m + ':' + String(s).padStart(2, '0');
}

/** 'YYYY-MM-DD' -> 0..6（周日=0），UTC 计算避免时区漂移 */
function weekdayOf(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || '').trim());
  if (!m) return NaN;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return NaN;
  return d.getUTCDay();
}

const WEEKDAY_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** 基尼系数，用于衡量分配公平性（0=完全平均） */
function gini(values) {
  const arr = values.filter((v) => Number.isFinite(v)).slice().sort((a, b) => a - b);
  const n = arr.length;
  if (n === 0) return 0;
  const sum = arr.reduce((a, b) => a + b, 0);
  if (sum === 0) return 0;
  let acc = 0;
  for (let i = 0; i < n; i += 1) acc += (i + 1) * arr[i];
  return (2 * acc) / (n * sum) - (n + 1) / n;
}

/** 中文按 1 字宽、ASCII 按 0.5 字宽估算显示宽度 */
function displayWidth(text) {
  let w = 0;
  for (const ch of String(text || '')) {
    w += /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/.test(ch) ? 1 : 0.5;
  }
  return w;
}

/** 是否是中文（含汉字） */
function hasCJK(text) {
  return /[\u4E00-\u9FFF]/.test(String(text || ''));
}

module.exports = {
  parseHHMM,
  fmtHHMM,
  fmtDuration,
  weekdayOf,
  WEEKDAY_ZH,
  gini,
  displayWidth,
  hasCJK,
};
