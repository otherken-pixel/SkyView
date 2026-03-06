export function calcDist(lat1, lon1, lat2, lon2) {
    var R = 3440.065;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calcBearing(lat1, lon1, lat2, lon2) {
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
    var x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) - Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

export function rwyBearing(lat1, lon1, lat2, lon2) {
    var phi1 = lat1 * Math.PI / 180, phi2 = lat2 * Math.PI / 180;
    var dLambda = (lon2 - lon1) * Math.PI / 180;
    var y  = Math.sin(dLambda) * Math.cos(phi2);
    var x  = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export function routeBboxFromPts(aptPts, padDeg) {
    var pad = padDeg || 3;
    var lats = aptPts.map(function(a) { return a.lat; });
    var lons = aptPts.map(function(a) { return a.lon; });
    return { minLat: Math.min.apply(null,lats)-pad, maxLat: Math.max.apply(null,lats)+pad,
             minLon: Math.min.apply(null,lons)-pad, maxLon: Math.max.apply(null,lons)+pad };
}

export function ptInBbox(lat, lon, bb) {
    return lat >= bb.minLat && lat <= bb.maxLat && lon >= bb.minLon && lon <= bb.maxLon;
}

// GeoJSON coords: [[lon,lat],...]  (outer ring = coords[0])
export function geojsonPolyInBbox(coords, bb) {
    var ring = (coords && coords[0]) ? coords[0] : coords;
    if (!ring) return false;
    return ring.some(function(pt) { return ptInBbox(pt[1], pt[0], bb); });
}

// G-AIRMET area: [{lat,lon},...]
export function latLonPolyInBbox(area, bb) {
    if (!Array.isArray(area)) return false;
    return area.some(function(pt) { return ptInBbox(pt.lat, pt.lon, bb); });
}

// CWA polygon: "lat,lon lat,lon ..." string
export function cwaPolyInBbox(polyStr, bb) {
    if (!polyStr) return false;
    return polyStr.trim().split(/\s+/).some(function(pair) {
        var parts = pair.split(',');
        if (parts.length < 2) return false;
        return ptInBbox(parseFloat(parts[0]), parseFloat(parts[1]), bb);
    });
}

// Longitude-based IANA timezone fallback for dynamically-fetched airports
export function lonToIanaTz(lon) {
    if (!lon || lon > -87)  return 'America/New_York';
    if (lon > -102) return 'America/Chicago';
    if (lon > -115) return 'America/Denver';
    return 'America/Los_Angeles';
}
