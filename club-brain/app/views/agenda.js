/* Club Console · 议程工作台 */
(function () {
  const CC = (window.CC = window.CC || {});
  CC.views = CC.views || {};
  const { h, icon, download, toast } = CC.dom;

  const KINDS = [
    ['opening', '召集开场'], ['facilitator', '促进者'], ['speech', '备稿'],
    ['break', '休息'], ['tabletopics', '即兴'], ['workshop', '工作坊'],
    ['report', '报告'], ['special', '特殊'], ['vote', '投票'], ['closing', '谢幕'],
  ];
  const STATUS = [['confirmed', '已确认'], ['pending', '待确认'], ['omitted', '省略']];
  const PATHS = ['PM', 'EC', 'EH', 'IP', 'MS', 'PI', 'VC', 'RS', 'SR', 'TC', 'DL'];

  function render(root) {
    const S = CC.state;
    const m = S.activeMeeting();
    if (!m) { root.appendChild(h('div', { class: 'empty' }, '没有会议。')); return; }
    const rep = S.lint(m);
    const members = S.members();

    const page = h('div', { class: 'grid', style: { gridTemplateColumns: 'minmax(0,1fr) 330px', gap: '14px', alignItems: 'start' } });
    const main = h('div', { class: 'grid', style: { gap: '14px' } });
    const side = h('div', { class: 'grid', style: { gap: '14px', position: 'sticky', top: '0' } });

    /* ---------- 元信息 ---------- */
    main.appendChild(h('div', { class: 'card' },
      h('div', { class: 'row wrap', style: { gap: '12px' } },
        field('期次', h('input', {
          type: 'number', value: m.meetingNo, style: { width: '76px' },
          on: { change: (e) => S.updateMeeting(m.id, { meetingNo: Number(e.target.value) }) },
        })),
        field('日期', h('input', {
          type: 'date', value: m.date, style: { width: '150px' },
          on: { change: (e) => S.updateMeeting(m.id, { date: e.target.value, weekday: S.weekdayZh(e.target.value) }) },
        })),
        field('星期', h('div', { class: 'small muted', style: { paddingTop: '7px' } }, m.weekday || '—')),
        field('开始', h('input', {
          type: 'time', value: m.start, style: { width: '104px' },
          on: { change: (e) => S.updateMeeting(m.id, { start: e.target.value }) },
        })),
        field('结束', h('input', {
          type: 'time', value: m.end, style: { width: '104px' },
          on: { change: (e) => S.updateMeeting(m.id, { end: e.target.value }) },
        })),
        field('即兴人数', h('input', {
          type: 'number', value: m.tableTopicsCount || 0, style: { width: '70px' },
          on: { change: (e) => S.updateMeeting(m.id, { tableTopicsCount: Number(e.target.value) }) },
        })),
        field('语言', h('select', {
          value: m.language || 'zh', style: { width: '96px' },
          on: { change: (e) => S.updateMeeting(m.id, { language: e.target.value }) },
        }, h('option', { value: 'zh' }, '中文'), h('option', { value: 'en' }, '英文'))),
        h('div', { class: 'grow' }),
        field('主题', h('input', {
          type: 'text', value: m.theme || '', placeholder: '收敛成短题（约 11 字）',
          style: { width: '260px' },
          on: { change: (e) => S.updateMeeting(m.id, { theme: e.target.value }) },
        }))
      )
    ));

    /* ---------- 结论条 ---------- */
    main.appendChild(h('div', { class: 'verdict ' + (rep.ok ? 'pass' : 'fail') },
      h('div', { class: 'score' }, rep.score),
      h('div', { class: 'grow' },
        h('div', { style: { fontWeight: 600 } }, rep.ok ? '断言通过' : '存在 ' + rep.counts.error + ' 个阻断项'),
        h('div', { class: 'small' }, rep.counts.error + ' 错误 / ' + rep.counts.warn + ' 告警 / ' + rep.counts.info + ' 提示　·　' +
          rep.totals.startText + '–' + rep.totals.endText + '（截止 ' + rep.totals.deadlineText + '）')
      ),
      h('div', { class: 'row' },
        m.status === 'draft'
          ? h('button', {
            class: 'btn ' + (rep.ok ? 'primary' : ''),
            disabled: !rep.ok,
            title: rep.ok ? '' : '有阻断项时不能定稿',
            on: { click: () => { S.setStage(m.id, 'locked'); toast('已定稿并锁定', 'ok'); } },
          }, '定稿')
          : h('button', { class: 'btn', on: { click: () => S.setStage(m.id, 'draft') } }, '退回起草'),
        m.status !== 'live'
          ? h('button', {
            class: 'btn primary', disabled: m.status === 'draft',
            on: { click: () => { S.liveStart(m.id); CC.app.go('live'); } },
          }, icon('play'), '开始本场')
          : h('button', { class: 'btn primary', on: { click: () => CC.app.go('live') } }, icon('play'), '回到会中')
      )
    ));

    /* ---------- 甘特 ---------- */
    main.appendChild(h('div', { class: 'card' },
      h('div', { class: 'row', style: { marginBottom: '6px' } },
        h('h3', { style: { margin: 0 } }, '时间线'),
        h('div', { class: 'grow' }),
        h('span', { class: 'small muted' }, '总 ' + rep.totals.plannedMinutes + ' 分钟，余 ' +
          (rep.totals.slackMinutes == null ? '—' : rep.totals.slackMinutes) + ' 分钟')
      ),
      h('div', { class: 'gantt' }, CC.chart.gantt(rep.timeline, { deadline: m.end, width: 820 }))
    ));

    /* ---------- 环节表 ---------- */
    const segRows = m.segments.map((seg, i) => segRow(m, seg, i, members, rep));
    main.appendChild(h('div', { class: 'card flush' },
      h('div', { class: 'row', style: { padding: '12px 14px 10px' } },
        h('h3', { style: { margin: 0 } }, '环节（' + m.segments.length + '）'),
        h('div', { class: 'grow' }),
        h('button', { class: 'btn sm', on: { click: () => S.addSegment(m.id) } }, icon('plus'), '添加环节')
      ),
      h('table', { class: 'data' },
        h('thead', null, h('tr', null,
          h('th', { style: { width: '34px' } }, '#'),
          h('th', null, '环节名'),
          h('th', { style: { width: '112px' } }, '类型'),
          h('th', { style: { width: '72px' } }, '分钟'),
          h('th', { style: { width: '132px' } }, '负责人'),
          h('th', { style: { width: '104px' } }, '状态'),
          h('th', { style: { width: '96px' } }, '')
        )),
        h('tbody', null, segRows)
      )
    ));

    /* ---------- 备稿 ---------- */
    main.appendChild(h('div', { class: 'card flush' },
      h('div', { class: 'row', style: { padding: '12px 14px 10px' } },
        h('h3', { style: { margin: 0 } }, '备稿（' + m.speeches.length + '）'),
        h('div', { class: 'grow' }),
        h('button', { class: 'btn sm', on: { click: () => S.addSpeech(m.id) } }, icon('plus'), '添加备稿')
      ),
      m.speeches.length ? h('table', { class: 'data' },
        h('thead', null, h('tr', null,
          h('th', { style: { width: '72px' } }, '路径'),
          h('th', { style: { width: '58px' } }, '级'),
          h('th', null, '题目'),
          h('th', null, '项目要求'),
          h('th', { style: { width: '110px' } }, '演讲人'),
          h('th', { style: { width: '110px' } }, '点评人'),
          h('th', { style: { width: '62px' } }, '时长'),
          h('th', { style: { width: '62px' } }, '点评'),
          h('th', { style: { width: '40px' } }, '')
        )),
        h('tbody', null, m.speeches.map((sp, i) => speechRow(m, sp, i, members, rep)))
      ) : h('div', { class: 'empty' }, '暂无备稿')
    ));

    /* ---------- 备注 ---------- */
    const noteInput = h('input', {
      type: 'text', placeholder: '按回车添加（中文例会备注列不要写英文名）',
      on: {
        keydown: (e) => {
          if (e.key === 'Enter' && e.target.value.trim()) {
            S.addNote(m.id, e.target.value);
            e.target.value = '';
          }
        },
      },
    });
    main.appendChild(h('div', { class: 'card' },
      h('h3', null, '备注（' + (m.notes || []).length + '）'),
      h('div', { class: 'chips', style: { marginBottom: '10px' } },
        (m.notes || []).map((n, i) => h('span', { class: 'tag' },
          n,
          h('span', {
            style: { cursor: 'pointer', marginLeft: '4px', color: 'var(--fg-3)' },
            on: { click: () => S.removeNote(m.id, i) },
          }, '×')
        ))
      ),
      noteInput
    ));

    /* ---------- 侧栏：问题 + 导出 ---------- */
    side.appendChild(h('div', { class: 'card' },
      h('div', { class: 'row', style: { marginBottom: '8px' } },
        h('h3', { style: { margin: 0 } }, '断言（' + rep.issues.length + '）'),
        h('div', { class: 'grow' }),
        h('span', { class: 'tag ' + (rep.ok ? 'green' : 'red') }, rep.ok ? '通过' : '阻断')
      ),
      rep.issues.length
        ? h('div', { class: 'issues' }, rep.issues.map((i) => h('div', {
          class: 'issue ' + i.severity,
          on: {
            click: () => {
              const el = document.querySelector('[data-seg="' + (i.field || '') + '"]');
              if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
            },
          },
        }, h('code', null, i.code), h('div', { class: 'msg' }, i.message))))
        : h('div', { class: 'small muted' }, '全部通过。')
    ));

    side.appendChild(h('div', { class: 'card' },
      h('h3', null, '导出'),
      h('div', { class: 'grid', style: { gap: '8px' } },
        h('button', { class: 'btn', on: { click: () => download('timer-' + m.meetingNo + '.csv', S.timerCsv(m), 'text/csv') } }, '计时器 CSV'),
        h('button', { class: 'btn', on: { click: () => download('sheet-' + m.meetingNo + '.md', S.sheetMarkdown(m), 'text/markdown') } }, '会单 Markdown'),
        h('button', {
          class: 'btn',
          on: {
            click: () => download('meeting-' + m.meetingNo + '.json', JSON.stringify(m, null, 2), 'application/json'),
          },
        }, '会议 JSON'),
        h('button', { class: 'btn', on: { click: () => window.print() } }, '打印会单'),
        h('div', { style: { height: '1px', background: 'var(--line)', margin: '4px 0' } }),
        h('button', {
          class: 'btn',
          on: {
            click: () => {
              const d = S.surveyDraft(m);
              download('survey-' + m.meetingNo + '.md', CC.core.surveyMd(d), 'text/markdown');
              if (d.warnings.length) toast('问卷草稿有 ' + d.warnings.length + ' 条提示', '');
            },
          },
        }, '问卷草稿 MD'),
        h('button', {
          class: 'btn', on: {
            click: () => {
              const d = S.surveyDraft(m);
              download('survey-' + m.meetingNo + '.jsonl', CC.core.surveyJsonl(d), 'text/plain');
            },
          },
        }, '问卷 JSONL')
      )
    ));

    page.appendChild(main);
    page.appendChild(side);
    root.appendChild(page);
  }

  function field(label, control) {
    return h('div', null,
      h('div', { class: 'small muted', style: { marginBottom: '3px' } }, label),
      control
    );
  }

  function segRow(m, seg, i, members, rep) {
    const tl = rep.timeline[i];
    return h('tr', { dataset: { seg: seg.id } },
      h('td', { class: 'mono small muted' }, tl ? tl.startText : ''),
      h('td', null, h('input', {
        type: 'text', value: seg.name,
        on: { change: (e) => CC.state.updateSegment(m.id, seg.id, { name: e.target.value }) },
      })),
      h('td', null, h('select', {
        value: seg.kind,
        on: { change: (e) => CC.state.updateSegment(m.id, seg.id, { kind: e.target.value }) },
      }, KINDS.map(([v, t]) => h('option', { value: v }, t)))),
      h('td', null, h('input', {
        type: 'number', value: seg.minutes, min: 0,
        on: { change: (e) => CC.state.updateSegment(m.id, seg.id, { minutes: Number(e.target.value) }) },
      })),
      h('td', null, personSelect(members, seg.owner, (v) => CC.state.updateSegment(m.id, seg.id, {
        owner: v, ownerStatus: v ? (seg.ownerStatus === 'omitted' ? 'confirmed' : seg.ownerStatus) : 'pending',
      }))),
      h('td', null, h('select', {
        value: seg.ownerStatus || 'pending',
        on: { change: (e) => CC.state.updateSegment(m.id, seg.id, { ownerStatus: e.target.value }) },
      }, STATUS.map(([v, t]) => h('option', { value: v }, t)))),
      h('td', { class: 'tight' },
        h('div', { class: 'row', style: { gap: '2px' } },
          h('button', { class: 'btn icon sm ghost', title: '上移', on: { click: () => CC.state.moveSegment(m.id, seg.id, -1) } }, icon('up')),
          h('button', { class: 'btn icon sm ghost', title: '下移', on: { click: () => CC.state.moveSegment(m.id, seg.id, 1) } }, icon('down')),
          h('button', { class: 'btn icon sm ghost', title: '在下方插入', on: { click: () => CC.state.addSegment(m.id, i) } }, icon('plus')),
          h('button', { class: 'btn icon sm ghost', title: '删除', on: { click: () => CC.state.removeSegment(m.id, seg.id) } }, icon('trash'))
        )
      )
    );
  }

  function speechRow(m, sp, i, members, rep) {
    const w = CC.core.displayWidth(sp.requirement || '');
    const over = w > 42;
    return h('tr', { dataset: { seg: sp.id } },
      h('td', null, h('select', {
        value: sp.path,
        on: { change: (e) => CC.state.updateSpeech(m.id, sp.id, { path: e.target.value }) },
      }, PATHS.map((p) => h('option', { value: p }, p)))),
      h('td', null, h('input', {
        type: 'number', value: sp.level, min: 1, max: 5,
        on: { change: (e) => CC.state.updateSpeech(m.id, sp.id, { level: Number(e.target.value) }) },
      })),
      h('td', null, h('input', {
        type: 'text', value: sp.title || '', placeholder: '（待定）',
        on: { change: (e) => CC.state.updateSpeech(m.id, sp.id, { title: e.target.value }) },
      })),
      h('td', null,
        h('input', {
          type: 'text', value: sp.requirement || '', placeholder: '路径 等级 项目名 + 要求',
          on: { change: (e) => CC.state.updateSpeech(m.id, sp.id, { requirement: e.target.value }) },
        }),
        h('div', {
          class: 'small',
          style: { color: over ? 'var(--err)' : 'var(--fg-3)', marginTop: '2px' },
        }, w.toFixed(1) + ' / 42 字' + (over ? '（会被裁行）' : ''))
      ),
      h('td', null, personSelect(members, sp.speaker, (v) => CC.state.updateSpeech(m.id, sp.id, { speaker: v }))),
      h('td', null, personSelect(members, sp.evaluator, (v) => CC.state.updateSpeech(m.id, sp.id, { evaluator: v }))),
      h('td', null, h('input', {
        type: 'number', value: sp.minutes,
        on: { change: (e) => CC.state.updateSpeech(m.id, sp.id, { minutes: Number(e.target.value) }) },
      })),
      h('td', null, h('input', {
        type: 'number', value: sp.evalMinutes,
        on: { change: (e) => CC.state.updateSpeech(m.id, sp.id, { evalMinutes: Number(e.target.value) }) },
      })),
      h('td', { class: 'tight' },
        h('button', { class: 'btn icon sm ghost', on: { click: () => CC.state.removeSpeech(m.id, sp.id) } }, icon('trash'))
      )
    );
  }

  function personSelect(members, value, onChange) {
    const opts = [h('option', { value: '' }, '（空）')]
      .concat(members.map((mm) => h('option', { value: mm.name }, mm.name + (mm.english ? ' · ' + mm.english : ''))));
    if (value && !members.some((mm) => mm.name === value)) {
      opts.push(h('option', { value }, value + '（不在册）'));
    }
    return h('select', { value: value || '', on: { change: (e) => onChange(e.target.value) } }, opts);
  }

  CC.views.agenda = { render };
})();
