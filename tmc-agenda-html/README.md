# tmc-agenda-html · 议程生成 + xlsx 保真导出

> **Owner**：Altair Li &lt;altairpaca@gmail.com&gt; · 许可证：MIT · **运行时依赖：无**

形态 C（HTML 版）：会前议程表制作，输出**保真 xlsx**（保留 EMF / Logo / 二维码 / Drawing）。

---

## 保真原理（不重造轮子）

1. 复制**最近一期议程 xlsx** 作底稿（保留全部富对象与样式）；
2. **ZIP 内 XML 直改** `xl/worksheets/sheet1.xml` + `xl/sharedStrings.xml`；
3. **改公式 / 行结构后必须删除 `xl/calcChain.xml`**（否则 Excel 弹「修复」框）；
4. **禁用 openpyxl**（会丢 EMF/Logo/二维码）。

---

## 构建

```bash
node build/inline.js    # → dist/agenda-builder.html
```

## 测试

```bash
node test/smoke.js       # 产物冒烟
node test/xlsx.test.js   # ZIP 读写往返 / XML 直改 / calcChain 删除
```

---

## 目录

```
tmc-agenda-html/
├── src/
│   ├── host-web.js
│   ├── ui/
│   │   ├── shell.html
│   │   ├── shell.css
│   │   ├── view-agenda-form.js     # 会议元数据 / 角色 / 备稿表单
│   │   ├── view-agenda-preview.js  # 议程预览（时间列 / 公式）
│   │   └── view-export.js          # 导出面板（xlsx / JSON）
│   └── xlsx/
│       ├── zip.js                  # 零依赖 ZIP 读写
│       ├── xml-utils.js            # sharedStrings / sheet 单元格定位
│       └── base-template.js        # 底稿载入
├── build/inline.js
├── templates/README.md             # 底稿模板机制说明
├── dist/agenda-builder.html
└── test/{smoke.js,xlsx.test.js}
```

---

Copyright (c) 2026 Altair Li &lt;altairpaca@gmail.com&gt; · MIT
