# TMC Toolkit · 头马例会模块化工具链

> **项目所有者 / Owner**：Altair Li（GitHub: [`Altairpaca`](https://github.com/Altairpaca) · Email: `altairpaca@gmail.com` · HKUST(GZ)，广州南沙）
> **许可证**：MIT

一套**可插拔、可自持、可离线、覆盖会前 → 会中 → 会后全流程**的头马（Toastmasters）俱乐部工具链。
设计哲学：**单文件零依赖 + 零后端 + 本地优先（local-first）**；小程序形态因平台限制例外。

---

## 核心理念

| 维度 | 说明 |
|------|------|
| **全流程** | 以单一数据源 `meeting.json` 打通「会前议程/接龙 → 会中三官记录 → 会后纪要/复盘」，同一期会议数据只录一次 |
| **可插拔** | 六边形架构（Ports & Adapters）：纯函数内核 + 端口注入，同一内核跑在浏览器 / 小程序 / Node 三种宿主 |
| **真离线** | 三官单文件 HTML 零外部依赖，`file://` 双击即用、断网可用、无需安装、无需账号 |
| **保真导出** | 议程 xlsx 复用「复制底稿 + ZIP 内 XML 直改」手法，保留 EMF/Logo/二维码，**禁用 openpyxl** |

---

## Repo 导航

| # | 仓库 | 范围 | 依赖 |
|---|------|------|------|
| 1 | [`tmc-toolkit`](.) | 总入口：文档、`meeting.json` 契约、模块规范、Roadmap | 无 |
| 2 | [`tmc-core`](./tmc-core) | 共享内核：`core/`（模型/渲染/计时/议程/图像）+ `ports/` + `adapters/` + `app/` | 无（零依赖） |
| 3 | [`tmc-officers-html`](./tmc-officers-html) | 形态 D：三官（计时/哼哈/语法）自包含单文件 HTML | `tmc-core`（构建内联） |
| 4 | [`tmc-agenda-html`](./tmc-agenda-html) | 形态 C（HTML）：议程生成 + xlsx 保真导出 | `tmc-core`（构建内联） |
| 5 | [`tmc-miniprogram`](./tmc-miniprogram) | 形态 B/C（小程序）：接龙/报名/备稿/投票/议程协作 | `tmc-core`（vendor 同步） |
| 6 | [`tmc-server-lite`](./tmc-server-lite) | 形态 B（可选，P2）：极轻量 HTTP 服务 | 无（Node 内建） |

### 依赖方向

```
tmc-toolkit (契约/文档)
   ├── tmc-core (共享内核) ──┬── tmc-officers-html
   │                         └── tmc-agenda-html
   ├── tmc-miniprogram  ←── tmc-core (vendor 同步) / tmc-server-lite (可选 API)
   └── tmc-server-lite (可选)
```

---

## 架构分层

```
宿主层 Hosts   →  Web / 微信小程序 / Node 服务端
适配层 Adapter →  WebStorageAdapter / WxStorageAdapter / HttpStorageAdapter ...
端口层 Ports   →  StoragePort / CanvasPort / ClockPort / FilePort / NetPort
应用层 App     →  agendaService / rsvpService / officerService / minutesService
内核层 Core    →  meetingModel / mdRenderer / reportKernel / imageKernel / timerCore / agendaCore
导出层 Export  →  xlsxWriter / pngExporter / jsonExporter
```

依赖只能由外向内（Adapter → Port → Application → Core）。**内核层禁止出现** `window` / `document` / `localStorage` / `wx.` / `require('fs')` / `fetch`。

---

## 快速开始

```bash
# 1) 跑内核自测（零依赖）
cd tmc-core && node test/_selftest.js

# 2) 构建三官单文件 HTML
cd tmc-officers-html && node build/inline.js
# → dist/universal-timer.html / ah-counter.html / grammarian.html

# 3) 构建议程生成器单文件 HTML
cd tmc-agenda-html && node build/inline.js
# → dist/agenda-builder.html

# 4)（可选）本地服务器，满足麦克风/ASR 安全上下文
python tmc-officers-html/tools/start-server.py
```

---

## 数据契约

所有模块以 [`schema/meeting.schema.json`](./schema/meeting.schema.json)（draft-07）为单一事实源，
最小合法实例见 [`examples/meeting.min.json`](./examples/meeting.min.json)。
契约变更流程见 [`schema/README.md`](./schema/README.md)。

---

## 文档

- [`docs/PRD.md`](./docs/PRD.md) — 产品需求文档
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — 系统架构设计 + 任务分解
- [`docs/context-brief.md`](./docs/context-brief.md) — 项目上下文简报
- [`docs/sequence-diagram.mermaid`](./docs/sequence-diagram.mermaid) — 时序图
- [`docs/class-diagram.mermaid`](./docs/class-diagram.mermaid) — 类图
- [`roadmap.md`](./roadmap.md) — 版本路线图

---

## 许可证

MIT License · Copyright (c) 2026 Altair Li
详见 [`LICENSE`](./LICENSE)。
