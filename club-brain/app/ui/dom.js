/* Club Console · DOM 与 UI 基元 */
(function () {
  const CC = (window.CC = window.CC || {});

  const ATTR_MAP = {
    className: 'class',
    htmlFor: 'for',
  };

  /**
   * 极简 h()：偏向可读，不追求 React 兼容。
   * h('div', { class: 'x', on: { click: fn } }, '文本', h('b', null, '粗'))
   */
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((key) => {
        const val = attrs[key];
        if (val == null || val === false) return;
        if (key === 'class' || key === 'className') {
          el.className = val;
        } else if (key === 'style' && typeof val === 'object') {
          Object.assign(el.style, val);
        } else if (key === 'dataset' && typeof val === 'object') {
          Object.entries(val).forEach(([k, v]) => { el.dataset[k] = v; });
        } else if (key === 'on' && typeof val === 'object') {
          Object.entries(val).forEach(([evt, fn]) => el.addEventListener(evt, fn));
        } else if (key === 'html') {
          el.innerHTML = val;
        } else if (key in el && key !== 'list' && typeof val !== 'object') {
          try { el[key] = val; } catch (_) { el.setAttribute(ATTR_MAP[key] || key, val); }
        } else {
          el.setAttribute(ATTR_MAP[key] || key, val);
        }
      });
    }
    children.flat(4).forEach((child) => {
      if (child == null || child === false) return;
      el.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return el;
  }

  function frag(...children) {
    const f = document.createDocumentFragment();
    children.flat(4).forEach((c) => { if (c != null) f.appendChild(c instanceof Node ? c : document.createTextNode(String(c))); });
    return f;
  }

  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  function icon(name) {
    const paths = {
      play: 'M8 5v14l11-7z',
      pause: 'M6 5h4v14H6zM14 5h4v14h-4z',
      next: 'M6 18l8.5-6L6 6v12zM16 6h2v12h-2z',
      prev: 'M18 18l-8.5-6L18 6v12zM6 6h2v12H6z',
      plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z',
      trash: 'M6 7h12l-1 13H7L6 7zm3-3h6l1 2H8l1-2z',
      up: 'M12 6l6 7h-4v5h-4v-5H6z',
      down: 'M12 18l-6-7h4V6h4v5h4z',
      check: 'M9 16.2l-3.5-3.5-1.4 1.4L9 19 20 8l-1.4-1.4z',
      x: 'M18.3 5.7L12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3z',
      star: 'M12 3l2.7 5.9 6.3.7-4.7 4.4 1.3 6.4L12 17.3 6.4 20.4l1.3-6.4L3 9.6l6.3-.7z',
      clock: 'M12 2a10 10 0 100 20 10 10 0 000-20zm1 5v5.4l4 2.3-.8 1.4-5.2-3V7z',
    };
    const d = paths[name] || '';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '15');
    svg.setAttribute('height', '15');
    svg.setAttribute('fill', 'currentColor');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
    return svg;
  }

  let toastTimer = [];
  function toast(message, type) {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) {
      wrap = h('div', { class: 'toast-wrap' });
      document.body.appendChild(wrap);
    }
    const el = h('div', { class: 'toast ' + (type || '') }, message);
    wrap.appendChild(el);
    const t = setTimeout(() => {
      el.style.transition = 'opacity .2s, transform .2s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(6px)';
      setTimeout(() => el.remove(), 220);
    }, 2600);
    toastTimer.push(t);
  }

  function modal({ title, sub, body, actions }) {
    const backdrop = h('div', { class: 'modal-backdrop' });
    const close = () => backdrop.remove();
    const foot = h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '16px' } },
      h('button', { class: 'btn ghost', on: { click: close } }, '关闭'),
      ...(actions || []).map((a) => h('button', {
        class: 'btn ' + (a.primary ? 'primary' : ''),
        on: { click: () => { if (a.onClick) a.onClick(); if (a.close !== false) close(); } },
      }, a.label))
    );
    backdrop.appendChild(h('div', { class: 'modal' },
      h('h2', null, title),
      sub ? h('div', { class: 'sub' }, sub) : null,
      body,
      foot
    ));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
    document.body.appendChild(backdrop);
    return { close };
  }

  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 400);
  }

  function uid(prefix) {
    return (prefix || 'id') + '-' + Math.random().toString(36).slice(2, 8);
  }

  function fmtSeconds(sec) {
    const s = Math.max(0, Math.round(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
  }

  function fmtClock(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return y + '.' + m + '.' + d;
  }

  CC.dom = { h, frag, clear, icon, toast, modal, download, uid, fmtSeconds, fmtClock };
})();
