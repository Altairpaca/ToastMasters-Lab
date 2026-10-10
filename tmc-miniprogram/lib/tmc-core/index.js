/* tmc-core/index.js
 * 共享内核汇总导出 + createApp 工厂。
 * createApp({ storage, canvas, clock, file, net }) → App
 *
 * @author Altair Li <altairpaca@gmail.com>
 * @license MIT
 */
'use strict';

// ---- 内核 ----
const mdRenderer = require('./core/md-renderer.js');
const meetingModel = require('./core/meeting-model.js');
const timerCore = require('./core/timer-core.js');
const reportKernel = require('./core/report-kernel.js');
const imageKernel = require('./core/image-kernel.js');
const agendaCore = require('./core/agenda-core.js');
const xlsxWriter = require('./core/xlsx-writer.js');

// ---- 端口 ----
const storagePort = require('./ports/storage-port.js');
const canvasPort = require('./ports/canvas-port.js');
const clockPort = require('./ports/clock-port.js');
const filePort = require('./ports/file-port.js');
const netPort = require('./ports/net-port.js');

// ---- 适配器 ----
const webStorage = require('./adapters/web-storage.js');
const webCanvas = require('./adapters/web-canvas.js');
const systemClock = require('./adapters/system-clock.js');
const webFile = require('./adapters/web-file.js');
const nullNet = require('./adapters/null-net.js');

// ---- 数据 ----
const rolesData = require('./data/roles.js');
const wordlistAh = require('./data/wordlist-ah.js');
const statusText = require('./data/status-text.js');

// ---- 应用服务 ----
const agendaService = require('./app/agenda-service.js');
const rsvpService = require('./app/rsvp-service.js');
const officerService = require('./app/officer-service.js');
const minutesService = require('./app/minutes-service.js');

/**
 * 装配应用（Composition Root）。
 * @param {Object} adapters { storage, canvas, clock, file, net }
 * @returns {Object} App { meeting, agenda, rsvp, officer, minutes, ... }
 */
function createApp(adapters) {
  const a = adapters || {};
  const ports = {
    storage: a.storage || storagePort.NullStorage(),
    canvas: a.canvas || canvasPort.NullCanvasPort(),
    clock: a.clock || clockPort.createClockPort(function () { return Date.now(); }),
    file: a.file || filePort.NullFilePort(),
    net: a.net || netPort.NullNetPort,
  };

  return {
    meeting: {
      validate: meetingModel.validate,
      migrate: meetingModel.migrate,
      normalize: meetingModel.normalize,
      empty: meetingModel.empty,
      makeMeetingId: meetingModel.makeMeetingId,
    },
    agenda: agendaService.createAgendaService(ports),
    rsvp: rsvpService.createRsvpService(ports),
    officer: officerService.createOfficerService(ports),
    minutes: minutesService.createMinutesService(ports),
    ports: ports,
    // 联网能力探测（离线降级入口）
    netAvailable: function () {
      try { return !!ports.net.isAvailable(); } catch (e) { return false; }
    },
  };
}

module.exports = {
  // 工厂
  createApp: createApp,
  // 内核（聚合命名空间）
  md: mdRenderer,
  meeting: meetingModel,
  timer: timerCore,
  report: reportKernel,
  image: imageKernel,
  agendaCore: agendaCore,
  xlsx: xlsxWriter,
  // 端口
  ports: {
    StoragePort: storagePort,
    CanvasPort: canvasPort,
    ClockPort: clockPort,
    FilePort: filePort,
    NetPort: netPort,
    NullNetPort: netPort.NullNetPort,
  },
  // 适配器
  adapters: {
    WebStorage: webStorage.WebStorage,
    WebCanvas: webCanvas.WebCanvas,
    SystemClock: systemClock.SystemClock,
    WebFile: webFile.WebFile,
    NullNet: nullNet.NullNet,
  },
  // 数据
  data: {
    roles: rolesData,
    wordlistAh: wordlistAh,
    statusText: statusText,
  },
  // 应用服务工厂（便于单独使用）
  services: {
    createAgendaService: agendaService.createAgendaService,
    createRsvpService: rsvpService.createRsvpService,
    createOfficerService: officerService.createOfficerService,
    createMinutesService: minutesService.createMinutesService,
  },
  // 版本
  VERSION: '0.5.0',
};
