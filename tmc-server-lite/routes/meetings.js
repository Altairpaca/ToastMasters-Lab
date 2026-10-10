/* tmc-server-lite/routes/meetings.js
 * 会议相关 REST 路由：GET/POST/DELETE /api/meetings[/:id]。
 * 零依赖，仅使用 Node 内置模块。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

/**
 * 创建会议路由处理器集合。
 * @param {Object} deps { store: JsonStore }
 * @returns {Object} 路由表 { 'GET /api/meetings': fn, ... }
 */
function createMeetingRoutes(deps) {
  const store = (deps && deps.store) || null;
  if (!store) throw new Error('createMeetingRoutes 需要 store');

  return {
    /** GET /api/meetings → 会议 ID 列表 */
    list: function () {
      return { status: 200, body: { ok: true, data: store.list() } };
    },

    /** GET /api/meetings/:id → 单个会议 */
    get: function (params) {
      const m = store.get(params.id);
      if (!m) return { status: 404, body: { ok: false, error: 'not_found' } };
      return { status: 200, body: { ok: true, data: m } };
    },

    /** POST /api/meetings → 新增/覆盖会议 */
    create: function (params, body) {
      if (!body || !body.meeting_id) {
        return { status: 400, body: { ok: false, error: 'meeting_id_required' } };
      }
      const saved = store.save(body);
      return { status: 200, body: { ok: true, data: saved } };
    },

    /** DELETE /api/meetings/:id → 删除会议 */
    remove: function (params) {
      const ok = store.remove(params.id);
      if (!ok) return { status: 404, body: { ok: false, error: 'not_found' } };
      return { status: 200, body: { ok: true, data: { removed: params.id } } };
    },
  };
}

module.exports = { createMeetingRoutes: createMeetingRoutes };
