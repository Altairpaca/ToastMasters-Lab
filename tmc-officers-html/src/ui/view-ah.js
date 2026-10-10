/* tmc-officers-html/src/ui/view-ah.js
 * 哼哈官视图：中英赘词/过渡词词钮统计、讲者人员、时间线、报告生成。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
(function (global) {
  'use strict';
  var TMC = global.TMC;
  var Views = (global.TMCViews = global.TMCViews || {});

  Views.ah = function (app, state, rerender) {
    var H = global.TMCHost;
    var officer = app.officer;
    var root = global.document.getElementById('viewRoot');

    // 会议语言（词钮用中文词还是英文词）
    var meetingLang = 'zh';
    var currentMember = '';
    var members = [];

    var saved = global.TMCStore ? global.TMCStore.load('ah') : null;
    if (saved) {
      if (saved.members) members = saved.members.slice();
      if (saved.currentMember) currentMember = saved.currentMember;
      if (saved.records) saved.records.forEach(function (r) { restoreRecord(r); });
    }

    function restoreRecord(r) {
      Object.keys(r.counts || {}).forEach(function (w) { officer.bumpAh(r.member_id, w, r.counts[w]); });
      if (r.minutes) officer.setAhMinutes(r.member_id, r.minutes);
    }

    function wordsForLang() {
      return officer.getAhWords().filter(function (w) { return w.lang === meetingLang; });
    }

    function render() {
      var words = wordsForLang();
      var settings = officer.getAhSettings();
      var recs = officer.getAhRecords();
      var totalFillers = recs.reduce(function (a, r) {
        return a + Object.keys(r.counts).reduce(function (b, k) { return b + r.counts[k]; }, 0);
      }, 0);

      var html = [];
      html.push('<div class="card">');
      html.push('<div class="card-title">🎙 哼哈官 Ah-Counter</div>');
      html.push('<div class="stat-row">');
      html.push('<div class="stat"><div class="num">' + totalFillers + '</div><div class="label">总赘词 Total</div></div>');
      html.push('<div class="stat"><div class="num">' + recs.length + '</div><div class="label">讲者 Speakers</div></div>');
      html.push('<div class="stat"><div class="num">' + members.length + '</div><div class="label">登记人数</div></div>');
      html.push('</div>');

      // 语言切换
      html.push('<div class="row">');
      html.push('<button class="btn sm ' + (meetingLang === 'zh' ? '' : 'ghost') + '" id="langZh">中文词表</button>');
      html.push('<button class="btn sm ' + (meetingLang === 'en' ? '' : 'ghost') + '" id="langEn">English 词表</button>');
      html.push('<div class="spacer" style="flex:1"></div>');
      html.push('</div>');

      // 当前讲者
      html.push('<div class="row">');
      html.push('<div class="field"><label>当前讲者 Current speaker</label>' +
        '<input type="text" id="ahMember" placeholder="输入姓名后回车" value="' + H.esc(currentMember) + '"></div>');
      html.push('<button class="btn sm" id="ahAddMember">＋ 登记</button>');
      html.push('</div>');

      // 词钮
      html.push('<div class="word-grid" id="wordGrid"></div>');
      html.push('<div class="hint">点词钮 +1；赘词进入报表阈值 ' + settings.fTh + ' 次，过渡词 ' + settings.oTh + ' 次。</div>');
      html.push('<div class="row" style="margin-top:10px">');
      html.push('<input type="text" id="ahCustom" placeholder="添加自定义词…" style="max-width:200px">');
      html.push('<button class="btn sm ghost" id="ahAddWord">＋ 加词</button>');
      html.push('<button class="btn sm ghost" id="ahReport">📄 生成报告</button>');
      html.push('</div>');
      html.push('</div>');

      // 记录表
      html.push('<div class="card"><div class="card-title">按讲者统计 Per-speaker</div>');
      if (!recs.length) html.push('<div class="empty-tip">还没有计数。</div>');
      else {
        html.push('<table class="data-table"><thead><tr><th>讲者</th><th class="num">总赘词</th><th>高频词</th></tr></thead><tbody>');
        recs.forEach(function (r) {
          var total = Object.keys(r.counts).reduce(function (a, k) { return a + r.counts[k]; }, 0);
          var hot = Object.keys(r.counts).sort(function (a, b) { return r.counts[b] - r.counts[a]; }).slice(0, 3);
          html.push('<tr><td>' + H.esc(r.member_id) + '</td><td class="num">' + total + '</td><td>' +
            hot.map(function (w) { return H.esc(w) + '×' + r.counts[w]; }).join('、') + '</td></tr>');
        });
        html.push('</tbody></table>');
      }
      html.push('</div>');
      root.innerHTML = html.join('');

      // 渲染词钮
      var grid = root.querySelector('#wordGrid');
      words.forEach(function (w) {
        var cnt = countFor(w.w);
        var cls = w.cls === 'filler' ? 'filler' : 'overused';
        var hot = cnt >= (w.cls === 'overused' ? settings.oTh : settings.fTh);
        var b = global.document.createElement('button');
        b.className = 'word-btn ' + cls + (hot ? ' hot' : '');
        b.innerHTML = H.esc(w.w) + '<span class="cnt">' + cnt + '</span>';
        b.onclick = function () { bump(w.w, 1); };
        b.oncontextmenu = function (e) { e.preventDefault(); bump(w.w, -1); };
        grid.appendChild(b);
      });

      bind();
    }

    function countFor(word) {
      var m = currentMember || '（未命名）';
      var rec = officer.getAhRecords().filter(function (r) { return r.member_id === m; })[0];
      return rec ? (rec.counts[word] || 0) : 0;
    }

    function bump(word, delta) {
      var m = currentMember || '（未命名）';
      officer.bumpAh(m, word, delta);
      persist();
      render();
    }

    function bind() {
      root.querySelector('#langZh').onclick = function () { meetingLang = 'zh'; render(); };
      root.querySelector('#langEn').onclick = function () { meetingLang = 'en'; render(); };
      var memEl = root.querySelector('#ahMember');
      memEl.onchange = function () { currentMember = memEl.value.trim(); persist(); render(); };
      memEl.onkeydown = function (e) { if (e.key === 'Enter') { currentMember = memEl.value.trim(); persist(); render(); } };
      root.querySelector('#ahAddMember').onclick = function () {
        var v = memEl.value.trim();
        if (v && members.indexOf(v) < 0) members.push(v);
        currentMember = v;
        persist(); render();
      };
      root.querySelector('#ahAddWord').onclick = function () {
        var el = root.querySelector('#ahCustom');
        var w = el.value.trim();
        if (!w) return;
        var words = officer.getAhWords();
        if (!words.some(function (x) { return x.w === w; })) {
          words.push({ w: w, cls: 'filler', lang: TMC.data.wordlistAh.guessWordLang(w), gloss: '' });
          officer.setAhWords(words);
        }
        el.value = '';
        persist(); render();
      };
      root.querySelector('#ahReport').onclick = function () { state.view = 'report'; state.reportKind = 'ah'; H.render(); };
    }

    function persist() {
      if (!global.TMCStore) return;
      global.TMCStore.save('ah', {
        members: members, currentMember: currentMember,
        records: officer.getAhRecords().map(function (r) { return { member_id: r.member_id, counts: r.counts, minutes: r.minutes }; }),
      });
    }

    render();
  };
})(typeof window !== 'undefined' ? window : globalThis);
