# 头马例会模块化工具链 · 项目上下文（Context Brief）

> 本文件由主理人（齐活林 · 交付总监）维护，供团队成员共享。所有成员开工前先读本文件。
> 项目所有者：**Altair Li**（GitHub `Altairpaca`，`altairpaca@gmail.com`，HKUST(GZ)，广州南沙）
> 创建日期：2026-10-10

---

## 一、用户原始需求（逐字）

> 以我（Altair Li）的名义，组织进行管理模块的开发，采用模块化的设计模式，各个组件可插拔，例会议程表制作接龙可以小程序化，三官记录也可以按照单客户端自包含的HTML方式进行开发，也可以给出不同的版本比如类GC的自包含版本和小程序友好的BS模型版本，可以作为不同的repo进行开发，最终同步提交到github上，都以我的名义，邮箱是altairpaca@gmail.com。

**拆解为 6 条硬需求**：
1. 以 **Altair Li** 名义开发，提交到 GitHub，邮箱 `altairpaca@gmail.com`
2. **模块化 + 可插拔**设计
3. **会前议程表制作 / 接龙** 方向 → 可**小程序化**
4. **会中三官记录** 方向 → **单客户端自包含 HTML** 方式
5. 提供**不同版本**：**类 GC 自包含版** 与 **小程序友好 BS 模型版**
6. 不同形态作为**不同 repo** 开发

---

## 二、上游参考站：gctoastmaster.club（GC 北京俱乐部）

**技术本质**：nginx/1.18.0 纯静态托管；约 40 个 HTML；**零外部 js/css、零自建后端**；每个工具是可单独下载、离线使用的单文件应用。

**工具清单（27 项，6 类）**：

| 类别 | 工具 | 能力 |
|---|---|---|
| 会议流转 | gc-rsvp / gc-speech / gc-ballot / gc-rsvp-guest / gc-agenda | 报名接龙、备稿申请（项目级联+排期看板）、评选投票（匿名投票码）、来宾通道、议程自动生成 |
| 现场三官 | universal-timer / gc-timer-mobile / timer-cards1099 / gc-ah-counter / gc-grammarian / gc-role-helper | 通用计时器、当期专用计时、信号时间卡、赘词计数、语法官、三官首次担任指南 |
| AI 助手 | ai2/（GC 大脑） | 门房问答 / 英语教练 / 成长陪伴三分身 |
| 内容成长 | 会议纪要 / 金句墙 / tips90 / 读书会 / gc-pathways-hub / gc-report🔒 / gc-attendance🔒 / gc-growth🔒 / gc-analytics🔒 | 会议回顾、金句、TI 90 贴士、Pathways 6 路径/5 级/52 评估表、出勤与成长分析 |
| 更多 | gc-roles / gc-themes-collection / president-opening / word-of-the-day-collection | 9 角色指南、历期主题、会长开幕词、每日一词 |

**关键观察**：① 验证了「单文件 + 无后端」可行；② 但工具之间**数据不通**（报名/议程/投票各存各的）；③ 成长数据需权限、与俱乐部深度绑定。

---

## 三、用户已有本地资产

### 3.1 头马三官助手（`F:/Programs/俱乐部/头马三官助手/`）

| 资产 | 路径 | 状态 | 价值 |
|---|---|---|---|
| 计时器 | `离线版/universal-timer.html` (66KB) | **已改造** | rAF 精确计时、三色灯、Web Audio 提示音、环节平行动计时、角色预设 + 报告三视图 |
| 哼哈官 | `离线版/gc-ah-counter.html` (52KB) | 原样 | 中英词表、赘词/过渡词分区、时间线日志、每分钟频率 Top3 |
| 语法官 | `离线版/gc-grammarian.html` (28KB) | 原样 | 每日一词、开场 Script、人名点选计数、妙语记录、双语报告、ASR（需联网） |
| 报告内核 | `离线版/universal-timer.html` L650/L1171/L1281/L1293 | **高价值** | `mdToHtml()` 零依赖 GFM 渲染 · `colorizeStatus()` · `wrapByWidth()` · `buildReportImage()` Canvas 自绘 2×PNG（高度随行数伸缩、白底版式） |
| 测试 | `离线版/_selftest.js` | 34 项全通过 | 纯逻辑单测范式 |
| 启动器 | `离线版/start-server.py` | 可用 | 满足安全上下文（麦克风/ASR 需 localhost 或 https） |
| 原始快照 | `原始快照/` | 复核用 | 含 home.html 站点主页 |

### 3.2 议程表制作规则体系（`议程表/规则与参考/`）

- `议程表制作流程总结.md`、`中英文名映射表.md`（唯一事实源）、`议程表制作问题总结.md`、`议程表ai修改prompt.docx`、skill `tmc-agenda-generation`
- **保真制表方法**：复制日期最大那期的 xlsx 作底稿 → **XML 直改 `sheet1.xml` + `sharedStrings.xml`**（**禁用 openpyxl，会丢 EMF/Logo/二维码**）
- 交付命名：`YYYY.MM.DD第 NNN 次例会会议程表.xlsx`
- 关键：改公式/行结构后**必须删 `xl/calcChain.xml`**；导出 PDF 用 Excel「打印到 Microsoft Print to PDF」（**不用 WPS、不用导出为PDF**，会降采样二维码）

---

## 四、GitHub 开源生态（16+ 项目）

| 方向 | 项目 | 技术栈 / 亮点 |
|---|---|---|
| 议程生成 | rahulkg31/toastmasters-agenda-generator | HTML + html2canvas + jsPDF，MIT |
| 议程生成 | sbartholomeusz/cinnamon | Angular SPA 自包含，GitHub Pages，MIT |
| 议程生成 | NooraWael/toastmasters-agenda | Next.js + TS + 多语言（RTL） |
| 议程生成 | abaker86/toastmastersagenda | C#/.NET，cookie 存储、无后端无 PII |
| 议程生成 | saroz/toastmaster-agenda-generator | JS + Firebase |
| 计时器 | **fangfufu/toastmaster-timer** | **PWA 无后端、可编辑槽位、YAML 存取、GPLv3（最强竞品）** |
| 计时器 | davidbartonau/toastmasters-timer | TS + Vite + Firebase Firestore 双端同步 |
| 计时器 | LD-Shell/toastmasters-timer | 纯静态 HTML/CSS/JS |
| 三官 | AkRypt/HITAMToastmastersApp | 会员 + 会议纪要 + Timer/AhCounter/Grammarian |
| 三官 | dairecoleman/ahcounter | Streamlit + 赘词可视化 |
| 全流程 | **skipandsnow/toastlabplus** | **Flutter + GCP 后端，功能最全（认证/多分会/角色报名/Gemini 解析 Excel 模板/投票 SSE）** |
| 全流程 | Gloryoftan/Toastmasters | Angular 20 + localStorage，**中文**（南京 ET） |
| 全流程 | Mutai-Gilbert/toastmasters-members | Django + SQLite |
| 全流程 | jharbieh/toastmasters | PWA + 52 周排期算法 + 本地分析 |
| 数据模型 | twin/tm-api | Ruby JSON:API：meetings / members / guests / participations / speeches，角色枚举官方化 |

**结论**：
1. **没有任何开源项目覆盖「会前议程 → 会中三官 → 会后复盘」全流程**
2. 议程类工具都**从零生成，无法保真输出**既有俱乐部格式 xlsx
3. 计时器类 `fangfufu` 最成熟但仍是独立工具
4. 唯一全流程方案 `toastlabplus` 是**重后端架构**
5. **Toastmasters International 无公开自助 API**（仅 dashboards.toastmasters.org 报表门户 + Club Finder，无官方接口）

---

## 五、架构不变式（不可动摇）

1. **单文件自包含** —— 延续 GC 站「一个 HTML 装下全部」哲学；任何工具双击即用、断网可用
2. **零后端 / 本地优先** —— 数据默认只存本机 `localStorage` + 可导出 JSON；不强制登录、不收集 PII
3. **会议 JSON 为单一事实源** —— 会前制表、会中记录、会后复盘读写同一份结构化数据
4. **不重造已验证的轮子** —— 议程 xlsx 保真导出沿用 XML 直改；三官在既有页面上升级而非重写

**例外说明**：小程序版因平台限制（微信小程序无法 `file://`、必须有其自己的网络请求模型）可突破第 1、2 条的部分约束，这正是「BS 模型版本」存在的理由。

---

## 六、角色枚举参考（来自 twin/tm-api）

官方角色：`Toastmaster` / `General Evaluator` / `Speaker`（带 speech_id）/ `Evaluator`（带 speaker_id）/ `Table Topics Master` / `Timer` / `Grammarian` / `Ah-Counter`

中文俱乐部扩展角色（来自实际议程表）：会议经理、开场致辞（教育副会长）、总主持、计时官、哼哈官、语法官、赘词/过渡词官、备稿演讲者、点评师、总体点评、即兴主持、即兴点评、圆桌/工作坊主讲、投票官、接待官、摄影官、幻灯片播放（教育副会长）、电脑支持、会长/主席。

---

## 七、团队与分工

| 成员 | Agent ID | 职责 |
|---|---|---|
| 主理人 齐活林 | team-lead | 编排、汇总、对外交付 |
| 产品经理 许清楚 | software-product-manager | PRD |
| 架构师 高见远 | software-architect | 系统架构 + 任务分解 |
| 工程师 寇豆码 | software-engineer | 代码实现 |
| QA 严过关 | software-qa-engineer | 测试 |
