# TMC Toolkit · QA 测试报告

> **QA 工程师**：严过关（Yan）
> **文档版本**：v1.1（Round 2 回归后定稿）
> **上游输入**：`docs/ARCHITECTURE.md`（§13 验收标准 / §9 构建 / §11 共享约定）、`docs/PRD.md`、工程师产出代码
> **测试原则**：独立复跑工程师自测 + 新增独立测试，不轻信自报结论；只写测试、不改业务源码
> **文档语言**：简体中文

---

## 1. 结论摘要

| 项 | 结论 |
|---|---|
| **总体通过率** | **Round 2 全量回归：374/374 通过（100%）** |
| **智能路由判定** | Round 1：源码 Bug（→ 工程师寇豆码修复）；Round 2：**全部通过 → NoOne** |
| 严重缺陷 | 1 个（High · S1，**已修复并回归通过**） |
| 架构不变式 | 零外部引用 ✅ / 内核纯净 ✅ / 单文件可用 ✅（逐条证据见 §7） |
| 测试轮次 | 2 轮（上限）—— Round 1 发现并路由，Round 2 回归全绿 |

---

## 2. 测试环境

| 项 | 值 |
|---|---|
| 项目根 | `F:/Programs/俱乐部/tmc-toolkit/` |
| Node | 22.22.2（`.workbuddy/binaries/node/versions/22.22.2-6/node.exe`） |
| 无头浏览器 | 本机 Chrome（`C:/Program Files/Google/Chrome/Application/chrome.exe`），经 `playwright-core` 驱动 |
| E2E 依赖 | `playwright-core` 装入 ASCII 工作目录 `/tmp/tmc-qa-e2e/`（中文路径对无头浏览器不可靠） |
| xlsx 处理 | 仅内存构造 / 只读，**未用 Excel/WPS 打开另存**（遵守约束） |

---

## 3. 测试矩阵（新增独立用例汇总）

### 3.1 运行命令与结果

| 测试套件 | 命令 | 用例 | 通过 | 失败 |
|---|---|---|---|---|
| 内核自测（工程师，复跑） | `node test/_selftest.js` @ tmc-core | 123 | 123 | 0 |
| **内核独立测试（新增）** | `node test/qa-core.test.js` @ tmc-core | 89 | 89 | 0 |
| xlsx 自测（工程师，复跑） | `node test/xlsx.test.js` @ tmc-agenda-html | 21 | 21 | 0 |
| **xlsx 保真独立测试（新增）** | `node test/qa-xlsx.js` @ tmc-agenda-html | 37 | 37 | 0 |
| 议程产物冒烟 | `node test/smoke.js` @ tmc-agenda-html | 9 | 9 | 0 |
| 三官产物冒烟 | `node test/smoke.js` @ tmc-officers-html | 30 | 30 | 0 |
| **三官 E2E 独立测试（新增）** | `node test/qa-e2e.js` @ tmc-officers-html | 19 | 19 | 0 |
| **架构不变式独立测试（新增）** | `node test/qa-invariants.js` @ tmc-officers-html | 33 | 33 | 0 |
| 服务端冒烟 | `node test/smoke.js` @ tmc-server-lite | 13 | 13 | 0 |

> **QA 新增独立用例合计：89 + 37 + 19 + 33 = 178 项；Round 2 全部通过。**
> 全量套件合计：123 + 89 + 21 + 37 + 9 + 30 + 19 + 33 + 13 = **374 项，0 失败**。
> 覆盖估算：内核关键纯函数（md/meeting/timer/image/agenda）分支覆盖充分；产物层零外部引用/保真/自包含完整覆盖（非行覆盖率工具测得，为按验收标准的定向覆盖）。

### 3.2 复跑工程师自测的独立性说明

- 工程师自报 `_selftest.js` 123 项通过，**已独立复跑确认属实**，并逐条审查断言：断言均为行为验证（如 `judgeStatus(449,300,420)==='ok'`、`patch 后 calcChain 被删除`、转义后 `&lt;img` 存在），**非空断言/非恒真断言**。
- 复跑结论与自报一致：`结果: 123 通过, 0 失败`。

---

## 4. 缺陷清单与智能路由

### 4.1 Round 1 —— 发现 1 个高危源码缺陷

| ID | 严重级 | 模块 | 状态 |
|---|---|---|---|
| **S1** | **High** | `tmc-core/core/xlsx-writer.js`（`patch()` / `stripCalcChain()`） | **Round 2 已修复并回归通过** |

#### S1 · xlsxWriter 删除 calcChain.xml 后遗留「悬空引用」

- **现象**：`patch()` / `stripCalcChain()` 删除 `xl/calcChain.xml` entry 时，未同步清理引用它的 `[Content_Types].xml` 的 `<Override PartName="/xl/calcChain.xml">` 与 `xl/_rels/workbook.xml.rels` 的 `<Relationship ... Target="calcChain.xml">`，产生悬空引用；**Excel 打开会报「文件需修复」**。
- **复现**：见 §5 复现脚本（用 `tmc-core` 内存构造含 calcChain 的底稿 → `patch()` → 检查残留）。
- **期望 vs 实际**：期望删除 calcChain 时同步移除两处引用；实际两处引用均残留。
- **依据**：架构 §13 T03 验收标准②「改公式/行结构后自动删除 `xl/calcChain.xml`」（意图为产出干净合法文件）；§11.3 约定产物应可正常打开。
- **影响**：xlsx 保真导出在「底稿含 calcChain 且被改动」时产出非法文件；`tmc-miniprogram/lib/tmc-core/**` 为 vendored 副本，需同步。
- **路由判定**：断言期望行为正确（符合 T03/§11.3）但实现输出错误 → **源码 Bug，反馈工程师寇豆码修复**（QA 不改源码）。
- **验证用例**：`tmc-agenda-html/test/qa-xlsx.js` 中 4 条：
  - `[Content_Types].xml 无悬空 Override 引用`
  - `[Content_Types].xml 不再声明 calcChain`
  - `xl/_rels/workbook.xml.rels 无悬空引用`
  - `workbook.xml.rels 不再引用 calcChain`

### 4.2 Round 1 —— 测试自身缺陷（QA 自修，不计入源码缺陷）

| ID | 描述 | 处理 |
|---|---|---|
| T1 | `toHtml(null)` 断言写为「返回空串」，但实现为 `String(md)` → 返回 `"<p>null</p>"`。实现无异常、行为已定义，**断言错误**。 | QA 修正断言为「不抛异常且返回 string」。 |
| T2 | `isSepRow('|---|')` 断言写为「false（1 个横线）」，但 `|---|` 实为 **3** 个横线（GFM 合法分隔行 → true）。**计数笔误**。 | QA 修正为 `|-|`→false、`|--|`/`|---|`→true。 |

### 4.3 Round 2 —— 回归验证（✅ 通过）

工程师修复 S1 后（在 `xlsx-writer.js` 新增 calcChain 悬空引用清理逻辑，并同步 miniprogram vendored 副本），QA 执行 Round 2：

- **定向回归**：`qa-xlsx.js` 原 4 条失败 → **全部转绿**。
- **对抗性加测**（8 条，已并入测试文件）：无 calcChain 底稿语义不变、多关系场景其余关系保留、二次 patch 幂等 → **全通过**。
- **全量回归**：9 个套件 **374/374 通过，0 失败**。
- **修复质量核查**：修复实现为 `stripCalcChainRefs`，同时清理 `[Content_Types].xml` 的 `<Override>` 与 `xl/_rels/workbook.xml.rels` 的 `<Relationship>`，且**幂等**（无 calcChain 时不改动 XML）；`tmc-miniprogram/lib/tmc-core/core/xlsx-writer.js` 与源**逐字节一致**。

---

## 5. 关键测试设计（独立测试覆盖点）

### 5.1 `tmc-core/test/qa-core.test.js`（89 项）

- **`mdToHtml`**：`<img onerror=...>`/`<script>` 注入转义（原始标签不出现）、`escapeHtml` 的 `&` 优先处理（不产生 `&amp;lt;`）、空/`null`/`undefined`/`0` 输入不抛异常、表格 4 种对齐解析、分隔行边界（`|-|` vs `|--|`）、超长单元格（10000 字符）完整保留、CRLF 归一。
- **`meetingModel.validate`**：官方最小实例（`tmc-toolkit/examples/meeting.min.json`）通过；4 项必填逐一测；`meeting_id`/`date`/`meeting_number` 格式；`language`/`agenda.type`/`ballot.category`/`timer.status` 非法枚举；`end_time ≤ start_time` 双向；非对象根；多错误同时收集；`evaluator` 未匹配进 `warnings` 而非 `errors`。
- **`timerCore.judgeStatus`**：恰好绿线(300)、绿线前(299)、恰好红线(420)、红牌后 29″(449)=ok、30″整(450)=over、31″=over；负数/非整数容错；`formatTime`/`parseTime` 边界（0/59/60/3599/负/非数字/秒>59）。
- **`imageKernel.wrapByWidth`**：空串→`['']`、单字符、单字符超宽不丢字、超宽折行（每行 ≤maxW）、折行拼接等于原文（无丢字）、中文折行。
- **`agendaCore`**：`timeColumn` 累计至 21:30；`validateTiming`（=135 不告警 / 160>135 告警）；`fromMin` 跨午夜回绕补零；`rowDiffChecklist`(3,5)/(5,3)/(4,4)/负数 的行号位移；`buildRows` 时间列随行位移正确、缓冲计入、presenter 取角色名。

### 5.2 `tmc-agenda-html/test/qa-xlsx.js`（37 项）

- 内存构造「结构逼真」底稿（含 `xl/media/image1.png`、`xl/media/image2.emf`、`xl/drawings/drawing1.xml`、`xl/worksheets/_rels/sheet1.xml.rels`、`xl/calcChain.xml`、`[Content_Types].xml`、`workbook.xml.rels`）。
- **保真**：`patch` 后 media/drawings 全保留；PNG/EMF **字节级**一致。
- **calcChain 删除 + 悬空引用**：entry 已删；`[Content_Types].xml` 无悬空 Override；`workbook.xml.rels` 无悬空引用；两处不再声明 calcChain；worksheet rels 的 drawing 目标仍存在。
- **写入正确性**：新文本单元格、公式 `<f>` 写入、既有单元格不破坏。
- **ZIP 往返**：entry 数/名/媒体字节/结构完整一致。
- **`stripCalcChain`**：独立可用、删 media 保留、幂等。
- **边界**：空 edits、非法字节 `validate` → `ok:false`。
- **对抗性检查（S1 修复回归）**：无 calcChain 底稿时 CT/rels 语义不变（幂等保护）；多关系场景下清理 calcChain 的同时保留 sheet/sharedStrings 关系；二次 `patch` 幂等。

### 5.3 `tmc-officers-html/test/qa-e2e.js`（19 项，playwright-core + 无头 Chrome）

- `file://` 加载 `dist/universal-timer.html`：标题、tab 渲染、默认视图。
- **零 console error**（监听 `console`/`pageerror`）。
- **零外部网络请求**（监听 `request`，非 `file:`/`data:`/`about:`/`blob:` 即违规）。
- 新增 2 条计时记录 → 生成报告 → 三视图（渲染/Markdown/纯文本）切换 → 三官报告（计时/哼哈/语法）切换，断言内容含 `TIMER'S REPORT` 与新增讲者。

### 5.4 `tmc-officers-html/test/qa-invariants.js`（33 项）

见 §6。

---

## 6. 关键复现脚本（S1）

```js
const TMC = require('./tmc-core/index.js');
const U = s => TMC.xlsx._enc.utf8Encode(s);
const base = TMC.xlsx.writeZip([
  { name:'[Content_Types].xml', data:U('<Types><Override PartName="/xl/worksheets/sheet1.xml" ContentType="x"/><Override PartName="/xl/calcChain.xml" ContentType="y"/></Types>') },
  { name:'xl/_rels/workbook.xml.rels', data:U('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="calcChain.xml"/></Relationships>') },
  { name:'xl/worksheets/sheet1.xml', data:U('<worksheet><sheetData><row r="1"><c r="A1"><f>1+1</f><v>2</v></c></row></sheetData></worksheet>') },
  { name:'xl/calcChain.xml', data:U('<calcChain><c r="A1" i="1"/></calcChain>') },
]);
const out = TMC.xlsx.patch(base, [{ sheet:'sheet1', ref:'A1', value:'SUM(1,2)', isFormula:true }]);
// 修复前：calcChain entry 已删，但 [Content_Types].xml 与 workbook.xml.rels 仍引用 calcChain（悬空）
// 修复后：两处引用同步移除，且幂等
```

---

## 7. 对架构不变式的验证结论（逐条给证据）

### 7.1 零外部引用 ✅

- **精确判据**：对 4 个 dist 产物扫描 —— ① 标签属性 `src=/href=/srcset=` 指向 `http(s)://` 或 `//`；② CSS `url(http...)`；③ `@import` 外链；④ 剔除 OOXML/XML 命名空间常量后残留的独立 `http` URL。
- **结论**：4 个产物（`universal-timer.html` / `ah-counter.html` / `grammarian.html` / `agenda-builder.html`）**均为 0 违规**。
- **补充运行时证据**：E2E 加载 + 完整交互过程中，`page.on('request')` 捕获到 **0 条**非 `file:`/`data:` 请求。
- **豁免说明**：`agenda-builder.html` 中唯一 `http://schemas.openxmlformats.org/...` 是 xlsx 的 XML 命名空间**字符串常量**（用于拼 OOXML），不触发任何网络加载，按判据豁免。
- 自动化：`tmc-officers-html/test/qa-invariants.js` §A。

### 7.2 内核纯净 ✅

- **判据**：`tmc-core/core/*.js`、`tmc-core/app/*.js`、`tmc-core/index.js`（共 **12** 个文件）剥离注释后，代码中不得出现 `window` / `document` / `localStorage` / `wx.` / `require('fs')` / `fetch(`。
- **结论**：**0 违规**。唯一命中 `document` 的位置是 `image-kernel.js` 第 4 行的**文件注释**（说明「而非直接用 document」），已由注释剥离逻辑排除；实际代码调用的是注入的 `CanvasPort`。
- 自动化：`qa-invariants.js` §B。

### 7.3 单文件可用 ✅

- **判据**：dist 产物无外链 `<script src>` / `<link href>` / `<img src>`；关键内核符号（`createApp`、`TMCZip`）内联存在；全部内联 `<script>` 可被 `new Function` 解析。
- **结论**：4 个产物**全部通过**；`file://` 直开 E2E 全绿、零 console error，证明自包含无缺失模块。
- 自动化：`qa-invariants.js` §C + `qa-e2e.js`。

---

## 8. 遗留问题与风险评估

> Round 2 全绿，**无遗留缺陷**。以下为非阻塞的改进建议与残余风险（均不阻断交付）。

| 项 | 级别 | 说明 | 建议 |
|---|---|---|---|
| 小程序端无自动化测试 | 低 | `tmc-miniprogram/` 无 `test/` 目录，Wx 适配器依赖平台 API 无法在 Node 直接跑 | 建议后续以「体验版手工冒烟 + 内核复用 QA 用例」覆盖 |
| xlsx 保真的「人工肉眼核对」 | 低 | 本次以结构化 + 字节级断言替代人工核对 | 首次真实底稿上线前建议人工开一份确认 |
| deflate 压缩底稿的端到端保真 | 中 | 现有 `writeZip` 以 STORE 模式写回；本测试用 STORE 底稿验证结构与字节保真 | 若取得真实 deflate 底稿样本，建议补一条透传保真回归用例（见 R1） |
| miniprogram vendored 内核一致性 | 低 | Round 2 已核查 `tmc-miniprogram/lib/tmc-core/**` 与源**逐字节一致** | 每次改动 `tmc-core` 后发布前跑 `node build/sync-core.js` |

> **风险 R1（中）**：`xlsx-writer.readZip` 对 deflate entry 采取「不解压、原字节透传」，`writeZip` 以 STORE 回写。理论上 CRC/长度字段按新数据重算，Excel 可正常读取；但**未用真实 deflate 底稿端到端验证**（本机无真实 xlsx 样本、且约束禁止用 Excel/WPS 另存）。若后续提供真实底稿，建议补一条保真回归用例。

---

## 9. 附：测试文件清单

| 文件 | 说明 |
|---|---|
| `tmc-core/test/qa-core.test.js` | 新增 · 内核纯函数边界/异常独立测试（89 项） |
| `tmc-agenda-html/test/qa-xlsx.js` | 新增 · xlsx 保真结构与完整性独立测试（37 项） |
| `tmc-officers-html/test/qa-e2e.js` | 新增 · playwright-core 无头 E2E（19 项） |
| `tmc-officers-html/test/qa-invariants.js` | 新增 · 架构不变式验证（33 项） |

*本报告由 QA 工程师严过关（Yan）产出，交付主理人齐活林汇总。*
