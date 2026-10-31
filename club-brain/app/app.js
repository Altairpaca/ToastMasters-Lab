/* Club Console · 应用外壳与路由 */
(function () {
  const CC = (window.CC = window.CC || {});
  const { h, icon, toast, download, modal } = CC.dom;

  const TABS = [
    { id: 'dashboard', label: '总览' },
    { id: 'agenda', label: '议程' },
    { id: 'live', label: '会中' },
    { id: 'retro', label: '复盘' },
    { id: 'members', label: '会员与 DCP' },
    { id: 'projection', label: '投屏' },
  ];

  let current = 'dashboard';
  let viewEl = null;
  let topEl = null;
  let statusEl = null;
  let wired = false;

  function go(view) {
    if (!CC.views[view]) return;
    if (current === 'live' && view !== 'live' && CC.views.live.stop) CC.views.live.stop();
    if (current === 'projection' && view !== 'projection' && CC.views.projection.stop) CC.views.projection.stop();
    current = view;
    render();
  }

  function render() {
    const S = CC.state;
    const m = S.activeMeeting();
    // 视图容器
    CC.dom.clear(viewEl);
    const view = CC.views[current];
    if (view) view.render(viewEl);

    // 顶部栏
    CC.dom.clear(topEl);
    const store = S.meetings();
    topEl.appendChild(h('div', { class: 'brand' },
      h('div', { class: 'mark' }, 'CC'),
      h('div', null,
        h('div', null, 'Club Console'),
        h('small', null, S.data.club.name)
      )
    ));

    topEl.appendChild(h('nav', { class: 'tabs' }, TABS.map((t) => h('button', {
      class: 'tab ' + (current === t.id ? 'active' : ''),
      on: { click: () => go(t.id) },
    }, t.label,
      t.id === 'agenda' && m ? (() => {
        const rep = S.lint(m);
        return h('span', {
          class: 'dot',
          style: { background: rep.ok ? 'var(--ok)' : 'var(--err)' },
        });
      })() : null))));

    topEl.appendChild(h('div', { class: 'spacer' }));

    topEl.appendChild(h('div', { class: 'select-meeting' },
      h('select', {
        value: m ? m.id : '',
        on: { change: (e) => S.setActive(e.target.value) },
      }, store.map((mm) => h('option', { value: mm.id },
        '#' + mm.meetingNo + ' · ' + mm.date + ' · ' + ({ draft: '起草', locked: '定稿', live: '进行中', done: '归档' }[mm.status] || mm.status)))),
      h('button', { class: 'btn sm', title: '新建会议', on: { click: () => { S.addMeeting(); toast('已新建一期', 'ok'); go('agenda'); } } }, icon('plus')),
      h('button', { class: 'btn sm', title: '复制本期', on: { click: () => { S.duplicateMeeting(S.data.activeMeetingId); toast('已复制为下一期', 'ok'); } } }, '复制')
    ));

    topEl.appendChild(h('div', { class: 'row', style: { gap: '6px' } },
      h('button', { class: 'btn sm ghost', title: '撤销 Ctrl+Z', disabled: !S.canUndo(), on: { click: () => S.undo() } }, '撤销'),
      h('button', { class: 'btn sm ghost', title: '备份为 JSON', on: { click: () => download('club-console-backup.json', S.fullJson(), 'application/json') } }, '备份'),
      h('button', { class: 'btn sm ghost', title: '从备份恢复', on: { click: openImport } }, '恢复'),
      h('button', { class: 'btn sm ghost', title: '快捷键', on: { click: openHelp } }, '?')
    ));

    // 状态栏
    CC.dom.clear(statusEl);
    const rep = m ? S.lint(m) : null;
    statusEl.appendChild(h('span', null, S.data.club.name + ' · ' + S.data.club.city));
    statusEl.appendChild(h('span', { class: 'sep' }, '|'));
    statusEl.appendChild(h('span', null, m ? ('第 ' + m.meetingNo + ' 次 · ' + m.date + ' · ' + m.status) : '无会议'));
    statusEl.appendChild(h('span', { class: 'sep' }, '|'));
    if (rep) {
      statusEl.appendChild(h('span', null,
        '断言 ', h('b', { style: { color: rep.ok ? 'var(--ok)' : 'var(--err)' } }, rep.ok ? '通过' : '阻断'),
        ' · 评分 ', h('b', null, String(rep.score)),
        ' · 结束 ', h('b', { style: { color: rep.totals.slackMinutes < 0 ? 'var(--err)' : 'inherit' } }, rep.totals.endText || '—')
      ));
    }
    statusEl.appendChild(h('div', { class: 'spacer' }));
    const mode = CC.sync ? CC.sync.status() : 'local';
    const modeText = { lan: '局域网同步', reconnecting: '同步中断·重连中', local: '单机模式' }[mode] || '单机模式';
    statusEl.appendChild(h('span', { style: { color: mode === 'lan' ? 'var(--ok)' : mode === 'reconnecting' ? 'var(--warn)' : 'inherit' } },
      '● ' + modeText));
    statusEl.appendChild(h('span', { class: 'sep' }, '|'));
    statusEl.appendChild(h('span', null, S.storageOk() ? '本地存储已启用' : '本地存储不可用（仅内存）'));
    statusEl.appendChild(h('span', { class: 'sep' }, '|'));
    statusEl.appendChild(h('span', null, '撤销栈 ' + (S.canUndo() ? '可用' : '空')));
    statusEl.appendChild(h('span', { class: 'sep' }, '|'));
    statusEl.appendChild(h('span', null, 'v' + (CC.VERSION || '2.0.0')));
  }

  function openImport() {
    const input = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          CC.state.importJson(String(reader.result));
          toast('已恢复备份', 'ok');
        } catch (err) {
          toast('恢复失败：' + err.message, 'err');
        }
      };
      reader.readAsText(file);
    });
    document.body.appendChild(input);
    input.click();
    setTimeout(() => input.remove(), 1000);
  }

  function openHelp() {
    const rows = [
      ['1 – 5', '切换视图'],
      ['Ctrl / ⌘ + Z', '撤销'],
      ['Ctrl / ⌘ + Shift + Z', '重做'],
      ['空格', '会中：开始 / 暂停计时'],
      ['N', '会中：完成当前环节'],
      ['Esc', '关闭弹层 / 回到总览'],
    ];
    modal({
      title: '快捷键与说明',
      sub: '数据只存在这台电脑的浏览器里，不上传任何服务器。记得定期「备份」。',
      body: h('div', null,
        h('table', { class: 'data' },
          h('thead', null, h('tr', null, h('th', null, '按键'), h('th', null, '作用'))),
          h('tbody', null, rows.map(([k, v]) => h('tr', null, h('td', { class: 'mono' }, k), h('td', null, v))))
        ),
        h('div', { class: 'small muted', style: { marginTop: '14px', lineHeight: '1.8' } },
          'Club Console 把「议程 → 会中 → 三官记录 → 复盘 → DCP」串成一条链：',
          '议程改一次，计时器 CSV、会单、投屏、复盘、问卷所需字段全部同步。',
          '所有断言来自 agenda-lint，共 20 余条规则，可追溯到具体环节。')
      ),
    });
  }

  function bindKeys() {
    if (wired) return;
    wired = true;
    window.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      const typing = /INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable);
      const meta = e.ctrlKey || e.metaKey;

      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) CC.state.redo(); else CC.state.undo();
        return;
      }
      if (meta && e.key.toLowerCase() === 'y') { e.preventDefault(); CC.state.redo(); return; }
      if (typing) return;

      if (e.key === 'Escape') {
        const back = document.querySelector('.modal-backdrop');
        if (back) back.remove();
        else if (current !== 'dashboard') go('dashboard');
        return;
      }
      if (/^[1-6]$/.test(e.key)) {
        const tab = TABS[Number(e.key) - 1];
        if (tab) go(tab.id);
        return;
      }
      if (e.key.toLowerCase() === 'p' && (current === 'live' || current === 'projection')) {
        e.preventDefault();
        go(current === 'projection' ? 'live' : 'projection');
        return;
      }
      if (current === 'live') {
        const m = CC.state.activeMeeting();
        if (!m || !m.live) return;
        if (e.code === 'Space') { e.preventDefault(); CC.state.liveToggle(m.id); }
        if (e.key.toLowerCase() === 'n') { e.preventDefault(); CC.state.liveFinish(m.id); }
      }
    });
  }

  function init() {
    viewEl = document.getElementById('view');
    topEl = document.getElementById('topbar');
    statusEl = document.getElementById('statusbar');
    CC.state.init();
    const q = new URLSearchParams(location.search).get('view');
    if (q && CC.views[q]) current = q;
    bindKeys();
    CC.state.subscribe(() => render());
    render();
    if (CC.sync) {
      CC.sync.onStatus(() => render());
      CC.sync.init();
    }
    if (!CC.state.storageOk()) {
      toast('浏览器禁用了本地存储，本次改动不会保存。请用 Chrome/Edge 打开，或改用「备份」导出。', 'err');
    }
  }

  CC.app = { init, go, render, get view() { return current; } };
  document.addEventListener('DOMContentLoaded', init);
})();
