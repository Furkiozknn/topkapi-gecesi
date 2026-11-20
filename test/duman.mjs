// Topkapı Gecesi duman testi. Depoya bağımlılık eklenmez: playwright-core (ya da playwright) ve yerel bir Chromium gerekir.
//   node test/duman.mjs [kök-klasör]            (varsayılan: bu deponun kökü)
//   PW_MODULE=<klasör>   playwright-core'un kurulu olduğu node_modules'un üstündeki klasör
//   CHROMIUM=<yol>       chrome.exe yolu (yoksa Playwright'ın kendi tarayıcısı)
//   RAPOR=1              ölçümleri (süre, boyut, küçük dokunma hedefleri) ayrıca yazdırır
//   SHOTS=<klasör>       ekran görüntülerini oraya yazar
// Denetimler: sayfa açılır, konsol/sayfa hatası ve 404 yok, oyun başlar, bir etkileşim durumu değiştirir,
// telefon görünümünde yatay taşma yok, eski kayıt açılır, sürüm etiketi ve sayfa meta kartı.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize, resolve } from 'node:path';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(process.argv[2] || join(here, '..'));
const req = createRequire(process.env.PW_MODULE ? join(resolve(process.env.PW_MODULE), 'x.js') : import.meta.url);
let pw; try { pw = req('playwright-core'); } catch { pw = req('playwright'); }
const IGNORED = /gc\.zgo\.at|goatcounter|fonts\.googleapis\.com|fonts\.gstatic\.com|favicon\.ico/;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.md': 'text/markdown' };
const srv = createServer((q, r) => {
  const p = normalize(decodeURIComponent(q.url.split('?')[0])).replace(/^([/\\])+/, '');
  let f = join(root, p || 'index.html');
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!f.startsWith(root) || !existsSync(f)) { r.writeHead(404); r.end('yok'); return; }
  r.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); r.end(readFileSync(f));
});
await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
const base = 'http://127.0.0.1:' + srv.address().port;
let failed = 0;
const ok = (m) => console.log('ok   ' + m);
const bad = (m) => { failed++; console.log('FAIL ' + m); };
const info = (m) => console.log('     ' + m);
const check = (c, m) => (c ? ok(m) : bad(m));
const browser = await pw.chromium.launch({ headless: true, executablePath: process.env.CHROMIUM || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
if (process.env.SHOTS) mkdirSync(process.env.SHOTS, { recursive: true });

async function newPage(opts, url) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const log = { errors: [], warns: [], failed: [], bad: [], bytes: 0 };
  page.on('console', m => { const t = m.text(); if (m.type() === 'error' && !IGNORED.test(t + (m.location().url || ''))) log.errors.push(t); else if (m.type() === 'warning') log.warns.push(t); });
  page.on('pageerror', e => log.errors.push('pageerror: ' + e.message));
  page.on('requestfailed', r => { if (!IGNORED.test(r.url())) log.failed.push(r.url() + ' ' + (r.failure() || {}).errorText); });
  page.on('response', async r => { if (r.status() >= 400 && !IGNORED.test(r.url())) log.bad.push(r.status() + ' ' + r.url()); try { const b = await r.body(); log.bytes += b.length; } catch { /* yok say */ } });
  const t0 = Date.now();
  await page.goto(base + url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__loaded === true, null, { timeout: 30000 }).catch(() => {});
  await page.waitForFunction(() => { const b = document.getElementById('b-play'); return b && !b.disabled; }, null, { timeout: 30000 }).catch(() => {});
  log.ready = Date.now() - t0;
  return { ctx, page, log };
}
const state = (page) => page.evaluate(() => { const D = window.topkapiDebug, G = D && D.G, S = G && G.S; return { screen: G && G.screen, p: S && S.p ? { x: +S.p.x.toFixed(2), z: +S.p.z.toFixed(2) } : null, errs: (window.__errs || []).slice(), paused: G && G.paused }; });

const profiles = [
  ['masaüstü 1366x768', { viewport: { width: 1366, height: 768 } }],
  ['telefon 390x844 dokunmatik', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }],
];
try {
  for (const [name, opts] of profiles) {
    console.log('--- ' + name);
    const slug = name.split(' ')[0];
    const t = await newPage(opts, '/?debug');
    check(await t.page.evaluate(() => !document.getElementById('b-play').disabled), 'oyun yüklendi, "Oyna" düğmesi etkin');
    info('hazır olma süresi ' + t.log.ready + ' ms, indirilen ' + Math.round(t.log.bytes / 1024) + ' KB');
    if (process.env.SHOTS) await t.page.screenshot({ path: join(process.env.SHOTS, slug + '-title.png') });
    const ov = await t.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
    check(ov.sw <= ov.iw + 1, 'başlık ekranında yatay taşma yok (' + ov.sw + '/' + ov.iw + ')');
    const fit = await t.page.evaluate(() => { const p = document.querySelector('#title .title'); const r = p.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), ih: innerHeight, scroll: p.scrollHeight > p.clientHeight + 1 }; });
    info('başlık paneli ' + fit.top + '-' + fit.bottom + ' / ' + fit.ih + (fit.scroll ? ' (iç kaydırma var)' : ''));
    await t.page.click('#b-play');
    await t.page.waitForFunction(() => ['map', 'play'].includes(window.topkapiDebug.G.screen), null, { timeout: 8000 }).catch(() => {});
    const s = await state(t.page);
    check(['map', 'play'].includes(s.screen), 'Oyna sonrası ekran değişti: ' + s.screen);
    if (process.env.SHOTS) await t.page.screenshot({ path: join(process.env.SHOTS, slug + '-map.png') });
    await t.ctx.close();

    const g = await newPage(opts, '/?debug&nosave&mission=1');
    await g.page.waitForFunction(() => window.topkapiDebug && window.topkapiDebug.G.screen === 'play', null, { timeout: 20000 }).catch(() => {});
    await sleep(500);
    const a = await state(g.page);
    check(a.screen === 'play', 'görev başladı (ekran: ' + a.screen + ')');
    if (opts.hasTouch) {
      await g.page.touchscreen.tap(200, 300); // ilk dokunuş dokunmatik arayüzü açar
      await g.page.waitForFunction(() => document.getElementById('stick').getBoundingClientRect().width > 0, null, { timeout: 10000 }).catch(() => {});
      const box = await g.page.evaluate(() => { const r = document.getElementById('stick').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
      const cdp = await g.ctx.newCDPSession(g.page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box[0], y: box[1], id: 1 }] });
      for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box[0] + i * 6, y: box[1] - i * 3, id: 1 }] }); await sleep(120); }
      await sleep(600);
      info('topuz: ' + await g.page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return (e && (e.id || e.className)) + ' | ' + document.getElementById('knob').style.transform; }, box));
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await g.page.keyboard.down('d'); await g.page.keyboard.down('w'); await sleep(1500); await g.page.keyboard.up('d'); await g.page.keyboard.up('w');
    }
    await sleep(700);
    const b = await state(g.page);
    const moved = a.p && b.p && (Math.abs(a.p.x - b.p.x) + Math.abs(a.p.z - b.p.z)) > 0.3;
    check(moved, 'girdi oyuncuyu hareket ettirdi (' + (a.p ? a.p.x + ',' + a.p.z : '-') + ' -> ' + (b.p ? b.p.x + ',' + b.p.z : '-') + ')');
    if (process.env.SHOTS) await g.page.screenshot({ path: join(process.env.SHOTS, slug + '-play.png') });
    await g.page.evaluate(() => window.topkapiDebug.togglePause(true)); await sleep(300);
    check(await g.page.evaluate(() => window.topkapiDebug.G.paused === true), 'duraklatma çalışıyor');
    if (process.env.SHOTS) await g.page.screenshot({ path: join(process.env.SHOTS, slug + '-pause.png') });
    const ov2 = await g.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
    check(ov2.sw <= ov2.iw + 1, 'oyun içinde yatay taşma yok');
    if (process.env.RAPOR) {
      await g.page.evaluate(() => window.topkapiDebug.togglePause(false)); await sleep(300);
      const small = await g.page.evaluate(() => [...document.querySelectorAll('button, a.btn, .ibtn, .tb')].filter(e => e.offsetParent !== null).map(e => { const r = e.getBoundingClientRect(); return [e.id || e.className, Math.round(r.width), Math.round(r.height)]; }).filter(x => x[1] < 40 || x[2] < 40));
      info('40px altı görünür düğmeler: ' + JSON.stringify(small));
    }
    const fin = await state(g.page);
    check(fin.errs.length === 0 && g.log.errors.length === 0, 'konsol/sayfa hatası yok ' + JSON.stringify(fin.errs.concat(g.log.errors).slice(0, 3)));
    check(g.log.failed.length === 0 && g.log.bad.length === 0, 'başarısız/404 istek yok ' + JSON.stringify(g.log.failed.concat(g.log.bad).slice(0, 3)));
    if (process.env.RAPOR && g.log.warns.length) info('uyarılar: ' + JSON.stringify(g.log.warns.slice(0, 5)));
    await g.ctx.close();
  }

  console.log('--- eski kayıt uyumu');
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(base + '/?nosave', { waitUntil: 'load' });
    await page.evaluate(() => {
      localStorage.setItem('arena.topkapi.save', JSON.stringify({ done: [true, true, true], stars: [[1, 1, 0], [1, 1, 1], [1, 0, 0]], tutDone: true, times: [70, 90, 80] }));
      localStorage.setItem('arena.topkapi.settings', JSON.stringify({ lang: 'tr', quality: 'low' }));
    });
    await page.goto(base + '/?debug', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__loaded === true).catch(() => {});
    await sleep(1500);
    const s = await state(page);
    check(errs.length === 0 && s.errs.length === 0, 'eski kayıtla açılış hatasız ' + JSON.stringify(errs.concat(s.errs).slice(0, 2)));
    check(await page.evaluate(() => !document.getElementById('b-cont').hidden), '"Devam" düğmesi kayıtla görünür');
    if (await page.evaluate(() => !!document.getElementById('b-book'))) { // v1.1: Gece Defteri
      await page.click('#b-book');
      const rows = await page.evaluate(() => document.querySelectorAll('#book-tbl tr').length);
      check(rows === 3 && await page.evaluate(() => !document.getElementById('news').hidden), 'Gece Defteri açılır, 3 tamamlanan görev satırı var (' + rows + ')');
      if (process.env.SHOTS) await page.screenshot({ path: join(process.env.SHOTS, 'defter.png') });
      await page.keyboard.press('Escape');
      check(await page.evaluate(() => document.getElementById('news').hidden), 'Esc Gece Defterini kapatır');
      await page.evaluate(() => window.topkapiDebug.startMission(0)); await sleep(2500);
      await page.evaluate(() => dispatchEvent(new Event('pagehide')));
      const sec = await page.evaluate(() => JSON.parse(localStorage.getItem('arena.topkapi.stats') || '{}').sec);
      check(sec > 0, 'oyun süresi kaydedildi (arena.topkapi.stats.sec=' + sec + ')');
    }
    await ctx.close();
  }

  console.log('--- sayfa / v1.1 ögeleri');
  {
    const { ctx, page } = await newPage({ viewport: { width: 1366, height: 768 } }, '/');
    const m = await page.evaluate(() => ({
      title: document.title,
      og: ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'].map(k => !!document.querySelector('meta[property="' + k + '"]')),
      tw: !!document.querySelector('meta[name="twitter:card"]'), theme: !!document.querySelector('meta[name="theme-color"]'),
      icon: !!document.querySelector('link[rel~=icon]'), ver: (document.getElementById('ver') || {}).textContent || '', news: !!document.getElementById('news'),
    }));
    check(m.title.includes('Topkapı'), 'başlık: ' + m.title);
    check(m.og.every(Boolean) && m.tw, 'Open Graph + Twitter kartı');
    check(m.theme, 'theme-color');
    check(m.icon, 'favicon bağlantısı');
    check(/^v\d+\.\d+/.test(m.ver), 'oyun içi sürüm etiketi: "' + m.ver + '"');
    check(m.news, '"Yenilikler" penceresi var');
    check(existsSync(join(root, '404.html')), '404.html var');
    await ctx.close();
  }
} catch (e) { bad('betik hatası: ' + (e && e.stack || e)); }
await browser.close(); srv.close();
console.log(failed ? '\nBAŞARISIZ: ' + failed + ' denetim' : '\nTÜMÜ GEÇTİ');
process.exit(failed ? 1 : 0);
