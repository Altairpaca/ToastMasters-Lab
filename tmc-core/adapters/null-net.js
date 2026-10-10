/* tmc-core/adapters/null-net.js
 * null-net — 离线空网络适配器（复用 ports/net-port 的 NullNetPort）。
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

const { NullNetPort } = require('../ports/net-port.js');

module.exports = { NullNet: NullNetPort, NullNetPort: NullNetPort };
