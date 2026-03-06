import { getAirport } from './airports';

export const CAT_RANK = { VFR: 0, MVFR: 1, IFR: 2, LIFR: 3 };

// Cross-browser fetch with timeout — AbortSignal.timeout is not supported on older iOS Safari
export function timeoutFetch(url, opts, ms) {
    var ctrl = new AbortController();
    var id = setTimeout(function() { ctrl.abort(); }, ms || 8000);
    var merged = Object.assign({}, opts || {}, { signal: ctrl.signal });
    return fetch(url, merged).then(
        function(r)  { clearTimeout(id); return r; },
        function(e)  { clearTimeout(id); throw e; }
    );
}

// Weather fetch with automatic retry on network errors or 5xx responses.
// Retries up to `retries` times (default 2) with short exponential backoff.
// 4xx responses are NOT retried — they indicate a bad request, not a transient fault.
export async function wxFetchWithRetry(url, opts, ms, retries) {
    var n = (retries != null) ? retries : 2;
    var delays = [600, 1500];
    for (var i = 0; i <= n; i++) {
        try {
            var res = await timeoutFetch(url, opts, ms);
            if (res.ok || res.status < 500) return res;   // success or 4xx — don't retry
            if (i < n) await new Promise(function(r) { setTimeout(r, delays[i] || 2000); });
        } catch(e) {
            if (i === n) throw e;
            await new Promise(function(r) { setTimeout(r, delays[i] || 2000); });
        }
    }
}

export function deriveCat(ceilingFt, visMi) {
    var v = visMi != null ? visMi : 10;
    var c = ceilingFt; // null = no ceiling (SKC/CLR/FEW)
    if ((c !== null && c < 500)  || v < 1) return 'LIFR';
    if ((c !== null && c < 1000) || v < 3) return 'IFR';
    if ((c !== null && c < 3000) || v < 5) return 'MVFR';
    return 'VFR';
}

export function getCategoryColor(flightCategory) {
    switch ((flightCategory || '').toUpperCase()) {
        case 'VFR':  return '#34C759';  // green
        case 'MVFR': return '#0A84FF';  // blue
        case 'IFR':  return '#FF3B30';  // red
        case 'LIFR': return '#BF5AF2';  // magenta/purple
        default:     return '#8E8E93';  // unknown - grey
    }
}

export function calculateDensityAltitude(tempC, altimeterInHg, elevationFt) {
    var pa = (29.92 - (altimeterInHg || 29.92)) * 1000 + (elevationFt || 0);
    var isaTemp = 15 - 0.001981 * pa;
    var da = pa + 120 * ((tempC != null ? tempC : 15) - isaTemp);
    return Math.round(da);
}

export function getGoColor(s) {
    return s >= 75 ? "var(--go)" : s >= 50 ? "var(--caution)" : "var(--nogo)";
}

export function parseCeilingFt(skyStr) {
    if (!skyStr) return null;
    var best = null;
    var re = /(?:BKN|OVC|VV)(\d{3})/gi, m;
    while ((m = re.exec(skyStr)) !== null) {
        var ft = parseInt(m[1]) * 100;
        if (best === null || ft < best) best = ft;
    }
    return best;
}

export function parseVisSMNum(s) {
    if (!s) return null;
    if (/^P/i.test(s)) return 99; // P6SM = "more than 6" - treat as unlimited
    var m = s.match(/([\d.]+)\s*(?:\/\s*([\d.]+))?\s*SM/i);
    if (!m) return null;
    return m[2] ? parseInt(m[1]) / parseInt(m[2]) : parseFloat(m[1]);
}

export function calcWindComponents(windDir, windSpd, runwayHdg) {
    if (windDir == null || !windSpd) return { headwind: 0, crosswind: 0 };
    var theta = (windDir - runwayHdg) * Math.PI / 180;
    return {
        headwind:  Math.round(windSpd * Math.cos(theta)),
        crosswind: Math.round(Math.abs(windSpd * Math.sin(theta)))
    };
}

export function buildRunwayEnds(runways, windDir, windSpd) {
    var ends = [];
    runways.forEach(function(rwy) {
        var parts = (rwy.ref || '').split('/');
        [
            { hdg: rwy.hdg1, id: (parts[0] || String(Math.round(rwy.hdg1 / 10))).trim() },
            { hdg: rwy.hdg2, id: (parts[1] || String(Math.round(rwy.hdg2 / 10))).trim() }
        ].forEach(function(end) {
            var c = calcWindComponents(windDir, windSpd, end.hdg);
            ends.push({
                id:        end.id,
                ref:       rwy.ref,
                heading:   end.hdg,
                headwind:  c.headwind,
                crosswind: c.crosswind,
                xwindWarn: c.crosswind > 15,
                lengthFt:  rwy.lengthFt,
                surface:   rwy.surface,
                source:    rwy.source
            });
        });
    });
    ends.sort(function(a, b) { return b.headwind - a.headwind; });
    return ends;
}

export function isPersistentPeriod(changeIndicator) {
    var ci = (changeIndicator || '').toUpperCase();
    return ci !== 'TEMPO' && ci !== 'BECMG' &&
           ci !== 'PROB'  && ci !== 'PROB30' && ci !== 'PROB40';
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

export function makeMetar(icao) {
    var apt = getAirport(icao);
    if (!apt) { return null; }
    var now = new Date();
    var dd = String(now.getUTCDate()).padStart(2, "0");
    var hh = String(now.getUTCHours()).padStart(2, "0");
    var mm = String(now.getUTCMinutes()).padStart(2, "0");
    var wdir = pick(["18", "24", "27", "33", "36", "09", "VRB"]);
    var wspd = randInt(4, 22);
    var gust = wspd > 12 ? "G" + (wspd + randInt(5, 12)) : "";
    var wind = wdir === "VRB" ? "VRB" + String(wspd).padStart(2, "0") + "KT" : wdir + "0" + String(wspd).padStart(2, "0") + gust + "KT";
    var vis = pick(["10SM", "10SM", "P6SM", "8SM", "6SM", "3SM", "1 1/2SM"]);
    var skyOptions = [
        { raw: "CLR", cat: "VFR" }, { raw: "FEW040", cat: "VFR" }, { raw: "FEW250", cat: "VFR" },
        { raw: "SCT025", cat: "MVFR" }, { raw: "SCT045 BKN120", cat: "MVFR" },
        { raw: "BKN015", cat: "MVFR" }, { raw: "BKN030", cat: "MVFR" },
        { raw: "OVC008", cat: "IFR" }, { raw: "OVC004", cat: "LIFR" }
    ];
    var sky = pick(skyOptions);
    var temp = randInt(5, 35);
    var dewp = temp - randInt(2, 10);
    var tempStr = (temp < 10 ? "0" : "") + temp + "/" + (dewp < 0 ? "M" : "") + (Math.abs(dewp) < 10 ? "0" : "") + Math.abs(dewp);
    var alt = "A" + pick(["2976", "2985", "2992", "2998", "3001", "3005", "3012"]);
    var cat = sky.cat;
    if (vis === "3SM" || vis === "1 1/2SM") { cat = "IFR"; }
    var wdirNum = wdir === "VRB" ? null : parseInt(wdir) * 10;
    return {
        raw: icao + " " + dd + hh + mm + "Z " + wind + " " + vis + " " + sky.raw + " " + tempStr + " " + alt + " RMK AO2",
        wind: wind, vis: vis, sky: sky.raw, temp: tempStr, alt: alt, cat: cat, wspd: wspd, wdir: wdirNum
    };
}

export function makeTaf(icao) {
    var now = new Date();
    var dd = String(now.getUTCDate()).padStart(2, "0");
    var hh = String(now.getUTCHours()).padStart(2, "0");
    var h6 = String((parseInt(hh) + 6) % 24).padStart(2, "0");
    var h12 = String((parseInt(hh) + 12) % 24).padStart(2, "0");
    var h18 = String((parseInt(hh) + 18) % 24).padStart(2, "0");
    return "TAF " + icao + " " + dd + hh + "00Z 24012KT P6SM FEW040 SCT250 TEMPO 28015G22KT BKN030 FM" + h12 + "00 18008KT P6SM SCT060 BECMG " + h18 + "00 VRB05KT FEW250";
}
