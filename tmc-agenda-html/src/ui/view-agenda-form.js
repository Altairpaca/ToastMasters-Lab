/* tmc-agenda-html/src/ui/view-agenda-form.js
 * 议程表单视图：会议元数据 / 角色分配 / 议程环节 / 备稿。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
(function (global) {
  'use strict';
  var TMC = global.TMC;
  var Views = (global.TMCViews = global.TMCViews || {});
  var ROLES = TMC.data.roles.ROLES;

  Views.form = function (app, state, session, rerender) {
    var H = global.TMCAgendaHost;
    var root = global.document.getElementById('viewRoot');
    var m = session.meeting;

    function save() {
      // 同步表单 → session.meeting
      m.meeting_number = parseInt(root.querySelector('#fNumber').value, 10) || 0;
      m.date = root.querySelector('#fDate').value || '';
      m.start_time = root.querySelector('#fStart').value || '19:15';
      m.end_time = root.querySelector('#fEnd').value || '21:30';
      m.theme.zh = root.querySelector('#fThemeZh').value.trim();
      m.theme.en = root.querySelector('#fThemeEn').value.trim();
      m.word_of_the_day.en = root.querySelector('#fWodEn').value.trim();
      m.word_of_the_day.zh = root.querySelector('#fWodZh').value.trim();
      m.meeting_id = TMC.meeting.makeMeetingId(m.date, m.meeting_number);

      // 角色
      m.roles = [];
      root.querySelectorAll('[data-role]').forEach(function (inp) {
        var name = inp.value.trim();
        if (name) m.roles.push({ role: inp.getAttribute('data-role'), name_zh: name, name_en: null });
      });

      // 环节
      m.agenda = [];
      root.querySelectorAll('[data-seg]').forEach(function (line) {
        var type = line.querySelector('[data-seg-type]').value;
        var title = line.querySelector('[data-seg-title]').value.trim();
        var dur = parseFloat(line.querySelector('[data-seg-dur]').value) || 0;
        var presenter = line.querySelector('[data-seg-presenter]').value.trim();
        m.agenda.push({
          segment_id: line.getAttribute('data-seg'),
          type: type, title_zh: title || TMC.agendaCore.TYPE_TITLE[type] || type,
          presenter: presenter, duration_min: dur,
          buffer_min: type === 'table_topics' ? 2 : 0,
        });
      });
    }

    function render() {
      var html = [];
      html.push('<div class="card"><div class="card-title">① 会议信息 Meeting Info</div>');
      html.push('<div class="row">');
      html.push('<div class="field"><label>期数 No.</label><input type="number" id="fNumber" min="1" value="' + (m.meeting_number || '') + '"></div>');
      html.push('<div class="field"><label>日期 Date</label><input type="date" id="fDate" value="' + H.esc(m.date) + '"></div>');
      html.push('<div class="field"><label>开始</label><input type="text" id="fStart" value="' + H.esc(m.start_time || '19:15') + '"></div>');
      html.push('<div class="field"><label>结束</label><input type="text" id="fEnd" value="' + H.esc(m.end_time || '21:30') + '"></div>');
      html.push('</div>');
      html.push('<div class="row">');
      html.push('<div class="field"><label>主题（中）</label><input type="text" id="fThemeZh" value="' + H.esc(m.theme.zh) + '"></div>');
      html.push('<div class="field"><label>主题（英）</label><input type="text" id="fThemeEn" value="' + H.esc(m.theme.en) + '"></div>');
      html.push('</div>');
      html.push('<div class="row">');
      html.push('<div class="field"><label>每日一词（英）</label><input type="text" id="fWodEn" value="' + H.esc(m.word_of_the_day.en) + '"></div>');
      html.push('<div class="field"><label>每日一词（中）</label><input type="text" id="fWodZh" value="' + H.esc(m.word_of_the_day.zh) + '"></div>');
      html.push('</div>');
      html.push('<div class="hint" id="fId"></div>');
      html.push('</div>');

      // 角色
      html.push('<div class="card"><div class="card-title">② 角色分配 Roles</div>');
      html.push('<div class="row">');
      ROLES.forEach(function (r) {
        var cur = (m.roles || []).filter(function (x) { return x.role === r.key; })[0];
        html.push('<div class="field"><label>' + r.zh + ' ' + r.en + '</label>' +
          '<input type="text" data-role="' + r.key + '" value="' + H.esc(cur ? cur.name_zh : '') + '"></div>');
      });
      html.push('</div></div>');

      // 议程环节
      html.push('<div class="card"><div class="card-title">③ 议程环节 Segments</div>');
      html.push('<div id="segLines"></div>');
      html.push('<button class="btn sm ghost" id="addSeg">＋ 添加环节</button>');
      html.push('</div>');

      html.push('<div class="row" style="justify-content:flex-end">');
      html.push('<button class="btn" id="gotoPreview">下一步：预览议程 →</button>');
      html.push('</div>');
      root.innerHTML = html.join('');

      // 渲染已有环节
      var segLines = root.querySelector('#segLines');
      if (!m.agenda.length) {
        // 默认给几条
        m.agenda = [
          { segment_id: 'seg-opening', type: 'opening', title_zh: '会议召集', duration_min: 3 },
          { segment_id: 'seg-tt', type: 'table_topics', title_zh: '即兴演讲', duration_min: 30 },
          { segment_id: 'seg-closing', type: 'closing', title_zh: '会议尾声', duration_min: 5 },
        ];
      }
      m.agenda.forEach(function (s) { segLines.appendChild(segLine(s)); });

      bind();
      updateId();
    }

    function segLine(s) {
      var div = global.document.createElement('div');
      div.className = 'agenda-line';
      div.setAttribute('data-seg', s.segment_id);
      var typeOpts = Object.keys(TMC.agendaCore.TYPE_TITLE).map(function (t) {
        return '<option value="' + t + '"' + (s.type === t ? ' selected' : '') + '>' + TMC.agendaCore.TYPE_TITLE[t] + '</option>';
      }).join('');
      div.innerHTML =
        '<select data-seg-type style="max-width:160px">' + typeOpts + '</select>' +
        '<input data-seg-title class="grow" placeholder="标题" value="' + H.esc(s.title_zh || '') + '">' +
        '<input data-seg-presenter class="grow" placeholder="呈现者" value="' + H.esc(s.presenter || '') + '">' +
        '<input data-seg-dur type="number" min="0" step="1" style="max-width:90px" placeholder="分钟" value="' + (s.duration_min || 0) + '">' +
        '<button class="btn sm ghost" data-del-seg>✕</button>';
      div.querySelector('[data-del-seg]').onclick = function () {
        save();
        session.meeting.agenda = session.meeting.agenda.filter(function (x) { return x.segment_id !== s.segment_id; });
        render();
      };
      return div;
    }

    function updateId() {
      var num = parseInt(root.querySelector('#fNumber').value, 10) || 0;
      var date = root.querySelector('#fDate').value || '';
      var el = root.querySelector('#fId');
      if (el) el.textContent = date && num ? ('meeting_id：' + TMC.meeting.makeMeetingId(date, num)) : '填写日期与期数后自动生成 meeting_id';
    }

    function bind() {
      ['#fNumber', '#fDate'].forEach(function (sel) {
        var el = root.querySelector(sel);
        if (el) el.oninput = updateId;
      });
      root.querySelector('#addSeg').onclick = function () {
        save();
        session.meeting.agenda.push({ segment_id: 'seg-' + Date.now(), type: 'prepared_speech', title_zh: '备稿演讲', duration_min: 5 });
        render();
      };
      root.querySelector('#gotoPreview').onclick = function () {
        save();
        state.view = 'preview';
        H.render();
      };
      root.querySelectorAll('input, select').forEach(function (el) {
        el.onchange = save;
      });
    }

    render();
  };
})(typeof window !== 'undefined' ? window : globalThis);
