/* tmc-agenda-html/src/ui/view-agenda-preview.js
 * 议程预览视图：时间列（含缓冲）/ 环节时间线 / 时间一致性校验 / Markdown 渲染。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
(function (global) {
  'use strict';
  var TMC = global.TMC;
  var Views = (global.TMCViews = global.TMCViews || {});

  Views.preview = function (app, state, session, rerender) {
    var H = global.TMCAgendaHost;
    var root = global.document.getElementById('viewRoot');

    function build() {
      var plan = app.agenda.buildAgenda(session.meeting, { anchors: { startTime: session.meeting.start_time } });
      session.plan = plan;
      session.rows = plan.rows;
      return plan;
    }

    function render() {
      if (!session.meeting.meeting_id) {
        // 未填会议信息时给出提示
        root.innerHTML = '<div class="card"><div class="empty-tip">尚未填写会议信息。请先到「① 填写会议」。</div>' +
          '<div class="row" style="justify-content:center"><button class="btn" id="backForm">← 返回填写</button></div></div>';
        var bf = root.querySelector('#backForm');
        if (bf) bf.onclick = function () { state.view = 'form'; H.render(); };
        return;
      }
      var plan = build();
      var vm = app.agenda.preview(plan);

      var html = [];
      html.push('<div class="card">');
      html.push('<div class="card-title">② 议程预览 Agenda Preview</div>');
      html.push('<div class="hint">' + H.esc(session.meeting.meeting_id) + ' · 共 ' + plan.rows.length +
        ' 个环节 · 预计 ' + plan.totalMinutes + ' 分钟（含缓冲）</div>');

      // 时间线
      html.push('<div style="margin-top:10px">');
      plan.rows.forEach(function (r, i) {
        html.push('<div class="timeline-row"><span class="t">' + H.esc(r.time) + '</span>' +
          '<span class="seg">' + H.esc(r.title_zh) + '</span>' +
          '<span class="who">' + H.esc(r.presenter || '—') + ' · ' + r.duration_min + '′</span></div>');
      });
      html.push('</div>');

      // 校验
      if (plan.warnings.length) {
        html.push('<div class="warn-box">⚠️ ' + H.esc(plan.warnings.join('；')) + '</div>');
      } else {
        html.push('<div class="ok-box">✅ 时间校验通过（议程总时长不超过会议时段）。</div>');
      }

      // Markdown 渲染视图
      html.push('<div class="card-title" style="margin-top:16px">渲染视图 Render</div>');
      html.push('<div class="report-render" id="pvRender"></div>');
      html.push('</div>');

      html.push('<div class="row" style="justify-content:space-between">');
      html.push('<button class="btn ghost" id="backForm">← 修改会议</button>');
      html.push('<button class="btn" id="gotoExport">下一步：导出 →</button>');
      html.push('</div>');
      root.innerHTML = html.join('');

      var box = root.querySelector('#pvRender');
      box.innerHTML = TMC.md.toHtml(TMC.report.toMarkdown(vm));

      root.querySelector('#backForm').onclick = function () { state.view = 'form'; H.render(); };
      root.querySelector('#gotoExport').onclick = function () { state.view = 'export'; H.render(); };
    }

    render();
  };
})(typeof window !== 'undefined' ? window : globalThis);
