/* Club Console · 示例数据（首次打开时的沙盘） */
(function () {
  const CC = (window.CC = window.CC || {});

  function sg(name, kind, minutes, owner, status) {
    return {
      id: 'sg-' + Math.random().toString(36).slice(2, 8),
      name, kind, minutes, owner: owner || '',
      ownerStatus: status || (owner ? 'confirmed' : 'pending'),
    };
  }

  function build() {
    const members = [
      {
        id: 'm1', name: '怀童', english: 'Huaitong', aliases: ['会长', '主席'], role: '教育副会长',
        capacity: 4, skills: { 主持: 5, 总评: 5, 即兴主持: 4, 时间官: 3, 哼哈官: 3, 语法官: 4 },
        history: { 主持: 6, 总评: 4, 即兴主持: 2 }, unavailable: [],
      },
      {
        id: 'm2', name: '珊珊', english: 'Shanshan', aliases: ['733'], role: '会议经理',
        capacity: 3, skills: { 主持: 4, 时间官: 5, 哼哈官: 3, 语法官: 4, 总评: 3, 即兴主持: 4 },
        history: { 时间官: 5, 主持: 2 }, unavailable: [],
      },
      {
        id: 'm3', name: '张三', english: 'Alex', aliases: [], role: '会员',
        capacity: 3, skills: { 主持: 3, 时间官: 2, 哼哈官: 4, 语法官: 2, 总评: 2, 即兴主持: 3 },
        history: { 哼哈官: 1 }, unavailable: [],
      },
      {
        id: 'm4', name: '李四', english: 'Ben', aliases: [], role: '会员',
        capacity: 3, skills: { 主持: 3, 时间官: 2, 哼哈官: 2, 语法官: 5, 总评: 3, 即兴主持: 2 },
        history: { 语法官: 2 }, unavailable: [],
      },
      {
        id: 'm5', name: '王五', english: 'Cindy', aliases: [], role: '事务官',
        capacity: 3, skills: { 主持: 3, 时间官: 4, 哼哈官: 4, 语法官: 3, 总评: 4, 即兴主持: 5 },
        history: { 即兴主持: 1, 哼哈官: 1 }, unavailable: ['2026-11-12'],
      },
      {
        id: 'm6', name: '赵六', english: 'David', aliases: [], role: '会员',
        capacity: 4, skills: { 主持: 4, 时间官: 3, 哼哈官: 3, 语法官: 3, 总评: 3, 即兴主持: 4 },
        history: {}, unavailable: [],
      },
      {
        id: 'm7', name: '兰辛', english: 'JC', aliases: ['JC'], role: '公关副会长',
        capacity: 3, skills: { 主持: 3, 时间官: 3, 哼哈官: 3, 语法官: 3, 总评: 4, 即兴主持: 3 },
        history: { 总评: 1 }, unavailable: [],
      },
      {
        id: 'm8', name: '怡欣', english: 'Yixin', aliases: ['计票员'], role: '接待官',
        capacity: 3, skills: { 主持: 3, 时间官: 4, 哼哈官: 3, 语法官: 3, 总评: 2, 即兴主持: 2 },
        history: { 时间官: 2 }, unavailable: [],
      },
    ];

    const m334 = {
      id: 'mtg-334', meetingNo: 334, date: '2026-10-29', weekday: '周四',
      start: '19:30', end: '21:30', language: 'zh', theme: '慢下来才算听懂', tableTopicsCount: 8,
      status: 'done',
      segments: [
        sg('召集与开场', 'opening', 5, '怀童'),
        sg('会议促进者介绍', 'facilitator', 15, '珊珊'),
        sg('备稿演讲 1', 'speech', 10, '王五'),
        sg('备稿演讲 2', 'speech', 10, '赵六'),
        sg('合影与休息', 'break', 10, '怡欣'),
        sg('即兴演讲', 'tabletopics', 21, '李四'),
        sg('促进者报告', 'report', 18, '兰辛'),
        sg('投票与颁奖', 'vote', 5, '怡欣'),
        sg('谢幕', 'closing', 5, '怀童'),
      ],
      speeches: [
        {
          id: 'sp-334-1', path: 'PM', level: 1, title: '第一次站上台',
          requirement: 'PM L1 研究与展示 4-6 分钟', speaker: '王五', evaluator: '赵六',
          minutes: 7, evalMinutes: 3, status: 'confirmed',
        },
        {
          id: 'sp-334-2', path: 'EC', level: 2, title: '把会开成产品',
          requirement: 'EC L2 管理项目 5-7 分钟', speaker: '赵六', evaluator: '兰辛',
          minutes: 7, evalMinutes: 3, status: 'confirmed',
        },
      ],
      notes: ['宾客 2 位首次到访'],
      records: {
        timing: [
          { id: 't1', segment: '召集与开场', speaker: '怀童', planned: 5, actual: 5, status: 'ok' },
          { id: 't2', segment: '会议促进者介绍', speaker: '珊珊', planned: 15, actual: 14, status: 'ok' },
          { id: 't3', segment: '备稿演讲 1', speaker: '王五', planned: 10, actual: 12, status: 'over' },
          { id: 't4', segment: '备稿演讲 2', speaker: '赵六', planned: 10, actual: 9, status: 'ok' },
          { id: 't5', segment: '即兴演讲', speaker: '李四', planned: 21, actual: 24, status: 'over' },
          { id: 't6', segment: '促进者报告', speaker: '兰辛', planned: 18, actual: 19, status: 'over' },
        ],
        ah: { 王五: { 嗯: 3, 然后: 2 }, 赵六: { 那个: 4 }, 李四: { 就是: 5, 然后: 1 } },
        grammar: { good: ['停顿比语言更有力'], issues: [{ type: '用词', text: '进行一个讲解', fix: '改为「讲解」' }] },
      },
      retro: null,
      live: null,
    };

    const m335 = {
      id: 'mtg-335', meetingNo: 335, date: '2026-11-05', weekday: '周四',
      start: '19:30', end: '21:30', language: 'zh', theme: '把话说清楚', tableTopicsCount: 10,
      status: 'done',
      segments: [
        sg('召集与开场', 'opening', 5, '怀童'),
        sg('会议促进者介绍', 'facilitator', 15, '珊珊'),
        sg('备稿演讲 1', 'speech', 10, '张三'),
        sg('备稿演讲 2', 'speech', 10, '李四'),
        sg('备稿演讲 3', 'speech', 10, '王五'),
        sg('合影与休息', 'break', 10, '王五'),
        sg('即兴演讲', 'tabletopics', 25, '赵六'),
        sg('促进者报告', 'report', 18, '兰辛'),
        sg('投票与颁奖', 'vote', 5, '怡欣'),
        sg('谢幕', 'closing', 5, '怀童'),
      ],
      speeches: [
        {
          id: 'sp-335-1', path: 'PM', level: 1, title: '第一次站上台',
          requirement: 'PM L1 研究与展示 4-6 分钟 需含明确论点', speaker: '张三', evaluator: '赵六',
          minutes: 7, evalMinutes: 3, status: 'confirmed',
        },
        {
          id: 'sp-335-2', path: 'PM', level: 2, title: '我的三次失败',
          requirement: 'PM L2 有效沟通 5-7 分钟 需有故事结构', speaker: '李四', evaluator: '怡欣',
          minutes: 7, evalMinutes: 3, status: 'confirmed',
        },
        {
          id: 'sp-335-3', path: 'EC', level: 2, title: '把会议开成产品',
          requirement: 'EC L2 管理项目 5-7 分钟 需含时间线', speaker: '王五', evaluator: '珊珊',
          minutes: 7, evalMinutes: 3, status: 'confirmed',
        },
      ],
      notes: ['宾客 3 位首次到访', '本期中文例会', '二维码沿用长期投票链接'],
      records: {
        timing: [
          { id: 'u1', segment: '召集与开场', speaker: '怀童', planned: 5, actual: 6, status: 'over' },
          { id: 'u2', segment: '会议促进者介绍', speaker: '珊珊', planned: 15, actual: 16, status: 'over' },
          { id: 'u3', segment: '备稿演讲 1', speaker: '张三', planned: 10, actual: 13, status: 'over' },
          { id: 'u4', segment: '备稿演讲 2', speaker: '李四', planned: 10, actual: 9, status: 'ok' },
          { id: 'u5', segment: '即兴演讲', speaker: '赵六', planned: 25, actual: 31, status: 'over' },
          { id: 'u6', segment: '促进者报告', speaker: '兰辛', planned: 18, actual: 16, status: 'ok' },
        ],
        ah: { 张三: { 嗯: 5, 然后: 4 }, 赵六: { 那个: 7, 就是: 3 }, 珊珊: { 嗯: 2 } },
        grammar: {
          good: ['把复杂的事情说简单', '他的停顿比语言更有力', '结尾回扣开头很漂亮'],
          issues: [
            { type: '用词', text: '进行一个讲解', fix: '改为「讲解」' },
            { type: '语法', text: '通过这次让我学到', fix: '改为「这次让我学到」' },
          ],
        },
      },
      retro: null,
      live: null,
    };

    const m336 = {
      id: 'mtg-336', meetingNo: 336, date: '2026-11-12', weekday: '周四',
      start: '19:30', end: '21:30', language: 'zh', theme: '把话说短', tableTopicsCount: 6,
      status: 'draft',
      segments: [
        sg('召集与开场', 'opening', 5, '怀童'),
        sg('会议促进者介绍', 'facilitator', 12, '珊珊', 'confirmed'),
        sg('备稿演讲 1', 'speech', 10, '张三', 'pending'),
        sg('合影与休息', 'break', 10, '怡欣', 'confirmed'),
        sg('即兴演讲', 'tabletopics', 17, '赵六', 'confirmed'),
        sg('促进者报告', 'report', 15, ''),
        sg('投票与颁奖', 'vote', 5, '怡欣', 'confirmed'),
        sg('谢幕', 'closing', 5, '怀童'),
      ],
      speeches: [
        {
          id: 'sp-336-1', path: 'PM', level: 2, title: '', requirement: '',
          speaker: '张三', evaluator: '', minutes: 7, evalMinutes: 3, status: 'pending',
        },
      ],
      notes: [],
      records: { timing: [], ah: {}, grammar: { good: [], issues: [] }, ahByWord: {} },
      retro: null,
      live: null,
    };

    return {
      version: 2,
      club: { name: '南沙港湾头马俱乐部', city: '广州南沙' },
      activeMeetingId: 'mtg-336',
      meetings: [m336, m335, m334],
      members,
      counterWords: ['嗯', '那个', '然后', '就是', '这个'],
      dcp: {
        period: { from: '2026-07-01', to: '2026-12-31' },
        awards: { level1: 3, level2: 3, level3: 1, level45: 0 },
        newMembers: 5,
        officersTrained: { round1: 5, round2: 3 },
        duesOnTime: true,
        history: [{ month: '2026-07', achieved: 1 }, { month: '2026-10', achieved: 5 }],
      },
    };
  }

  CC.seed = { build };
})();
