'use strict';

/**
 * brand-lint · 品牌物料校验
 *
 * 不做生成，只判定"这张物料能不能发"。
 * 对应创新点：PR-011 品牌一致性 / PR-012 二维码可扫性 / PR-013 主色校验 / PR-014 合规用语
 *
 * 输入是一份"物料事实清单"（asset manifest）。清单可由设计脚本产出，
 * 也可由人工填写；本模块只负责规则判定，不依赖任何图像库。
 */

const SEVERITY = { error: 'error', warn: 'warn', info: 'info' };
const PENALTY = { error: 10, warn: 4, info: 1 };

function issue(code, severity, message, extra) {
  return Object.assign({ code, severity, message }, extra || {});
}

/** #RRGGBB -> [r,g,b] */
function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 两个颜色的欧氏距离（0–441） */
function colorDistance(a, b) {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  if (!x || !y) return Infinity;
  const dr = x[0] - y[0];
  const dg = x[1] - y[1];
  const db = x[2] - y[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/** WCAG 相对亮度 */
function luminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return NaN;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 对比度 */
function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  if (Number.isNaN(la) || Number.isNaN(lb)) return NaN;
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** 是否是中性色（白/黑/灰），不计入"非品牌色" */
function isNeutral(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  const max = Math.max(...rgb);
  const min = Math.min(...rgb);
  return max - min <= 20 || max <= 24 || min >= 232;
}

const KIND_RULES = {
  poster: { primaryMin: 0.25, accentMax: 0.4, unknownMax: 0.18, qrModulePx: 3, safeMin: 32 },
  certificate: { primaryMin: 0.15, accentMax: 0.45, unknownMax: 0.2, qrModulePx: 3, safeMin: 24 },
  agenda: { primaryMin: 0.12, accentMax: 0.45, unknownMax: 0.22, qrModulePx: 3, safeMin: 20 },
  social: { primaryMin: 0.2, accentMax: 0.45, unknownMax: 0.2, qrModulePx: 2, safeMin: 24 },
};

/**
 * @param {object} asset 物料事实清单
 * @param {object} [options] { kind 覆盖, strict }
 */
function lintBrand(asset, options) {
  const opts = Object.assign({ strict: false }, options || {});
  const a = asset || {};
  const kind = opts.kind || a.kind || 'poster';
  const rules = KIND_RULES[kind] || KIND_RULES.poster;
  const brand = a.brand || {};
  const primary = brand.primary || '#772432';
  const accent = brand.accent || '#F2DF74';
  const tolerance = Number(brand.tolerance) || 40;
  const out = [];

  // —— 主色与配色 ——
  const palette = Array.isArray(a.palette) ? a.palette : [];
  let primaryRatio = 0;
  let accentRatio = 0;
  let unknownRatio = 0;
  let neutralRatio = 0;
  if (!palette.length) {
    out.push(issue('E_NO_PALETTE', SEVERITY.error, '缺少配色清单（palette），无法判定品牌一致性'));
  } else {
    palette.forEach((p) => {
      const ratio = Number(p.ratio) || 0;
      const dPrimary = colorDistance(p.hex, primary);
      const dAccent = colorDistance(p.hex, accent);
      if (dPrimary <= tolerance) primaryRatio += ratio;
      else if (dAccent <= tolerance) accentRatio += ratio;
      else if (isNeutral(p.hex)) neutralRatio += ratio;
      else unknownRatio += ratio;
    });
    const total = palette.reduce((s, p) => s + (Number(p.ratio) || 0), 0);
    if (total > 0 && Math.abs(total - 1) > 0.02) {
      out.push(issue('I_PALETTE_SUM', SEVERITY.info, '配色占比合计 ' + total.toFixed(2) + '，建议归一为 1.00'));
    }
    if (primaryRatio < rules.primaryMin) {
      out.push(issue('E_PRIMARY_LOW', SEVERITY.error,
        '主色占比 ' + (primaryRatio * 100).toFixed(0) + '%，低于 ' + (rules.primaryMin * 100).toFixed(0) + '% 的品牌线',
        { field: 'palette' }));
    }
    if (accentRatio > rules.accentMax) {
      out.push(issue('W_ACCENT_HIGH', SEVERITY.warn,
        '强调色占比 ' + (accentRatio * 100).toFixed(0) + '%，超过 ' + (rules.accentMax * 100).toFixed(0) + '%，会削弱主色',
        { field: 'palette' }));
    }
    if (unknownRatio > rules.unknownMax) {
      out.push(issue('W_OFF_BRAND', SEVERITY.warn,
        '非品牌色占比 ' + (unknownRatio * 100).toFixed(0) + '%，超过 ' + (rules.unknownMax * 100).toFixed(0) + '%',
        { field: 'palette' }));
    }
  }

  // —— 二维码 ——
  const qr = a.qr;
  if (!qr) {
    out.push(issue('W_NO_QR', SEVERITY.warn, '物料没有二维码信息；若用于招新/投票请补充'));
  } else {
    const modulePx = Number(qr.modulePx) || 0;
    const quiet = Number(qr.quietZoneModules);
    if (modulePx && modulePx < rules.qrModulePx) {
      out.push(issue('E_QR_MODULE', SEVERITY.error,
        '二维码单模块 ' + modulePx + 'px，低于 ' + rules.qrModulePx + 'px，缩放后极易扫不出', { field: 'qr' }));
    }
    if (Number.isFinite(quiet) && quiet < 4) {
      out.push(issue('E_QR_QUIET', SEVERITY.error, '二维码静区 ' + quiet + ' 模块，低于 4 模块标准', { field: 'qr' }));
    }
    const cr = Number(qr.contrastRatio);
    if (Number.isFinite(cr) && cr < 4.5) {
      out.push(issue('E_QR_CONTRAST', SEVERITY.error, '二维码对比度 ' + cr.toFixed(1) + ':1，低于 4.5:1', { field: 'qr' }));
    }
    if (qr.inverted) {
      out.push(issue('W_QR_INVERTED', SEVERITY.warn, '反色二维码（浅码深底）部分机型识别率低', { field: 'qr' }));
    }
  }

  // —— 文字长度 ——
  (a.texts || []).forEach((t, i) => {
    const text = String(t.text || '');
    const max = Number(t.maxChars) || 0;
    if (max && [...text].length > max) {
      out.push(issue('E_TEXT_OVERFLOW', SEVERITY.error,
        '「' + (t.label || '文字' + (i + 1)) + '」' + [...text].length + ' 字，超过版面上限 ' + max + ' 字：' + text.slice(0, 18) + '…',
        { field: 'texts[' + i + ']' }));
    }
    if (t.minPt && t.pt && Number(t.pt) < Number(t.minPt)) {
      out.push(issue('W_TEXT_TOO_SMALL', SEVERITY.warn,
        '「' + (t.label || '文字' + (i + 1)) + '」字号 ' + t.pt + 'pt，低于可读下限 ' + t.minPt + 'pt',
        { field: 'texts[' + i + ']' }));
    }
  });

  // —— Logo 与安全区 ——
  const logo = a.logo;
  if (logo) {
    if (logo.present === false) {
      out.push(issue('E_LOGO_MISSING', SEVERITY.error, '物料缺少俱乐部/头马 Logo'));
    } else {
      const need = Number(logo.minClearSpacePx) || 16;
      const got = Number(logo.clearSpacePx);
      if (Number.isFinite(got) && got < need) {
        out.push(issue('W_LOGO_CLEARSPACE', SEVERITY.warn,
          'Logo 净空 ' + got + 'px，低于建议 ' + need + 'px', { field: 'logo' }));
      }
    }
  }
  const safe = a.safeArea;
  if (safe) {
    const min = Number(safe.min) || rules.safeMin;
    ['top', 'bottom', 'left', 'right'].forEach((side) => {
      const v = Number(safe[side]);
      if (Number.isFinite(v) && v < min) {
        out.push(issue('W_SAFE_AREA', SEVERITY.warn,
          '安全区 ' + side + ' 仅 ' + v + 'px，低于 ' + min + 'px，裁切时可能切到内容', { field: 'safeArea' }));
      }
    });
  }

  // —— 合规用语 ——
  const tm = a.trademark || {};
  if (!tm.nonOfficialClaim) {
    out.push(issue('E_NO_DISCLAIMER', SEVERITY.error,
      '未声明"非官方/独立项目"。使用 Toastmasters 名称与标识时必须与官方区隔', { field: 'trademark' }));
  }
  (a.texts || []).forEach((t, i) => {
    const text = String(t.text || '');
    if (/ guaranteed |包治|保证成功|一定能|最专业|第一/.test(text)) {
      out.push(issue('W_ABSOLUTE_CLAIM', SEVERITY.warn,
        '「' + (t.label || '文字' + (i + 1)) + '」含绝对化用语，广告法与平台规则风险：' + text.slice(0, 20),
        { field: 'texts[' + i + ']' }));
    }
  });

  const rank = { error: 0, warn: 1, info: 2 };
  out.sort((x, y) => rank[x.severity] - rank[y.severity]);
  const counts = { error: 0, warn: 0, info: 0 };
  out.forEach((i) => { counts[i.severity] += 1; });
  const score = Math.max(0, 100 - counts.error * PENALTY.error - counts.warn * PENALTY.warn - counts.info * PENALTY.info);

  return {
    schema: 'brand-lint/v1',
    asset: a.name || '(未命名)',
    kind,
    ok: counts.error === 0,
    score,
    counts,
    issues: out,
    measured: {
      primaryRatio: palette.filter((p) => colorDistance(p.hex, primary) <= tolerance)
        .reduce((s, p) => s + (Number(p.ratio) || 0), 0),
      accentRatio: palette.filter((p) => colorDistance(p.hex, accent) <= tolerance)
        .reduce((s, p) => s + (Number(p.ratio) || 0), 0),
      neutralRatio,
      unknownRatio,
    },
  };
}

function toMarkdown(report) {
  const lines = [
    '# 品牌体检 · ' + report.asset,
    '',
    '| 项目 | 结果 |',
    '|---|---|',
    '| 物料类型 | ' + report.kind + ' |',
    '| 结论 | ' + (report.ok ? '✅ 可发布' : '❌ 不可发布') + ' |',
    '| 评分 | ' + report.score + ' / 100 |',
    '| 主色占比 | ' + (report.measured.primaryRatio * 100).toFixed(0) + '% |',
    '| 问题 | ' + report.counts.error + ' 错误 / ' + report.counts.warn + ' 告警 / ' + report.counts.info + ' 提示 |',
    '',
    '## 问题清单',
    '',
  ];
  if (!report.issues.length) lines.push('未发现问题。');
  else {
    lines.push('| 级别 | 代码 | 说明 |');
    lines.push('|---|---|---|');
    const label = { error: '❌', warn: '⚠️', info: 'ℹ️' };
    report.issues.forEach((i) => lines.push('| ' + label[i.severity] + ' | `' + i.code + '` | ' + i.message.replace(/\|/g, '\\|') + ' |'));
  }
  return lines.join('\n');
}

module.exports = { lintBrand, toMarkdown, colorDistance, contrastRatio, hexToRgb, isNeutral, KIND_RULES };
