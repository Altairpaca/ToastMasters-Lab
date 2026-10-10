/* tmc-core/core/md-renderer.js
 * 零依赖 Markdown 渲染器（GFM 子集）。移植自 universal-timer.html 的 mdToHtml 家族，
 * 保持功能等价：先转义再套样式（防注入）。
 *
 * 支持：# 标题 / **粗体** / *斜体* / `代码` / - 无序列表 / 1. 有序列表 / --- 分隔线
 *       / | 表格（含 :--- 对齐行） / 普通段落
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

/**
 * HTML 转义（防注入）。所有用户内容在套样式前必须经过此函数。
 * @param {*} s 任意值
 * @returns {string}
 */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 行内 Markdown → HTML（先转义，再替换 code/strong/em）。
 * @param {string} s 单行文本
 * @returns {string}
 */
function mdInline(s) {
  let t = escapeHtml(s);
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return t;
}

/**
 * 判断是否为表格分隔行，如 |---:|:---|:---|---:|:---|
 * @param {string} line
 * @returns {boolean}
 */
function isSepRow(line) {
  if (String(line).indexOf('-') < 0) return false;
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
}

/**
 * 拆分表格行为单元格数组（去首尾竖线与空白）。
 * @param {string} line
 * @returns {string[]}
 */
function splitRow(line) {
  let t = String(line).trim();
  if (t.charAt(0) === '|') t = t.slice(1);
  if (t.charAt(t.length - 1) === '|') t = t.slice(0, -1);
  return t.split('|').map(function (c) { return c.trim(); });
}

/**
 * 解析分隔行单元格的对齐方式。
 * @param {string} cell 如 ':---:' / '---:' / ':---' / '---'
 * @returns {''|'left'|'center'|'right'}
 */
function alignOf(cell) {
  const left = cell.charAt(0) === ':';
  const right = cell.charAt(cell.length - 1) === ':';
  if (left && right) return 'center';
  if (right) return 'right';
  if (left) return 'left';
  return '';
}

/**
 * Markdown → HTML 片段（无外层容器）。
 * @param {string} md
 * @returns {string}
 */
function toHtml(md) {
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  let listType = null;

  function closeList() {
    if (listType) { out.push('</' + listType + '>'); listType = null; }
  }

  while (i < lines.length) {
    const line = lines[i];

    // --- 表格 ---
    if (line.indexOf('|') >= 0 && i + 1 < lines.length && isSepRow(lines[i + 1])) {
      closeList();
      const head = splitRow(line);
      const aligns = splitRow(lines[i + 1]).map(alignOf);
      i += 2;
      const body = [];
      while (i < lines.length && lines[i].trim() !== '' && lines[i].indexOf('|') >= 0) {
        body.push(splitRow(lines[i]));
        i++;
      }
      let h = '<table class="md-table"><thead><tr>';
      head.forEach(function (c, k) {
        h += '<th' + (aligns[k] ? ' style="text-align:' + aligns[k] + '"' : '') + '>' +
          mdInline(c) + '</th>';
      });
      h += '</tr></thead><tbody>';
      body.forEach(function (r) {
        h += '<tr>';
        head.forEach(function (_, k) {
          h += '<td' + (aligns[k] ? ' style="text-align:' + aligns[k] + '"' : '') + '>' +
            mdInline(r[k] === undefined ? '' : r[k]) + '</td>';
        });
        h += '</tr>';
      });
      h += '</tbody></table>';
      out.push(h);
      continue;
    }

    // --- 分隔线 ---
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      closeList(); out.push('<hr>'); i++; continue;
    }

    // --- 标题 ---
    const hm = /^(#{1,6})\s+(.*)$/.exec(line);
    if (hm) {
      closeList();
      const lv = hm[1].length;
      out.push('<h' + lv + '>' + mdInline(hm[2]) + '</h' + lv + '>');
      i++; continue;
    }

    // --- 无序列表 ---
    const ul = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (ul) {
      if (listType !== 'ul') { closeList(); out.push('<ul>'); listType = 'ul'; }
      out.push('<li>' + mdInline(ul[1]) + '</li>');
      i++; continue;
    }

    // --- 有序列表 ---
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ol) {
      if (listType !== 'ol') { closeList(); out.push('<ol>'); listType = 'ol'; }
      out.push('<li>' + mdInline(ol[1]) + '</li>');
      i++; continue;
    }

    // --- 空行 ---
    if (line.trim() === '') { closeList(); i++; continue; }

    // --- 段落 ---
    closeList();
    out.push('<p>' + mdInline(line) + '</p>');
    i++;
  }
  closeList();
  return out.join('\n');
}

module.exports = {
  toHtml: toHtml,
  inline: mdInline,
  escapeHtml: escapeHtml,
  isSepRow: isSepRow,
  splitRow: splitRow,
  alignOf: alignOf,
  mdInline: mdInline,
};
