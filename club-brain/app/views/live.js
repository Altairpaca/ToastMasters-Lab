/* Club Console · 会中驾驶舱 */
(function () {
  const CC = (window.CC = window.CC || {});
  CC.views = CC.views || {};
  const { h, icon, toast } = CC.dom;

  let tickId = null;

  function stop() {
    if (tickId) { clearInterval(tickId); tickId = null; }
  }

  function render(root) {
    stop();
    const S = CC.state;
    const m = S.activeMeeting();
    if (!m) { root.appendChild(h('div', { class: 'empty' }, '没有会议。')); return; }

    const l = m.live;
    if (!l || m.status === 'draft') {
      root.appendChild(h('div', { class: 'empty' },
        h('div', { style: { fontSize: '15px', marginBottom: '10px' } }, m.status === 'draft' ? '议程还在起草，先定稿再开会。' : '本场尚未开始。'),
        h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '12px' } },
          h('button', { class: 'btn', on: { click: () => CC.app.go('agenda') } }, '去议程工作台'),
          h('button', {
            class: 'btn primary', disabled: m.status === 'draft',
            on: { click: () => { S.liveStart(m.id); } },
          }, icon('play'), '开始本场')
        )
      ));
      return;
    }

    const idx = l.index;
    const seg = m.segments[idx] || null;
    const planned = seg ? Number(seg.minutes) * 60 : 0;
    const people = S.allPeople(m);
    const words = CC.state.data.counterWords || ['嗯', '那个', '然后'];

    /* ---------- 左：时钟 ---------- */
    const timeEl = h('div', { class: 'clock-time' }, '00:00');
    const subEl = h('div', { class: 'clock-sub' }, '');
    const segEl = h('div', { class: 'clock-seg' },
      h('span', { class: 'tag blue' }, '第 ' + (idx + 1) + ' / ' + m.segments.length + ' 项'),
      h('span', null, seg ? seg.name : '—'),
      h('span', { class: 'muted small' }, seg && seg.owner ? '· ' + seg.owner : ''),
      h('span', { class: 'grow' }),
      h('span', { class: 'muted small mono' }, seg ? '计划 ' + seg.minutes + ':00' : '')
    );

    const lights = ['green', 'yellow', 'red'].map((c) => h('div', { class: 'light ' + c, dataset: { light: c } }));

    const clockPanel = h('div', { class: 'clock-panel' },
      segEl,
      timeEl,
      subEl,
      h('div', { class: 'lights' }, lights),
      h('div', { class: 'clock-actions' },
        h('button', {
          class: 'btn', on: { click: () => S.liveReset(m.id) },
        }, '归零'),
        h('button', {
          class: 'btn primary huge', on: { click: () => S.liveToggle(m.id) },
        }, l.runningSince ? icon('pause') : icon('play'), l.runningSince ? '暂停' : '开始'),
        h('button', {
          class: 'btn', on: { click: () => S.liveFinish(m.id) },
        }, '完成 → 下一项'),
        h('button', {
          class: 'btn ghost', on: { click: () => S.livePrev(m.id) },
        }, icon('prev'), '上一项')
      ),
      h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '4px' } },
        h('button', {
          class: 'btn danger', on: {
            click: () => {
              if (confirm('结束本场并生成复盘？')) S.liveEnd(m.id);
            },
          },
        }, '结束本场并生成复盘')
      )
    );

    /* ---------- 左：队列 ---------- */
    const queue = h('div', { class: 'card' },
      h('div', { class: 'row', style: { marginBottom: '8px' } },
        h('h3', { style: { margin: 0 } }, '流程'),
        h('div', { class: 'grow' }),
        h('span', { class: 'small muted' }, '已完成 ' + m.records.timing.length + ' / ' + m.segments.length)
      ),
      h('div', { class: 'queue' }, m.segments.map((s, i) => {
        const rec = m.records.timing.find((t) => t.segmentId === s.id || t.segment === s.name);
        const cls = i === idx ? 'current' : rec ? 'done' : '';
        return h('div', { class: 'queue-item ' + cls },
          h('span', { class: 'idx' }, String(i + 1).padStart(2, '0')),
          h('span', { class: 'nm' }, s.name + (s.owner ? '  ·  ' + s.owner : '')),
          rec ? h('span', {
            class: 'tag ' + (rec.actual > rec.planned ? 'red' : 'green'),
            style: { padding: '0 6px' },
          }, rec.actual.toFixed(1) + "'") : null,
          h('span', { class: 'tm' }, s.minutes + "'")
        );
      }))
    );

    /* ---------- 右：哼哈计数 ---------- */
    const ahTotal = (person) => Object.values(m.records.ah[person] || {}).reduce((a, b) => a + b, 0);
    const counterCard = h('div', { class: 'card' },
      h('div', { class: 'row', style: { marginBottom: '8px' } },
        h('h3', { style: { margin: 0 } }, '哼哈官'),
        h('div', { class: 'grow' }),
        h('span', { class: 'small muted' }, '点击词语 +1')
      ),
      people.length ? h('div', { style: { display: 'grid', gap: '8px' } },
        people.map((p) => h('div', { class: 'counter', style: { flexWrap: 'wrap' } },
          h('span', { class: 'nm' }, p),
          h('span', { class: 'n' }, String(ahTotal(p))),
          h('div', { class: 'row', style: { gap: '4px', width: '100%', marginTop: '4px' } },
            words.map((w) => {
              const c = (m.records.ah[p] || {})[w] || 0;
              return h('button', {
                class: 'chip ' + (c ? 'on' : ''),
                style: { fontSize: '11.5px', padding: '1px 8px' },
                on: {
                  click: () => S.addAh(m.id, p, w),
                  contextmenu: (e) => { e.preventDefault(); S.removeAh(m.id, p, w); },
                },
              }, w + (c ? ' ×' + c : ''));
            })
          )
        ))
      ) : h('div', { class: 'small muted' }, '议程里还没有人员。')
    );

    /* ---------- 右：语法官 ---------- */
    const goodInput = h('input', { type: 'text', placeholder: '好词好句，回车添加' });
    const issueInput = h('input', { type: 'text', placeholder: '语法/用词问题，回车添加' });
    const grammarCard = h('div', { class: 'card' },
      h('h3', null, '语法官'),
      h('div', { class: 'small muted', style: { marginBottom: '4px' } }, '好词好句（' + m.records.grammar.good.length + '）'),
      h('div', { class: 'chips', style: { marginBottom: '8px' } },
        m.records.grammar.good.map((t, i) => h('span', { class: 'tag green' }, t,
          h('span', { style: { cursor: 'pointer', marginLeft: '4px' }, on: { click: () => S.removeGrammar(m.id, 'good', i) } }, '×')))),
      goodInput,
      h('div', { class: 'small muted', style: { margin: '10px 0 4px' } }, '问题（' + m.records.grammar.issues.length + '）'),
      h('div', { style: { display: 'grid', gap: '4px', marginBottom: '8px' } },
        m.records.grammar.issues.map((it, i) => h('div', { class: 'row small' },
          h('span', { class: 'tag yellow' }, it.type || '问题'),
          h('span', { class: 'grow' }, it.text),
          h('span', { class: 'muted' }, '→ ' + (it.fix || '')),
          h('span', { style: { cursor: 'pointer' }, on: { click: () => S.removeGrammar(m.id, 'issues', i) } }, '×')))),
      issueInput
    );

    goodInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.value.trim()) {
        CC.state.addGrammar(m.id, 'good', e.target.value.trim());
      }
    });
    issueInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.value.trim()) {
        CC.state.addGrammar(m.id, 'issues', { type: '用词', text: e.target.value.trim(), fix: '' });
      }
    });

    /* ---------- 右：实时日志 ---------- */
    const logCard = h('div', { class: 'card' },
      h('h3', null, '记录'),
      h('div', { class: 'log-list' },
        (l.log || []).slice(-14).reverse().map((row) => h('div', { class: 'log-row' },
          h('span', { class: 't' }, new Date(row.t).toTimeString().slice(0, 5)),
          h('span', null, row.text)
        )) || h('div', { class: 'small muted' }, '暂无')
      )
    );

    root.appendChild(h('div', { class: 'live-wrap' },
      h('div', { class: 'grid', style: { gap: '14px' } }, clockPanel, queue),
      h('div', { class: 'grid', style: { gap: '14px' } }, counterCard, grammarCard, logCard)
    ));

    /* ---------- 计时循环：只改文本，不重渲染 ---------- */
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
      timeEl.className = 'clock-time ' + cls;
      subEl.textContent = '已用 ' + CC.dom.fmtSeconds(elapsed) + (planned ? '　超时宽限 ' + Math.max(0, Math.round(elapsed - planned - 30)) + 's' : '');
      subEl.style.color = planned && elapsed > planned + 30 ? 'var(--err)' : 'var(--fg-3)';
      lights.forEach((node) => {
        const c = node.dataset.light;
        const on = (c === 'green' && cls === 'green') || (c === 'yellow' && cls === 'yellow') ||
          (c === 'red' && (cls === 'red' || cls === 'over'));
        node.classList.toggle('on', on);
      });
      document.title = (l.runningSince ? '● ' : '') + text + ' · ' + (seg ? seg.name : '') + ' · Club Console';
    }
    paint();
    tickId = setInterval(paint, 250);
  }

  CC.views.live = { render, stop };
})();
