// Measures sky cloud fraction vs. the renderer's "coverage" knob, for the cloud types the weather mapping uses.
// Looks straight down from 10 km (terrain-free image mode) over a 3x3 grid that tiles the whole 45 km
// weather map, and counts pixels whose cloud transmittance is below 0.5 (= vertical-projection cloud
// fraction, which is what forecast models report).
//   node tools/calibrate.js            -> raw table (feed to tools/cal2table.py)
//   VERIFY=1 node tools/calibrate.js   -> asks for 25/50/75% through the shipped table, on an offset grid
const { chromium } = require('playwright');
const path = require('path');
const TYPES = {
  stratus: {ctype: 0.08, density: 0.35, cthick: 1.6, cbottom: 1.0, erosion: 0.3},
  cumulus: {ctype: 0.85, density: 0.19, cthick: 2.2, cbottom: 1.5, erosion: 0.45},
};
const COVS = [0, ...Array.from({length: 21}, (_, i) => +(0.3 + i * 0.025).toFixed(3)), 1];
const VERIFY = !!process.env.VERIFY, TARGETS = [0.1, 0.25, 0.5, 0.75, 0.9];
(async () => {
  const b = await chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
  const p = await b.newPage({viewport: {width: 300, height: 300}});
  p.on('pageerror', e => console.log('[pageerror]', e.message));
  await p.route(/^https:/, r => r.abort());
  await p.goto('file://' + path.resolve(__dirname, '../index.html') + '?liveWeather=0&fpsCap=60&dynres=0&quality=Ultra&precip=0&showWx=0&bgMode=Image');
  await p.waitForFunction(() => window.__wcs && __wcs.frame > 3, null, {timeout: 120000});
  await p.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 2; __wcs.setParam('bgImage', c.toDataURL()); });
  await p.waitForFunction(() => __wcs.Bg.active(), null, {timeout: 30000});
  const result = {};
  const off = VERIFY ? 7.5 : 0;
  for (const [name, t] of Object.entries(TYPES)){
    result[name] = [];
    const list = VERIFY ? await Promise.all(TARGETS.map(f => p.evaluate(([f, ty]) => __wcs.coverFromFraction(f, ty), [f, t.ctype]))) : COVS;
    for (let n = 0; n < list.length; n++){
      const cov = list[n];
      let blocked = 0, total = 0;
      for (let gx = -1; gx <= 1; gx++) for (let gz = -1; gz <= 1; gz++){
        const x = gx * 15 + off, z = gz * 15 + off;
        const f0 = await p.evaluate(({t, cov, x, z}) => {
          __wcs.freeze = true;
          Object.assign(__wcs.P, t, {coverage: cov, wind: 0, motion: 1});
          __wcs.camOverride = {pos: [x, 10, z], pitch: -1.5707, fov: 90};
          return __wcs.frame;
        }, {t, cov, x, z});
        await p.waitForFunction(f0 => __wcs.frame >= f0 + 3, f0, {timeout: 120000});
        const r = await p.evaluate(() => __wcs.readCloudT());
        for (const T of r.T){ total++; if (T < 0.5) blocked++; }
      }
      result[name].push([+(blocked / total).toFixed(3), cov]);
      console.log(`${name} ${VERIFY ? `target ${(TARGETS[n] * 100).toFixed(0)}% knob ${cov.toFixed(3)}` : `knob ${cov.toFixed(3)}`} -> ${(blocked / total * 100).toFixed(1)}%`);
    }
  }
  console.log(JSON.stringify(result));
  await b.close();
})();
