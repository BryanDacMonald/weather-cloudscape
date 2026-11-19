// Checks the ephemeris against known astronomical events.  Run: node tools/test-sky.js
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const block = src.slice(src.indexOf('// BEGIN EPHEM'), src.indexOf('// END EPHEM'));
const {Ephem, STAR_DATA} = new Function(block + '; return {Ephem, STAR_DATA};')();
const R = Math.PI / 180, ang = (a, b) => 2 * Math.asin(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / 2) / R;   // stable for tiny angles
let fails = 0;
const check = (name, val, lo, hi) => { const ok = val >= lo && val <= hi; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${val.toFixed(3)} (expected ${lo}..${hi})`); };
// topocentric Moon: parallax lowers its altitude by asin(1/dist)*cos(alt)
function topoMoonSunSep(iso, lat, lon){
  const t = new Date(iso), b = Ephem.bodies(t), lst = Ephem.gmst(t) + lon;
  const m = Ephem.toHorizontal(b.moon.eq, lat, lst), s = Ephem.toHorizontal(b.sunEq, lat, lst);
  const alt = m.alt - Math.asin(1 / b.moon.dist) / R * Math.cos(m.alt * R);
  const v = (al, az) => [Math.cos(al * R) * Math.sin(az * R), Math.cos(al * R) * Math.cos(az * R), Math.sin(al * R)];
  return ang(v(alt, m.az), v(s.alt, s.az));
}
let b = Ephem.bodies(new Date('2000-01-21T04:44:00Z'));
check('Lunar eclipse 2000-01-21: Moon-Sun elongation (deg)', b.moon.elong, 179.3, 180);
check('Lunar eclipse 2000-01-21: Moon ecliptic latitude (deg, |.|)', Math.abs(b.moon.eclLat), 0, 0.5);
check('Lunar eclipse 2000-01-21: illuminated fraction', b.moon.illum, 0.999, 1);
check('Total solar eclipse 2017-08-21, Kentucky: topocentric Moon-Sun sep (deg)', topoMoonSunSep('2017-08-21T18:25:00Z', 36.97, -87.67), 0, 0.15);
check('Total solar eclipse 2024-04-08, Mexico: topocentric Moon-Sun sep (deg)', topoMoonSunSep('2024-04-08T18:17:00Z', 25.29, -104.14), 0, 0.15);
check('Same eclipse, geocentric sep (parallax matters, deg)', Ephem.bodies(new Date('2024-04-08T18:17:00Z')).moon.elong, 0.3, 1.2);
b = Ephem.bodies(new Date('2020-12-21T18:00:00Z'));
const P = n => b.planets.find(p => p.name === n);
check('Great conjunction 2020-12-21: Jupiter-Saturn sep (deg)', ang(P('jupiter').eq, P('saturn').eq), 0.05, 0.2);
check('  Jupiter magnitude', P('jupiter').mag, -2.2, -1.8);
check('  Saturn magnitude', P('saturn').mag, 0.4, 0.8);
b = Ephem.bodies(new Date('2023-03-02T00:00:00Z'));
check('Venus-Jupiter conjunction 2023-03-02: sep (deg)', ang(P('venus').eq, P('jupiter').eq), 0.3, 0.8);
check('  Venus magnitude', P('venus').mag, -4.2, -3.8);
b = Ephem.bodies(new Date('2020-10-13T23:00:00Z'));
check('Mars opposition 2020-10-13: elongation from Sun (deg)', ang(P('mars').eq, b.sunEq), 175, 180);
check('  Mars magnitude', P('mars').mag, -2.8, -2.4);
// stars: catalogue sanity, Polaris altitude = latitude, Sirius on the meridian
const S = Ephem.unpackStars(STAR_DATA);
const dirOf = k => [S.dir[k * 3], S.dir[k * 3 + 1], S.dir[k * 3 + 2]];
let brightest = 0; for (let k = 1; k < S.n; k++) if (S.mag[k] < S.mag[brightest]) brightest = k;
check('Brightest catalogue star magnitude (Sirius -1.46)', S.mag[brightest], -1.5, -1.4);
const t0 = new Date('2026-01-15T05:00:00Z'), d0 = Ephem.dayNum(t0);
let pol = 0; for (let k = 0; k < S.n; k++) if (dirOf(k)[2] > dirOf(pol)[2] && S.mag[k] < 2.5) pol = k;
const polH = Ephem.toHorizontal(Ephem.j2000ToDate(dirOf(pol), d0), 45, Ephem.gmst(t0) - 75);
check('Polaris altitude at lat 45N (deg)', polH.alt, 44.2, 45.8);
const sir = Ephem.j2000ToDate(dirOf(brightest), d0), sirRA = (Math.atan2(sir[1], sir[0]) / R + 360) % 360;
const sH = Ephem.toHorizontal(sir, 45, sirRA);        // LST = RA -> on the meridian
check('Sirius at transit, lat 45N: azimuth (deg)', sH.az, 179.9, 180.1);
check('Sirius at transit, lat 45N: altitude (deg, 90-45-16.7)', sH.alt, 28.0, 28.6);
// precession round trip
const v = (u => { const l = Math.hypot(...u); return u.map(x => x / l); })(dirOf(1234)), back = Ephem.dateToJ2000(Ephem.j2000ToDate(v, 9500), 9500);
check('Precession round trip error (arcsec)', ang(v, back) * 3600, 0, 0.5);
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
