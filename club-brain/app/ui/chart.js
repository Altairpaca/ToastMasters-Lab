/* Club Console · 图表（纯 SVG，零依赖） */
(function () {
  const CC = (window.CC = window.CC || {});
  const NS = 'http://www.w3.org/2000/svg';

  const KIND_COLOR = {
    opening: '#6f7885',
    facilitator: '#4c8dff',
    speech: '#b23a52',
    break: '#3d4652',
    tabletopics: '#d29922',
    workshop: '#8f6fe8',
    report: '#2f9e6b',
    special: '#c26b2a',
    vote: '#e0b341',
    closing: '#6f7885',
  };

  function el(tag, attrs) {
    const node = document.createElementNS(NS, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k, v));
    return node;
  }

  /**
   * 议程甘特图
   * @param {Array} timeline 来自 lintAgenda 的 timeline（含 start/end/minutes/kind/name）
   * @param {object} opts { deadline: '21:30', width }
   */
  function gantt(timeline, opts) {
    const o = opts || {};
    const width = o.width || 980;
    const rowH = 22;
    const gap = 6;
    const labelW = 150;
    const height = timeline.length * (rowH + gap) + 34;
    const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, width: '100%', height });

    if (!timeline.length) return svg;

    const t0 = timeline[0].start;
    const t1 = timeline[timeline.length - 1].end;
    const span = Math.max(1, t1 - t0);
    const plotW = width - labelW - 20;

    // 顶部刻度（每 15 分钟）
    const step = span > 150 ? 30 : 15;
    for (let m = Math.ceil(t0 / step) * step; m <= t1; m += step) {
      const x = labelW + ((m - t0) / span) * plotW;
      svg.appendChild(el('line', { x1: x, y1: 18, x2: x, y2: height - 8, stroke: '#1e242d', 'stroke-width': 1 }));
      const t = el('text', { x, y: 12, fill: '#6f7885', 'font-size': 10, 'text-anchor': 'middle', 'font-family': 'ui-monospace, monospace' });
      t.textContent = CC.core.fmtHHMM(m);
      svg.appendChild(t);
    }

    timeline.forEach((seg, i) => {
      const y = 22 + i * (rowH + gap);
      const x = labelW + ((seg.start - t0) / span) * plotW;
      const w = Math.max(3, ((seg.end - seg.start) / span) * plotW);

      const label = el('text', { x: 0, y: y + 15, fill: '#a7afbb', 'font-size': 11.5 });
      label.textContent = seg.name.length > 11 ? seg.name.slice(0, 11) + '…' : seg.name;
      svg.appendChild(label);

      const rect = el('rect', {
        x, y, width: w, height: rowH, rx: 4,
        fill: KIND_COLOR[seg.kind] || '#3d4652',
        opacity: seg.minutes <= 0 ? 0.3 : 0.9,
      });
      const title = el('title', {});
      title.textContent = `${seg.name} ${seg.startText}–${seg.endText}（${seg.minutes} 分钟）`;
      rect.appendChild(title);
      svg.appendChild(rect);

      if (w > 46) {
        const txt = el('text', {
          x: x + 6, y: y + 15, fill: '#0c0e12', 'font-size': 10.5, 'font-weight': 600,
        });
        txt.textContent = seg.minutes + "'";
        svg.appendChild(txt);
      }
    });

    // 截止时间标线
    if (o.deadline) {
      const dl = CC.core.parseHHMM(o.deadline);
      if (Number.isFinite(dl) && dl >= t0 && dl <= t1 + 30) {
        const x = labelW + ((dl - t0) / span) * plotW;
        svg.appendChild(el('line', {
          x1: x, y1: 18, x2: x, y2: height - 8, stroke: '#f85149', 'stroke-width': 1.5, 'stroke-dasharray': '4 3',
        }));
        const t = el('text', { x, y: height - 1, fill: '#f85149', 'font-size': 10, 'text-anchor': 'middle' });
        t.textContent = '截止 ' + o.deadline;
        svg.appendChild(t);
      }
    }
    return svg;
  }

  /** 水平条形对比：计划 vs 实测 */
  function compareBars(rows) {
    const max = Math.max(1, ...rows.map((r) => Math.max(r.planned, r.actual)));
    const wrap = document.createElement('div');
    wrap.className = 'bars';
    rows.forEach((r) => {
      const pctP = (r.planned / max) * 100;
      const pctA = (r.actual / max) * 100;
      const over = r.actual > r.planned;
      const row = CC.dom.h('div', { class: 'bar-row' },
        CC.dom.h('div', { class: 'nowrap', title: r.label }, r.label),
        CC.dom.h('div', { style: { position: 'relative', height: '16px' } },
          CC.dom.h('div', {
            class: 'bar-track',
            style: { position: 'absolute', inset: '0', opacity: '.35' },
          }, CC.dom.h('div', { class: 'bar-fill', style: { width: pctP + '%' } })),
          CC.dom.h('div', {
            class: 'bar-track',
            style: { position: 'absolute', inset: '0', background: 'transparent' },
          }, CC.dom.h('div', { class: 'bar-fill ' + (over ? 'over' : 'ok'), style: { width: pctA + '%' } }))
        ),
        CC.dom.h('div', {
          class: 'right mono small',
          style: { color: over ? 'var(--err)' : 'var(--fg-2)' },
        }, r.planned + '→' + r.actual + (over ? ' ↑' + (r.actual - r.planned) : ''))
      );
      wrap.appendChild(row);
    });
    return wrap;
  }

  /** 迷你趋势线 */
  function sparkline(values, opts) {
    const o = opts || {};
    const w = o.width || 220;
    const hh = o.height || 40;
    const svg = el('svg', { viewBox: `0 0 ${w} ${hh}`, width: w, height: hh });
    if (values.length < 2) return svg;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const span = Math.max(1, max - min);
    const pts = values.map((v, i) => {
      const x = (i / (values.length - 1)) * (w - 4) + 2;
      const y = hh - 4 - ((v - min) / span) * (hh - 8);
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
    svg.appendChild(el('polyline', {
      points: pts.join(' '), fill: 'none', stroke: o.color || '#4c8dff', 'stroke-width': 1.8,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round',
    }));
    return svg;
  }

  CC.chart = { gantt, compareBars, sparkline, KIND_COLOR };
})();
