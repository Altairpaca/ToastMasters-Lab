# Club Console

> 头马（Toastmasters）俱乐部的**运营台**：一场会从起草到复盘，只用一个离线应用。
>
> 双击一个 HTML 文件就能跑。零依赖、零后端、零账号，数据只存在你自己的浏览器里。

作者：Altair Li &lt;altairpaca@gmail.com&gt;　·　许可：MIT　·　体积：单文件 198 KB

---

## 它解决什么

头马俱乐部的工作被切成了很多互不相通的碎片：议程在 Excel 里、计时在三官工具里、
复盘在微信群里、会员进度在一个没人更新的表格里、投票在问卷星里。

每一段都要重新录一遍，每一段都没有校验，出错只能事后发现。

**Club Console 把这些串成一条链**：议程改一次 → 计时器 CSV、会单、投屏、会中记录、
复盘、问卷草稿全部同步。并且在每个交接点做**断言**：不通过就不让你往下走。

---

## 快速开始

```bash
# 方式一：直接打开（推荐给非技术同学）
#   双击 dist/club-console.html

# 方式二：从源码构建
npm run build          # 生成 dist/club-console.html
npm test               # 62 项内核单元测试
npm run test:e2e       # 26 项真实 DOM 冒烟测试（jsdom）
```

不需要 `npm install`，没有任何第三方依赖。

---

## 六个视图

| 视图 | 做什么 | 关键设计 |
|---|---|---|
| **总览** | 本期评分、结束时间、确认率、待办、时间线 | 一眼看出"这期能不能定稿" |
| **议程** | 环节/备稿/备注全字段编辑 + 实时断言 + 五路导出 | 改一个数字，评分和时间线立刻重算 |
| **会中** | 大计时器、三色灯、流程队列、哼哈计数、语法官记录 | 只改 DOM 文本，不重渲染，计时不闪 |
| **投屏** | 给全场看的大屏：环节名、倒计时、三色灯、下一项 | 独立视图，按 `P` 一键切换 |
| **复盘** | 准时度、环节偏差、个人表现、自动结论、上期对比 | 三官数据自动变成结构化档案 |
| **会员与 DCP** | 会员台账（含角色能力矩阵）、排班求解、DCP 十项目标 | 排班给依据，DCP 给预测和动作 |

---

## 一条数据链

```
议程（结构化） ──┬─→ 断言（20+ 条规则）
                 ├─→ 计时器 CSV（给三官工具）
                 ├─→ 会单 Markdown / 打印
                 ├─→ 会中驾驶舱（按环节推进）
                 │      ├─→ 计时记录
                 │      ├─→ 哼哈计数
                 │      └─→ 语法官记录
                 ├─→ 复盘（准时度 / 偏差 / 个人趋势）
                 └─→ 问卷草稿（奖项与选项，含名额约束）
```

同一份 `meeting.json`，六个视图共用；不存在"改了这处忘了那处"。

---

## 断言清单（节选）

| 代码 | 规则 |
|---|---|
| `E_END_OVERRUN` | 环节累加后的结束时间超过截止时间 |
| `E_WEEKDAY_MISMATCH` | 日期与星期不符 |
| `E_PENDING_IN_MAIN` | **待确认**的人进入了正式名单 |
| `E_REQUIREMENT_TOO_LONG` | 「项目要求」超过 B:G 合并单元格 42 字上限 |
| `E_ENGLISH_IN_NOTES` | 中文例会备注列出现英文名/拼音 |
| `E_TOO_MANY_ROLES` | 同一人一场担任超过 2 个角色 |
| `E_SELF_EVAL` | 自己点评自己 |
| `E_UNKNOWN_PERSON` | 人员不在花名册（支持别名：`733`→珊珊、`JC`→兰辛） |
| `W_SPEECH_ORDER` | 备稿未按等级升序 |
| `W_TT_FORMULA` | 即兴时长与「5 + 2×人数」不符 |

`ownerStatus` 的三态（`confirmed / pending / omitted`）是整套设计的地基：
**待确认的人永远进不了正式名单**，这是议程出错最高发的地方。

---

## 内核（可独立使用）

`src/core/` 与界面解耦，Node 与浏览器共用同一份源码：

| 模块 | 能力 |
|---|---|
| `agenda-lint` | 20+ 条议程规则、时间线推导、0–100 评分、HTML/Markdown 报告 |
| `brand-lint` | 品牌物料校验：主色占比、二维码模块/静区/对比度、文字溢出、绝对化用语 |
| `role-scheduler` | 约束排班：成本矩阵 + 加权贪心 + 2-opt，输出依据与公平性基尼 |
| `meeting-retro` | 三官数据 → 准时度、偏差、个人趋势、自动结论 |
| `dcp-tracker` | DCP 十项目标（可配置）、达成等级、速度预测、逐项动作 |
| `dues-recon` | 台账 × 流水匹配（金额容差 + 日期窗口 + 姓名加权）、双向未匹配、收缴率 |
| `feedback-loop` | 点评建议闭环：重复建议 ≥2 次告警、关闭率、陈旧项 |
| `survey-draft` | 从议程生成投票问卷草稿（名额约束 + 排除待确认），可转问卷星 JSONL |

### 命令行

```bash
node src/cli.js lint examples/meeting.sample.json --roster examples/roster.sample.json --html out/report.html
node src/cli.js brand examples/asset.sample.json
node src/cli.js schedule examples/schedule.sample.json
node src/cli.js retro examples/retro.sample.json
node src/cli.js dcp examples/dcp.sample.json
node src/cli.js dues examples/dues.sample.json
node src/cli.js feedback examples/feedback.sample.json
node src/cli.js survey examples/meeting.sample.json --jsonl out/survey.jsonl
```

`lint` / `brand` / `dues` 有问题时退出码为 **1**，可直接接 CI 或本地钩子。

---

## 数据与隐私

- 全部数据存在浏览器 `localStorage`（键 `club-console/v2`），**不上传任何服务器**。
- 无第三方脚本、无 CDN、无字体外链，断网可用。
- `localStorage` 不可用时会降级为内存模式并提示，此时请用「备份」导出 JSON。
- 「备份 / 恢复」是唯一的跨设备迁移方式——记得定期导出。

## 键盘

| 按键 | 作用 |
|---|---|
| `1`–`6` | 切换视图 |
| `Ctrl/⌘ + Z` | 撤销（40 步） |
| `Ctrl/⌘ + Shift + Z` | 重做 |
| `空格` | 会中：开始 / 暂停 |
| `N` | 会中：完成当前环节 |
| `P` | 会中 ↔ 投屏 |
| `Esc` | 关闭弹层 / 回总览 |

---

## 架构

```
src/core/*.js      纯函数内核（CommonJS，Node 直接 require，浏览器由构建包装）
app/
  ui/dom.js        极简 h() 与 UI 基元
  ui/chart.js      纯 SVG 甘特图与对比条
  state.js         单一事实源 + 撤销栈 + 持久化
  seed.js          示例数据
  views/*.js       六个视图
  app.js           路由、快捷键、顶栏与状态栏
build/build.js     把内核 + 视图 + CSS 内联成一个 HTML
dist/              产物
```

构建不引入打包器：给每个 CommonJS 内核套一个 `module/require` 迷你宿主，
再与视图脚本顺序拼接，最后内联进模板，产物可直接 `file://` 打开。

## 路线图

- **v2.1**：议程多期连排、替班市场、决议台账
- **v2.2**：内容矩阵（一稿多平台 + 品牌自检面板）
- **v2.3**：跨设备同步（可选的本地局域网服务，仍不依赖云）

## 免责声明

本项目为独立开源项目，**与 Toastmasters International 无隶属、赞助或背书关系**。
Toastmasters、Pathways 等是 Toastmasters International 的商标。
各俱乐部的规则、DCP 口径、时长标准请以官方最新文件与本俱乐部惯例为准
（`dcp-tracker` 的默认目标仅为示例，可配置）。

## 许可

[MIT](./LICENSE) © Altair Li
