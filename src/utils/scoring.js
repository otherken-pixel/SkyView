import { CAT_RANK } from './aviation';
import { FRAT_QUESTIONS, FRAT_CAT_MAX, FRAT_CAT_WEIGHT } from '../data/frat';

export function calcGoScoreFromMetars(depMetar, arrMetar) {
    if (!depMetar || !arrMetar) return 50;
    // Use worst-case category (no averaging) - Math.min of conditions, not average
    var worstRank = Math.max(CAT_RANK[depMetar.cat] || 0, CAT_RANK[arrMetar.cat] || 0);
    var worstCat = ['VFR', 'MVFR', 'IFR', 'LIFR'][worstRank] || 'VFR';
    // IFR or LIFR -> instant fail
    if (worstCat === 'IFR' || worstCat === 'LIFR') return 0;
    var catScores = { VFR: 95, MVFR: 60 };
    var windPen = Math.max(0, (depMetar.wspd - 15) * 3) + Math.max(0, (arrMetar.wspd - 15) * 3);
    return Math.max(5, Math.min(99, Math.round((catScores[worstCat] || 50) - windPen)));
}

export function calcDetailedScore(effectiveWxData, routeDist, isIfrRated) {
    isIfrRated = isIfrRated || false;
    if (!effectiveWxData || effectiveWxData.length === 0) return { total: 50, breakdown: [], scoreCap: null };
    function parseT(ts) {
        if (!ts) return null;
        var m = ts.match(/^(M?)(\d+)\//);
        return m ? (m[1] === 'M' ? -parseInt(m[2]) : parseInt(m[2])) : null;
    }
    var breakdown = [];

    // 1. Flight category (0-25 pts)
    var worstCat = effectiveWxData.reduce(function(w, e) {
        if (!e.effectiveWx) return w;
        return (CAT_RANK[e.effectiveWx.cat] || 0) > (CAT_RANK[w] || 0) ? e.effectiveWx.cat : w;
    }, 'VFR');
    var catCol = { VFR: 'var(--cat-vfr-color)', MVFR: 'var(--cat-mvfr-color)', IFR: 'var(--cat-ifr-color)', LIFR: 'var(--cat-lifr-color)' }[worstCat] || 'var(--cat-vfr-color)';
    var hasIFRorLIFR = worstCat === 'IFR' || worstCat === 'LIFR';
    var scoreCap = null;
    var catPts, catDetail;
    if (!isIfrRated) {
        // Strict VFR Hard Veto system
        if (hasIFRorLIFR) {
            catPts   = 0;
            scoreCap = 30;
            catDetail = 'Worst: ' + worstCat + ' \u2014 Hard Veto (total capped at 30)';
        } else if (worstCat === 'MVFR') {
            catPts   = 10;
            scoreCap = 70;
            catDetail = 'Worst: MVFR \u2014 Strict penalty (total capped at 70)';
        } else {
            catPts   = 25;
            catDetail = 'Worst case: VFR';
        }
    } else {
        // IFR-rated fallback: point deductions, no hard veto; LIFR still penalised heavily
        if (worstCat === 'LIFR') {
            catPts   = 3;
            scoreCap = 40;
            catDetail = 'Worst: LIFR \u2014 Heavy penalty (IFR rated, capped at 40)';
        } else {
            catPts   = { VFR: 25, MVFR: 16, IFR: 8 }[worstCat] || 25;
            catDetail = 'Worst case: ' + worstCat + (worstCat === 'IFR' ? ' (IFR rated)' : '');
        }
    }
    breakdown.push({ label: 'Flight Category', score: catPts, max: 25, icon: 'cloud', color: catCol, detail: catDetail });

    // 2. Visibility (0-20 pts)
    function parseVisSM(s) {
        if (!s) return NaN;
        if (/^P/i.test(s)) return 10; // "P6SM" = "plus 6 SM" -> treat as 10
        var m = s.match(/([\d.]+)\s*(?:\/\s*([\d.]+))?\s*SM/i);
        if (!m) return NaN;
        return m[2] ? parseInt(m[1]) / parseInt(m[2]) : parseFloat(m[1]);
    }
    var minVis = Infinity;
    effectiveWxData.forEach(function(e) {
        if (!e.effectiveWx) return;
        var v = parseVisSM(e.effectiveWx.vis);
        if (!isNaN(v)) minVis = Math.min(minVis, v);
    });
    var visPts = minVis === Infinity ? 20 : minVis >= 10 ? 20 : minVis >= 5 ? 16 : minVis >= 3 ? 10 : minVis >= 1 ? 4 : 0;
    var visCol = visPts >= 16 ? 'var(--cat-vfr-color)' : visPts >= 10 ? 'var(--cat-mvfr-color)' : 'var(--cat-ifr-color)';
    breakdown.push({ label: 'Visibility', score: visPts, max: 20, icon: 'visibility', color: visCol, detail: minVis === Infinity ? 'No data' : (minVis.toFixed(1) + ' SM') });

    // 3. Wind & gusts (0-20 pts)
    var maxWind = 0;
    effectiveWxData.forEach(function(e) {
        if (!e.effectiveWx) return;
        var ws = e.effectiveWx.wind || '';
        var wm = ws.match(/(\d{2,3})KT/); if (wm) maxWind = Math.max(maxWind, parseInt(wm[1]));
        var gm = ws.match(/G(\d+)KT/); if (gm) maxWind = Math.max(maxWind, parseInt(gm[1]));
    });
    var windPts = maxWind <= 10 ? 20 : maxWind <= 15 ? 17 : maxWind <= 20 ? 12 : maxWind <= 25 ? 6 : 0;
    var windCol = windPts >= 17 ? 'var(--cat-vfr-color)' : windPts >= 12 ? 'var(--cat-mvfr-color)' : 'var(--cat-ifr-color)';
    breakdown.push({ label: 'Winds / Gusts', score: windPts, max: 20, icon: 'air', color: windCol, detail: maxWind > 0 ? ('Max ' + maxWind + ' kts') : 'Calm' });

    // 4. Route length complexity (0-15 pts)
    var rd = routeDist || 0;
    var rtPts = rd <= 50 ? 15 : rd <= 150 ? 13 : rd <= 300 ? 10 : rd <= 500 ? 7 : 4;
    var rtCol = rtPts >= 13 ? 'var(--cat-vfr-color)' : rtPts >= 10 ? 'var(--cat-mvfr-color)' : 'var(--md-sys-color-warning)';
    breakdown.push({ label: 'Route Length', score: rtPts, max: 15, icon: 'route', color: rtCol, detail: rd + ' NM total' });

    // 5. Data confidence (0-10 pts)
    var noLive = effectiveWxData.some(function(e) { return !e.metarLive; });
    var isNws  = effectiveWxData.some(function(e) { return e.source === 'nws'; });
    var isTaf  = effectiveWxData.some(function(e) { return e.source === 'taf'; });
    var confPts = noLive ? 4 : isNws ? 6 : isTaf ? 8 : 10;
    var confCol = confPts >= 8 ? 'var(--cat-vfr-color)' : confPts >= 5 ? 'var(--cat-mvfr-color)' : 'var(--cat-ifr-color)';
    var confTxt = noLive ? 'Simulated stations present' : isNws ? 'NWS 7-day forecast (>30h)' : isTaf ? 'TAF forecast' : 'Live METAR';
    breakdown.push({ label: 'Data Quality', score: confPts, max: 10, icon: 'verified', color: confCol, detail: confTxt });

    // 6. Icing / freezing risk (0-10 pts)
    var icingRisk = 0;
    effectiveWxData.forEach(function(e) {
        if (!e.effectiveWx) return;
        var tc = parseT(e.effectiveWx.temp);
        if (tc !== null && tc <= 2 && tc >= -22) icingRisk = Math.max(icingRisk, 2);
        else if (e.effectiveWx.sky && /FZRA|FZDZ|SN|RASN/.test(e.effectiveWx.sky)) icingRisk = Math.max(icingRisk, 1);
    });
    var icPts = icingRisk === 0 ? 10 : icingRisk === 1 ? 6 : 2;
    var icCol = icPts === 10 ? 'var(--cat-vfr-color)' : icPts === 6 ? 'var(--cat-mvfr-color)' : 'var(--cat-ifr-color)';
    var icTxt = icingRisk === 0 ? 'No indicators' : icingRisk === 1 ? 'Precip type \u2014 check PIREPs' : 'Near-freezing temps + moisture';
    breakdown.push({ label: 'Icing Risk', score: icPts, max: 10, icon: 'ac_unit', color: icCol, detail: icTxt });

    var rawTotal = breakdown.reduce(function(s, f) { return s + f.score; }, 0);
    var total = scoreCap !== null
        ? Math.round(Math.min(scoreCap, rawTotal))
        : Math.round(Math.min(100, rawTotal));
    return { total: total, breakdown: breakdown, scoreCap: scoreCap };
}

export function calcFratGoScore(answers) {
    var raw = { P:0, A:0, V:0, E:0 };
    FRAT_QUESTIONS.forEach(function(q) {
        if (answers[q.id] !== undefined) raw[q.cat] += answers[q.id];
    });
    var risk = 0;
    ['P','A','V','E'].forEach(function(c) {
        risk += (raw[c] / FRAT_CAT_MAX[c]) * 100 * FRAT_CAT_WEIGHT[c];
    });
    return Math.max(0, Math.min(100, Math.round(100 - risk)));
}
