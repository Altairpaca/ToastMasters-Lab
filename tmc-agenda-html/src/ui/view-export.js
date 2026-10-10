/* tmc-agenda-html/src/ui/view-export.js
 * 导出视图：载入底稿 xlsx（元数据替换 + 保真导出）/ 导出 JSON / 导出 Markdown。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
(function (global) {
  'use strict';
  var TMC = global.TMC;
  var Views = (global.TMCViews = global.TMCViews || {});

  Views.export = function (app, state, session, rerender) {
    var H = global.TMCAgendaHost;
    var root = global.document.getElementById('viewRoot');

    function render(status) {
      var m = session.meeting;
      var plan = session.plan || app.agenda.buildAgenda(m, { anchors: { startTime: m.start_time } });
      session.plan = plan;

      var html = [];
      html.push('<div class="card"><div class="card-title">③ 导出 / 底稿 Export</div>');
      html.push('<div class="hint">导出文件命名：<b>' + H.esc(exportName()) + '</b></div>');

      // 底稿上传
      html.push('<div class="drop-zone" id="drop">' +
        (session.baseEntries ? ('✅ 已载入底稿：' + zipSummary()) : '📎 点击或拖入最近一期议程 xlsx 作底稿（保真导出必需）') +
        '</div>');
      html.push('<input type="file" id="fileInput" accept=".xlsx" class="hidden">');

      // 替换表预览
      html.push('<div class="card-title" style="margin-top:16px">替换表 Edits（只读）</div>');
      var edits = app.agenda.buildCellEdits(plan, 3, 1);
      html.push('<div class="hint">共 ' + edits.length + ' 个单元格将被写入 sheet1（示例行 A/B/C 列）。</div>');

      // 按钮
      html.push('<div class="row" style="margin-top:14px">');
      html.push('<button class="btn" id="expXlsx"' + (session.baseEntries ? '' : ' disabled') + '>⬇️ 导出保真 xlsx</button>');
      html.push('<button class="btn ghost" id="expJson">⬇️ 导出 meeting.json</button>');
      html.push('<button class="btn ghost" id="expMd">⬇️ 导出议程 Markdown</button>');
      html.push('</div>');

      if (status) html.push('<div class="' + (status.ok ? 'ok-box' : 'warn-box') + '">' + H.esc(status.msg) + '</div>');

      html.push('<div class="warn-box" style="margin-top:14px">保真导出说明：直接改写底稿 ZIP 内的 ' +
        'sheet1.xml / sharedStrings.xml，保留 EMF / Logo / 二维码 / Drawing；改公式后自动删除 calcChain.xml。' +
        '导出后请用 Excel「打印到 Microsoft Print to PDF」出 PDF（勿用 WPS 或「导出为 PDF」）。</div>');
      html.push('</div>');

      html.push('<div class="row"><button class="btn ghost" id="backPreview">← 返回预览</button></div>');
      root.innerHTML = html.join('');

      bind();
    }

    function zipSummary() {
      if (!session.baseEntries) return '';
      var hasSheet = session.baseEntries.some(function (e) { return e.name === 'xl/worksheets/sheet1.xml'; });
      return session.baseEntries.length + ' entries' + (hasSheet ? '，含 sheet1' : '');
    }

    function exportName() {
      var m = session.meeting;
      var d = (m.date || '').replace(/-/g, '.');
      return d + '第 ' + (m.meeting_number || '?') + ' 次例会会议程表.xlsx';
    }

    function bind() {
      var drop = root.querySelector('#drop');
      var fileInput = root.querySelector('#fileInput');
      drop.onclick = function () { fileInput.click(); };
      drop.ondragover = function (e) { e.preventDefault(); drop.classList.add('hover'); };
      drop.ondragleave = function () { drop.classList.remove('hover'); };
      drop.ondrop = function (e) {
        e.preventDefault(); drop.classList.remove('hover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]);
      };
      fileInput.onchange = function () { if (fileInput.files[0]) readFile(fileInput.files[0]); };

      root.querySelector('#expXlsx').onclick = function () {
        if (!session.baseEntries) { render({ ok: false, msg: '请先载入底稿 xlsx。' }); return; }
        try {
          var plan = session.plan;
          var edits = app.agenda.buildCellEdits(plan, 3, 1);
          // 用 sharedStrings 方式写入（文本单元格）
          var entries = session.baseEntries.slice();
          // 1) sharedStrings 追加
          var sst = global.TMCZip.readText(entries, 'xl/sharedStrings.xml') || '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="0" uniqueCount="0"></sst>';
          var sheetXml = global.TMCZip.readText(entries, 'xl/worksheets/sheet1.xml') || '';
          edits.forEach(function (ed) {
            if (ed.isFormula) {
              sheetXml = global.TMCXml.setCell(sheetXml, ed.ref, ed.value, true);
            } else {
              var res = global.TMCXml.addSharedString(sst, ed.value);
              sst = res.xml;
              sheetXml = global.TMCXml.setCell(sheetXml, ed.ref, String(res.index), false);
            }
          });
          entries = global.TMCZip.writeText(entries, 'xl/sharedStrings.xml', sst);
          entries = global.TMCZip.writeText(entries, 'xl/worksheets/sheet1.xml', sheetXml);
          var bytes = global.TMCBaseTemplate.save(entries);
          var blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          var url = URL.createObjectURL(blob);
          var a = global.document.createElement('a');
          a.href = url; a.download = exportName(); a.click();
          setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
          render({ ok: true, msg: '已导出 ' + exportName() + '（保真，已删除 calcChain）。' });
        } catch (e) {
          render({ ok: false, msg: '导出失败：' + (e && e.message ? e.message : e) });
        }
      };

      root.querySelector('#expJson').onclick = function () {
        var m = session.meeting;
        m.agenda = (session.plan ? session.plan.rows.map(function (r) {
          return { segment_id: r.segment_id, type: r.type, title_zh: r.title_zh, presenter: r.presenter, duration_min: r.duration_min };
        }) : m.agenda);
        var blob = new Blob([JSON.stringify(TMC.meeting.normalize(m), null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = global.document.createElement('a');
        a.href = url; a.download = (m.meeting_id || 'meeting') + '.json'; a.click();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
        render({ ok: true, msg: '已导出 meeting.json。' });
      };

      root.querySelector('#expMd').onclick = function () {
        var vm = app.agenda.preview(session.plan);
        var md = TMC.report.toMarkdown(vm);
        var blob = new Blob(['\ufeff' + md], { type: 'text/markdown;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = global.document.createElement('a');
        a.href = url; a.download = 'agenda_' + (session.meeting.date || '') + '.md'; a.click();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
        render({ ok: true, msg: '已导出议程 Markdown。' });
      };

      root.querySelector('#backPreview').onclick = function () { state.view = 'preview'; H.render(); };
    }

    function readFile(file) {
      var reader = new FileReader();
      reader.onload = function () {
        var res = global.TMCBaseTemplate.load(reader.result);
        if (!res.ok) { render({ ok: false, msg: '底稿载入失败：' + res.errors.join('；') }); return; }
        session.baseEntries = res.entries;
        var rows = global.TMCBaseTemplate.detectRows(res.entries);
        render({ ok: true, msg: '底稿载入成功：' + res.entries.length + ' entries，数据行 ' + rows.minRow + '~' + rows.maxRow + '。' });
      };
      reader.readAsArrayBuffer(file);
    }

    render();
  };
})(typeof window !== 'undefined' ? window : globalThis);
