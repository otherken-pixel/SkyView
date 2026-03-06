import Papa from 'papaparse';
import { AIRPORTS } from '../data/airports';
import { rwyBearing } from './geo';
import { timeoutFetch } from './aviation';

// --- OurAirports module state ---
var _ourAirports = null;   // null = not yet loaded, {} = loaded (may be empty)
var _oaLoading   = false;
var _OA_CSV      = 'https://davidmegginson.github.io/ourairports-data/airports.csv';
var _OA_LS_KEY   = 'skyview_oa_idx_v2';
var _OA_TTL      = 30 * 24 * 60 * 60 * 1000; // 30 days

// --- OpenAIP module state ---
var _OAIP_BASE   = 'https://api.openaip.net/api';
var _OAIP_LS_KEY = 'skyview_openaip_key';
var _OAIP_TTL    = 60 * 60 * 1000; // 1 hour

// Seed key from env var into localStorage on first run (never hardcode credentials)
export function seedOpenAIPKey() {
    if (!localStorage.getItem(_OAIP_LS_KEY)) {
        const envKey = typeof import.meta !== 'undefined' && import.meta.env
            ? import.meta.env.VITE_OPENAIP_KEY
            : undefined;
        if (envKey) localStorage.setItem(_OAIP_LS_KEY, envKey);
    }
}

export function getOpenAIPKey() {
    return localStorage.getItem(_OAIP_LS_KEY) || '';
}

// Accessors for module-level OurAirports state (used by SettingsModal)
export function _getOurAirports() { return _ourAirports; }
export function _getOaLoading()   { return _oaLoading; }
export function _setOurAirports(v) { _ourAirports = v; }
export function _setOaLoading(v)   { _oaLoading = v; }

// In-flight fetch guard to prevent duplicate API calls
const _fetchingIcaos = new Set();

// Returns airport from cache (sync). Trims whitespace before lookup.
export function getAirport(icao) {
    if (!icao) return null;
    icao = icao.trim().toUpperCase();
    return AIRPORTS[icao] || null;
}

// Fetch real airport data from Aviation Weather Center API and cache it.
export async function fetchAirportInfo(icao) {
    if (!icao) return null;
    icao = icao.trim().toUpperCase();
    if (icao.length !== 4) return null;
    if (AIRPORTS[icao]) return AIRPORTS[icao];
    if (_fetchingIcaos.has(icao)) return null;
    _fetchingIcaos.add(icao);
    try {
        const res = await timeoutFetch(
            `https://aviationweather.gov/api/data/airport?ids=${icao}&format=json`,
            {}, 6000
        );
        if (!res.ok) return null;
        const data = await res.json();
        if (!data || data.length === 0) return null;
        const a = data[0];
        if (!a.lat || !a.lon) return null;
        const apt = {
            name: a.name || icao + " Airport",
            city: a.city || icao,
            state: a.state || "US",
            lat: parseFloat(a.lat),
            lon: parseFloat(a.lon),
            elev: parseInt(a.elev) || 0,
            rwy: [],
            artcc: "Center",
            freq: { atis: '', twr: '', gnd: '', app: '', dep: '', clnc: '' }
        };
        AIRPORTS[icao] = apt;
        return apt;
    } catch(e) {
        return null;
    } finally {
        _fetchingIcaos.delete(icao);
    }
}

export async function loadOurAirports() {
    if (_ourAirports !== null || _oaLoading) return;
    _oaLoading = true;
    try {
        // Try localStorage cache first
        var raw = localStorage.getItem(_OA_LS_KEY);
        if (raw) {
            var cached = JSON.parse(raw);
            if (cached && cached.ts && (Date.now() - cached.ts < _OA_TTL) && cached.idx) {
                _ourAirports = cached.idx;
                _oaLoading = false;
                return;
            }
        }
    } catch(e) {}

    try {
        var res = await fetch(_OA_CSV);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var text = await res.text();

        var parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        var idx = {};
        parsed.data.forEach(function(row) {
            if (!row.ident || row.type === 'closed') return;
            var isLargeMed = row.type === 'large_airport' || row.type === 'medium_airport';
            var isSmallNA  = row.type === 'small_airport' &&
                             (row.iso_country === 'US' || row.iso_country === 'CA');
            if (!isLargeMed && !isSmallNA) return;
            if (AIRPORTS[row.ident]) return;

            var lat = parseFloat(row.latitude_deg);
            var lon = parseFloat(row.longitude_deg);
            if (isNaN(lat) || isNaN(lon)) return;

            idx[row.ident] = {
                n: row.name,
                c: row.municipality || '',
                r: (row.iso_region || '').replace(/^.+-/,''),
                k: row.iso_country,
                a: Math.round(lat * 1000) / 1000,
                o: Math.round(lon * 1000) / 1000,
                e: parseInt(row.elevation_ft) || 0,
                t: row.type[0]
            };
        });

        _ourAirports = idx;
        try { localStorage.setItem(_OA_LS_KEY, JSON.stringify({ ts: Date.now(), idx })); }
        catch(e) { console.warn('[OurAirports] localStorage quota exceeded \u2014 using memory-only cache'); }
        console.log('[OurAirports] Loaded ' + Object.keys(idx).length + ' airports');
    } catch(e) {
        console.warn('[OurAirports] Load failed:', e.message);
        _ourAirports = {};
    } finally {
        _oaLoading = false;
    }
}

export function searchOurAirports(q, limit) {
    if (!_ourAirports || !q) return [];
    limit = limit || 8;
    q = q.trim().toUpperCase();
    if (q.length < 2) return [];

    var exact = [], icaoPrefix = [], cityPrefix = [], nameMatch = [];
    var entries = Object.entries(_ourAirports);
    for (var i = 0; i < entries.length; i++) {
        var id = entries[i][0], a = entries[i][1];
        if (AIRPORTS[id]) continue;
        var city = (a.c || '').toUpperCase();
        var name = (a.n || '').toUpperCase();
        if (id === q)                     exact.push({ id, a });
        else if (id.startsWith(q))         icaoPrefix.push({ id, a });
        else if (city.startsWith(q))       cityPrefix.push({ id, a });
        else if (name.includes(q))         nameMatch.push({ id, a });
    }

    var combined = exact.concat(icaoPrefix).concat(cityPrefix).concat(nameMatch);
    return combined.slice(0, limit).map(function(m) {
        return {
            icao: m.id,
            name: m.a.n,
            city: m.a.c,
            state: m.a.r,
            country: m.a.k,
            lat: m.a.a,
            lon: m.a.o,
            elev: m.a.e
        };
    });
}

// Generic fetch wrapper for OpenAIP
async function openaipFetch(path, params) {
    var key = getOpenAIPKey();
    if (!key) return null;

    var cacheKey = 'skyview_oaip_' + path + '_' + JSON.stringify(params || {});
    try {
        var c = JSON.parse(localStorage.getItem(cacheKey) || 'null');
        if (c && c.ts && (Date.now() - c.ts < _OAIP_TTL)) return c.d;
    } catch(e) {}

    var url = _OAIP_BASE + path;
    if (params && Object.keys(params).length) {
        url += '?' + new URLSearchParams(params).toString();
    }
    try {
        var res = await timeoutFetch(url, { headers: { 'x-openaip-api-key': key } }, 10000);
        if (!res.ok) {
            if (res.status === 401 || res.status === 403)
                console.warn('[OpenAIP] Auth failed (HTTP', res.status, ') \u2014 check API key in Settings');
            return null;
        }
        var data = await res.json();
        try { localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), d: data })); }
        catch(e) {}
        return data;
    } catch(e) {
        console.warn('[OpenAIP] Fetch error for', path, ':', e.message);
        return null;
    }
}

export async function enrichAirportFromOpenAIP(icao) {
    if (!icao) return null;
    var existing = AIRPORTS[icao];
    if (existing && existing.rwy && existing.rwy.length > 0) return existing;
    var data = await openaipFetch('/airports', { icaoCode: icao });
    if (!data || !data.items || data.items.length === 0) return existing || null;
    var a = data.items[0];

    var freq = { atis: '', twr: '', gnd: '', app: '', dep: '', clnc: '' };
    if (Array.isArray(a.frequencies)) {
        a.frequencies.forEach(function(f) {
            var t = (f.type || '').toUpperCase(), v = f.value || '';
            if      (t.includes('ATIS'))                           freq.atis = v;
            else if (t.includes('TWR') || t.includes('TOWER'))    freq.twr  = v;
            else if (t.includes('GND') || t.includes('GROUND'))   freq.gnd  = v;
            else if (t.includes('APP') || t.includes('APPR'))     freq.app  = v;
            else if (t.includes('DEP') || t.includes('DEPAR'))    freq.dep  = v;
            else if (t.includes('CLR') || t.includes('CLNC') ||
                     t.includes('DELIVERY'))                       freq.clnc = v;
        });
    }

    var coords = a.geometry && a.geometry.coordinates;
    var lon = coords ? coords[0] : 0;
    var lat = coords ? coords[1] : 0;

    var enriched = Object.assign({}, existing || {}, {
        name:     a.name || (existing && existing.name) || icao + ' Airport',
        city:     a.city || a.municipality || (existing && existing.city) || '',
        state:    a.country && a.country.code ? a.country.code : (existing && existing.state) || 'US',
        lat:      lat || (existing && existing.lat) || 0,
        lon:      lon || (existing && existing.lon) || 0,
        elev:     (a.elevation && a.elevation.value) ? Math.round(a.elevation.value * 3.281) : (existing && existing.elev) || 0,
        rwy:      (a.runways || []).map(function(r) { return r.designator; }).filter(Boolean),
        artcc:    (existing && existing.artcc) || 'Center',
        facility: (existing && existing.facility) || null,
        freq:     freq
    });
    AIRPORTS[icao] = enriched;
    return enriched;
}

// Quick validation helper — used by the Settings modal to test the key
export async function testOpenAIPKey(key) {
    var prev = getOpenAIPKey();
    localStorage.setItem(_OAIP_LS_KEY, key);
    try {
        var url = _OAIP_BASE + '/airports?icaoCode=KCLT&page=1&limit=1';
        var res = await timeoutFetch(url, { headers: { 'x-openaip-api-key': key } }, 8000);
        return { ok: res.ok, status: res.status };
    } catch(e) {
        localStorage.setItem(_OAIP_LS_KEY, prev);
        return { ok: false, status: 0, err: e.message };
    }
}

export async function fetchRunwayData(icao) {
    var apt = getAirport(icao);
    if (!apt || !apt.lat) {
        apt = await fetchAirportInfo(icao).catch(function() { return null; });
    }
    if (!apt || !apt.rwy || apt.rwy.length === 0) {
        await enrichAirportFromOpenAIP(icao).catch(function() {});
        apt = getAirport(icao);
    }
    if (!apt || !apt.lat) return [];
    var d = 0.08;
    var s = (apt.lat - d).toFixed(5), n = (apt.lat + d).toFixed(5);
    var w = (apt.lon - d).toFixed(5), eLon = (apt.lon + d).toFixed(5);
    var query = '[out:json][timeout:15];'
              + 'way["aeroway"="runway"](' + s + ',' + w + ',' + n + ',' + eLon + ');'
              + 'out geom;';
    try {
        var res = await timeoutFetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'data=' + encodeURIComponent(query)
        }, 15000);
        if (res.ok) {
            var data = await res.json();
            var ways = (data.elements || []).filter(function(el) {
                if (el.type !== 'way' || !Array.isArray(el.geometry) || el.geometry.length < 2) return false;
                var tags = el.tags || {};
                if (tags['disused'] === 'yes' || tags['abandoned'] === 'yes' ||
                    tags['disused:aeroway'] === 'runway' || tags['abandoned:aeroway'] === 'runway' ||
                    (tags['description'] && tags['description'].toLowerCase().indexOf('closed') >= 0)) return false;
                var g = el.geometry;
                var midLat = (g[0].lat + g[g.length-1].lat) / 2;
                var midLon = (g[0].lon + g[g.length-1].lon) / 2;
                var dLat = (midLat - apt.lat) * 111320;
                var dLon = (midLon - apt.lon) * 111320 * Math.cos(apt.lat * Math.PI / 180);
                var distM = Math.sqrt(dLat * dLat + dLon * dLon);
                return distM < 2000;
            });
            if (ways.length > 0) {
                return ways.map(function(el) {
                    var g   = el.geometry;
                    var hdg = rwyBearing(g[0].lat, g[0].lon, g[g.length-1].lat, g[g.length-1].lon);
                    var ref = (el.tags && el.tags.ref) || '';
                    var lenM = el.tags && parseFloat(el.tags['length'] || el.tags['est:length'] || '0');
                    return {
                        ref:      ref,
                        hdg1:     Math.round(hdg),
                        hdg2:     Math.round((hdg + 180) % 360),
                        lengthFt: lenM > 0 ? Math.round(lenM * 3.281) : null,
                        surface:  (el.tags && el.tags.surface) || null,
                        source:   'osm'
                    };
                });
            }
        }
    } catch(e) { /* fall through to static fallback */ }

    // Fallback: derive from AIRPORTS.rwy designator strings
    return (apt.rwy || []).map(function(pair) {
        var parts = pair.replace(/[LCRlcr]/g, '').split('/');
        var n1 = parseInt(parts[0], 10) || 0;
        var n2 = parseInt(parts[1], 10) || (n1 + 18) % 36;
        return {
            ref:      pair,
            hdg1:     n1 * 10,
            hdg2:     n2 === 0 ? 360 : n2 * 10,
            lengthFt: null,
            surface:  null,
            source:   'static'
        };
    });
}
