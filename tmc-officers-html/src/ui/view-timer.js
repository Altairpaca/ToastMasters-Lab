/* tmc-officers-html/src/ui/view-timer.js
 * 计时官视图：预设选择、计时、三色灯、记录列表（会话内 + localStorage）。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
(function (global) {
  'use strict';
  var TMC = global.TMC;
  var Views = (global.TMCViews = global.TMCViews || {});

  // 预设（与既有 universal-timer 一致）
  var PRESETS = [
    { key: 'speech', name: '备稿演讲', en: 'Prepared Speech', green: 300, yellow: 360, red: 420 },
    { key: 'tt', name: '即兴演讲', en: 'Table Topics', green: 60, yellow: 90, red: 120 },
    { key: 'eval', name: '点评', en: 'Evaluation', green: 120, yellow: 150, red: 180 },
    { key: 'custom', name: '自定义', en: 'Custom', green: 60, yellow: 90, red: 120 },
  ];

  Views.timer = function (app, state, rerender) {
    var H = global.TMCHost;
    var officer = app.officer;
    var root = global.document.getElementById('viewRoot');

    var th = { green: 300, yellow: 360, red: 420 };
    var presetKey = 'speech';
    var lastLight = 'none';
    var rafId = null;

    // 恢复计时记录
    var saved = H && global.TMCStore ? global.TMCStore.load('timer') : null;
    if (saved && Array.isArray(saved.records)) {
      saved.records.forEach(function (r) {
        officer.recordTimer(r);
      });
    }

    function render() {
      var recs = officer.getTimerRecords();
      var html = [];
      html.push('<div class="card">');
      html.push('<div class="card-title">⏱ 计时计时器 Timer</div>');
      // 当前角色 + 阈值
      html.push('<div class="row">');
      html.push('<div class="field"><label>当前环节 / 讲者</label><input type="text" id="tSpeaker" placeholder="讲者姓名"></div>');
      html.push('<div class="field"><label>角色</label><input type="text" id="tRole" value="' + H.esc(presetLabel()) + '"></div>');
      html.push('</div>');
      html.push('<div class="timer-box" id="timerBox">');
      html.push('<div class="clock" id="tClock">0:00</div>');
      html.push('<div class="clock-sub" id="tThresholds">🟢 ' + TMC.timer.formatTime(th.green) + '  🟡 ' + TMC.timer.formatTime(th.yellow) + '  🔴 ' + TMC.timer.formatTime(th.red) + '</div>');
      html.push('<div class="status-line" id="tStatus">就绪</div>');
      html.push('</div>');
      html.push('<div class="row" style="margin-top:12px">');
      html.push('<button class="btn" id="tStart">▶ 开始</button>');
      html.push('<button class="btn ghost" id="tNext" disabled>✓ 记录并下一位</button>');
      html.push('<button class="btn ghost" id="tReset">↺ 复位</button>');
      html.push('</div>');
      html.push('<div class="presets" id="presets"></div>');
      html.push('</div>');

      // 记录表
      html.push('<div class="card"><div class="card-title">记录 Records（' + recs.length + '）</div>');
      if (!recs.length) html.push('<div class="empty-tip">还没有记录。选择预设 → 开始计时 → 记录并下一位。</div>');
      else {
        html.push('<table class="data-table"><thead><tr><th>#</th><th>讲者</th><th>角色</th><th class="num">用时</th><th>状态</th><th></th></tr></thead><tbody>');
        recs.forEach(function (r, i) {
          var st = TMC.data.statusText.statusText(r.status);
          var detail = TMC.timer.formatTime(r.time);
          if (r.status === 'over' && r.overBy > 0) detail += ' (+' + TMC.timer.formatTime(r.overBy) + ')';
          if (r.status === 'under') detail += ' (-' + TMC.timer.formatTime(r.green - r.time) + ')';
          html.push('<tr><td>' + (i + 1) + '</td><td>' + H.esc(r.speaker) + '</td><td>' + H.esc(r.role) +
            '</td><td class="num">' + detail + '</td><td><span class="badge ' + r.status + '">' + st.zh +
            '</span></td><td><button class="btn sm ghost" data-del="' + i + '">✕</button></td></tr>');
        });
        html.push('</tbody></table>');
      }
      html.push('<div class="row" style="margin-top:10px"><button class="btn ghost sm" id="tClear">清空全部</button>');
      html.push('<button class="btn sm" id="tReport">📄 生成报告</button></div>');
      html.push('</div>');
      root.innerHTML = html.join('');

      // 预设按钮
      var pg = root.querySelector('#presets');
      PRESETS.forEach(function (p) {
        var b = global.document.createElement('button');
        b.className = 'preset-btn' + (presetKey === p.key ? ' active' : '');
        b.innerHTML = p.name + ' ' + p.en +
          '<span class="sub">🟢' + TMC.timer.formatTime(p.green) + ' 🟡' + TMC.timer.formatTime(p.yellow) + ' 🔴' + TMC.timer.formatTime(p.red) + '</span>';
        b.onclick = function () {
          presetKey = p.key;
          th = { green: p.green, yellow: p.yellow, red: p.red };
          var roleEl = root.querySelector('#tRole');
          if (roleEl && p.key !== 'custom') roleEl.value = p.name + ' ' + p.en;
          officer.stopwatchReset();
          render();
        };
        pg.appendChild(b);
      });

      bind();
      renderClock();
    }

    function presetLabel() {
      var p = PRESETS.filter(function (x) { return x.key === presetKey; })[0];
      return p ? (p.name + ' ' + p.en) : '自定义 Custom';
    }

    function bind() {
      var startBtn = root.querySelector('#tStart');
      var nextBtn = root.querySelector('#tNext');
      var resetBtn = root.querySelector('#tReset');
      var clearBtn = root.querySelector('#tClear');
      var reportBtn = root.querySelector('#tReport');

      startBtn.onclick = function () {
        var sw = officer.stopwatch();
        if (!sw) { officer.startSegment('seg-' + Date.now(), th.red / 60); sw = officer.stopwatch(); }
        if (sw.isRunning()) { sw.pause(); startBtn.textContent = '▶ 继续'; }
        else { sw.start(); startBtn.textContent = '⏸ 暂停'; nextBtn.disabled = false; tick(); }
      };
      nextBtn.onclick = function () {
        var spk = root.querySelector('#tSpeaker').value.trim() || '（未命名）';
        var role = root.querySelector('#tRole').value.trim() || presetLabel();
        officer.recordTimer({ segment_id: 'seg-' + Date.now(), planned_min: th.red / 60, speaker: spk, role: role, green: th.green, red: th.red });
        officer.stopwatchReset();
        startBtn.textContent = '▶ 开始';
        nextBtn.disabled = true;
        persist();
        render();
        var s = root.querySelector('#tSpeaker'); if (s) s.focus();
      };
      resetBtn.onclick = function () {
        officer.stopwatchReset();
        startBtn.textContent = '▶ 开始';
        nextBtn.disabled = true;
        lastLight = 'none';
        renderClock();
        persist();
      };
      clearBtn.onclick = function () {
        if (!officer.getTimerRecords().length) return;
        if (global.confirm('确定清空全部计时记录？')) { officer.clearTimer(); persist(); render(); }
      };
      reportBtn.onclick = function () { state.view = 'report'; state.reportKind = 'timer'; H.render(); };
      root.querySelectorAll('[data-del]').forEach(function (b) {
        b.onclick = function () { officer.deleteTimer(parseInt(b.getAttribute('data-del'), 10)); persist(); render(); };
      });
    }

    function tick() {
      renderClock();
      var sw = officer.stopwatch();
      rafId = sw && sw.isRunning() ? global.requestAnimationFrame(tick) : null;
    }

    function renderClock() {
      var clockEl = root.querySelector('#tClock');
      if (!clockEl) return;
      var sw = officer.stopwatch();
      var sec = sw ? sw.seconds() : 0;
      var light = TMC.timer.lightState(sec, th.green, th.yellow, th.red);
      var box = root.querySelector('#timerBox');
      if (box) box.className = 'timer-box' + ((sec > 0 || (sw && sw.isRunning())) && light !== 'none' ? ' ' + light : '');
      clockEl.textContent = TMC.timer.formatTime(sec);
      var st = root.querySelector('#tStatus');
      if (st) {
        var status = '就绪';
        if (sec > 0 || (sw && sw.isRunning())) {
          if (light === 'over') status = '🔴 已超时 +' + TMC.timer.formatTime(sec - th.red);
          else if (light === 'red') status = '🔴 时间到，请收尾';
          else if (light === 'yellow') status = '🟡 注意时间';
          else if (light === 'green') status = '🟢 已达最短合格时间';
          else status = '⏱ 计时中';
        }
        st.textContent = status;
      }
      lastLight = light;
    }

    function persist() {
      if (global.TMCStore) global.TMCStore.save('timer', { records: officer.getTimerRecords() });
    }

    // 初始化秒表
    officer.startSegment('seg-init', th.red / 60);
    var sw0 = officer.stopwatch(); if (sw0) sw0.reset();

    render();
    if (rafId) global.cancelAnimationFrame(rafId);
  };
})(typeof window !== 'undefined' ? window : globalThis);
