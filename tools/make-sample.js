// Renders the procedural valley with no clouds and saves it as images/sample-valley.png with a
// transparent sky (cut out with the renderer's own depth buffer).  Run: node tools/make-sample.js
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
(async () => {
  const W = 1920, H = 1080;
  const b = await chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
  const p = await b.newPage({viewport: {width: W, height: H}});
  p.on('pageerror', e => console.log('[pageerror]', e.message));
  await p.route(/^https:/, r => r.abort());
  await p.goto('file://' + path.resolve(__dirname, '../index.html') +
    '?liveWeather=0&manualCover=0&fpsCap=10&dynres=0&quality=High&precip=0&showWx=0&bgMode=Procedural%20landscape&bgImage=');
  await p.waitForFunction(() => window.__wcs && __wcs.frame > 2, null, {timeout: 300000});
  await p.evaluate(() => { Object.assign(__wcs.P, {time: 12.5, heading: -19, flare: 0, bloom: 0.1, vignette: 0, distort: 0, ca: 0}); });
  const f0 = await p.evaluate(() => __wcs.frame);
  await p.waitForFunction(f0 => __wcs.frame >= f0 + 12, f0, {timeout: 600000, polling: 500});
  await p.evaluate(() => document.querySelectorAll('body > div').forEach(d => d.style.display = 'none'));
  const shot = await p.screenshot({type: 'png', timeout: 600000});
  // sky mask from the terrain depth target (sky = no terrain hit)
  const mask = await p.evaluate(() => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, R.terrainFB); gl.readBuffer(gl.COLOR_ATTACHMENT1);
    const buf = new Float32Array(S.W * S.H * 4);
    gl.readPixels(0, 0, S.W, S.H, gl.RGBA, gl.FLOAT, buf);
    const out = new Uint8Array(S.W * S.H);
    for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++)
      out[(S.H - 1 - y) * S.W + x] = buf[(y * S.W + x) * 4] < 1e5 ? 255 : 0;   // flip to top-down
    return {w: S.W, h: S.H, raw: Array.from(out)};
  });
  // composite screenshot + alpha in a scratch page
  const q = await b.newPage();
  const png = await q.evaluate(async ({img, m}) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + img; await im.decode();
    const c = document.createElement('canvas'); c.width = m.w; c.height = m.h;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0, m.w, m.h);
    const d = x.getImageData(0, 0, m.w, m.h);
    for (let i = 0; i < m.raw.length; i++) d.data[i * 4 + 3] = m.raw[i];
    x.putImageData(d, 0, 0);
    return c.toDataURL('image/png').split(',')[1];
  }, {img: shot.toString('base64'), m: mask});
  fs.writeFileSync(path.resolve(__dirname, '../images/sample-valley.png'), Buffer.from(png, 'base64'));
  console.log('wrote images/sample-valley.png', mask.w, mask.h);
  await b.close();
})();
