# tmc-core · 共享内核

> **Owner**：Altair Li &lt;altairpaca@gmail.com&gt; · GitHub [`Altairpaca`](https://github.com/Altairpaca)
> **许可证**：MIT · **运行时依赖**：无（零依赖）

TMC Toolkit 的**共享内核**：一份纯函数业务逻辑，通过**端口注入（Ports & Adapters）**适配三种宿主
（浏览器单文件 HTML / 微信小程序 / Node 服务端）。

---

## 设计约束（硬性）

内核层**禁止出现**任何宿主符号：

```
window / document / localStorage / wx. / require('fs') / fetch
```

所有宿主能力一律通过端口（`ports/`）注入，由宿主提供的适配器（`adapters/`）实现。

---

## 目录结构

```
tmc-core/
├── index.js                # 汇总导出 + createApp 工厂
├── core/                   # 纯函数内核（零宿主依赖）
│   ├── md-renderer.js      # Markdown → HTML（零依赖 GFM 子集）
│   ├── meeting-model.js    # meeting.json 校验 / 归一化 / 迁移
│   ├── timer-core.js       # 判色 / 格式化 / 秒表（红牌后 30″ 宽限）
│   ├── report-kernel.js    # 三官报告视图模型 → HTML / Markdown / 纯文本
│   ├── image-kernel.js     # 视图模型 → Canvas 2× 白底 PNG 绘制
│   ├── agenda-core.js      # 环节顺序 / 时间列公式 / 行插入
│   └── xlsx-writer.js      # (可选) xlsx ZIP 内 XML 直改保真
├── ports/                  # 端口契约（只声明，不实现）
│   ├── storage-port.js     # StoragePort + NullStorage
│   ├── canvas-port.js      # CanvasPort
│   ├── clock-port.js       # ClockPort + SystemClockPort
│   ├── file-port.js        # FilePort + NullFilePort
│   └── net-port.js         # NetPort + NullNetPort
├── adapters/               # 通用适配器（Web / Node 可用）
│   ├── web-storage.js
│   ├── web-canvas.js
│   ├── system-clock.js
│   ├── web-file.js
│   └── null-net.js
├── app/                    # 应用服务（用例编排，依赖注入 ports）
│   ├── agenda-service.js
│   ├── rsvp-service.js
│   ├── officer-service.js
│   └── minutes-service.js
├── data/                   # 静态数据
│   ├── roles.js
│   ├── wordlist-ah.js
│   └── status-text.js
└── test/
    ├── _selftest.js        # 零依赖单测（node 直跑）
    └── fixtures/
        └── meeting.sample.json
```

---

## 使用

### Node

```js
const TMC = require('tmc-core');

// 纯内核函数
const html = TMC.md.toHtml('# Hello');
const st = TMC.timer.judgeStatus(330, 300, 420); // => 'ok'

// 装配应用（注入适配器）
const app = TMC.createApp({
  storage: TMC.adapters.WebStorage(),
  canvas: TMC.adapters.WebCanvas(),
  clock: TMC.adapters.SystemClock(),
  file: TMC.adapters.WebFile(),
  net: TMC.ports.NullNetPort,
});
console.log(app.meeting.empty());
```

### 浏览器（构建期内联）

`tmc-officers-html` / `tmc-agenda-html` 的 `build/inline.js` 会把本内核内联进单文件 HTML，
统一挂到 `window.TMC`。

---

## 自测

```bash
node test/_selftest.js
# 全绿则退出码 0；有失败则退出码 1
```

---

## 许可证

MIT · Copyright (c) 2026 Altair Li
