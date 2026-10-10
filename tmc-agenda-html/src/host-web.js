/* tmc-agenda-html/src/host-web.js
 * 议程生成器 Web 宿主：装配适配器 + createApp + 统一外壳（三个标签页）。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
(function (global) {
  'use strict';
  var TMC = global.TMC;

  var app = TMC.createApp({
    storage: TMC.adapters.WebStorage(),
    canvas: TMC.adapters.WebCanvas(),
    clock: TMC.adapters.SystemClock(),
    file: TMC.adapters.WebFile(),
    net: TMC.ports.NullNetPort,
  });

  var netAvailable = app.netAvailable();

  // 共享会话态：由表单视图写入，预览/导出视图读取
  var session = {
    meeting: TMC.meeting.empty(),
    rows: [],        // 议程行（含时间列）
    plan: null,      // AgendaPlan
    baseEntries: null, // 底稿 ZIP entries
  };

  var state = { view: 'form' };
  var defaultView = (global.document && global.document.documentElement.getAttribute('data-default-view')) || 'form';
  state.view = defaultView;

  function render() {
    var root = global.document.getElementById('app');
    var tabs = [
      { key: 'form', label: '① 填写会议' },
      { key: 'preview', label: '② 议程预览' },
      { key: 'export', label: '③ 导出 / 底稿' },
    ];
    var html = [];
    html.push('<div class="topbar"><h1>TMC 议程生成器</h1>');
    html.push('<span class="sub">议程制表 · xlsx 保真导出 · 零依赖离线版</span>');
    html.push('<span class="spacer" style="flex:1"></span>');
    if (!netAvailable) html.push('<span class="offline-note">离线模式</span>');
    html.push('</div>');
    html.push('<div class="tabs">');
    tabs.forEach(function (t) {
      html.push('<button class="tab' + (state.view === t.key ? ' active' : '') + '" data-view="' + t.key + '">' + t.label + '</button>');
    });
    html.push('</div>');
    html.push('<div id="viewRoot"></div>');
    html.push('<div class="footer">TMC Toolkit · MIT · Altair Li</div>');
    root.innerHTML = html.join('');
    root.querySelectorAll('.tab').forEach(function (b) {
      b.onclick = function () { state.view = b.getAttribute('data-view'); render(); };
    });
    var views = global.TMCViews || {};
    if (views[state.view]) views[state.view](app, state, session, render);
  }

  function esc(s) { return TMC.md.escapeHtml(s === undefined || s === null ? '' : s); }

  global.TMCAgendaHost = {
    app: app, state: state, session: session, render: render, esc: esc, netAvailable: netAvailable,
  };

  var booted = false;
  function boot() { if (booted) return; booted = true; render(); }
  if (global.document.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', boot);
  else boot();

  global.onerror = function (m) { try { console.warn('[TMC] error', m); } catch (e) {} };
})(typeof window !== 'undefined' ? window : globalThis);
