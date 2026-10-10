# tmc-officers-html · 三官自包含单文件 HTML

> **Owner**：Altair Li &lt;altairpaca@gmail.com&gt; · 许可证：MIT · **运行时依赖：无**

形态 D：计时官 / 哼哈官 / 语法官的**零依赖单文件 HTML**。
构建期把 `tmc-core` 内核内联进单个 HTML，产物 `file://` 双击即用、断网可用。

---

## 构建

```bash
node build/inline.js
```

产物：

| 文件 | 说明 |
|------|------|
| `dist/universal-timer.html` | 计时官（计时 + 三色灯 + 报告三视图 + PNG） |
| `dist/ah-counter.html` | 哼哈官（赘词 / 过渡词统计 + 报告） |
| `dist/grammarian.html` | 语法官（每日一词 + 妙语 / 改进 + 报告） |

三个文件共享同一个外壳模板与内联内核，仅默认视图不同。

---

## 零外部引用保证

产物**不含**任何 `src="http`、`href="http`、`@import url(http`。
内核依赖通过构建期内联（`build/inline.js`）打入，无 CDN、无 npm 运行时依赖。

## 冒烟检查

```bash
node test/smoke.js
```

检查：文件大小 ≤ 120KB、无占位符残留、无外部引用、可被 `new Function` 解析、关键符号存在。

---

## 本地服务器（麦克风 / ASR 需安全上下文）

```bash
python tools/start-server.py [端口]
```

浏览器只在 `localhost` 或 `https` 下允许使用麦克风；直接双击（`file://`）会被拒绝。
联网增强（ASR）在离线时自动**隐藏入口、不报错**。

---

## 目录

```
tmc-officers-html/
├── src/
│   ├── host-web.js          # 组装适配器 + createApp
│   ├── store.js             # localStorage 持久化（经 StoragePort）
│   └── ui/
│       ├── shell.html       # 统一外壳模板（占位符 /*__STYLE__*/ /*__CORE__*/ /*__HOST__*/）
│       ├── shell.css        # 全局样式 + 报告版式
│       ├── view-timer.js    # 计时官视图
│       ├── view-ah.js       # 哼哈官视图
│       ├── view-grammarian.js # 语法官视图
│       └── view-report.js   # 报告三视图 Tab + 复制 / 下载 / PNG
├── build/inline.js          # 零依赖内联构建器
├── dist/                    # 构建产物
├── tools/start-server.py    # 本地服务器
└── test/smoke.js            # 产物冒烟检查
```

---

Copyright (c) 2026 Altair Li &lt;altairpaca@gmail.com&gt; · MIT
