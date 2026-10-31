'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { buildSurveyDraft, toWjxJsonl, toMarkdown } = require('../src/core/survey-draft');

function meeting(over) {
  return Object.assign({
    meetingNo: 335,
    date: '2026-11-05',
    theme: '把话说清楚',
    segments: [
      { id: 's1', name: '召集与开场', kind: 'opening', minutes: 5, owner: '怀童', ownerStatus: 'confirmed' },
      { id: 's2', name: '会议促进者介绍', kind: 'facilitator', minutes: 15, owner: '珊珊', ownerStatus: 'confirmed' },
      { id: 's3', name: '备稿演讲 1', kind: 'speech', minutes: 10, owner: '张三', ownerStatus: 'confirmed' },
      { id: 's4', name: '即兴演讲', kind: 'tabletopics', minutes: 25, owner: '赵六', ownerStatus: 'confirmed' },
      { id: 's5', name: '促进者报告', kind: 'report', minutes: 18, owner: '兰辛', ownerStatus: 'confirmed' },
    ],
    speeches: [
      { title: '第一次站上台', speaker: '张三', evaluator: '赵六', status: 'confirmed' },
      { title: '', speaker: '李四', evaluator: '怡欣', status: 'confirmed' },
    ],
  }, over || {});
}

test('最佳角色：多选，名额 2', () => {
  const d = buildSurveyDraft(meeting());
  const q = d.questions.find((x) => x.id === 'best-role');
  assert.ok(q);
  assert.strictEqual(q.type, 'multi');
  assert.strictEqual(q.uplimit, 2);
  assert.ok(q.title.includes('最多选 2 项'));
});

test('最佳角色：待确认的人不进选项', () => {
  const m = meeting();
  m.segments[1].ownerStatus = 'pending';
  const d = buildSurveyDraft(m);
  const q = d.questions.find((x) => x.id === 'best-role');
  assert.ok(!q.options.some((o) => o.text.includes('珊珊')), '待确认的珊珊不应出现');
  assert.ok(d.warnings.some((w) => w.includes('珊珊')), '应给出待确认提示');
});

test('最佳角色：宣导类环节被剔除', () => {
  const m = meeting();
  m.segments.push({ id: 'x', name: '品牌宣导', kind: 'facilitator', minutes: 5, owner: '王五', ownerStatus: 'confirmed' });
  const d = buildSurveyDraft(m);
  const q = d.questions.find((x) => x.id === 'best-role');
  assert.ok(!q.options.some((o) => o.text.includes('王五')));
});

test('最佳备稿：题名为空时用「题目待定」', () => {
  const d = buildSurveyDraft(meeting());
  const q = d.questions.find((x) => x.id === 'best-speech');
  assert.ok(q.options.some((o) => o.text.includes('题目待定') && o.text.includes('李四')));
  assert.strictEqual(q.type, 'single');
});

test('最佳点评：包含总体点评与即兴点评', () => {
  const d = buildSurveyDraft(meeting());
  const q = d.questions.find((x) => x.id === 'best-eval');
  const texts = q.options.map((o) => o.text);
  assert.ok(texts.some((t) => t.includes('总体点评：兰辛')));
  assert.ok(texts.some((t) => t.includes('即兴点评：赵六')));
  assert.ok(texts.some((t) => t.includes('的点评：赵六')));
});

test('最佳即兴：选项留空', () => {
  const d = buildSurveyDraft(meeting());
  const q = d.questions.find((x) => x.id === 'best-tabletopics');
  assert.ok(q);
  assert.strictEqual(q.options.length, 0);
  assert.ok(q.note);
});

test('建议题为简答且选填', () => {
  const d = buildSurveyDraft(meeting());
  const q = d.questions.find((x) => x.id === 'advice');
  assert.strictEqual(q.type, 'text');
  assert.strictEqual(q.required, false);
});

test('没有即兴环节时不生成该题', () => {
  const m = meeting();
  m.segments = m.segments.filter((s) => s.kind !== 'tabletopics');
  const d = buildSurveyDraft(m);
  assert.ok(!d.questions.some((x) => x.id === 'best-tabletopics'));
});

test('JSONL：题型映射 4=多选 3=单选 5=简答', () => {
  const d = buildSurveyDraft(meeting());
  const lines = toWjxJsonl(d).split('\n').map((l) => JSON.parse(l));
  assert.strictEqual(lines.length, d.questions.length);
  const role = lines.find((l) => l.title.includes('最佳会议角色'));
  const advice = lines.find((l) => l.title.includes('建议'));
  assert.strictEqual(role.q_type, 4);
  assert.strictEqual(role.uplimit, 2);
  assert.strictEqual(advice.q_type, 5);
  assert.strictEqual(advice.required, false);
});

test('Markdown 输出含题号与选项', () => {
  const md = toMarkdown(buildSurveyDraft(meeting()));
  assert.ok(md.includes('最佳会议角色'));
  assert.ok(md.includes('- '));
});

test('空议程不崩', () => {
  const d = buildSurveyDraft({});
  assert.ok(Array.isArray(d.questions));
  assert.ok(d.warnings.length > 0);
});
