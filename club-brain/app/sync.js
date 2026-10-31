/* ==========================================================================
   Club Console · 局域网同步层
   在 http(s) 下自动连接本地服务；file:// 打开时安静地退回单机模式。
   ========================================================================== */
(function () {
  const CC = (window.CC = window.CC || {});

  let available = false;
  let status = 'local'; // local | lan | reconnecting
  let es = null;
  let pushTimer = null;
  let lastJson = '';
  let statusCb = null;

  function setStatus(next) {
    status = next;
    if (statusCb) statusCb(next);
  }

  function isHttp() {
    return /^https?:$/.test(location.protocol);
  }

  async function init() {
    if (!isHttp()) { setStatus('local'); return status; }
    try {
      const res = await fetch('api/state', { cache: 'no-store' });
      if (!res.ok) throw new Error('no api');
      const body = await res.json();
      if (body && body.state && Array.isArray(body.state.meetings)) {
        const json = JSON.stringify(body.state);
        lastJson = json;
        if (json !== JSON.stringify(CC.state.data)) CC.state.replaceData(body.state);
      } else {
        await fetch('api/state', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(CC.state.data),
        });
      }
      available = true;
      setStatus('lan');
      connect();
    } catch (err) {
      available = false;
      setStatus('local');
    }
    return status;
  }

  function connect() {
    if (es) es.close();
    try {
      es = new EventSource('api/events');
    } catch (err) {
      setStatus('local');
      return;
    }
    es.onopen = () => setStatus('lan');
    es.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (!msg || msg.type !== 'state' || !msg.state) return;
      const json = JSON.stringify(msg.state);
      if (json === lastJson || json === JSON.stringify(CC.state.data)) return;
      lastJson = json;
      CC.state.replaceData(msg.state);
    };
    es.onerror = () => {
      setStatus('reconnecting');
      // EventSource 自带重连；若彻底关闭则退回本地
      if (es && es.readyState === 2) {
        available = false;
        setStatus('local');
      }
    };
  }

  /** 本地改动 → 推给服务端（防抖 250ms） */
  function push() {
    if (!available) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(doPush, 250);
  }

  async function doPush() {
    if (!available) return;
    const json = JSON.stringify(CC.state.data);
    if (json === lastJson) return;
    lastJson = json;
    try {
      await fetch('api/state', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: json,
      });
    } catch (err) {
      setStatus('reconnecting');
    }
  }

  /** 发送一条会中命令（手机遥控端用） */
  async function send(cmd) {
    if (!available) return false;
    try {
      const res = await fetch('api/command', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(cmd),
      });
      return res.ok;
    } catch (err) {
      setStatus('reconnecting');
      return false;
    }
  }

  CC.sync = {
    init,
    push,
    send,
    available: () => available,
    status: () => status,
    onStatus(fn) { statusCb = fn; },
  };
})();
