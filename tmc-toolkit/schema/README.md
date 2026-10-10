# `meeting.json` 契约变更流程

`meeting.schema.json` 是 TMC Toolkit 全部模块的**单一事实源**（single source of truth）。
会前制表、会中三官记录、会后复盘三阶段读写同一份数据，模块之间**只通过本契约耦合**。

---

## 契约原则

1. **人类可读、可版本控制**：纯文本 JSON，字段名 `snake_case`，与契约严格一致（**不做 camelCase 转换**）。
2. **不私藏字段**：任何模块不得在 `meeting.json` 之外另存业务字段。
3. **向后兼容**：新增字段必须可选；破坏性变更必须提升 `meta.version` 并提供 `migrate()` 迁移。
4. **时间约定**：
   - 时间戳字段（`meta.updated_at`）使用 **ISO 8601 UTC**，如 `2026-09-15T12:00:00Z`；
   - 会议日期 `date` 使用本地日历日 `YYYY-MM-DD`；
   - 开始/结束时间 `start_time`/`end_time` 使用本地 24 小时制 `HH:MM`。

---

## 变更步骤

1. **提 issue**：说明变更动机、影响字段、是否破坏兼容。
2. **改 schema**：更新 `meeting.schema.json`。
3. **补样本**：更新 `examples/meeting.min.json`（最小合法实例）与 `examples/meeting.333.json`（真实脱敏样本）。
4. **改内核**：同步更新 `tmc-core/core/meeting-model.js` 的 `validate()` / `normalize()` / `migrate()`。
5. **跑自测**：`cd tmc-core && node test/_selftest.js` 必须全绿。
6. **升版本**：破坏性变更提升 `meta.version`（语义化：`major.minor`）。

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0 | 2026-10-10 | 首版契约：会议元数据 / 角色 / 议程 / 备稿 / 来宾 / 接龙 / 投票 / 三官记录 / 纪要 / 附件 / meta |

---

## 校验方式

内核提供零依赖校验器（不引入 `ajv` 等外部库）：

```js
const { meeting } = require('tmc-core');
const res = meeting.validate(sample);
// => { ok: true, errors: [] }
```

校验规则详见 `docs/ARCHITECTURE.md` §5.3。

---

Copyright (c) 2026 Altair Li &lt;altairpaca@gmail.com&gt; · MIT
