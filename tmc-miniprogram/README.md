# tmc-miniprogram · 微信小程序端

> **Owner**：Altair Li &lt;altairpaca@gmail.com&gt; · 许可证：MIT

形态 B/C（小程序）：报名接龙 / 备稿申请 / 评选投票 / 议程协作 / 三官报告查看。
内核通过 `build/sync-core.js` **vendor 同步**（小程序不能用 npm 外部包）。

---

## 内核同步

```bash
node build/sync-core.js
```

把 `tmc-core` 的 `core/ ports/ data/ index.js` 拷贝到 `lib/tmc-core/`，
跳过 `adapters/web-*`（小程序用 `adapters/wx-*`）。

---

## 目录

```
tmc-miniprogram/
├── project.config.json
├── app.js / app.json / app.wxss
├── adapters/          # wx-storage / wx-canvas / wx-clock / wx-file / wx-net
├── pages/             # index / rsvp / speech / ballot / agenda / report
├── components/report-view/
├── lib/tmc-core/      # 同步产物（vendored）
├── build/sync-core.js
└── utils/
```

---

## 数据契约

读写字段严格对齐 `meeting.json`（见 `tmc-toolkit/schema/meeting.schema.json`），
可与 HTML 版互相导入导出。

---

Copyright (c) 2026 Altair Li &lt;altairpaca@gmail.com&gt; · MIT
