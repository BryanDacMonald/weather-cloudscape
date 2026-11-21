// Shared test harness: opens index.html in headless Chromium (software WebGL) with every network service mocked,
// a fixed clock, and optional forced conditions. Used by run-tests.js and handy for one-off renders:
//   const H = require('./harness'); const t = await H.open({query: {...}, weather: {...}, time: '2026-...Z'}); ...
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '../..');
const MOCK_AIRCRAFT = JSON.parse(fs.readFileSync(path.join(__dirname, 'mock-aircraft.json'), 'utf8'));
const CORS = {'access-control-allow-origin': '*'};
const DEFAULT_WEATHER = {temperature_2m: 18, dew_point_2m: 9, is_day: 1, weather_code: 2, cloud_cover: 40, cloud_cover_low: 35,
  cloud_cover_mid: 5, cloud_cover_high: 5, visibility: 30000, wind_speed_10m: 4, wind_direction_10m: 270, wind_gusts_10m: 7,
  rain: 0, showers: 0, snowfall: 0, precipitation: 0};
const DEFAULT_UPPER = {temperature_300hPa: [-48], temperature_250hPa: [-55], relative_humidity_300hPa: [80], relative_humidity_250hPa: [75],
  wind_speed_250hPa: [30], wind_direction_250hPa: [270]};

async function open({query = {}, weather = {}, time = '2026-09-10T17:30:00Z', viewport = [960, 540], init = '', aircraft = MOCK_AIRCRAFT, snowDepth = 0, rain6h = 0} = {}){
  const browser = await chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files']});
  const ctx = await browser.newContext({viewport: {width: viewport[0], height: viewport[1]}});
  // fixed clock that still advances
  await ctx.addInitScript(`{ const T0 = Date.parse('${time}'), R0 = Date.now(); const D = Date; globalThis.Date = class extends D { constructor(...a){ if (a.length) super(...a); else super(T0 + (D.now() - R0)); } static now(){ return T0 + (D.now() - R0); } }; ${init} }`);
  const page = await ctx.newPage();
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load|ERR_/.test(m.text())) errors.push(m.text()); });
  await page.route(/^https:/, r => { requests.push(r.request().url()); r.abort(); });          // anything unmocked fails
  const hour = time.slice(0, 13) + ':00';
  await page.route('https://api.open-meteo.com/**', r => { const u = r.request().url(); requests.push(u);
    if (u.includes('hourly=snow_depth')) return r.fulfill({headers: CORS, json: {hourly: {time: [hour], snow_depth: [snowDepth], precipitation: [rain6h], snowfall: [0]}}});
    if (u.includes('hourly=')) return r.fulfill({headers: CORS, json: {elevation: 260, hourly: {time: [hour], ...DEFAULT_UPPER}}});
    r.fulfill({headers: CORS, json: {elevation: 260, current: {...DEFAULT_WEATHER, ...weather}}}); });
  await page.route('https://geocoding-api.open-meteo.com/**', r => { requests.push(r.request().url()); r.fulfill({headers: CORS, json: {results: [{name: 'Minneapolis', latitude: 44.98, longitude: -93.27, country_code: 'US', admin1: 'Minnesota'}]}}); });
  await page.route('https://get.geojs.io/**', r => { requests.push(r.request().url()); r.fulfill({headers: CORS, json: {latitude: '44.98', longitude: '-93.27', city: 'Minneapolis', region: 'Minnesota'}}); });
  await page.route(/https:\/\/api\.(adsb\.lol|airplanes\.live)\//, r => { requests.push(r.request().url()); r.fulfill({headers: CORS, json: aircraft}); });
  await page.route('https://services.swpc.noaa.gov/**', r => { requests.push(r.request().url()); r.fulfill({headers: CORS, json: [{time_tag: time, kp_index: 2, estimated_kp: 2.3}]}); });
  await page.route('https://celestrak.org/**', r => { requests.push(r.request().url()); r.fulfill({headers: CORS, json: [{EPOCH: time.replace('Z', ''), MEAN_MOTION: 15.501, ECCENTRICITY: 0.0005, INCLINATION: 51.64, RA_OF_ASC_NODE: 247.46, ARG_OF_PERICENTER: 130.5, MEAN_ANOMALY: 325, MEAN_MOTION_DOT: 0.00016}]}); });
  await page.route('https://api.github.com/**', r => { requests.push(r.request().url()); r.fulfill({headers: CORS, json: {tag_name: 'v9.9.9', html_url: 'https://github.com/'}}); });
  const q = new URLSearchParams({location: '44.98,-93.27', showWx: '0', fpsCap: '60', ...query});
  await page.goto('file://' + path.join(ROOT, 'index.html') + '?' + q);
  await page.waitForFunction(() => window.__wcs && __wcs.frame > 3, null, {timeout: 180000});
  return {browser, page, errors, requests, close: () => browser.close()};
}
module.exports = {open, ROOT, DEFAULT_WEATHER};
