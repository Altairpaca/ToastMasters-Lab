# tmc-server-lite

> TMC 工具链的**可选**极简服务端 —— 零依赖，仅使用 Node 内置模块。

为 `meeting.json` 提供 REST 持久化，并用 `tmc-core` 内核在服务端生成三官报告视图模型。
**它不是必需组件**：整套工具链在离线、无服务端的情况下依然完整可用。

## 快速开始

```bash
# 直接运行（默认端口 8787，数据目录 ./data）
node server.js

# 指定端口与数据目录
node server.js --port 9000 --data ./data
```

## 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| GET | `/api/meetings` | 会议 ID 列表 |
| GET | `/api/meetings/:id` | 读取单个会议 |
| POST | `/api/meetings` | 新增/覆盖会议（body = meeting.json） |
| DELETE | `/api/meetings/:id` | 删除会议 |
| POST | `/api/reports/:kind` | 生成报告视图模型，`kind ∈ timer\|ah\|grammarian` |

### 示例

```bash
curl http://127.0.0.1:8787/api/health

curl -X POST http://127.0.0.1:8787/api/meetings \
  -H 'Content-Type: application/json' \
  -d '{"meeting_id":"2026-10-08_第335次","theme":{"zh":"例会"}}'

curl -X POST http://127.0.0.1:8787/api/reports/timer \
  -H 'Content-Type: application/json' \
  -d '{"timerRecords":[{"segment_id":"prep1","planned_min":5,"time":330,"status":"ok"}],"meta":{"meetingName":"例会"}}'
```

## 依赖说明

- 运行期零第三方依赖（`package.json` 的 `dependencies` 为空）。
- `routes/reports.js` 会尝试 `require('tmc-core/core/report-kernel.js')`；
  若 `tmc-core` 未在 `node_modules` 中，可通过环境变量 `NODE_PATH` 指向同级的 `tmc-core`，
  或在 `package.json` 中把它作为本地依赖安装。

## 数据存储

`store/json-store.js` 将每个会议序列化为 `data/<meeting_id>.json`。
文件名经过安全转义，防止路径穿越。存储目录可用 `--data` 覆盖。

## 作者

Altair Li &lt;altairpaca@gmail.com&gt; · MIT License
