/* tmc-officers-html/src/host-web.js
 * Web 宿主装配：组装适配器 + createApp + 构建统一的标签页外壳。
 * 在内联产物中于内核之后运行，可访问 window.TMC / window.TMCViews。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
(function (global) {
  'use strict';
  var TMC = global.TMC;

  // ---- 组装适配器（Composition Root） ----
  var app = TMC.createApp({
    storage: TMC.adapters.WebStorage(),
    canvas: TMC.adapters.WebCanvas(),
    clock: TMC.adapters.SystemClock(),
    file: TMC.adapters.WebFile(),
    net: TMC.ports.NullNetPort,   // 离线默认；联网版可替换为真实 NetPort
  });

  // ---- 联网能力探测：离线时隐藏 ASR 入口，不报错 ----
  var netAvailable = app.netAvailable();

  // ---- 状态 ----
  var state = {
    view: 'timer',           // timer | ah | grammarian | report
    meetingName: '',
    meetingDate: todayStr(),
    reportKind: 'timer',     // 报告当前展示的三官类型
    reportView: 'render',    // render | markdown | plain
  };

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // ---- 默认视图来自 <html data-default-view> ----
  var defaultView = (global.document && global.document.documentElement.getAttribute('data-default-view')) || 'timer';
  state.view = defaultView;
  state.reportKind = defaultView === 'ah' ? 'ah' : (defaultView === 'grammarian' ? 'grammarian' : 'timer');

  // ---- 顶层渲染 ----
  function renderShell() {
    var root = global.document.getElementById('app');
    var tabs = [
      { key: 'timer', label: '⏱ 计时官 Timer' },
      { key: 'ah', label: '🎙 哼哈官 Ah-Counter' },
      { key: 'grammarian', label: '📖 语法官 Grammarian' },
      { key: 'report', label: '📄 报告 Report' },
    ];
    var html = [];
    html.push('<div class="topbar">');
    html.push('<h1>TMC 三官助手</h1>');
    html.push('<span class="sub">TMC Officers Toolkit · 零依赖离线版</span>');
    html.push('<span class="spacer"></span>');
    if (!netAvailable) {
      html.push('<span class="offline-note">离线模式 · 联网增强已隐藏</span>');
    }
    html.push('</div>');

    html.push('<div class="tabs">');
    tabs.forEach(function (t) {
      html.push('<button class="tab' + (state.view === t.key ? ' active' : '') + '" data-view="' + t.key + '">' + t.label + '</button>');
    });
    html.push('</div>');

    // 会议元信息（各视图共用）
    html.push('<div class="card"><div class="row">');
    html.push('<div class="field"><label>会议名称 Meeting</label>' +
      '<input type="text" id="meetingName" placeholder="如 南沙港湾第335次例会" value="' + esc(state.meetingName) + '"></div>');
    html.push('<div class="field"><label>日期 Date</label>' +
      '<input type="date" id="meetingDate" value="' + esc(state.meetingDate) + '"></div>');
    html.push('</div></div>');

    html.push('<div id="viewRoot"></div>');
    html.push('<div class="footer">TMC Toolkit · MIT · Altair Li</div>');
    root.innerHTML = html.join('');

    root.querySelectorAll('.tab').forEach(function (btn) {
      btn.onclick = function () {
        state.view = btn.getAttribute('data-view');
        renderShell();
      };
    });
    bindMeetingMeta(root);

    // 渲染当前视图
    var views = global.TMCViews || {};
    var factory = views[state.view];
    if (factory) factory(app, state, renderShell);
  }

  function bindMeetingMeta(root) {
    var nameEl = root.querySelector('#meetingName');
    var dateEl = root.querySelector('#meetingDate');
    if (nameEl) nameEl.oninput = function () {
      state.meetingName = nameEl.value;
      app.officer.setMeta({ meetingName: state.meetingName, date: state.meetingDate });
      saveMeta();
    };
    if (dateEl) dateEl.oninput = function () {
      state.meetingDate = dateEl.value;
      app.officer.setMeta({ meetingName: state.meetingName, date: state.meetingDate });
      saveMeta();
    };
  }

  function saveMeta() {
    if (global.TMCStore) global.TMCStore.save('meta', { meetingName: state.meetingName, date: state.meetingDate });
  }

  /* ---- 工具函数（供各视图复用，挂到 window.TMCHost） ---- */
  function esc(s) { return TMC.md.escapeHtml(s === undefined || s === null ? '' : s); }

  function flash(msg, btn) {
    if (!btn) return;
    var old = btn.textContent;
    btn.textContent = msg;
    setTimeout(function () { btn.textContent = old; }, 1500);
  }

  function downloadText(name, text, mime) {
    var blob = new Blob(['\ufeff' + text], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = global.document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function downloadPng(name, vm) {
    var c = TMC.image.render(vm, TMC.adapters.WebCanvas(), { scale: 2 });
    if (!c) { alert('图片生成失败：画布不可用'); return; }
    c.toBlob(function (blob) {
      if (!blob) { alert('图片生成失败，请重试。'); return; }
      var url = URL.createObjectURL(blob);
      var a = global.document.createElement('a');
      a.href = url; a.download = name; a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    }, 'image/png');
  }

  function colorize(box) {
    // 复用内核的着色规则：命中状态列 → 套胶囊
    box.querySelectorAll('table.md-table td').forEach(function (td) {
      var t = td.textContent;
      var cls = '';
      if (t.indexOf('合格') === 0 || t.indexOf('Qualified') === 0) cls = 'st-ok';
      else if (t.indexOf('超时') === 0 || t.indexOf('Over') === 0) cls = 'st-over';
      else if (t.indexOf('时间不足') === 0 || t.indexOf('Under') === 0) cls = 'st-under';
      if (!cls) return;
      var sp = global.document.createElement('span');
      sp.className = 'st-pill ' + cls;
      sp.textContent = t;
      td.textContent = '';
      td.appendChild(sp);
    });
  }

  global.TMCHost = {
    app: app,
    state: state,
    netAvailable: netAvailable,
    render: renderShell,
    esc: esc,
    flash: flash,
    downloadText: downloadText,
    downloadPng: downloadPng,
    colorize: colorize,
    todayStr: todayStr,
  };

  // ---- 启动 ----
  // 若存在已保存的会议元信息，先恢复
  if (global.TMCStore) {
    var saved = global.TMCStore.load('meta');
    if (saved) {
      state.meetingName = saved.meetingName || '';
      state.meetingDate = saved.date || state.meetingDate;
      app.officer.setMeta({ meetingName: state.meetingName, date: state.meetingDate });
    } else {
      app.officer.setMeta({ meetingName: '', date: state.meetingDate });
    }
  }

  var booted = false;
  function boot() { if (booted) return; booted = true; renderShell(); }
  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // 全局兜底错误记录（不联网上报）
  global.onerror = function (msg) { try { console.warn('[TMC] error:', msg); } catch (e) {} };
})(typeof window !== 'undefined' ? window : globalThis);
