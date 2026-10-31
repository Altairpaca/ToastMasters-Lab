/* Club Console · 总览 */
(function () {
  const CC = (window.CC = window.CC || {});
  CC.views = CC.views || {};
  const { h, icon, fmtClock } = CC.dom;

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
    if (!m) {
      root.appendChild(h('div', { class: 'empty' }, '还没有会议。点右上角「新建」开始。'));
      return;
    }
    const rep = S.lint(m);
    const confirmed = m.segments.filter((s) => s.ownerStatus === 'confirmed' && s.owner).length;
    const totalOwned = m.segments.filter((s) => s.owner).length;
    const confirmRate = totalOwned ? Math.round((confirmed / totalOwned) * 100) : 0;
    const slack = rep.totals.slackMinutes;

    const verdictCls = rep.ok ? 'pass' : 'fail';
    const verdictText = rep.ok ? '全部断言通过，可以定稿' : rep.counts.error + ' 个阻断问题，暂不可定稿';

    const wrap = h('div', { class: 'grid', style: { gap: '14px' } });

    // 顶部结论条
    wrap.appendChild(h('div', { class: 'stage-banner' },
      h('div', { class: 'stage-pill stage-' + m.status }, {
        draft: '起草中', locked: '已定稿', live: '进行中', done: '已归档',
      }[m.status] || m.status),
      h('div', { class: 'grow' },
        h('div', { style: { fontWeight: '600' } }, '第 ' + m.meetingNo + ' 次 · ' + (m.theme || '未定主题')),
        h('div', { class: 'small muted' }, fmtClock(m.date) + ' ' + (m.weekday || '') + '　' + m.start + '–' + m.end + '　' + (m.language === 'zh' ? '中文例会' : '英文例会'))
      ),
      h('button', { class: 'btn primary', on: { click: () => CC.app.go('agenda') } }, '打开议程工作台')
    ));

    // KPI
    wrap.appendChild(h('div', { class: 'grid c4' },
      kpi('议程评分', h('span', null, rep.score, h('small', null, '/100')), rep.ok ? '断言通过' : '存在阻断项', rep.ok ? 'ok' : 'err'),
      kpi('预计结束', rep.totals.endText, '截止 ' + rep.totals.deadlineText + '　余 ' + (slack == null ? '—' : slack) + ' 分钟',
        slack != null && slack < 0 ? 'err' : slack != null && slack <= 2 ? 'warn' : 'ok'),
      kpi('角色确认率', h('span', null, confirmRate, h('small', null, '%')), confirmed + ' / ' + totalOwned + ' 个角色已确认',
        confirmRate >= 90 ? 'ok' : confirmRate >= 60 ? 'warn' : 'err'),
      kpi('备稿', h('span', null, m.speeches.length, h('small', null, ' 篇')), (m.speeches.filter((s) => s.evaluator).length) + ' 篇已配点评')
    ));

    // 主体：左甘特+待办，右问题
    const left = h('div', { class: 'grid', style: { gap: '14px' } });
    const right = h('div', { class: 'grid', style: { gap: '14px' } });

    left.appendChild(h('div', { class: 'card' },
      h('h3', null, '时间线'),
      h('div', { class: 'gantt' }, CC.chart.gantt(rep.timeline, { deadline: m.end, width: 900 }))
    ));

    // 待办：按严重度取前 6
    const top = rep.issues.slice(0, 6);
    left.appendChild(h('div', { class: 'card' },
      h('div', { class: 'row', style: { marginBottom: '8px' } },
        h('h3', { style: { margin: 0 } }, '待处理'),
        h('div', { class: 'spacer grow' }),
        h('button', { class: 'btn sm ghost', on: { click: () => CC.app.go('agenda') } }, '全部 ' + rep.issues.length + ' 项')
      ),
      top.length ? h('div', { class: 'issues' }, top.map(issueRow)) : h('div', { class: 'small muted' }, '没有待处理项。')
    ));

    // 右侧：最近会议
    const list = h('div', { class: 'card flush' },
      h('div', { style: { padding: '12px 14px 8px' } }, h('h3', { style: { margin: 0 } }, '最近会议')),
      h('table', { class: 'data' },
        h('thead', null, h('tr', null,
          h('th', null, '期次'), h('th', null, '日期'), h('th', null, '状态'), h('th', { class: 'num' }, '评分')
        )),
        h('tbody', null, S.meetings().slice(0, 6).map((mm) => {
          const r = S.lint(mm);
          return h('tr', {
            style: { cursor: 'pointer' },
            on: { click: () => { S.setActive(mm.id); } },
          },
            h('td', null, '#' + mm.meetingNo),
            h('td', { class: 'mono small' }, mm.date),
            h('td', null, h('span', {
              class: 'tag ' + ({ draft: '', locked: 'blue', live: 'green', done: 'gold' }[mm.status] || ''),
            }, { draft: '起草', locked: '定稿', live: '进行中', done: '归档' }[mm.status] || mm.status)),
            h('td', { class: 'num' }, String(r.score))
          );
        }))
      )
    );
    right.appendChild(list);

    // 右侧：阶段建议
    const hints = [];
    if (m.status === 'draft') hints.push('议程处于起草阶段：先补齐待确认角色，再点「定稿」锁定。');
    if (m.status === 'locked') hints.push('议程已定稿：可以进入会中驾驶舱，三官记录会自动生成复盘。');
    if (m.status === 'live') hints.push('会议进行中：切到「会中」继续控制节奏。');
    if (m.status === 'done') hints.push('本场已归档：复盘已生成，可导出给执委会。');
    if (slack != null && slack < 0) hints.push('总时长超出 ' + Math.abs(slack) + ' 分钟，建议压缩「促进者报告」或「即兴」。');
    if (m.speeches.some((s) => !s.evaluator)) hints.push('有备稿还没配点评人，会影响「最佳点评」问卷生成。');
    right.appendChild(h('div', { class: 'card' },
      h('h3', null, '下一步'),
      h('div', { class: 'small', style: { display: 'grid', gap: '7px' } },
        hints.map((t) => h('div', { style: { display: 'flex', gap: '7px' } },
          h('span', { style: { color: 'var(--gold)' } }, '▸'), h('span', null, t)))
      )
    ));

    wrap.appendChild(h('div', { class: 'grid', style: { gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)', gap: '14px' } },
      left, right));
    root.appendChild(wrap);

    function issueRow(i) {
      return h('div', {
        class: 'issue ' + i.severity,
        on: {
          click: () => {
            CC.app.go('agenda');
            if (i.field) setTimeout(() => {
              const el = document.querySelector('[data-seg="' + i.field + '"]');
              if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.style.outline = '2px solid var(--gold)'; }
            }, 60);
          },
        },
      },
        h('code', null, i.code),
        h('div', { class: 'msg' }, i.message)
      );
    }
  }

  CC.views.dashboard = { render };
})();
