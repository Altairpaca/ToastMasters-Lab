/* tmc-officers-html/src/ui/view-grammarian.js
 * 语法官视图：每日一词、人员点选计数、妙语/改进记录、报告生成。
 * ASR（联网增强）入口在离线时隐藏，不报错。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
(function (global) {
  'use strict';
  var TMC = global.TMC;
  var Views = (global.TMCViews = global.TMCViews || {});

  Views.grammarian = function (app, state, rerender) {
    var H = global.TMCHost;
    var officer = app.officer;
    var root = global.document.getElementById('viewRoot');

    var word = { word: '', pos: '', defEn: '', defZh: '' };
    var members = [];   // [{name, wod}]

    var saved = global.TMCStore ? global.TMCStore.load('grammarian') : null;
    if (saved) {
      if (saved.word) word = saved.word;
      if (saved.members) {
        members = saved.members.slice();
        members.forEach(function (m) {
          officer.addGrammarian({ member_id: m.name });
          for (var i = 0; i < m.wod; i++) officer.addGrammarian({ member_id: m.name, wod: true });
        });
      }
    }

    function render() {
      var recs = officer.getGrammarianRecords();
      var totalWod = recs.reduce(function (a, r) { return a + r.wod_count; }, 0);

      var html = [];
      html.push('<div class="card">');
      html.push('<div class="card-title">📖 语法官 Grammarian</div>');

      // 每日一词
      html.push('<div class="row">');
      html.push('<div class="field"><label>每日一词 Word</label><input type="text" id="gWord" value="' + H.esc(word.word) + '"></div>');
      html.push('<div class="field"><label>词性 POS</label><input type="text" id="gPos" value="' + H.esc(word.pos) + '"></div>');
      html.push('</div>');
      html.push('<div class="row">');
      html.push('<div class="field"><label>英文释义</label><input type="text" id="gDefEn" value="' + H.esc(word.defEn) + '"></div>');
      html.push('<div class="field"><label>中文释义</label><input type="text" id="gDefZh" value="' + H.esc(word.defZh) + '"></div>');
      html.push('</div>');

      // 开场 Script（自动生成）
      html.push('<div class="hint">🎤 开场介绍 Script（照读即可）：</div>');
      html.push('<textarea id="gScript" readonly>' + H.esc(script()) + '</textarea>');

      // 人员
      html.push('<div class="row" style="margin-top:10px">');
      html.push('<input type="text" id="gPerson" placeholder="发言人姓名，回车登记" style="max-width:200px">');
      html.push('<button class="btn sm" id="gAdd">＋ 登记</button>');
      html.push('<button class="btn sm ghost" id="gResetCounts">计数清零</button>');
      html.push('</div>');
      html.push('<div class="person-chips" id="chips"></div>');

      // 妙语 / 改进
      html.push('<div class="row" style="margin-top:12px">');
      html.push('<input type="text" id="gNote" placeholder="妙语 / 可改进用法…">');
      html.push('<button class="btn sm gold" id="gGood">✨ 妙语</button>');
      html.push('<button class="btn sm ghost" id="gFix">⚠️ 改进</button>');
      html.push('</div>');

      // 记录
      html.push('<ul class="log-list" id="gLogs"></ul>');
      html.push('<div class="row" style="margin-top:10px"><button class="btn sm" id="gReport">📄 生成报告</button>');
      html.push('<span class="hint">每日一词使用合计 ' + totalWod + ' 次</span></div>');
      html.push('</div>');
      root.innerHTML = html.join('');

      // 人员 chip
      var chips = root.querySelector('#chips');
      members.forEach(function (m, i) {
        var c = global.document.createElement('button');
        c.className = 'person-chip';
        c.innerHTML = H.esc(m.name) + (m.wod > 0 ? '<span class="wod">×' + m.wod + '</span>' : '');
        c.onclick = function () { bumpWod(i); };
        c.oncontextmenu = function (e) { e.preventDefault(); delPerson(i); };
        chips.appendChild(c);
      });

      // 日志
      var logs = root.querySelector('#gLogs');
      var recs2 = officer.getGrammarianRecords();
      var flat = [];
      recs2.forEach(function (r) {
        r.good_phrases.forEach(function (p) { flat.push({ name: r.member_id, type: 'good', text: p }); });
        r.corrections.forEach(function (p) { flat.push({ name: r.member_id, type: 'fix', text: p }); });
      });
      if (!flat.length) logs.innerHTML = '<li class="hint">还没有记录。听到妙语或可改进用法随手记。</li>';
      flat.slice().reverse().forEach(function (l) {
        var li = global.document.createElement('li');
        li.innerHTML = '<span class="who">' + H.esc(l.name) + '</span>' +
          (l.type === 'good' ? '✨' : '⚠️') + ' ' + H.esc(l.text);
        logs.appendChild(li);
      });

      // ASR 入口（离线隐藏）
      if (H.netAvailable) {
        var asr = global.document.createElement('div');
        asr.className = 'hint';
        asr.textContent = '🎧 语音识别（ASR）：已检测到联网能力，可开启自动提醒每日一词。';
        root.querySelector('.card').appendChild(asr);
      }

      bind();
    }

    function script() {
      if (!word.word) return '填写上方「每日一词」后，这里自动生成开场 Script（英文，照读即可）。';
      return 'Greetings everyone! Our Word of the Day is "' + word.word + '"' +
        (word.pos ? ' (' + word.pos + ')' : '') + '. ' +
        (word.defEn ? 'It means ' + word.defEn + '. ' : '') +
        'Please try to use it in your speeches today.';
    }

    function bumpWod(i) {
      members[i].wod += 1;
      officer.addGrammarian({ member_id: members[i].name, wod: true });
      persist(); render();
    }

    function delPerson(i) {
      members.splice(i, 1);
      persist(); render();
    }

    function bind() {
      function syncWord() {
        word.word = root.querySelector('#gWord').value.trim();
        word.pos = root.querySelector('#gPos').value.trim();
        word.defEn = root.querySelector('#gDefEn').value.trim();
        word.defZh = root.querySelector('#gDefZh').value.trim();
        root.querySelector('#gScript').value = script();
        persist();
      }
      ['#gWord', '#gPos', '#gDefEn', '#gDefZh'].forEach(function (sel) {
        root.querySelector(sel).oninput = syncWord;
      });
      root.querySelector('#gAdd').onclick = function () {
        var el = root.querySelector('#gPerson');
        var name = el.value.trim();
        if (name && !members.some(function (m) { return m.name === name; })) {
          members.push({ name: name, wod: 0 });
          officer.addGrammarian({ member_id: name });
          el.value = '';
          persist(); render();
        }
      };
      root.querySelector('#gPerson').onkeydown = function (e) { if (e.key === 'Enter') root.querySelector('#gAdd').click(); };
      root.querySelector('#gResetCounts').onclick = function () {
        if (!global.confirm('把所有发言人的每日一词计数清零？')) return;
        members.forEach(function (m) { m.wod = 0; });
        persist(); render();
      };
      root.querySelector('#gGood').onclick = function () { addNote('good'); };
      root.querySelector('#gFix').onclick = function () { addNote('fix'); };
      root.querySelector('#gReport').onclick = function () { state.view = 'report'; state.reportKind = 'grammarian'; H.render(); };
    }

    function addNote(type) {
      var el = root.querySelector('#gNote');
      var text = el.value.trim();
      if (!text) return;
      var name = currentFirstMember();
      if (type === 'good') officer.addGrammarian({ member_id: name, good: text });
      else officer.addGrammarian({ member_id: name, correction: text });
      el.value = '';
      persist(); render();
    }

    function currentFirstMember() {
      return members.length ? members[members.length - 1].name : '（未命名）';
    }

    function persist() {
      if (!global.TMCStore) return;
      global.TMCStore.save('grammarian', { word: word, members: members });
    }

    render();
  };
})(typeof window !== 'undefined' ? window : globalThis);
