/* tmc-core/ports/canvas-port.js
 * CanvasPort — 画布工厂端口契约。
 * 内核只接受 CanvasPort 产出的 CanvasLike，内部用标准 2D 指令，三宿主通用。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

/**
 * 校验 CanvasLike 是否具备必要能力（鸭子类型）。
 * @param {*} c 待校验对象
 * @returns {boolean}
 */
function isCanvasLike(c) {
  return !!c && typeof c.getContext === 'function' &&
    typeof c.width === 'number' && typeof c.height === 'number';
}

/**
 * 校验一个对象是否满足 CanvasPort 契约。
 * @param {*} obj 待校验对象
 * @returns {{ok:boolean, missing:string[]}}
 */
function checkCanvasPort(obj) {
  const missing = [];
  if (!obj || typeof obj !== 'object') {
    return { ok: false, missing: ['create'] };
  }
  if (typeof obj.create !== 'function') missing.push('create');
  return { ok: missing.length === 0, missing: missing };
}

/**
 * 空实现：create 返回 null。用于无画布环境（如纯数据校验）。
 * @returns {Object} CanvasPort
 */
function NullCanvasPort() {
  return {
    create: function () { return null; },
    acquire: function () { return Promise.resolve(null); },
  };
}

module.exports = {
  isCanvasLike: isCanvasLike,
  checkCanvasPort: checkCanvasPort,
  NullCanvasPort: NullCanvasPort,
};
