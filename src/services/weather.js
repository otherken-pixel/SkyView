import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase.js';

// ---------------------------------------------------------------------------
// Cache configuration
// ---------------------------------------------------------------------------

const CACHE_TTL = {
  METAR: 5 * 60 * 1000,        // 5 minutes
  TAF: 15 * 60 * 1000,         // 15 minutes
  NWS: 60 * 60 * 1000,         // 1 hour
  ADVISORY: 10 * 60 * 1000,    // 10 minutes (SIGMETs, AIRMETs, CWAs, PIREPs)
  NWS_POINTS: 24 * 60 * 60 * 1000, // 24 hours (localStorage)
};

/** In-memory cache: key -> { data, expiry } */
const cache = new Map();

/**
 * Get a cached value if it exists and hasn't expired.
 * @param {string} key
 * @returns {*|null}
 */
function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * Store a value in the cache with the given TTL.
 * @param {string} key
 * @param {*} data
 * @param {number} ttl - milliseconds
 */
function cacheSet(key, data, ttl) {
  cache.set(key, { data, expiry: Date.now() + ttl });
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

/**
 * Fetch with a timeout.
 * @param {string} url
 * @param {RequestInit} [options]
 * @param {number} [timeoutMs=10000]
 * @returns {Promise<Response>}
 */
export function timeoutFetch(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

/**
 * Fetch with automatic retry for weather endpoints.
 * @param {string} url
 * @param {RequestInit} [options]
 * @param {number} [retries=2]
 * @param {number} [timeoutMs=10000]
 * @returns {Promise<Response>}
 */
export async function wxFetchWithRetry(url, options = {}, retries = 2, timeoutMs = 10000) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await timeoutFetch(url, options, timeoutMs);
      if (res.ok) return res;
      lastError = new Error(`HTTP ${res.status}: ${res.statusText}`);
    } catch (err) {
      lastError = err;
    }
    // brief backoff before retry
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// METAR
// ---------------------------------------------------------------------------

/**
 * Fetch a live METAR via the weatherProxy Firebase callable.
 * @param {string} icao - e.g. "KJFK"
 * @returns {Promise<{raw: string, wind: string, vis: string, sky: string, temp: string, alt: string, cat: string, wspd: number, wdir: number}>}
 */
export async function fetchLiveMetar(icao) {
  const cacheKey = `metar_${icao}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const weatherProxy = httpsCallable(functions, 'weatherProxy');
  const result = await weatherProxy({ type: 'metar', icao });
  const raw = result.data;

  // Parse the raw METAR string into structured fields
  const parsed = parseMetar(raw);
  cacheSet(cacheKey, parsed, CACHE_TTL.METAR);
  return parsed;
}

/**
 * Parse a raw METAR string into structured weather data.
 * @param {string|Object} raw
 * @returns {{raw: string, wind: string, vis: string, sky: string, temp: string, alt: string, cat: string, wspd: number, wdir: number}}
 */
function parseMetar(raw) {
  // If the callable returned an object, use it directly
  if (typeof raw === 'object' && raw !== null) {
    return {
      raw: raw.raw || raw.rawOb || String(raw),
      wind: raw.wind || '',
      vis: raw.vis || raw.visibility || '',
      sky: raw.sky || raw.clouds || '',
      temp: raw.temp || raw.temperature || '',
      alt: raw.alt || raw.altimeter || '',
      cat: raw.cat || raw.flightCategory || '',
      wspd: Number(raw.wspd || raw.windSpeed || 0),
      wdir: Number(raw.wdir || raw.windDirection || 0),
    };
  }

  const text = String(raw);

  // Wind: e.g. 27015G25KT or VRB05KT
  const windMatch = text.match(/\b(\d{3}|VRB)(\d{2,3})(G\d{2,3})?KT\b/);
  const wdir = windMatch && windMatch[1] !== 'VRB' ? Number(windMatch[1]) : 0;
  const wspd = windMatch ? Number(windMatch[2]) : 0;
  const gust = windMatch && windMatch[3] ? windMatch[3] : '';
  const wind = windMatch ? windMatch[0] : '';

  // Visibility: e.g. 10SM or 3/4SM
  const visMatch = text.match(/\b(\d+\s?\d?\/?\d*)SM\b/);
  const vis = visMatch ? visMatch[0] : '';

  // Sky condition
  const skyMatches = text.match(/\b(SKC|CLR|FEW|SCT|BKN|OVC|VV)\d{3}\b/g);
  const sky = skyMatches ? skyMatches.join(' ') : '';

  // Temperature
  const tempMatch = text.match(/\b(M?\d{2})\/(M?\d{2})\b/);
  const temp = tempMatch ? tempMatch[0] : '';

  // Altimeter
  const altMatch = text.match(/\bA(\d{4})\b/);
  const alt = altMatch ? altMatch[0] : '';

  // Flight category heuristic
  const cat = deriveFlightCategory(vis, skyMatches, wspd);

  return { raw: text, wind, vis, sky, temp, alt, cat, wspd, wdir };
}

/**
 * Derive a flight category (VFR/MVFR/IFR/LIFR) from visibility and ceiling.
 */
function deriveFlightCategory(visStr, skyMatches, wspd) {
  // Parse visibility in SM
  let visSm = 10;
  const numMatch = visStr.match(/([\d.]+)/);
  if (numMatch) visSm = parseFloat(numMatch[1]);
  if (visStr.includes('/')) {
    const fracMatch = visStr.match(/(\d+)\/(\d+)/);
    if (fracMatch) visSm = Number(fracMatch[1]) / Number(fracMatch[2]);
  }

  // Parse ceiling (lowest BKN/OVC/VV)
  let ceiling = Infinity;
  if (skyMatches) {
    for (const m of skyMatches) {
      if (/^(BKN|OVC|VV)/.test(m)) {
        const alt = parseInt(m.replace(/\D/g, ''), 10) * 100;
        if (alt < ceiling) ceiling = alt;
      }
    }
  }

  if (visSm < 1 || ceiling < 500) return 'LIFR';
  if (visSm < 3 || ceiling < 1000) return 'IFR';
  if (visSm <= 5 || ceiling <= 3000) return 'MVFR';
  return 'VFR';
}

// ---------------------------------------------------------------------------
// TAF
// ---------------------------------------------------------------------------

/**
 * Fetch a live TAF via the weatherProxy Firebase callable.
 * Includes nearby station fallback if the primary station has no TAF.
 * @param {string} icao
 * @returns {Promise<Object>}
 */
export async function fetchLiveTaf(icao) {
  const cacheKey = `taf_${icao}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const weatherProxy = httpsCallable(functions, 'weatherProxy');

  try {
    const result = await weatherProxy({ type: 'taf', icao });
    const data = result.data;

    if (data && (typeof data === 'string' ? data.trim().length > 0 : true)) {
      cacheSet(cacheKey, data, CACHE_TTL.TAF);
      return data;
    }
  } catch {
    // Primary station TAF not available — try nearby fallback
  }

  // Nearby station fallback: try appending common suffixes or known alternates
  try {
    const result = await weatherProxy({ type: 'taf', icao, nearby: true });
    const data = result.data;
    cacheSet(cacheKey, data, CACHE_TTL.TAF);
    return data;
  } catch (err) {
    console.warn(`[fetchLiveTaf] No TAF available for ${icao} or nearby stations:`, err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// NWS Forecast
// ---------------------------------------------------------------------------

/**
 * Fetch NWS forecast for a lat/lon coordinate.
 * Two-step process: /points/ to get the forecast URL, then fetch the forecast.
 * Points responses are cached in localStorage for 24 hours.
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<Object>}
 */
export async function fetchNwsForecast(lat, lon) {
  const cacheKey = `nws_${lat.toFixed(4)}_${lon.toFixed(4)}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  // Step 1: resolve the forecast URL from /points/
  const forecastUrl = await getNwsForecastUrl(lat, lon);

  // Step 2: fetch the actual forecast
  const res = await wxFetchWithRetry(forecastUrl, {
    headers: { Accept: 'application/geo+json', 'User-Agent': 'FlightScore/1.0' },
  });
  const data = await res.json();
  cacheSet(cacheKey, data, CACHE_TTL.NWS);
  return data;
}

/**
 * Resolve the NWS forecast URL for a lat/lon, caching in localStorage for 24h.
 */
async function getNwsForecastUrl(lat, lon) {
  const lsKey = `nws_points_${lat.toFixed(4)}_${lon.toFixed(4)}`;

  // Check localStorage cache
  try {
    const stored = localStorage.getItem(lsKey);
    if (stored) {
      const { url, expiry } = JSON.parse(stored);
      if (Date.now() < expiry) return url;
      localStorage.removeItem(lsKey);
    }
  } catch {
    // ignore parse errors
  }

  const pointsRes = await wxFetchWithRetry(
    `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`,
    { headers: { Accept: 'application/geo+json', 'User-Agent': 'FlightScore/1.0' } },
  );
  const pointsData = await pointsRes.json();
  const forecastUrl = pointsData.properties?.forecast;

  if (!forecastUrl) {
    throw new Error('NWS did not return a forecast URL for this location.');
  }

  // Persist in localStorage
  try {
    localStorage.setItem(
      lsKey,
      JSON.stringify({ url: forecastUrl, expiry: Date.now() + CACHE_TTL.NWS_POINTS }),
    );
  } catch {
    // localStorage may be full or unavailable
  }

  return forecastUrl;
}

// ---------------------------------------------------------------------------
// PIREPs
// ---------------------------------------------------------------------------

/**
 * Fetch live PIREPs from aviationweather.gov.
 * @param {number} lat
 * @param {number} lon
 * @param {number} [radiusNm=100]
 * @returns {Promise<Array>}
 */
export async function fetchLivePireps(lat, lon, radiusNm = 100) {
  const cacheKey = `pireps_${lat.toFixed(2)}_${lon.toFixed(2)}_${radiusNm}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const url =
    `https://aviationweather.gov/api/data/pirep?` +
    `lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&dist=${radiusNm}&format=json`;

  const res = await wxFetchWithRetry(url);
  const data = await res.json();
  cacheSet(cacheKey, data, CACHE_TTL.ADVISORY);
  return data;
}

// ---------------------------------------------------------------------------
// SIGMETs
// ---------------------------------------------------------------------------

/**
 * Fetch active SIGMETs from aviationweather.gov.
 * @returns {Promise<Array>}
 */
export async function fetchSigmets() {
  const cacheKey = 'sigmets';
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const res = await wxFetchWithRetry(
    'https://aviationweather.gov/api/data/airsigmet?format=json',
  );
  const data = await res.json();
  cacheSet(cacheKey, data, CACHE_TTL.ADVISORY);
  return data;
}

// ---------------------------------------------------------------------------
// G-AIRMETs
// ---------------------------------------------------------------------------

/**
 * Fetch active G-AIRMETs from aviationweather.gov.
 * @returns {Promise<Array>}
 */
export async function fetchGairmets() {
  const cacheKey = 'gairmets';
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const res = await wxFetchWithRetry(
    'https://aviationweather.gov/api/data/gairmet?format=json',
  );
  const data = await res.json();
  cacheSet(cacheKey, data, CACHE_TTL.ADVISORY);
  return data;
}

// ---------------------------------------------------------------------------
// CWAs
// ---------------------------------------------------------------------------

/**
 * Fetch active Center Weather Advisories from aviationweather.gov.
 * @returns {Promise<Array>}
 */
export async function fetchCwas() {
  const cacheKey = 'cwas';
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const res = await wxFetchWithRetry(
    'https://aviationweather.gov/api/data/cwa?format=json',
  );
  const data = await res.json();
  cacheSet(cacheKey, data, CACHE_TTL.ADVISORY);
  return data;
}

// ---------------------------------------------------------------------------
// Winds Aloft
// ---------------------------------------------------------------------------

/**
 * Fetch winds-aloft (wind/temp) data from aviationweather.gov.
 * @param {string} [region='all'] - e.g. 'all', 'us', region code
 * @returns {Promise<Array>}
 */
export async function fetchWindsAloft(region = 'all') {
  const cacheKey = `winds_${region}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const res = await wxFetchWithRetry(
    `https://aviationweather.gov/api/data/windtemp?region=${encodeURIComponent(region)}&format=json`,
  );
  const data = await res.json();
  cacheSet(cacheKey, data, CACHE_TTL.ADVISORY);
  return data;
}

// ---------------------------------------------------------------------------
// NOTAMs
// ---------------------------------------------------------------------------

/**
 * Fetch live NOTAMs from the FAA NOTAM search API.
 * @param {string} icao - e.g. "KJFK"
 * @returns {Promise<Array>}
 */
// ---------------------------------------------------------------------------
// Geo/weather helpers
// ---------------------------------------------------------------------------

export function windRegionForLon(lon) {
  if (lon > -67) return 'bos';
  if (lon > -82) return 'mia';
  if (lon > -96) return 'chi';
  if (lon > -104) return 'dfw';
  if (lon > -112) return 'slc';
  return 'sfo';
}

export function lonToIanaTz(lon) {
  if (!lon || lon > -87) return 'America/New_York';
  if (lon > -102) return 'America/Chicago';
  if (lon > -115) return 'America/Denver';
  return 'America/Los_Angeles';
}

export function getTripTargetUtc(trip, ianaTimezone) {
  if (!trip || !trip.date || !trip.time) return null;
  const dp = trip.date.split('-').map(Number);
  const tp = trip.time.split(':').map(Number);
  function offsetMin(utcDate) {
    const p = {};
    new Intl.DateTimeFormat('en-US', {
      timeZone: ianaTimezone,
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
      hour12: false
    }).formatToParts(utcDate).forEach(x => { p[x.type] = x.value; });
    const hh = parseInt(p.hour);
    const localUtcMs = Date.UTC(parseInt(p.year), parseInt(p.month) - 1, parseInt(p.day), hh === 24 ? 0 : hh, parseInt(p.minute), parseInt(p.second));
    return (localUtcMs - utcDate.getTime()) / 60000;
  }
  const naive = new Date(Date.UTC(dp[0], dp[1] - 1, dp[2], tp[0], tp[1], 0));
  const off1 = offsetMin(naive);
  let result = new Date(naive.getTime() - off1 * 60000);
  const off2 = offsetMin(result);
  if (off1 !== off2) result = new Date(naive.getTime() - off2 * 60000);
  return result;
}

export function closestWindStation(stations, lat, lon) {
  let best = null, bestD = Infinity;
  (stations || []).forEach(s => {
    if (s.lat == null || s.lon == null) return;
    const d = (s.lat - lat) * (s.lat - lat) + (s.lon - lon) * (s.lon - lon);
    if (d < bestD) { bestD = d; best = s; }
  });
  return best;
}

export function getWindAtAlt(stn, altFt) {
  if (!stn) return null;
  const levels = [3, 6, 9, 12, 18, 24, 30, 34, 39];
  const altK = altFt / 1000;
  const closest = levels.reduce((prev, cur) => Math.abs(cur - altK) < Math.abs(prev - altK) ? cur : prev);
  const wdir = stn['wdir' + closest], wspd = stn['wspd' + closest], temp = stn['temp' + closest];
  if (wdir == null) return null;
  const lv = wdir === 990 || wdir === '990';
  return { altFt: closest * 1000, wdir: lv ? 'LV' : String(wdir).padStart(3, '0'), wspd: wspd || 0, temp: temp != null ? temp : null, lv };
}

function tafTs(t) {
  if (t == null) return null;
  if (typeof t === 'number') return t;
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d.getTime() / 1000;
}

function isPersistentPeriod(changeIndicator) {
  if (!changeIndicator) return true;
  const ci = changeIndicator.toUpperCase();
  return ci === 'FM' || ci === '' || ci === 'INITIAL' || ci === 'NEW' || ci.startsWith('FROM');
}

let _deriveCat, _parseCeilingFt, _parseVisSMNum;
function ensureParsers() {
  if (!_deriveCat) {
    // Lazy load to avoid circular dependency
    _deriveCat = (cft, vmi) => {
      if (cft !== null && cft < 500) return 'LIFR';
      if (cft !== null && cft < 1000) return 'IFR';
      if (cft !== null && cft < 3000) return 'MVFR';
      if (vmi !== null && vmi < 1) return 'LIFR';
      if (vmi !== null && vmi < 3) return 'IFR';
      if (vmi !== null && vmi < 5) return 'MVFR';
      return 'VFR';
    };
    _parseCeilingFt = (skyStr) => {
      if (!skyStr) return null;
      const m = skyStr.match(/(?:BKN|OVC|VV)(\d{3})/);
      return m ? parseInt(m[1]) * 100 : null;
    };
    _parseVisSMNum = (s) => {
      if (!s) return null;
      if (s.startsWith('P6') || s === 'P6SM') return 7;
      const frac = s.match(/^(\d+)\/(\d+)/);
      if (frac) return parseInt(frac[1]) / parseInt(frac[2]);
      const n = parseFloat(s);
      return isNaN(n) ? null : n;
    };
  }
}

function parseTafPeriodSafe(fp, icao) {
  if (!fp) return null;
  ensureParsers();
  const wspd = fp.wspd || 0, wdir = fp.wdir || 0, wgst = fp.wgst || 0;
  const wdirStr = wdir === 0 ? 'VRB' : String(wdir).padStart(3, '0');
  const wind = `${wdirStr}${String(wspd).padStart(2, '0')}${wgst > 0 ? 'G' + String(wgst).padStart(2, '0') : ''}KT`;
  let visib = 6;
  if (fp.visib != null) {
    const vs = String(fp.visib);
    const fracMatch = vs.match(/^(\d+)\/(\d+)$/);
    visib = fracMatch ? parseInt(fracMatch[1]) / parseInt(fracMatch[2]) : parseFloat(vs);
  }
  if (isNaN(visib)) visib = 6;
  const vis = visib >= 6 ? 'P6SM' : visib + 'SM';
  let sky = 'CLR';
  if (fp.clouds && fp.clouds.length) {
    sky = fp.clouds.map(c => `${c.cover || 'FEW'}${String(Math.round((c.base || 0) / 100)).padStart(3, '0')}`).join(' ');
  }
  const cat = _deriveCat(_parseCeilingFt(sky), _parseVisSMNum(vis));
  return { raw: `TAF ${icao}`, wind, vis, sky, cat, wspd };
}

const CAT_RANK = { VFR: 0, MVFR: 1, IFR: 2, LIFR: 3 };

function parseTafForTime(tafObj, targetUtc) {
  const periods = tafObj.fcsts || tafObj.forecast;
  if (!tafObj || !periods || !periods.length) return null;
  const targetTs = targetUtc.getTime() / 1000;
  const icao = tafObj.stationId || '';
  ensureParsers();
  function rank(period) {
    return CAT_RANK[(parseTafPeriodSafe(period, icao) || {}).cat || 'VFR'] || 0;
  }
  let base = null;
  for (const p of periods) {
    if (!isPersistentPeriod(p.changeIndicator)) continue;
    const ft = tafTs(p.timeFrom);
    if (ft !== null && ft <= targetTs) base = p;
  }
  if (!base) {
    for (const p of periods) {
      if (isPersistentPeriod(p.changeIndicator)) { base = p; break; }
    }
  }
  if (!base) return null;
  let active = base, activeRank = rank(active);
  for (const p of periods) {
    if ((p.changeIndicator || '').toUpperCase() !== 'BECMG') continue;
    const ft = tafTs(p.timeFrom), tt = tafTs(p.timeTo);
    if (ft === null || ft > targetTs) continue;
    if (tt !== null && targetTs >= tt) { active = p; activeRank = rank(p); }
    else if (rank(p) > activeRank) { active = p; activeRank = rank(p); }
  }
  for (const p of periods) {
    if ((p.changeIndicator || '').toUpperCase() !== 'TEMPO') continue;
    const ft = tafTs(p.timeFrom), tt = tafTs(p.timeTo);
    if (ft === null || tt === null) continue;
    if (ft <= targetTs && targetTs < tt) {
      const pr = rank(p);
      if (pr > activeRank) { active = p; activeRank = pr; }
    }
  }
  return parseTafPeriodSafe(active, icao);
}

function pickNwsDay(nwsDays, targetUtc) {
  if (!nwsDays || !nwsDays.length) return null;
  const target = targetUtc.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return nwsDays.find(d => d.dateStr === target) || nwsDays[0];
}

function nwsDayToEffectiveWx(day, icao) {
  if (!day) return null;
  const wspd = Math.round((day.ws || 0) * 0.869);
  const catVis = { VFR: 'P6SM', MVFR: '4SM', IFR: '1SM', LIFR: '1/4SM' };
  const catSky = { VFR: 'FEW030', MVFR: 'BKN020', IFR: 'OVC007', LIFR: 'OVC002' };
  const cat = day.cat || 'VFR';
  return {
    raw: `NWS 7-Day ${icao}`,
    wind: `VRB${String(wspd).padStart(2, '0')}KT`,
    wspd, cat,
    vis: catVis[cat] || 'P6SM',
    sky: catSky[cat] || 'CLR',
    shortForecast: day.shortForecast || '',
  };
}

async function resolveAptCoords(icao) {
  const { getAirport, fetchAirportInfo } = await import('../utils/airports');
  const a = getAirport(icao);
  return a || fetchAirportInfo(icao).catch(() => null);
}

export { resolveAptCoords, parseTafForTime, pickNwsDay, nwsDayToEffectiveWx };

export async function fetchEffectiveWxForTrip(trip, allPts) {
  const { getAirport } = await import('../utils/airports');
  const { makeMetar } = await import('../utils/aviation');
  const depApt = getAirport(trip.dep);
  const targetUtc = getTripTargetUtc(trip, depApt ? (depApt.tz || lonToIanaTz(depApt.lon)) : 'America/New_York');
  const hoursUntil = targetUtc ? (targetUtc.getTime() - Date.now()) / 3600000 : null;

  if (hoursUntil !== null && hoursUntil > 30) {
    const [metarArr, nwsArr] = await Promise.all([
      Promise.all(allPts.map(icao => fetchLiveMetar(icao).catch(() => null))),
      Promise.all(allPts.map(icao =>
        resolveAptCoords(icao).then(a =>
          a ? fetchNwsForecast(a.lat, a.lon).catch(() => null) : null
        )
      ))
    ]);
    return allPts.map((icao, idx) => {
      const m = metarArr[idx], nwsDays = nwsArr[idx];
      const metarLive = !!m, metar = m || makeMetar(icao);
      if (nwsDays) {
        const nwsWx = nwsDayToEffectiveWx(pickNwsDay(nwsDays, targetUtc), icao);
        if (nwsWx) return { icao, effectiveWx: nwsWx, metarLive, source: 'nws', sourceLabel: 'NWS 7-Day' };
      }
      return { icao, effectiveWx: metar, metarLive, source: 'metar', sourceLabel: metarLive ? 'METAR (no fcst)' : 'No data' };
    }).filter(e => e.effectiveWx);

  } else if (hoursUntil !== null && hoursUntil > 2) {
    const [metarArr, tafArr, nwsArr] = await Promise.all([
      Promise.all(allPts.map(icao => fetchLiveMetar(icao).catch(() => null))),
      Promise.all(allPts.map(icao => fetchLiveTaf(icao).catch(() => null))),
      Promise.all(allPts.map(icao =>
        resolveAptCoords(icao).then(a =>
          a ? fetchNwsForecast(a.lat, a.lon).catch(() => null) : null
        )
      ))
    ]);
    return allPts.map((icao, idx) => {
      const m = metarArr[idx], taf = tafArr[idx], nwsDays = nwsArr[idx];
      const metarLive = !!m, metar = m || makeMetar(icao);
      if (taf) {
        const tafWx = parseTafForTime(taf, targetUtc);
        if (tafWx) {
          const lbl = taf._nearbyStation ? `TAF ${taf._nearbyStation}` : 'TAF';
          return { icao, effectiveWx: tafWx, metarLive, source: 'taf', sourceLabel: lbl };
        }
      }
      if (nwsDays) {
        const nwsWx = nwsDayToEffectiveWx(pickNwsDay(nwsDays, targetUtc), icao);
        if (nwsWx) return { icao, effectiveWx: nwsWx, metarLive, source: 'nws', sourceLabel: 'NWS Grid' };
      }
      return { icao, effectiveWx: metar, metarLive, source: 'metar', sourceLabel: metarLive ? 'METAR (no TAF)' : 'No data' };
    }).filter(e => e.effectiveWx);

  } else {
    const metarArr = await Promise.all(allPts.map(icao => fetchLiveMetar(icao).catch(() => null)));
    return allPts.map((icao, idx) => ({
      icao, effectiveWx: metarArr[idx] || null,
      metarLive: !!metarArr[idx], source: 'metar',
      sourceLabel: metarArr[idx] ? 'Live METAR' : 'No data'
    })).filter(e => e.effectiveWx);
  }
}

// ---------------------------------------------------------------------------
// NOTAMs
// ---------------------------------------------------------------------------

export async function fetchLiveNotams(icao) {
  const cacheKey = `notams_${icao}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const res = await wxFetchWithRetry(
    'https://notams.aim.faa.gov/notamSearch/search',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        searchType: 0,
        designatorsForLocation: icao,
        notamType: 'NOTAM',
        operatorString: 'AND',
        resultType: 0,
        formatType: 'DOMESTIC',
      }).toString(),
    },
  );
  const data = await res.json();
  cacheSet(cacheKey, data, CACHE_TTL.ADVISORY);
  return data;
}
