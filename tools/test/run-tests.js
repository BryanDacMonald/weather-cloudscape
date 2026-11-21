// Regression tests for the whole wallpaper (headless, software WebGL, all services mocked).
//   npm i playwright (or use a global one), then:  node tools/test/run-tests.js
// Takes several minutes: software rendering is slow. Each check prints ok/FAIL; exit code 1 on any failure.
const H = require('./harness');
const { execSync } = require('child_process');
const path = require('path');
let fails = 0;
const check = (name, cond, detail = '') => { if (!cond) fails++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${detail ? '  (' + detail + ')' : ''}`); };
// mean colour of the top band of the screen (sky), measured in the page
// (from a real screenshot: a WebGL canvas can't be read back after it has been presented)
const skyRGB = async page => { const png = (await page.screenshot()).toString('base64'); return page.evaluate(async png => {
  const im = new Image(); im.src = 'data:image/png;base64,' + png; await im.decode();
  const c = document.createElement('canvas'), W = 240, H = 135; c.width = W; c.height = H;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0, W, H);
  const d = x.getImageData(0, 4, W, 30).data; let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4){ r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
  return [r / n, g / n, b / n];
}, png); };
(async () => {
  console.log('-- ephemeris'); try { execSync('node ' + path.join(H.ROOT, 'tools/test-sky.js'), {stdio: 'pipe'}); check('sky positions vs known events (tools/test-sky.js)', true); } catch (e){ check('sky positions vs known events', false, e.stdout.toString().split('\n').filter(l => /FAIL/.test(l)).join('; ')); }

  console.log('-- daytime, background image, partly cloudy, aircraft');
  let t = await H.open({query: {bgMode: 'Image', bgImage: 'images/sample-valley.png', imgFov: '45'}, weather: {wind_speed_10m: 8, wind_gusts_10m: 14},
                        init: 'window.__birdBoost = 400;'});
  await t.page.waitForTimeout(15000);
  let s = await t.page.evaluate(() => ({wx: document.getElementById('wx').innerText, sun: Weather.sun(), kind: Weather.state.target && Weather.state.target.kind,
    cov: P.coverage, img: Bg.active(), alpha: Bg.state.hasAlpha, autoH: Bg.state.autoH, sway: Bg.swayState.ok, flights: Flights.state.count, src: Flights.state.src,
    birds: Birds.state.groups.length, upper: !!Flights.state.upper}));
  check('no page errors', !t.errors.length, t.errors.slice(0, 3).join(' | '));
  check('weather fetched and shown', /cloud cover/.test(s.wx) || s.kind, s.kind);
  check('real sun position computed (12:30 CDT, 10 Sep, Minneapolis: ~49°)', s.sun && Math.abs(s.sun.el - 49) < 2, s.sun && s.sun.el.toFixed(1) + '°');
  check('40% cover maps to the calibrated knob', s.cov > 0.5 && s.cov < 0.55, s.cov.toFixed(3));
  check('background image with transparent sky', s.img && s.alpha && s.autoH > 0.3 && s.autoH < 0.8, 'horizon ' + (s.autoH || 0).toFixed(2));
  check('wind sway layer running', s.sway);
  check('aircraft parsed (ground traffic excluded)', s.flights === 4, s.flights + ' from ' + s.src);
  check('upper-air data for contrails', s.upper);
  check('birds spawn when boosted', s.birds > 0, s.birds + ' groups');
  const moved = await t.page.evaluate(async () => { const cv = Bg.swayState.cv, a = cv.toDataURL(); window.__swayT = 50; Bg.sway(); const b1 = cv.toDataURL(); window.__swayT = 51.5; Bg.sway(); const b2 = cv.toDataURL(); return b1 !== b2; });
  check('vegetation moves between frames', moved);
  await t.page.evaluate(() => { window.__glassForce = {rain: 0.8, wet: 1, frost: 0, fog: 0}; });
  await t.page.waitForTimeout(3000);
  check('raindrops on the glass when forced', await t.page.evaluate(() => document.getElementById('glass').style.display !== 'none' && Glass.state.hasBack));
  // synthetic roads mask: a horizontal red stroke across the lower half
  const roads = await t.page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 225; const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, 400, 225); x.strokeStyle = '#f00'; x.lineWidth = 6; x.beginPath(); x.moveTo(20, 170); x.lineTo(380, 160); x.stroke();
    x.strokeStyle = '#00f'; x.beginPath(); x.moveTo(200, 166); x.lineTo(240, 165); x.stroke();
    __wcs.setParam('roadsMask', c.toDataURL()); await new Promise(r => setTimeout(r, 1500));
    const T = Bg.trafficState; return {n: T.roads.length, pts: T.roads[0] && T.roads[0].length, hidden: T.roads[0] && T.roads[0].some(p => !p.vis)};
  });
  check('roads mask parsed into a road with a hidden stretch', roads.n === 1 && roads.pts > 20 && roads.hidden, JSON.stringify(roads));
  // sound, rendered offline
  const snd = await t.page.evaluate(async () => {
    const run = async c => { const sr = 22050, ctx = new OfflineAudioContext(2, sr * 6, sr), n = Sound.build(ctx); n.master.gain.value = 1; Sound.state.crickets.length = 0;
      for (let tt = 0; tt < 5.8; tt += 0.1) Sound.tick(n, c, tt, 0.1); const L = (await ctx.startRendering()).getChannelData(0); let e = 0; for (let i = sr * 2; i < L.length; i++) e += L[i] * L[i]; return Math.sqrt(e / (L.length - sr * 2)); };
    const base = {rain: 0, glass: 0, wind: 1, gust: 1.5, birds: 0, crickets: 0, T: 15};
    return {quiet: await run(base), rain: await run({...base, rain: 0.8, glass: 1}), wind: await run({...base, wind: 18, gust: 26})};
  });
  check('sound: rain and wind are audible, calm is near-silent', snd.rain > snd.quiet * 20 && snd.wind > snd.quiet * 10, JSON.stringify(Object.fromEntries(Object.entries(snd).map(([k, v]) => [k, +v.toFixed(4)]))));
  await t.close();

  console.log('-- full overcast, late afternoon (tuned to photos of a real overcast)');
  t = await H.open({weather: {cloud_cover: 100, cloud_cover_low: 100, cloud_cover_mid: 40, cloud_cover_high: 0, weather_code: 3, temperature_2m: 8.9, dew_point_2m: 4},
                    time: '2026-11-22T21:45:00Z', query: {bgMode: 'Image', bgImage: 'images/sample-valley.png'}});
  await t.page.waitForTimeout(25000);
  const rgb = await skyRGB(t.page), blueEx = rgb[2] - rgb[0], sat = (Math.max(...rgb) - Math.min(...rgb)) / Math.max(...rgb);
  check('overcast is a cool grey, not blue (photo: blue excess ~25, sat ~0.12)', blueEx > 10 && blueEx < 35 && sat < 0.18, `blue excess ${blueEx.toFixed(1)}, sat ${sat.toFixed(3)}`);
  check('no page errors', !t.errors.length, t.errors.slice(0, 3).join(' | '));
  await t.close();

  console.log('-- clear night');
  t = await H.open({weather: {cloud_cover: 0, cloud_cover_low: 0, cloud_cover_mid: 0, cloud_cover_high: 0, weather_code: 0, is_day: 0}, time: '2026-12-08T04:30:00Z'});
  await t.page.waitForTimeout(12000);
  s = await t.page.evaluate(() => ({sky: Sky.active(), stars: Sky.state.stars && Sky.state.stars.n, cov: P.coverage, kp: Space.state.kp, iss: !!Space.state.iss}));
  check('real night sky active with the star catalogue', s.sky && s.stars > 8000, s.stars + ' stars');
  check('clear sky means no cloud at all', s.cov === 0, 'coverage knob ' + s.cov);
  check('space weather and ISS elements fetched', s.kp !== null && s.iss, 'Kp ' + s.kp);
  check('no page errors', !t.errors.length, t.errors.slice(0, 3).join(' | '));
  await t.close();

  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
