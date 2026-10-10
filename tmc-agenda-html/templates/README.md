# 底稿模板机制（Base Template Mechanism）

> 保真导出的核心是**「复制最近一期作底稿 + ZIP 内 XML 直改」**。
> 本目录用于放置**中立空白底稿**（可选 fallback），主路径仍是「用户最近一期议程 xlsx」。

---

## 为什么需要底稿

既有俱乐部议程 xlsx 含 **EMF 图标 / Logo / 二维码 / Drawing / 合并单元格 / 字体样式**。
通用工具（如 `openpyxl`）重存会**丢弃这些富对象**，导出后与原件不一致。

保真方案：**不重造表格**，只把新一期数据**写进底稿副本的单元格**，其余字节原样保留。

---

## 主路径 vs fallback

| 路径 | 说明 |
|------|------|
| **主路径** | 用户上传「最近一期已发布的议程 xlsx」作底稿 → 最贴近当期格式 |
| **fallback**（可选） | 本目录提供的**中立空白底稿**（脱敏一期），当用户暂无底稿时使用 |

> 中立底稿应脱敏：删除真实姓名/联系方式，保留版式骨架（Logo/二维码占位可保留或替换为示例）。

---

## 底稿要求

- 必须是合法 `.xlsx`（ZIP/OOXML），含：
  - `xl/worksheets/sheet1.xml`（主表）
  - `xl/sharedStrings.xml`（共享字符串表）
- 允许含 `xl/calcChain.xml`（导出时会自动删除）。

---

## 使用方式

1. 打开 `dist/agenda-builder.html`；
2. 「③ 导出 / 底稿」点击或拖入底稿 xlsx；
3. 点击「导出保真 xlsx」→ 得到保真议程表（命名 `YYYY.MM.DD第 NNN 次例会会议程表.xlsx`）。

---

## 导出 PDF

导出后用 **Excel「打印到 Microsoft Print to PDF」**出 PDF。
**不要用 WPS、不要用「导出为 PDF」** —— 会降采样二维码导致模糊。

---

Copyright (c) 2026 Altair Li &lt;altairpaca@gmail.com&gt; · MIT
