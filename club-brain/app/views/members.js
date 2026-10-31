/* Club Console · 会员、排班与 DCP */
(function () {
  const CC = (window.CC = window.CC || {});
  CC.views = CC.views || {};
  const { h, icon, toast, download } = CC.dom;

  const ROLES = ['主持', '时间官', '哼哈官', '语法官', '总评', '即兴主持'];
  const WEIGHT = { 主持: 5, 总评: 5, 即兴主持: 4, 时间官: 3, 哼哈官: 3, 语法官: 3 };

  let schedResult = null;
  let schedIds = [];

  function render(root) {
    const S = CC.state;
    const data = S.data;
    const m = S.activeMeeting();

    const page = h('div', { class: 'grid', style: { gap: '14px' } });

    /* ---------- 会员台账 ---------- */
    const memCard = h('div', { class: 'card flush' },
      h('div', { class: 'row', style: { padding: '12px 14px 10px' } },
        h('h3', { style: { margin: 0 } }, '会员台账（' + data.members.length + '）'),
        h('div', { class: 'grow' }),
        h('button', {
          class: 'btn sm', on: {
            click: () => S.commit((d) => {
              d.members.push({
                id: CC.dom.uid('m'), name: '新会员', english: '', aliases: [], role: '会员',
                capacity: 3, skills: { 主持: 3, 时间官: 3, 哼哈官: 3, 语法官: 3, 总评: 3, 即兴主持: 3 },
                history: {}, unavailable: [],
              });
            }),
          },
        }, icon('plus'), '添加会员')
      ),
      h('table', { class: 'data' },
        h('thead', null, h('tr', null,
          h('th', null, '姓名'),
          h('th', { style: { width: '110px' } }, '英文名'),
          h('th', { style: { width: '120px' } }, '别名'),
          h('th', { style: { width: '64px' } }, '容量'),
          ROLES.map((r) => h('th', { style: { width: '54px' }, class: 'center' }, r.slice(0, 2))),
          h('th', { style: { width: '36px' } }, '')
        )),
        h('tbody', null, data.members.map((mem) => h('tr', null,
          h('td', null, h('input', {
            type: 'text', value: mem.name,
            on: { change: (e) => updateMember(mem.id, { name: e.target.value }) },
          })),
          h('td', null, h('input', {
            type: 'text', value: mem.english || '',
            on: { change: (e) => updateMember(mem.id, { english: e.target.value }) },
          })),
          h('td', null, h('input', {
            type: 'text', value: (mem.aliases || []).join(' '), placeholder: '空格分隔',
            on: {
              change: (e) => updateMember(mem.id, { aliases: e.target.value.split(/\s+/).filter(Boolean) }),
            },
          })),
          h('td', null, h('input', {
            type: 'number', value: mem.capacity, min: 1, max: 8,
            on: { change: (e) => updateMember(mem.id, { capacity: Number(e.target.value) }) },
          })),
          ROLES.map((role) => h('td', { class: 'center' }, h('input', {
            type: 'number', value: (mem.skills || {})[role] || 0, min: 0, max: 5,
            style: { textAlign: 'center', padding: '3px 2px' },
            on: {
              change: (e) => {
                const skills = Object.assign({}, mem.skills, { [role]: Number(e.target.value) });
                updateMember(mem.id, { skills });
              },
            },
          }))),
          h('td', { class: 'tight' }, h('button', {
            class: 'btn icon sm ghost', on: {
              click: () => S.commit((d) => { d.members = d.members.filter((x) => x.id !== mem.id); }),
            },
          }, icon('trash')))
        )))
      )
    );
    page.appendChild(memCard);

    /* ---------- 排班 ---------- */
    const candidates = S.meetings().filter((x) => x.status !== 'done').slice(0, 4);
    const schedCard = h('div', { class: 'card' },
      h('div', { class: 'row', style: { marginBottom: '10px' } },
        h('h3', { style: { margin: 0 } }, '角色排班求解'),
        h('div', { class: 'grow' }),
        h('button', {
          class: 'btn primary sm', on: {
            click: () => {
              const picked = candidates.filter((x) => schedIds.includes(x.id));
              if (!picked.length) { toast('先勾选至少一场会议', 'err'); return; }
              schedResult = solve(picked);
              CC.app.render();
            },
          },
        }, '求解'),
        h('button', {
          class: 'btn sm ghost', on: {
            click: () => {
              if (!schedResult) return;
              const txt = schedResult.assignments.map((a) => a.date + '  ' + a.role + '  ' + a.name).join('\n');
              download('schedule.csv', '日期,角色,姓名\n' + schedResult.assignments.map((a) => a.date + ',' + a.role + ',' + a.name).join('\n'), 'text/csv');
              toast('已导出 ' + schedResult.assignments.length + ' 条', 'ok');
            },
          },
        }, '导出')
      ),
      h('div', { class: 'row wrap', style: { marginBottom: '10px', gap: '6px' } },
        candidates.map((mm) => {
          const on = schedIds.includes(mm.id);
          return h('button', {
            class: 'chip ' + (on ? 'on' : ''),
            on: {
              click: () => {
                schedIds = on ? schedIds.filter((x) => x !== mm.id) : schedIds.concat(mm.id);
                CC.app.render();
              },
            },
          }, '#' + mm.meetingNo + ' ' + mm.date);
        })
      ),
      schedResult ? renderSchedule(schedResult) : h('div', { class: 'small muted' },
        '勾选要排的场次 → 求解。成本 = 能力缺口×2 + 历史次数×1.4 − 意愿；硬约束：不可用日期、单场最多 2 个角色、个人容量。')
    );
    page.appendChild(schedCard);

    /* ---------- DCP ---------- */
    page.appendChild(renderDcp(data.dcp));

    root.appendChild(page);

    function updateMember(id, patch) {
      S.commit((d) => {
        const mm = d.members.find((x) => x.id === id);
        if (mm) Object.assign(mm, patch);
      });
    }
  }

  function solve(meetings) {
    const data = CC.state.data;
    const input = {
      meetings: meetings.map((m) => ({
        id: m.id, date: m.date,
        slots: ROLES.map((role) => ({ role, weight: WEIGHT[role] })),
      })),
      members: data.members.map((m) => ({
        id: m.id, name: m.name,
        capacity: m.capacity || 3,
        unavailable: m.unavailable || [],
        skills: m.skills || {},
        history: m.history || {},
        prefs: m.prefs || {},
      })),
    };
    return CC.core.schedule(input);
  }

  function renderSchedule(res) {
    return h('div', null,
      h('div', { class: 'row', style: { marginBottom: '8px', gap: '14px' } },
        h('span', { class: 'tag ' + (res.ok ? 'green' : 'yellow') }, res.stats.filled + '/' + res.stats.slots + ' 已排'),
        h('span', { class: 'small muted' }, '公平性基尼 ' + res.fairness.gini + '（越低越均）'),
        h('span', { class: 'small muted' }, '总成本 ' + res.totalCost)
      ),
      h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: '10px' } },
        Object.entries(res.assignments.reduce((acc, a) => {
          (acc[a.meetingId] = acc[a.meetingId] || { date: a.date, rows: [] }).rows.push(a);
          return acc;
        }, {})).map(([id, group]) => h('div', { class: 'card', style: { background: 'var(--panel-2)', padding: '10px 12px' } },
          h('div', { class: 'small', style: { fontWeight: 600, marginBottom: '6px' } }, group.date),
          group.rows.map((r) => h('div', { class: 'kv', style: { display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', padding: '2px 0' } },
            h('span', { class: 'muted' }, r.role),
            h('span', null, r.name),
            h('span', { class: 'muted small', style: { maxWidth: '46%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } , title: r.reason }, r.reason)
          ))
        ))
      ),
      res.unassigned.length ? h('div', { style: { marginTop: '10px' } },
        h('div', { class: 'small', style: { color: 'var(--warn)', marginBottom: '4px' } }, '缺口 ' + res.unassigned.length + ' 个'),
        res.unassigned.map((u) => h('div', { class: 'small muted' },
          u.date + ' · ' + u.role + ' → 候选：' + (u.candidates || []).map((c) => c.name + '(' + c.cost + ')').join('、')))
      ) : null
    );
  }

  function renderDcp(dcp) {
    const r = CC.core.trackDcp(dcp);
    const setDcp = (patch) => CC.state.commit((d) => { Object.assign(d.dcp, patch); });

    const num = (label, value, onChange, width) => h('div', null,
      h('div', { class: 'small muted', style: { marginBottom: '2px' } }, label),
      h('input', { type: 'number', value, min: 0, style: { width: width || '76px' }, on: { change: (e) => onChange(Number(e.target.value)) } })
    );

    return h('div', { class: 'card' },
      h('div', { class: 'row', style: { marginBottom: '10px' } },
        h('h3', { style: { margin: 0 } }, 'DCP 进度'),
        h('div', { class: 'grow' }),
        h('span', { class: 'tag gold' }, r.level),
        h('span', { class: 'small muted' }, r.achievedCount + ' / 10')
      ),
      h('div', { class: 'row wrap', style: { gap: '12px', marginBottom: '12px' } },
        num('Level 1', dcp.awards.level1, (v) => setDcp({ awards: Object.assign({}, dcp.awards, { level1: v }) })),
        num('Level 2', dcp.awards.level2, (v) => setDcp({ awards: Object.assign({}, dcp.awards, { level2: v }) })),
        num('Level 3', dcp.awards.level3, (v) => setDcp({ awards: Object.assign({}, dcp.awards, { level3: v }) })),
        num('Level 4/5', dcp.awards.level45, (v) => setDcp({ awards: Object.assign({}, dcp.awards, { level45: v }) })),
        num('新会员', dcp.newMembers, (v) => setDcp({ newMembers: v })),
        num('执委培训一', dcp.officersTrained.round1, (v) => setDcp({ officersTrained: Object.assign({}, dcp.officersTrained, { round1: v }) })),
        num('执委培训二', dcp.officersTrained.round2, (v) => setDcp({ officersTrained: Object.assign({}, dcp.officersTrained, { round2: v }) }))
      ),
      h('div', { class: 'grid', style: { gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)', gap: '16px' } },
        h('div', null,
          r.goals.map((g) => h('div', { class: 'goal-row' },
            h('div', { class: 'chk', style: { color: g.achieved ? 'var(--ok)' : 'var(--fg-3)' } }, g.achieved ? '✓' : '○'),
            h('div', { class: 'small' }, g.title),
            h('div', null, h('div', { class: 'progress' }, h('i', { style: { width: g.progressPct + '%' } }))),
            h('div', { class: 'right small mono' }, g.current + '/' + g.target)
          ))
        ),
        h('div', null,
          r.forecast ? h('div', { class: 'small', style: { marginBottom: '10px' } },
            h('div', { class: 'kv', style: { display: 'flex', justifyContent: 'space-between' } }, '推进速度', h('b', null, r.forecast.velocityPerMonth + ' 项/月')),
            h('div', { class: 'kv', style: { display: 'flex', justifyContent: 'space-between' } }, '到 Select（7 项）',
              h('b', null, r.forecast.monthsToSelect == null ? '—' : r.forecast.monthsToSelect + ' 个月')),
            h('div', { class: 'kv', style: { display: 'flex', justifyContent: 'space-between' } }, "到 President's（9 项）",
              h('b', null, r.forecast.monthsToPresidents == null ? '—' : r.forecast.monthsToPresidents + ' 个月'))
          ) : h('div', { class: 'small muted', style: { marginBottom: '10px' } }, '历史样本不足，无法预测。'),
          h('div', { class: 'small muted', style: { marginBottom: '4px' } }, '下一步动作'),
          r.actions.slice(0, 4).map((a) => h('div', { class: 'small', style: { display: 'flex', gap: '6px', marginBottom: '5px' } },
            h('span', { style: { color: 'var(--gold)' } }, '▸'),
            h('span', null, h('b', null, a.title + '：'), a.action)))
        )
      )
    );
  }

  CC.views.members = { render };
})();
