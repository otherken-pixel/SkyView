import { getAirport } from './airports';
import { parseCeilingFt, parseVisSMNum, getRunwayRecommendation } from './weather';

var _MIN_LS_KEY = 'skyview_personal_minimums';

export function getPersonalMinimums() {
    try { var r = localStorage.getItem(_MIN_LS_KEY); return r ? JSON.parse(r) : null; }
    catch(e) { return null; }
}

export function savePersonalMinimums(mins) {
    if (mins) localStorage.setItem(_MIN_LS_KEY, JSON.stringify(mins));
    else localStorage.removeItem(_MIN_LS_KEY);
}

export function checkPersonalMinimums(effectiveWxData, personalMinimums, tripTargetUtc) {
    if (!personalMinimums || !Object.values(personalMinimums).some(function(v) { return v != null && v > 0; })) {
        return { penalty: 25, status: 'notset', worstParam: null,
            color: 'var(--caution)', icon: 'warning',
            detail: 'ADM: Personal minimums not configured — set them in Pilot Profile' };
    }
    var isNight = tripTargetUtc ? (tripTargetUtc.getUTCHours() < 6 || tripTargetUtc.getUTCHours() >= 20) : false;
    var minCeil = isNight ? (personalMinimums.ceilingNight || personalMinimums.ceilingDay || 0) : (personalMinimums.ceilingDay || 0);
    var minVis  = isNight ? (personalMinimums.visNight || personalMinimums.visDay || 0) : (personalMinimums.visDay || 0);
    var maxWind  = personalMinimums.maxWind || 0;
    var maxGust  = personalMinimums.maxGustSpread || 0;
    var maxXwind = personalMinimums.maxCrosswind || 0;
    var worstRank = 0, worstStatus = 'clear', worstParam = null, detailMsg = '';
    function elevate(rank, status, param, msg) {
        if (rank > worstRank) { worstRank = rank; worstStatus = status; worstParam = param; detailMsg = msg; }
    }
    (effectiveWxData || []).forEach(function(e) {
        var wx = e.effectiveWx; if (!wx) return;
        var id = e.icao, apt = getAirport(id);
        if (minCeil > 0) {
            var cft = parseCeilingFt(wx.sky);
            if (cft !== null) {
                if (cft < minCeil) elevate(3, 'exceed', 'Ceiling', id + ': ceiling ' + cft + 'ft below min ' + minCeil + 'ft');
                else if (cft === minCeil) elevate(2, 'at', 'Ceiling', id + ': ceiling exactly at minimum ' + minCeil + 'ft');
                else if (cft <= minCeil * 1.20) elevate(1, 'buffer', 'Ceiling', id + ': ceiling ' + cft + 'ft within 20% of minimum');
            }
        }
        if (minVis > 0) {
            var vis = parseVisSMNum(wx.vis);
            if (vis !== null) {
                if (vis < minVis) elevate(3, 'exceed', 'Visibility', id + ': vis ' + vis + 'SM below min ' + minVis + 'SM');
                else if (vis === minVis) elevate(2, 'at', 'Visibility', id + ': visibility exactly at minimum');
                else if (vis <= minVis * 1.20) elevate(1, 'buffer', 'Visibility', id + ': visibility within 20% of minimum');
            }
        }
        if (maxWind > 0) {
            var wm = (wx.wind || '').match(/(\d{2,3})KT/);
            var wkts = wm ? parseInt(wm[1]) : 0;
            if (wkts > maxWind) elevate(3, 'exceed', 'Wind', id + ': wind ' + wkts + 'kt exceeds max ' + maxWind + 'kt');
            else if (wkts === maxWind) elevate(2, 'at', 'Wind', id + ': wind exactly at maximum');
            else if (wkts >= maxWind * 0.80) elevate(1, 'buffer', 'Wind', id + ': wind ' + wkts + 'kt within 20% of maximum');
        }
        if (maxGust > 0) {
            var gm = (wx.wind || '').match(/(\d{2,3})G(\d+)KT/);
            if (gm) {
                var spread = parseInt(gm[2]) - parseInt(gm[1]);
                if (spread > maxGust) elevate(3, 'exceed', 'Gust Spread', id + ': gust spread ' + spread + 'kt exceeds max ' + maxGust + 'kt');
                else if (spread === maxGust) elevate(2, 'at', 'Gust Spread', id + ': gust spread exactly at maximum');
                else if (spread >= maxGust * 0.80) elevate(1, 'buffer', 'Gust Spread', id + ': gust spread within 20% of maximum');
            }
        }
        if (maxXwind > 0 && apt) {
            var rwy = getRunwayRecommendation(wx, apt);
            if (rwy && rwy.crosswind != null) {
                var xw = rwy.crosswind;
                if (xw > maxXwind) elevate(3, 'exceed', 'Crosswind', id + ': crosswind ' + xw + 'kt exceeds max ' + maxXwind + 'kt');
                else if (xw === maxXwind) elevate(2, 'at', 'Crosswind', id + ': crosswind exactly at maximum');
                else if (xw >= maxXwind - 2) elevate(1, 'buffer', 'Crosswind', id + ': crosswind ' + xw + 'kt within 2kt of limit');
            }
        }
        var wxCat = wx.cat;
        if (wxCat === 'IFR' || wxCat === 'LIFR') {
            if (minCeil === 0 && minVis === 0) elevate(3, 'exceed', 'Flight Category', id + ': conditions are ' + wxCat + ' — set ceiling/visibility minimums in Pilot Profile');
            else if (worstRank < 1) elevate(1, 'buffer', 'Flight Category', id + ': conditions are ' + wxCat + ' — review your ceiling/visibility minimums');
        }
    });
    switch (worstStatus) {
        case 'exceed': return { penalty: 50, status: 'exceed', worstParam: worstParam, color: 'var(--nogo)', icon: 'dangerous', detail: 'EXCEEDS minimums — ' + detailMsg };
        case 'at':     return { penalty: 30, status: 'at', worstParam: worstParam, color: 'var(--nogo)', icon: 'warning', detail: 'AT minimums — ' + detailMsg };
        case 'buffer': return { penalty: 15, status: 'buffer', worstParam: worstParam, color: 'var(--caution)', icon: 'warning_amber', detail: 'Buffer zone — ' + detailMsg };
        default:       return { penalty: 0, status: 'clear', worstParam: null, color: 'var(--go)', icon: 'check_circle', detail: 'All conditions clear of personal minimums' };
    }
}
