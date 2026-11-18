// Measures sky cloud fraction vs. the renderer's "coverage" knob, for the cloud types the weather mapping uses.
// Renders the sky straight overhead (terrain-free image mode) at many positions and counts pixels whose
// cloud transmittance is below 0.5.  Run:  node tools/calibrate.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const path = require('path');
const TYPES = {
  stratus: {ctype: 0.08, density: 0.35, cthick: 1.6, cbottom: 1.0, erosion: 0.3},
  cumulus: {ctype: 0.85, density: 0.19, cthick: 2.2, cbottom: 1.5, erosion: 0.45},
};
const COVS = [0, ...Array.from({length: 21}, (_, i) => +(0.3 + i * 0.025).toFixed(3)), 1];
(async () => {
  const b = await chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
  const p = await b.newPage({viewport: {width: 200, height: 200}});
  p.on('pageerror', e => console.log('[pageerror]', e.message));
  await p.route(/^https:/, r => r.abort());
  await p.goto('file://' + path.resolve(__dirname, '../index.html') + '?liveWeather=0&fpsCap=60&dynres=0&quality=Medium&precip=0&showWx=0&bgMode=Image');
  await p.waitForFunction(() => window.__wcs && __wcs.frame > 3, null, {timeout: 120000});
  // 1x1 transparent PNG: image mode with no foreground, so no terrain is drawn
  await p.evaluate(() => {
    const c = document.createElement('canvas'); c.width = c.height = 2;
    __wcs.setParam('bgImage', c.toDataURL());
  });
  await p.waitForFunction(() => __wcs.Bg.active(), null, {timeout: 30000});
  const result = {};
  for (const [name, t] of Object.entries(TYPES)){
    result[name] = [];
    for (const cov of COVS){
      let blocked = 0, total = 0;
      for (let k = 0; k < 8; k++){
        // spread positions over the 45 km weather-map tile
        const x = ((k * 7.31) % 45) - 22.5, z = ((k * 13.7) % 45) - 22.5;
        const f0 = await p.evaluate(({t, cov, x, z}) => {
          __wcs.freeze = true;
          Object.assign(__wcs.P, t, {coverage: cov, wind: 0, motion: 1});
          __wcs.camOverride = {pos: [x, 0.05 - (x * x + z * z) / (2 * 6360), z], pitch: 1.5707, fov: 70};
          return __wcs.frame;
        }, {t, cov, x, z});
        await p.waitForFunction(f0 => __wcs.frame >= f0 + 3, f0);
        const r = await p.evaluate(() => __wcs.readCloudT());
        for (const T of r.T){ total++; if (T < 0.5) blocked++; }
      }
      result[name].push([+(blocked / total).toFixed(3), cov]);
      process.stdout.write(`${name} cov ${cov.toFixed(2)} -> ${(blocked / total * 100).toFixed(1)}%\n`);
    }
  }
  console.log(JSON.stringify(result));
  await b.close();
})();
