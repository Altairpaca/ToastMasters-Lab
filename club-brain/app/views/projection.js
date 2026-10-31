/* Club Console · 投屏模式（给全场看的大屏） */
(function () {
  const CC = (window.CC = window.CC || {});
  CC.views = CC.views || {};
  const { h } = CC.dom;

  let tickId = null;

  function stop() {
    if (tickId) { clearInterval(tickId); tickId = null; }
    document.body.classList.remove('projecting');
    document.title = 'Club Console · 头马俱乐部运营台';
  }

  function render(root) {
    stop();
    document.body.classList.add('projecting');
    const S = CC.state;
    const m = S.activeMeeting();
    if (!m) { root.appendChild(h('div', { class: 'empty' }, '没有会议。')); return; }
    const l = m.live;

    if (!l) {
      root.appendChild(h('div', { class: 'proj-empty' },
        h('div', { style: { fontSize: '28px', marginBottom: '14px' } }, '投屏待机'),
        h('div', { class: 'muted' }, '在「会中」点击开始后，这里会同步显示。'),
        h('div', { style: { marginTop: '20px' } },
          h('button', { class: 'btn', on: { click: () => CC.app.go('live') } }, '去会中'))
      ));
      return;
    }

    const idx = l.index;
    const seg = m.segments[idx] || null;
    const next = m.segments[idx + 1] || null;
    const planned = seg ? Number(seg.minutes) * 60 : 0;

    const timeEl = h('div', { class: 'proj-time' }, '00:00');
    const lights = ['green', 'yellow', 'red'].map((c) => h('div', { class: 'light ' + c, dataset: { light: c } }));

    root.appendChild(h('div', { class: 'proj' },
      h('div', { class: 'proj-head' },
        h('div', { class: 'proj-club' }, S.data.club.name),
        h('div', { class: 'proj-meta' }, '第 ' + m.meetingNo + ' 次　·　' + m.date + '　·　' + (m.theme || ''))
      ),
      h('div', { class: 'proj-body' },
        h('div', { class: 'proj-seg' }, '当前：' + (seg ? seg.name : '—')),
        timeEl,
        h('div', { class: 'lights', style: { transform: 'scale(1.5)', transformOrigin: 'center', margin: '6px 0 12px' } }, lights),
        h('div', { class: 'proj-sub' }, seg ? (seg.owner ? seg.owner + '　·　计划 ' + seg.minutes + ' 分钟' : '计划 ' + seg.minutes + ' 分钟') : ''),
        h('div', { class: 'proj-next' }, next ? '下一项：' + next.name + (next.owner ? ' · ' + next.owner : '') + '（' + next.minutes + "'）" : '本场最后一项')
      ),
      h('div', { class: 'proj-foot' },
        h('span', null, '进度 ' + (idx + 1) + ' / ' + m.segments.length),
        h('span', null, (m.start || '') + ' – ' + (m.end || '')),
        h('span', null, '按 Esc 退出投屏')
      )
    ));

    function paint() {
      const elapsed = CC.state.liveElapsedSeconds(m);
      const remain = planned - elapsed;
      let cls = '';
      let text;
      if (remain >= 0) {
        text = CC.dom.fmtSeconds(remain);
        const ratio = planned ? elapsed / planned : 0;
        if (ratio >= 1) cls = 'red';
        else if (ratio >= 0.85) cls = 'yellow';
        else if (ratio >= 0.7) cls = 'green';
      } else {
        text = '+' + CC.dom.fmtSeconds(-remain);
        cls = 'over';
      }
      timeEl.textContent = text;
      timeEl.className = 'proj-time ' + cls;
      lights.forEach((node) => {
        const c = node.dataset.light;
        const on = (c === 'green' && cls === 'green') || (c === 'yellow' && cls === 'yellow') ||
          (c === 'red' && (cls === 'red' || cls === 'over'));
        node.classList.toggle('on', on);
      });
      document.title = (l.runningSince ? '● ' : '') + text + ' · ' + (seg ? seg.name : '');
    }
    paint();
    tickId = setInterval(paint, 250);
  }

  CC.views.projection = { render, stop };
})();
