/* tmc-officers-html/test/qa-e2e.js
 * QA 独立 E2E 测试（严过关）：用 playwright-core 无头加载 dist/universal-timer.html。
 * 验证：
 *   1) 页面加载「零 console error」
 *   2) 能新增记录 → 生成报告 → 三种视图切换（渲染 / Markdown / 纯文本）
 *   3) 无外部网络请求（监听 request 事件，拦截非 file:// / data: 的请求）
 *
 * 运行： node test/qa-e2e.js
 *   - 需要 playwright-core（脚本会尝试多个常见位置 / 环境变量 PW_CORE）
 *   - 需要本机 Chrome 或 Edge；可用 CHROME_PATH 覆盖
 *   - 因中文路径对无头浏览器不可靠，会把 dist 复制到系统临时 ASCII 目录后再加载
 * 全绿退出码 0，有失败退出码 1。
 *
 * @author Yan (QA) · TMC Toolkit
 * @license MIT
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  \u2705 ' + name); }
  else { fail++; failures.push(name); console.log('  \u274c ' + name + (extra ? '\n     ' + extra : '')); }
}
function section(t) { console.log('\n=== ' + t + ' ==='); }

/* ---------- 定位 playwright-core ---------- */
function resolvePlaywrightCore() {
  const candidates = [
    process.env.PW_CORE,
    path.join(__dirname, '..', 'node_modules'),
    '/tmp/tmc-qa-e2e/node_modules',
    path.join(os.homedir(), '.workbuddy/binaries/node/workspace/node_modules'),
  ].filter(Boolean);
  for (let i = 0; i < candidates.length; i++) {
    try {
      const m = require.resolve('playwright-core', { paths: [candidates[i]] });
      return require(m);
    } catch (e) { /* continue */ }
  }
  return null;
}

/* ---------- 定位浏览器可执行文件 ---------- */
function resolveBrowserPath() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe') : '',
  ].filter(Boolean);
  for (let i = 0; i < candidates.length; i++) {
    try { if (fs.existsSync(candidates[i])) return candidates[i]; } catch (e) { /* */ }
  }
  return null;
}

/* ---------- 把 dist 复制到 ASCII 临时目录 ---------- */
function stageDist() {
  const src = path.resolve(__dirname, '../dist/universal-timer.html');
  if (!fs.existsSync(src)) { throw new Error('dist/universal-timer.html 不存在，请先运行 node build/inline.js'); }
  const dir = path.join(os.tmpdir(), 'tmc-qa-e2e-stage');
  fs.mkdirSync(dir, { recursive: true });
  const dst = path.join(dir, 'universal-timer.html');
  fs.copyFileSync(src, dst);
  return dst;
}

(async function main() {
  section('0. 环境探测');

  const pw = resolvePlaywrightCore();
  ok('playwright-core 可用', !!pw, '未找到 playwright-core，请安装或设置 PW_CORE');
  if (!pw) { return finish(); }

  const browserPath = resolveBrowserPath();
  ok('找到本机 Chrome/Edge（' + (browserPath || '未找到') + '）', !!browserPath);
  if (!browserPath) { return finish(); }

  let staged;
  try { staged = stageDist(); } catch (e) { ok('准备 dist 产物体', false, e.message); return finish(); }
  ok('dist 已复制到 ASCII 临时目录', fs.existsSync(staged));

  const fileUrl = 'file:///' + staged.replace(/\\/g, '/');
  const consoleErrors = [];
  const pageErrors = [];
  const externalRequests = [];

  let browser;
  try {
    browser = await pw.chromium.launch({ executablePath: browserPath, headless: true, args: ['--no-sandbox'] });
  } catch (e) {
    ok('浏览器启动', false, e.message);
    return finish();
  }

  const page = await browser.newPage();
  page.on('console', function (msg) {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', function (err) { pageErrors.push(err.message); });
  page.on('request', function (req) {
    const u = req.url();
    if (!/^(file:|data:|about:|blob:)/.test(u)) externalRequests.push(u);
  });

  try {
    /* ---- 1. 加载 + 零 console error ---- */
    section('1. 页面加载');
    await page.goto(fileUrl, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    ok('页面标题含「三官助手」', (await page.title()).indexOf('三官助手') >= 0, await page.title());
    ok('#app 已渲染（含 tab 按钮）', (await page.locator('#app .tabs .tab').count()) >= 4);
    ok('默认视图容器存在（#viewRoot）', (await page.locator('#viewRoot').count()) === 1);

    /* ---- 3. 无外部网络请求 ---- */
    section('3. 无外部网络请求');
    ok('加载阶段无外部请求', externalRequests.length === 0, JSON.stringify(externalRequests));

    /* ---- 2. 新增记录 ---- */
    section('2. 新增记录 → 报告 → 三视图');
    // 计时官视图：输入讲者 → 开始 → 记录并下一位
    await page.fill('#tSpeaker', 'QA测试讲者');
    await page.click('#tStart');
    await page.waitForTimeout(150);
    await page.click('#tNext');
    await page.waitForTimeout(200);

    const recCount = await page.locator('.data-table tbody tr').count();
    ok('新增 1 条计时记录（表格 1 行）', recCount === 1, '实际 ' + recCount + ' 行');

    // 再新增一条，覆盖多条渲染
    await page.fill('#tSpeaker', 'QA测试讲者2');
    await page.click('#tStart');
    await page.waitForTimeout(150);
    await page.click('#tNext');
    await page.waitForTimeout(200);
    ok('新增第 2 条记录（表格 2 行）', (await page.locator('.data-table tbody tr').count()) === 2);

    // 生成报告
    await page.click('#tReport');
    await page.waitForTimeout(300);
    ok('已进入报告视图（.rep-tabs 存在）', (await page.locator('.rep-tabs').count()) >= 2);
    ok('渲染视图默认展示表格（#rRender 含 <table>）',
      (await page.locator('#rRender table.md-table').count()) >= 1);

    // 切到 Markdown 视图
    await page.click('.rep-tab[data-view="markdown"]');
    await page.waitForTimeout(150);
    const mdText = await page.locator('#rMd').inputValue();
    ok('Markdown 视图含报告标题', mdText.indexOf("TIMER'S REPORT") >= 0);
    ok('Markdown 视图含新增讲者', mdText.indexOf('QA测试讲者') >= 0);

    // 切到纯文本视图
    await page.click('.rep-tab[data-view="plain"]');
    await page.waitForTimeout(150);
    const plainText = await page.locator('#rPlain').inputValue();
    ok('纯文本视图含表头', plainText.indexOf('姓名 Speaker') >= 0);

    // 切回渲染视图
    await page.click('.rep-tab[data-view="render"]');
    await page.waitForTimeout(150);
    ok('可切回渲染视图', (await page.locator('#rRender table.md-table').count()) >= 1);

    // 三官报告切换（计时/哼哈/语法）
    await page.click('.rep-tab[data-kind="ah"]');
    await page.waitForTimeout(150);
    await page.click('.rep-tab[data-kind="grammarian"]');
    await page.waitForTimeout(150);
    const gText = await page.locator('#rRender').innerText();
    ok('语法官报告渲染成功（非空）', gText.length > 0);
    await page.click('.rep-tab[data-kind="timer"]');
    await page.waitForTimeout(150);

    /* ---- 反复确认全程零 error / 零外部请求 ---- */
    section('4. 全程零错误 / 零外链');
    ok('console 无 error', consoleErrors.length === 0, JSON.stringify(consoleErrors));
    ok('无未捕获 pageerror', pageErrors.length === 0, JSON.stringify(pageErrors));
    ok('全程无外部网络请求', externalRequests.length === 0, JSON.stringify(externalRequests));
  } catch (e) {
    ok('E2E 流程执行', false, (e && e.stack) || String(e));
  } finally {
    try { await browser.close(); } catch (e) { /* */ }
  }

  finish();
})().catch(function (e) {
  console.error('E2E 意外失败:', (e && e.stack) || e);
  process.exit(1);
});

function finish() {
  console.log('\n' + '='.repeat(46));
  console.log('结果: ' + pass + ' 通过, ' + fail + ' 失败');
  if (fail) console.log('失败用例:\n  - ' + failures.join('\n  - '));
  process.exit(fail ? 1 : 0);
}
