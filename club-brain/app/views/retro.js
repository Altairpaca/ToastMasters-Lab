/* Club Console · 复盘 */
(function () {
  const CC = (window.CC = window.CC || {});
  CC.views = CC.views || {};
  const { h, icon, download } = CC.dom;

  function kpi(label, value, sub, cls) {
    return h('div', { class: 'kpi ' + (cls || '') },
      h('div', { class: 'label' }, label),
      h('div', { class: 'value' }, value),
      sub ? h('div', { class: 'sub' }, sub) : null
    );
  }

  function render(root) {
    const S = CC.state;
    const m = S.activeMeeting();
    if (!m) { root.appendChild(h('div', { class: 'empty' }, '没有会议。')); return; }

    const hasRecords = (m.records.timing || []).length > 0 || Object.keys(m.records.ah || {}).length;
    if (!hasRecords && !m.retro) {
      root.appendChild(h('div', { class: 'empty' },
        h('div', { style: { marginBottom: '10px' } }, '还没有会中数据。'),
        h('button', { class: 'btn primary', on: { click: () => CC.app.go(m.status === 'draft' ? 'agenda' : 'live') } },
          m.status === 'draft' ? '去完善议程' : '去会中记录')
      ));
      return;
    }

    const r = m.retro || S.ensureRetro(m);
    if (!r) { root.appendChild(h('div', { class: 'empty' }, '复盘生成失败。')); return; }

    // 上期对比
    const others = S.meetings().filter((x) => x.id !== m.id && (x.records.timing || []).length)
      .filter((x) => x.date < m.date);
    const prev = others[0];
    const prevRetro = prev ? (prev.retro || S.ensureRetro(prev)) : null;
    const dPunc = prevRetro ? r.punctuality - prevRetro.punctuality : null;

    const wrap = h('div', { class: 'grid', style: { gap: '14px' } });

    wrap.appendChild(h('div', { class: 'row' },
      h('div', { class: 'stage-banner grow', style: { marginBottom: 0 } },
        h('div', { class: 'stage-pill stage-done' }, '已归档'),
        h('div', { class: 'grow' },
          h('div', { style: { fontWeight: 600 } }, '第 ' + r.meetingNo + ' 次复盘 · ' + r.date),
          h('div', { class: 'small muted' }, '由三官记录自动生成　·　' + r.totals.segments + ' 个环节')
        ),
        h('button', {
          class: 'btn', on: {
            click: () => download('retro-' + r.meetingNo + '.md', CC.core.retroMd(r), 'text/markdown'),
          },
        }, '导出 Markdown'),
        h('button', { class: 'btn ghost', on: { click: () => CC.app.go('live') } }, '回到会中')
      )
    ));

    wrap.appendChild(h('div', { class: 'grid c4' },
      kpi('准时度', h('span', null, r.punctuality, h('small', null, '/100')),
        dPunc == null ? '首次记录' : (dPunc >= 0 ? '比上期 +' : '比上期 ') + dPunc + ' 分',
        r.punctuality >= 80 ? 'ok' : r.punctuality >= 60 ? 'warn' : 'err'),
      kpi('总时长', h('span', null, r.totals.actualMinutes, h('small', null, ' 分')),
        '计划 ' + r.totals.plannedMinutes + ' 分', r.totals.deltaMinutes > 0 ? 'warn' : 'ok'),
      kpi('超时环节', h('span', null, r.totals.overruns, h('small', null, ' 个')),
        r.totals.overruns ? '最长超 ' + Math.max(...r.segments.map((s) => s.delta)) + ' 分钟' : '全部准时',
        r.totals.overruns ? 'err' : 'ok'),
      kpi('赘词', h('span', null, r.totals.ahTotal, h('small', null, ' 次')), '全场合计', r.totals.ahTotal > 10 ? 'warn' : 'ok')
    ));

    const left = h('div', { class: 'grid', style: { gap: '14px' } });
    const right = h('div', { class: 'grid', style: { gap: '14px' } });

    left.appendChild(h('div', { class: 'card' },
      h('h3', null, '环节偏差（浅色=计划，实色=实测）'),
      CC.chart.compareBars(r.segments.map((s) => ({ label: s.segment, planned: s.planned, actual: s.actual })))
    ));

    left.appendChild(h('div', { class: 'card' },
      h('h3', null, '个人表现'),
      h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: '10px' } },
        r.persons.map((p) => h('div', { class: 'person-card' },
          h('div', { class: 'nm' }, p.speaker),
          h('div', { class: 'kv' }, '时长', h('b', null, p.actualMinutes + ' 分')),
          h('div', { class: 'kv' }, '偏差', h('b', { style: { color: p.deltaMinutes > 0 ? 'var(--err)' : 'var(--ok)' } },
            (p.deltaMinutes > 0 ? '+' : '') + p.deltaMinutes.toFixed(1) + ' 分')),
          h('div', { class: 'kv' }, '准时率', h('b', null, p.onTimeRate == null ? '—' : p.onTimeRate + '%')),
          h('div', { class: 'kv' }, '赘词', h('b', null, p.ahTotal + (p.ahPerMinute != null ? '　(' + p.ahPerMinute + '/分)' : ''))),
          p.topFiller ? h('div', { class: 'kv' }, '高频词', h('b', null, p.topFiller.word + ' ×' + p.topFiller.count)) : null
        ))
      )
    ));

    right.appendChild(h('div', { class: 'card' },
      h('h3', null, '自动结论'),
      h('div', { class: 'small', style: { display: 'grid', gap: '8px' } },
        r.insights.map((t) => h('div', { style: { display: 'flex', gap: '7px' } },
          h('span', { style: { color: 'var(--gold)' } }, '▸'), h('span', null, t)))
      )
    ));

    right.appendChild(h('div', { class: 'card' },
      h('h3', null, '语法官'),
      h('div', { class: 'small muted', style: { marginBottom: '4px' } }, '好词好句'),
      (r.grammar.good.length
        ? h('div', { class: 'chips' }, r.grammar.good.map((g) => h('span', { class: 'tag green' }, g)))
        : h('div', { class: 'small muted' }, '无')),
      h('div', { class: 'small muted', style: { margin: '10px 0 4px' } }, '问题'),
      (r.grammar.issues.length
        ? h('div', { style: { display: 'grid', gap: '4px' } }, r.grammar.issues.map((i) => h('div', { class: 'small' },
          h('span', { class: 'tag yellow', style: { marginRight: '6px' } }, i.type || '问题'),
          i.text, i.fix ? h('span', { class: 'muted' }, ' → ' + i.fix) : null)))
        : h('div', { class: 'small muted' }, '无'))
    ));

    wrap.appendChild(h('div', { class: 'grid', style: { gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: '14px' } }, left, right));
    root.appendChild(wrap);
  }

  CC.views.retro = { render };
})();
