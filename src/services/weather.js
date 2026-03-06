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
