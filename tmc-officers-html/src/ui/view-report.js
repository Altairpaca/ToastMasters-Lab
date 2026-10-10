/* tmc-officers-html/src/ui/view-report.js
 * 报告视图：三官报告切换 + 三视图（渲染 / Markdown / 纯文本）+ 复制 / 下载 / PNG。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
(function (global) {
  'use strict';
  var TMC = global.TMC;
  var Views = (global.TMCViews = global.TMCViews || {});

  Views.report = function (app, state, rerender) {
    var H = global.TMCHost;
    var officer = app.officer;
    var root = global.document.getElementById('viewRoot');

    var kind = state.reportKind || 'timer';
    var view = state.reportView || 'render';

    function buildVm() {
      var meta = officer.getMeta();
      if (kind === 'ah') return officer.getReport('ah');
      if (kind === 'grammarian') return officer.getReport('grammarian');
      return officer.getReport('timer');
    }

    function render() {
      var vm = buildVm();
      var mdText = TMC.report.toMarkdown(vm);
      var plainText = TMC.report.toPlain(vm);

      var html = [];
      html.push('<div class="card">');
      html.push('<div class="card-title">📄 报告 Report</div>');

      // 三官切换
      html.push('<div class="rep-tabs">');
      html.push('<button class="rep-tab' + (kind === 'timer' ? ' active' : '') + '" data-kind="timer">⏱ 计时员</button>');
      html.push('<button class="rep-tab' + (kind === 'ah' ? ' active' : '') + '" data-kind="ah">🎙 哼哈官</button>');
      html.push('<button class="rep-tab' + (kind === 'grammarian' ? ' active' : '') + '" data-kind="grammarian">📖 语法官</button>');
      html.push('</div>');

      // 三视图切换
      html.push('<div class="rep-tabs">');
      html.push('<button class="rep-tab' + (view === 'render' ? ' active' : '') + '" data-view="render">渲染视图</button>');
      html.push('<button class="rep-tab' + (view === 'markdown' ? ' active' : '') + '" data-view="markdown">Markdown</button>');
      html.push('<button class="rep-tab' + (view === 'plain' ? ' active' : '') + '" data-view="plain">纯文本</button>');
      html.push('</div>');

      // 工具条
      html.push('<div class="report-tools">');
      html.push('<button class="btn sm" id="rCopy">📋 ' + (view === 'plain' ? '复制纯文本' : '复制 Markdown') + '</button>');
      html.push('<button class="btn sm ghost" id="rDownload">⬇️ ' + (view === 'plain' ? '下载 TXT' : '下载 MD') + '</button>');
      html.push('<button class="btn sm gold" id="rPng">🖼 下载图片 PNG</button>');
      html.push('</div>');

      // 内容
      if (view === 'render') {
        html.push('<div class="report-render" id="rRender"></div>');
      } else if (view === 'markdown') {
        html.push('<textarea id="rMd" readonly style="min-height:320px">' + H.esc(mdText) + '</textarea>');
      } else {
        html.push('<textarea id="rPlain" readonly style="min-height:320px">' + H.esc(plainText) + '</textarea>');
      }
      html.push('</div>');
      root.innerHTML = html.join('');

      if (view === 'render') {
        var box = root.querySelector('#rRender');
        box.innerHTML = TMC.md.toHtml(mdText);
        H.colorize(box);
      }

      // 绑定
      root.querySelectorAll('[data-kind]').forEach(function (b) {
        b.onclick = function () { kind = b.getAttribute('data-kind'); state.reportKind = kind; render(); };
      });
      root.querySelectorAll('[data-view]').forEach(function (b) {
        b.onclick = function () { view = b.getAttribute('data-view'); state.reportView = view; render(); };
      });
      root.querySelector('#rCopy').onclick = function (btn) {
        var text = view === 'plain' ? plainText : mdText;
        copyText(text, root.querySelector('#rCopy'));
      };
      root.querySelector('#rDownload').onclick = function () {
        var date = (officer.getMeta().date || H.todayStr());
        var isPlain = view === 'plain';
        H.downloadText(kind + '_Report_' + date + (isPlain ? '.txt' : '.md'),
          isPlain ? plainText : mdText,
          isPlain ? 'text/plain;charset=utf-8' : 'text/markdown;charset=utf-8');
      };
      root.querySelector('#rPng').onclick = function () {
        var date = (officer.getMeta().date || H.todayStr());
        H.downloadPng(kind + '_Report_' + date + '.png', buildVm());
      };
    }

    function copyText(text, btn) {
      if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
        global.navigator.clipboard.writeText(text).then(function () { H.flash('已复制 ✓', btn); },
          function () { fallbackCopy(text, btn); });
      } else { fallbackCopy(text, btn); }
    }

    function fallbackCopy(text, btn) {
      var ta = global.document.createElement('textarea');
      ta.value = text;
      global.document.body.appendChild(ta);
      ta.select();
      try { global.document.execCommand('copy'); } catch (e) {}
      global.document.body.removeChild(ta);
      H.flash('已复制 ✓', btn);
    }

    render();
  };
})(typeof window !== 'undefined' ? window : globalThis);
