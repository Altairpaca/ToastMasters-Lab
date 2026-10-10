/* tmc-core/core/image-kernel.js
 * 图像内核：报告视图模型 → Canvas 2× 白底 PNG 绘制。
 * 移植 universal-timer.html 的 buildReportImage / wrapByWidth / roundRectPath，
 * 改为接受注入的 CanvasPort（而非直接用 document），三宿主通用。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

const timer = require('./timer-core.js');

/** 字体族（中文优先）。 */
const IMG_FONT = '"Microsoft YaHei","Segoe UI",system-ui,sans-serif';
const IMG_MONO = 'Consolas,"Courier New",monospace';

/** 调色板。 */
const IMG_C = {
  ink: '#1b2233', dim: '#7a869a', line: '#e4e9f2', zebra: '#f7f9fc',
  head: '#eef3fa', accent: '#004165', gold: '#c9a227',
  ok: '#15803d', okBg: '#e8f7ee',
  over: '#b91c1c', overBg: '#fdeaea',
  under: '#1d4ed8', underBg: '#e9effd',
};

/**
 * 圆角矩形路径。
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x @param {number} y @param {number} w @param {number} h @param {number} r
 */
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * 逐字符量测折行。
 * @param {CanvasRenderingContext2D} ctx 已设好 font 的上下文
 * @param {string} text
 * @param {number} maxW 最大行宽
 * @returns {string[]}
 */
function wrapByWidth(ctx, text, maxW) {
  const out = [];
  let cur = '';
  const s = String(text);
  for (let i = 0; i < s.length; i++) {
    const next = cur + s.charAt(i);
    if (cur && ctx.measureText(next).width > maxW) { out.push(cur); cur = s.charAt(i); }
    else cur = next;
  }
  if (cur) out.push(cur);
  return out.length ? out : [''];
}

/**
 * 依据视图模型与画布端口渲染报告图片（2× 像素密度，白底）。
 * 画布高度 = 固定表头 + 记录条数 × 行高 + 汇总块 + 额外块，随内容自动伸缩。
 * @param {Object} vm ReportViewModel
 * @param {Object} canvasPort CanvasPort（需含 create(w,h)）
 * @param {Object} [opts] { scale?:number }
 * @returns {Object|null} CanvasLike（可 toDataURL 导出），端口不可用时返回 null
 */
function render(vm, canvasPort, opts) {
  if (!canvasPort || typeof canvasPort.create !== 'function') return null;
  const SC = (opts && opts.scale) || 2;
  const PAD = 36;
  const F = function (w, s) { return w + ' ' + s + 'px ' + IMG_FONT; };
  const M = function (w, s) { return w + ' ' + s + 'px ' + IMG_MONO; };

  const head = vm.headers.slice();
  const aligns = vm.aligns.slice();
  const rows = vm.rows.length ? vm.rows.map(function (r) {
    return { cells: r.cells.slice(), st: r.st || '' };
  }) : [{ cells: head.map(function () { return ''; }), st: '' }];
  if (!vm.rows.length) { rows[0].cells[1] = '（还没有记录）'; }

  const cellFonts = head.map(function (_, k) {
    return (k === head.length - 1) ? F(600, 15) : F(400, 17);
  });
  const HEAD_FONT = F(700, 15);

  // ---- 量测：临时测量用同一 canvasPort（可能返回 null，此时退化为估算） ----
  const probe = canvasPort.create(8, 8);
  const mc = probe && typeof probe.getContext === 'function' ? probe.getContext('2d') : null;
  const measure = function (font, text) {
    if (mc) { mc.font = font; return mc.measureText(String(text)).width; }
    // 无度量的估算：中文按 1 宽、其余按 0.55 宽（相对字号）
    const size = parseInt(String(font).match(/(\d+)px/)[1], 10) || 16;
    let w = 0;
    String(text).split('').forEach(function (ch) { w += /[\u4e00-\u9fff]/.test(ch) ? size : size * 0.55; });
    return w;
  };

  const colW = head.map(function (h, k) {
    let w = measure(HEAD_FONT, h);
    rows.forEach(function (r) { w = Math.max(w, measure(cellFonts[k], r.cells[k])); });
    return Math.ceil(w) + 32;
  });
  const tableW0 = colW.reduce(function (a, b) { return a + b; }, 0);
  const W = Math.max(780, PAD * 2 + tableW0);
  // 富余宽度补给「角色/中间列」（第 2 或第 3 列）
  const flexCol = head.length >= 3 ? 2 : 1;
  colW[flexCol] += Math.max(0, W - PAD * 2 - tableW0);

  const HEAD_H = 46, ROW_H = 42;

  // ---- 汇总块量测 ----
  const sumText = vm.summary;
  const sumLines = wrapByWidth({ font: F(400, 16), measureText: function (t) { return { width: measure(F(400, 16), t) }; } },
    sumText, W - PAD * 2 - 32);
  const sumH = sumLines.length * 24 + 26;

  // ---- 额外块量测 ----
  const extraBlocks = (vm.extra || []).map(function (e) {
    const text = e.label + '：' + e.text;
    const lines = wrapByWidth({ font: F(400, 16), measureText: function (t) { return { width: measure(F(400, 16), t) }; } },
      text, W - PAD * 2 - 32);
    return { lines: lines, h: lines.length * 24 + 26 };
  });
  const extraH = extraBlocks.reduce(function (a, b) { return a + 12 + b.h; }, 0);

  // ---- 竖向排版预算 ----
  const TITLE_H = 34, SUB_H = 22, RULE_GAP = 26, FOOT_H = 22;
  const H = PAD + TITLE_H + 6 + SUB_H + 14 + 4 + RULE_GAP +
    HEAD_H + rows.length * ROW_H +
    24 + sumH + extraH + 12 + FOOT_H + PAD;

  // ---- 建画布 ----
  const c = canvasPort.create(Math.round(W * SC), Math.round(H * SC));
  if (!c || typeof c.getContext !== 'function') return null;
  const ctx = c.getContext('2d');
  ctx.scale(SC, SC);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const colX = [];
  let acc = PAD;
  colW.forEach(function (w) { colX.push(acc); acc += w; });

  let y = PAD;

  // 标题
  ctx.fillStyle = IMG_C.ink;
  ctx.font = F(700, 26);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(vm.title.en + '  ' + vm.title.zh, PAD, y + 24);
  y += TITLE_H + 6;

  // 会议名 / 日期
  ctx.fillStyle = IMG_C.dim;
  ctx.font = F(400, 15);
  ctx.fillText(vm.meta.meetingName + ' ｜ ' + (vm.meta.date || ''), PAD, y + 16);
  y += SUB_H + 14;

  // 分隔条
  ctx.fillStyle = IMG_C.accent;
  ctx.fillRect(PAD, y, 96, 4);
  ctx.fillStyle = IMG_C.gold;
  ctx.fillRect(PAD + 96, y, 24, 4);
  y += 4 + RULE_GAP;

  // 表头
  ctx.fillStyle = IMG_C.head;
  ctx.fillRect(PAD, y, W - PAD * 2, HEAD_H);
  ctx.fillStyle = IMG_C.accent;
  ctx.font = HEAD_FONT;
  ctx.textBaseline = 'middle';
  head.forEach(function (h, k) {
    if (aligns[k] === 'right') {
      ctx.textAlign = 'right';
      ctx.fillText(h, colX[k] + colW[k] - 16, y + HEAD_H / 2 + 1);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(h, colX[k] + 16, y + HEAD_H / 2 + 1);
    }
  });
  ctx.strokeStyle = IMG_C.accent;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PAD, y + HEAD_H); ctx.lineTo(W - PAD, y + HEAD_H); ctx.stroke();
  y += HEAD_H;

  // 数据行
  const statusCol = head.findIndex(function (h) { return h.indexOf('状态') >= 0 || h.indexOf('Status') >= 0; });
  rows.forEach(function (r, ri) {
    const top = y + ri * ROW_H;
    const mid = top + ROW_H / 2 + 1;
    if (ri % 2 === 1) {
      ctx.fillStyle = IMG_C.zebra;
      ctx.fillRect(PAD, top, W - PAD * 2, ROW_H);
    }
    for (let k = 0; k < head.length; k++) {
      const txt = r.cells[k];
      if (k === statusCol && r.st) {
        ctx.font = cellFonts[k];
        const bw = ctx.measureText(String(txt)).width + 22, bh = 26;
        const bx = colX[k] + 6, by = top + (ROW_H - bh) / 2;
        const pal = r.st === 'ok' ? [IMG_C.okBg, IMG_C.ok]
          : r.st === 'over' ? [IMG_C.overBg, IMG_C.over]
            : [IMG_C.underBg, IMG_C.under];
        ctx.fillStyle = pal[0];
        roundRectPath(ctx, bx, by, bw, bh, 13);
        ctx.fill();
        ctx.fillStyle = pal[1];
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(txt), bx + 11, by + bh / 2 + 1);
      } else {
        ctx.font = cellFonts[k];
        ctx.fillStyle = IMG_C.ink;
        ctx.textBaseline = 'middle';
        if (aligns[k] === 'right') {
          ctx.textAlign = 'right';
          ctx.fillText(String(txt), colX[k] + colW[k] - 16, mid);
        } else {
          ctx.textAlign = 'left';
          ctx.fillText(String(txt), colX[k] + 16, mid);
        }
      }
    }
    ctx.strokeStyle = IMG_C.line;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD, top + ROW_H); ctx.lineTo(W - PAD, top + ROW_H); ctx.stroke();
  });
  y += rows.length * ROW_H + 24;

  // 汇总块
  ctx.fillStyle = IMG_C.head;
  roundRectPath(ctx, PAD, y, W - PAD * 2, sumH, 10);
  ctx.fill();
  ctx.fillStyle = IMG_C.ink;
  ctx.font = F(400, 16);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  sumLines.forEach(function (ln, k) { ctx.fillText(ln, PAD + 16, y + 13 + k * 24); });
  y += sumH;

  // 额外块（如环节计时 / 每日一词）
  extraBlocks.forEach(function (blk) {
    y += 12;
    ctx.fillStyle = '#fdf6e3';
    roundRectPath(ctx, PAD, y, W - PAD * 2, blk.h, 10);
    ctx.fill();
    ctx.fillStyle = '#8a6d1f';
    ctx.font = F(400, 16);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    blk.lines.forEach(function (ln, k) { ctx.fillText(ln, PAD + 16, y + 13 + k * 24); });
    y += blk.h;
  });

  // 页脚
  y += 12;
  ctx.fillStyle = IMG_C.dim;
  ctx.font = F(400, 13);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('TMC Toolkit · ' + vm.title.zh + ' 自动生成', W / 2, y);

  return c;
}

module.exports = {
  IMG_FONT: IMG_FONT,
  IMG_MONO: IMG_MONO,
  IMG_C: IMG_C,
  roundRectPath: roundRectPath,
  wrapByWidth: wrapByWidth,
  render: render,
  buildReportImage: render,
};
