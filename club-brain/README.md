# club-brain

> 头马（Toastmasters）俱乐部运营的**验收层**工具集。零依赖、离线可用、纯函数内核。
>
> 生态里已经有 170+ 个项目在"生成"议程、海报、排班表；几乎没有一个在"验真"。
> 这个工具包只做一件事：**在东西发出去之前，告诉你哪里会出事。**

作者：Altair Li &lt;altairpaca@gmail.com&gt;　·　许可：MIT　·　运行环境：Node ≥ 18（无第三方依赖）

---

## 为什么需要它

一次议程表改版可能悄悄破坏合并单元格；一张海报的二维码可能印出来才发现扫不出；
一份会单可能写着 21:46 结束却没人注意；一位会员可能一场被排了三个角色。

这些都不是"功能缺失"，而是"缺少校验"。`club-brain` 把俱乐部的隐性规则写成**可执行的断言**：

- 断言不通过 → 退出码非 0 → 流水线阻断，不给你"发出去再说"的机会。
- 每条问题都有稳定的错误码（如 `E_END_OVERRUN`），可以写进回归测试。

---

## 安装与使用

```bash
git clone https://github.com/Altairpaca/club-brain.git
cd club-brain
node --test test/agenda.test.js test/toolkit.test.js   # 36 项测试
node src/cli.js demo                                     # 跑一遍全部示例，产物写入 out/
```

不需要 `npm install`。整个包没有任何依赖。

### 五个命令

```bash
# 1) 议程体检（可加 --html 出可视化报告）
node src/cli.js lint examples/meeting.sample.json --roster examples/roster.sample.json --html out/report.html

# 2) 品牌物料体检
node src/cli.js brand examples/asset.sample.json

# 3) 角色排班
node src/cli.js schedule examples/schedule.sample.json

# 4) 三官数据 → 会议复盘
node src/cli.js retro examples/retro.sample.json

# 5) DCP 十项目标缺口与预测
node src/cli.js dcp examples/dcp.sample.json
```

所有命令都支持 `--json`（机器可读）与 `--md <file>`（写文件）。
`lint` / `brand` 在发现问题时退出码为 **1**，可直接用于 CI 或本地钩子。

---

## 五个模块

### 1. `agenda-lint` · 议程规则断言引擎

把"议程表该长什么样"变成 20 多条可执行规则：

| 规则 | 说明 |
|---|---|
| `E_END_OVERRUN` | 环节累加后的结束时间超过截止时间（默认 21:30） |
| `E_WEEKDAY_MISMATCH` | 日期与星期不符 |
| `E_PENDING_IN_MAIN` | 待确认人员进入了正式名单 |
| `E_REQUIREMENT_TOO_LONG` | 「项目要求」超过 B:G 合并单元格 42 字上限（会被裁成三行） |
| `E_ENGLISH_IN_NOTES` | 中文例会备注列出现英文名/拼音 |
| `E_TOO_MANY_ROLES` | 同一人一场担任超过 2 个角色 |
| `E_SELF_EVAL` | 自己点评自己 |
| `E_UNKNOWN_PERSON` | 人员不在花名册（支持别名：`733`→珊珊、`JC`→兰辛） |
| `W_SPEECH_ORDER` | 备稿未按等级升序 |
| `W_TT_FORMULA` | 即兴时长与「5 + 2×人数」不符 |
| `W_DURATION_RANGE` | 环节时长超出该类型常见区间 |

输出 0–100 评分与三级问题（error/warn/info），并给出完整时间线。

### 2. `brand-lint` · 品牌物料校验

不做生成，只判定"这张图能不能发"。校验主色占比、强调色上限、非品牌色比例、
二维码单模块像素/静区/对比度、文字溢出、字号下限、Logo 净空、安全区、绝对化用语、
「非官方」声明。中性色（白/黑/灰）自动排除，不误判。

### 3. `role-scheduler` · 约束排班

角色排班本质是带约束的指派问题。成本函数：

```
成本 = 能力缺口 × 2 + 该角色历史次数 × 1.4 − 本人意愿
```

先用加权贪心（关键角色优先），再做 2-opt 局部交换。硬约束：不可用日期、单场上限、
个人总容量。输出每一条排班的**依据**（为什么排给 TA），缺人时给前 3 候选，
并给出公平性基尼系数。

### 4. `meeting-retro` · 三官数据 → 结构化复盘

把计时、哼哈、语法官记录规范成 `retro.json`：环节偏差表、按人聚合
（超时次数/准时率/赘词数/每分钟赘词率/高频赘词）、准时度评分、自动结论、
与上期的对比。三官数据从此不再是一次性的。

### 5. `dcp-tracker` · DCP 缺口与预测

十项目标可配置（默认值仅作示例，**官方口径以当年 DCP 手册为准**）。
输出每项进度、达成等级（5/7/9 项）、按历史速度预测还需几个月到 Select / President's，
以及每个缺口对应的具体动作。

---

## 数据契约

所有模块共享一份极简的 `meeting.json`（见 `examples/meeting.sample.json`）：

```json
{
  "meetingNo": 335,
  "date": "2026-11-05",
  "weekday": "周四",
  "start": "19:30",
  "end": "21:30",
  "language": "zh",
  "segments": [
    { "name": "召集与开场", "kind": "opening", "minutes": 5, "owner": "怀童", "ownerStatus": "confirmed" }
  ],
  "speeches": [
    { "path": "PM", "level": 1, "title": "第一次站上台", "requirement": "…",
      "speaker": "张三", "evaluator": "赵六", "minutes": 7, "evalMinutes": 3 }
  ],
  "notes": ["宾客 3 位首次到访"]
}
```

`kind` 取值：`opening | facilitator | speech | break | tabletopics | workshop | report | special | vote | closing`。
`ownerStatus` 三态：`confirmed | pending | omitted` —— 这是本工具包最核心的设计：
**待确认的人不允许出现在正式名单里**。

---

## 设计原则

1. **只验真，不生成。** 生成器可以很笨，校验器必须很严。
2. **零依赖。** 没有 `npm install`，断网能用，五年后还能跑。
3. **纯函数内核。** 所有判定不碰文件系统与网络，可被测试、可被嵌入任何宿主。
4. **错误码稳定。** 每条规则一个码，可用于回归测试与豁免。
5. **断言即阻断。** 默认严格；要放过就显式豁免并留痕，而不是默认宽松。

---

## 路线图

本工具包是「头马 AI 自动化 1000 个创新点」中 **TOP 6** 的实现（见
`../头马生态调研/创新点库/00_总览与Gap分析.md`）。后续批次：

- **B2**：议程 JSON 中间层（AG-022）、点评建议闭环（OF-033）、会员待办（MB-075）、会费对账（FI-005）、决议台账（GV-003）、规则有效期（GV-012）
- **B3**：议程↔问卷联动（AG-043）、项目要求结构化（ED-002）、俱乐部仪表盘（DT-012）、替班市场（SC-028）、比赛计分器（EV-006）

---

## 免责声明

本项目为独立开源项目，**与 Toastmasters International 无隶属、赞助或背书关系**。
Toastmasters、Pathways 等是 Toastmasters International 的商标。
各俱乐部的具体规则、DCP 口径、时长标准请以官方最新文件与本俱乐部惯例为准。

## 许可

[MIT](./LICENSE) © Altair Li
