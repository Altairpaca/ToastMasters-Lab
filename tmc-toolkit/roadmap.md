# TMC Toolkit 路线图（Roadmap）

> **Owner**：Altair Li &lt;altairpaca@gmail.com&gt; · GitHub [`Altairpaca`](https://github.com/Altairpaca)

---

## v0.1.0 · 基础设施与契约（T01）

- [x] 6 个 repo 目录骨架（`tmc-toolkit` / `tmc-core` / `tmc-officers-html` / `tmc-agenda-html` / `tmc-miniprogram` / `tmc-server-lite`）
- [x] `schema/meeting.schema.json`（draft-07）+ 最小合法实例
- [x] 端口契约（Storage / Canvas / Clock / File / Net + NullNetPort）
- [x] 零依赖内联构建器 `build/inline.js`

## v0.2.0 · 共享内核（T02）

- [x] `md-renderer`（移植 `mdToHtml` 零依赖 GFM 渲染）
- [x] `meeting-model`（校验 / 归一化 / 迁移）
- [x] `timer-core`（判色 / 格式化 / 秒表，含红牌后 30″ 宽限口径）
- [x] `report-kernel`（三官报告视图模型 → HTML / Markdown / 纯文本）
- [x] `image-kernel`（Canvas 自绘 2× 白底 PNG，接受 `CanvasPort` 注入）
- [x] `agenda-core`（环节顺序 / 时间列公式 / 行插入）
- [x] 应用服务（agenda / rsvp / officer / minutes）
- [x] `_selftest.js` 零依赖单测（≥ 60 项断言）

## v0.3.0 · 保真导出（T03）

- [x] `xlsx/zip.js`（零依赖 ZIP 读写）
- [x] `xlsx/xml-utils.js`（sheet / sharedStrings 单元格定位）
- [x] `core/xlsx-writer.js`（ZIP 内 XML 直改 + 删除 `calcChain.xml`）
- [x] `xlsx/base-template.js`（底稿载入）

## v0.4.0 · 宿主外壳与 UI（T04）

- [x] 三官单文件 HTML（`universal-timer` / `ah-counter` / `grammarian`）
- [x] 议程生成器单文件 HTML（`agenda-builder`）
- [x] 联网增强离线优雅降级（ASR 入口隐藏不报错）
- [x] 本地服务器启动器（`tools/start-server.py`）

## v0.5.0 · 多形态适配（T05）

- [x] 微信小程序（Wx 适配器 + 6 页面 + 报告组件 + 内核同步脚本）
- [x] 极轻量服务端（`tmc-server-lite`：Node 内建 http + JSON 落盘）

---

## 未来（Backlog）

- [ ] ASR 联网增强正式接入（语音转写 → 每日一词命中提醒）
- [ ] 成长数据看板（跨期出勤 / 角色分布 / 备稿级别 / 合格率趋势）
- [ ] 金句墙 / tips90 等可插拔内容模块
- [ ] `templates/` 中立空白底稿库（脱敏一期）
- [ ] GitHub Actions 跑 `_selftest.js`
- [ ] 数据隐私保留与删除接口（`DELETE /api/guest/:id`）

---

Copyright (c) 2026 Altair Li &lt;altairpaca@gmail.com&gt; · MIT
