# Weather Cloudscape: a live-weather desktop wallpaper for Windows

Real-time volumetric clouds that follow **your actual local weather**: cloud cover, cloud type, cloud base height, wind direction and speed, haze/fog, rain, snow and lightning. The sun, Moon, planets and stars sit where they really are in your sky right now. You can keep the procedural mountain valley, or use **your own background image** and the rendered sky shows through behind it.

It is a fork of [Cloudscape](https://github.com/Fishypants/cloudscape) by Michael Cook (MIT). The renderer is a single HTML file with no dependencies. Weather comes from [Open-Meteo](https://open-meteo.com/), which needs no API key.

## Install (Lively Wallpaper, free)

1. Install **Lively Wallpaper** from the Microsoft Store or [rocksdanister/lively](https://github.com/rocksdanister/lively).
2. Zip this folder, or keep it as a folder.
3. In Lively, click **+ Add Wallpaper** and choose the zip, or drag the zip or `index.html` onto the Lively window.
4. Select **Weather Cloudscape**, then click **Customise** (the "…" menu or the settings icon) to set it up.

On first start the wallpaper finds your approximate location from your IP address and fetches the weather. IP location can be off by tens of kilometres, and a VPN moves it entirely. **Type your city** (e.g. `Halifax, Canada`) or `lat, lon` in **Location** to get it right. The weather readout in the top-right corner shows which place it is using.

### Lively settings that matter

| Setting | What it does |
|---|---|
| Location | Exact coordinates like `44.9778, -93.2650` work best (right-click your home in Google Maps to copy them), or a city name, `City, Country/State`, or ZIP code. Blank = detect from IP. Only a rounded (~1 km) location is ever sent to online services; the exact one is used on your PC to position the sun, Moon and aircraft. |
| View faces | Compass direction the view looks toward. This decides where the sun rises and sets on screen and which way clouds drift. 180 = south, the best choice in the northern hemisphere. |
| Cloud motion | Time-lapse factor for drifting clouds. 1 = true wind speed, which is almost imperceptibly slow. |
| Background / Image | `Procedural landscape`, or `Image` plus a file from the dropdown. |
| Sky mask | How the sky region of your image is found (see below). |
| Quality / Frame cap | GPU cost. Start with **Medium / 30**. Drop to **Low / 15** on laptops. |

## Using your own background image

Use **Background = Image** and pick a file in the **Image** dropdown. If your file isn't listed, use the dropdown's **+** button, or copy it into the wallpaper's `images` folder (in Lively, right-click the wallpaper → **Open file location**).

How the sky gets replaced, from best to worst:

1. **PNG with a transparent sky** (best). Cut the sky out in any editor: Photoshop's *Select → Sky*, GIMP's fuzzy select, Photopea (free, in-browser), or an AI background remover. Everything transparent becomes live sky. The included `images/sample-valley.png` is built this way.
2. **Auto (detect sky)**. Finds the bright, smooth, bluish or white region connected to the top edge, then refines the skyline at full resolution: soft edges, no leftover band of the photo's old sky, sharpening halos removed. It works well on daytime photos and AI-generated images with a plain sky and a clean skyline. Leave **Edge softening** low; it's only an extra. It can't handle photos with dense bare branches across the sky (use a hand-made cut-out for those), and struggles with night photos, fog and sky-coloured buildings.
   - **Catch:** browsers block reading pixels from local files when a page runs from disk. In Lively, auto-detection may be unavailable. If so, the wallpaper falls back to the horizon line and says so in the in-page panel. The workaround: open `index.html` in Chrome or Edge, press **H**, click **Choose image…**, check the result, then click **Save cut-out PNG** and use that PNG in Lively.
3. **Horizon line**. Everything above a straight line becomes sky. Good for sea or flat-horizon photos.

**Auto horizon** pitches the virtual camera so the rendered horizon lines up with the bottom of your photo's sky. **Sky FOV** should roughly match the photo's lens: about 40–60° for normal photos, wider for phone ultra-wide shots. **Relight image** dims, warms and cools the photo to match the time of day and cloud cover, so the foreground doesn't stay sunlit at night. Around sunrise and sunset it adds golden light (less under cloud), and when your view faces a low sun the foreground darkens as if backlit. Photos with soft daylight and slightly muted, late-summer colours take the evening tint best.

## How weather maps to the sky

Every 15 minutes the wallpaper reads Open-Meteo's *current* conditions for your location. The scene then eases toward them over about a minute, so updates don't pop.

| Weather data | Rendered as |
|---|---|
| `cloud_cover` (total %) | Fraction of the overhead sky covered by cloud. Calibrated, see below. |
| low / mid / high cover, weather code | Cloud type: cumulus, stratocumulus, stratus/nimbostratus, altocumulus, high thin layer, towering cumulus, cumulonimbus |
| temperature − dew point | Cumulus cloud base height (lifting condensation level, about 125 m per °C) |
| wind speed & direction (10 m) | Cloud drift direction and speed (×1.8 for cloud-level wind, × the motion setting) |
| visibility, fog codes | Atmospheric haze |
| rain / showers / snowfall, WMO code | Rain streaks, snowflakes, lightning flashes |
| your latitude/longitude + clock | Real sun elevation and azimuth (stars at night) |

### What "accurate" means here, and its limits

- **Cloud cover is calibrated.** The renderer's coverage knob isn't a percentage: the whole clear-to-overcast range happens between about 0.3 and 0.8 on it. It was measured by looking straight down on the entire cloud map and counting the area where clouds block more than half the light (`tools/calibrate.js`). On a separate set of positions, requests for 10/25/50/75/90% came out within 1.5 points for both stratus and cumulus.
- **It's forecast-model data, not a camera.** Open-Meteo's "current" values are a weather model's estimate for a grid cell a few kilometres wide, updated every 15 minutes. The *amount and type* of cloud should match what you see outside. The *positions* of individual clouds are made up.
- **Near the horizon, clouds look denser than the percentage.** That's real-world perspective too: you see the sides of distant clouds.
- **No true cirrus.** High wispy cloud is drawn as a thin, translucent high layer.
- **One cloud layer at a time.** When several layers are reported, the dominant one is drawn.

## The night sky

With live weather on, the night sky is the real one for your location and time:

- **Stars:** every star in the Yale Bright Star Catalogue down to magnitude 6.5 (8,404 stars), with real colours. The sky turns through the night, so constellations rise and set as they really do.
- **Moon:** correct position (including its ~1° parallax), phase, tilt, and its dark seas (maria). Moonlight brightens the night sky, clouds, the ground and your photo, and washes out faint stars.
- **Planets:** Mercury, Venus, Mars, Jupiter and Saturn, at their real positions and brightness.
- **Clouds** hide everything behind them, so stars show only where the weather says the sky is clear.

Settings: **Sky darkness** (City / Suburban / Rural / Dark site) sets how many stars you see. Pick what matches your sky; a suburban sky shows a few hundred stars, a dark site thousands. **Moon size** can be enlarged (1 = true size, which is small on screen). **View faces** must be set to the compass direction your view or photo really faces, or the sky will be the one behind you.

Accuracy: positions are good to a few arcminutes (a tenth of the Moon's width). `tools/test-sky.js` checks them against real events: the 2017 and 2024 total solar eclipses (computed Moon within 0.04° of the Sun's centre from the path of totality), the 2000 lunar eclipse, the 2020 Jupiter–Saturn great conjunction, and Mars's 2020 opposition. Star brightness is compressed to suit a screen, and the Moon is dimmed at night so its seas stay visible, the way your eye sees it.

## Air traffic

Real aircraft within about 50 km, from live ADS-B data ([adsb.lol](https://adsb.lol), falling back to [airplanes.live](https://airplanes.live)), updated every 30 seconds by default (10 / 30 / 60 s setting) and moved smoothly in between. Updates stop whenever the wallpaper isn't being drawn (paused by Lively, a full-screen app, the screen off).

- **By day:** distant airliners are tiny dark specks, as in real life. Aircraft on approach that point toward you show their bright landing lights.
- **By night:** red and green wingtip lights, the white tail light, the flashing red beacon and double-flash white strobes.
- **Contrails:** drawn only when the upper air allows them, using the Schmidt-Appleman rule with live temperature and humidity at 250–300 hPa from Open-Meteo. They form below about −40 °C, and persist and spread, drifting with the high-altitude wind, when the air is saturated with respect to ice. Otherwise they're short or absent.
- **Clouds and terrain** hide aircraft behind them.

Settings: **Aircraft size** (1 = true size, which is two or three pixels for an airliner 30 km away), **Contrails**, **Flight labels** (callsign, type, flight level). For accurate positions, especially for low aircraft near an airport, enter your exact coordinates in **Location**.

Coverage depends on volunteer receivers near you. Aircraft without ADS-B (some light aircraft) don't appear.

## Running it in a browser

Open `index.html` in Chrome, Edge or Firefox. Press **H** for the full settings panel: the wallpaper settings on top, then every Cloudscape renderer setting. Settings and your chosen image are saved in the browser. URL parameters also work, e.g. `index.html?location=Oslo&bgMode=Image&panel=1`.

## Performance and privacy

- This is a real-time raymarcher: it uses your GPU continuously. Lively pauses wallpapers when a fullscreen app or game is focused (check Lively's *Performance* settings). A dedicated GPU is recommended. Use **Low / 15 fps** on integrated graphics or battery.
- Network requests: Open-Meteo (weather, upper air and city lookup), adsb.lol or airplanes.live (aircraft: 2 requests a minute by default, only while the wallpaper is being drawn; roughly 1–6 MB an hour near a busy airport) and, only if Location is blank, `get.geojs.io` / `ipapi.co` for IP-based location. These services see your IP address and a location rounded to about 1 km. Typing a location stops the IP lookup; turning off **Real-time aircraft** stops the flight requests.
- Open-Meteo's free API is for non-commercial use (about 96 requests per day here).

## Files

| File | |
|---|---|
| `index.html` | The whole wallpaper (renderer + weather + background + overlays) |
| `LivelyInfo.json`, `LivelyProperties.json` | Lively Wallpaper metadata and Customise panel |
| `images/sample-valley.png` | Sample foreground with a transparent sky |
| `tools/calibrate.js` | Re-measures the cloud cover calibration (Node + Playwright) |
| `tools/test-sky.js` | Checks Moon, planet and star positions against known astronomical events (`node tools/test-sky.js`) |
| `tools/make-starcat.py` | Packs the star catalogue into `index.html` |
| `tools/make-sample.js` | Regenerates the sample image |

## License

MIT. Original renderer © 2026 Michael Cook ([Cloudscape](https://github.com/Fishypants/cloudscape)). Weather data by [Open-Meteo.com](https://open-meteo.com/) (CC BY 4.0). Star data: Yale Bright Star Catalogue, 5th ed. (Hoffleit & Warren, public domain), via the JSON edition by Bretton Wade ([MIT](https://github.com/brettonw/YaleBrightStarCatalog)). Moon and planet positions: Paul Schlyter's method; planet magnitudes partly from Mallama & Hilton (2018). Aircraft data: [adsb.lol](https://adsb.lol) (ODbL 1.0) / [airplanes.live](https://airplanes.live).
