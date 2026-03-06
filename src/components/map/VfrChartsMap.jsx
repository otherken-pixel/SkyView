import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MdIcon } from '../common';
import { getAirport } from '../../utils/airports';

// CartoDB tile URLs — dark and light variants match app themes
const TILE_DARK  = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_LIGHT = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const TILE_ATTR  = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

// ── VFR Sectional Chart tile URL ──
const TILE_VFR      = 'https://wms.chartbundle.com/tms/1.0.0/sec/{z}/{x}/{y}.png?origin=nw';
const TILE_VFR_ATTR = '&copy; FAA VFR Sectional &middot; <a href="https://chartbundle.com">ChartBundle</a>';

const ADDS = 'https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services';

function VfrChartsMap({ dep, arr, wps }) {
    const mapEl         = useRef(null);
    const leafletMap    = useRef(null);
    const baseTileRef   = useRef(null);
    const routeLayerRef = useRef(null);
    const layerGroupRef = useRef({});
    const altLabelRef   = useRef(null);
    const debounceRef   = useRef(null);
    const fetchRef      = useRef(null);

    const [isDark, setIsDark] = useState(!document.body.classList.contains('light-theme'));
    const [showAirports,    setShowAirports]    = useState(true);
    const [showObstacles,   setShowObstacles]   = useState(false);
    const [showNavaids,     setShowNavaids]     = useState(false);
    const [showFixes,       setShowFixes]       = useState(false);
    const [showRoutes,      setShowRoutes]      = useState(false);
    const [showSUA,         setShowSUA]         = useState(false);
    const [showAirspaceBdy, setShowAirspaceBdy] = useState(true);

    var allCodes = [dep].concat(wps || []).concat([arr]).filter(function(c) { return c && c.trim().length >= 3; });
    var allPts   = allCodes.map(function(c) { return getAirport(c); }).filter(Boolean);

    // ── Helpers ──
    function bboxParam(map) {
        var b = map.getBounds();
        return encodeURIComponent(b.getWest().toFixed(4) + ',' + b.getSouth().toFixed(4) + ',' + b.getEast().toFixed(4) + ',' + b.getNorth().toFixed(4));
    }

    function addsUrl(service, fields, where) {
        return ADDS + '/' + service + '/FeatureServer/0/query?geometry=' + bboxParam(leafletMap.current) +
            '&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects' +
            '&where=' + encodeURIComponent(where || '1=1') +
            '&outFields=' + encodeURIComponent(fields) +
            '&outSR=4326&f=geojson&resultRecordCount=4000';
    }

    function replaceLayerGroup(key, layer) {
        var map = leafletMap.current;
        if (!map) return;
        if (layerGroupRef.current[key]) { map.removeLayer(layerGroupRef.current[key]); }
        layerGroupRef.current[key] = layer;
        layer.addTo(map);
    }

    function removeLayerGroup(key) {
        var map = leafletMap.current;
        if (!map) return;
        if (layerGroupRef.current[key]) { map.removeLayer(layerGroupRef.current[key]); delete layerGroupRef.current[key]; }
    }

    function fmtAlt(val) {
        if (val == null || val === '' || val === 0 || val === '0') return 'SFC';
        var n = parseInt(val, 10);
        if (isNaN(n) || n <= 0) return 'SFC';
        return String(Math.round(n / 100));
    }

    // ── Data Fetchers ──
    function fetchAirports() {
        var L = window.L;
        fetch(addsUrl('US_Airport', 'ARPT_NAME,ICAO_ID,ARPT_ID,TYPE_CODE,ELEV', '1=1'))
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!leafletMap.current || !data.features) return;
                var layer = L.geoJSON(data, {
                    pointToLayer: function(f, ll) {
                        return L.circleMarker(ll, { radius: 5, fillColor: '#34C759', color: '#1a5c28', weight: 1.5, fillOpacity: 0.9 });
                    },
                    onEachFeature: function(f, lyr) {
                        var p = f.properties || {};
                        var id = p.ICAO_ID || p.ARPT_ID || '';
                        lyr.bindTooltip(id, { permanent: true, direction: 'right', offset: [6, 0], className: 'airport-label' });
                        lyr.bindPopup('<b>' + id + '</b><br>' + (p.ARPT_NAME || '') + '<br>Type: ' + (p.TYPE_CODE || '\u2014') + '<br>Elev: ' + (p.ELEV != null ? p.ELEV + ' ft MSL' : '\u2014'));
                    }
                });
                replaceLayerGroup('airports', layer);
            }).catch(function(e) { console.warn('[Map] Airports:', e); });
    }

    function fetchObstacles() {
        var L = window.L;
        fetch(addsUrl('DOF_Obstacles', 'OBST_NAME,AGL_HGT,MSL_HGT,TYPE_CODE', '1=1'))
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!leafletMap.current || !data.features) return;
                var layer = L.geoJSON(data, {
                    pointToLayer: function(f, ll) {
                        return L.circleMarker(ll, { radius: 3, fillColor: '#FF3B30', color: '#8B0000', weight: 1, fillOpacity: 0.85 });
                    },
                    onEachFeature: function(f, lyr) {
                        var p = f.properties || {};
                        var agl = p.AGL_HGT != null ? p.AGL_HGT + ' AGL' : '\u2014';
                        var msl = p.MSL_HGT != null ? p.MSL_HGT + ' MSL' : '\u2014';
                        lyr.bindPopup('<b>' + (p.TYPE_CODE || 'Obstacle') + '</b><br>' + (p.OBST_NAME || '') + '<br>' + agl + ' / ' + msl);
                    }
                });
                replaceLayerGroup('obstacles', layer);
            }).catch(function(e) { console.warn('[Map] Obstacles:', e); });
    }

    function fetchNavaids() {
        var L = window.L;
        fetch(addsUrl('Navaids', 'NAV_ID,NAME,TYPE_CODE,FREQ,CHANNEL', '1=1'))
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!leafletMap.current || !data.features) return;
                var layer = L.geoJSON(data, {
                    pointToLayer: function(f, ll) {
                        var tc = (f.properties.TYPE_CODE || '').toUpperCase();
                        var isVor = tc.indexOf('VOR') >= 0;
                        return L.circleMarker(ll, {
                            radius: isVor ? 5 : 4,
                            fillColor: isVor ? '#00CED1' : '#FF9500',
                            color: isVor ? '#006060' : '#7a4700',
                            weight: 1.5, fillOpacity: 0.9
                        });
                    },
                    onEachFeature: function(f, lyr) {
                        var p = f.properties || {};
                        lyr.bindTooltip((p.NAV_ID || '') + ' \u00B7 ' + (p.TYPE_CODE || ''), { direction: 'top', offset: [0, -7] });
                        lyr.bindPopup('<b>' + (p.NAV_ID || '') + '</b> \u2014 ' + (p.NAME || '') + '<br>Type: ' + (p.TYPE_CODE || '') +
                            (p.FREQ ? '<br>Freq: ' + p.FREQ : '') + (p.CHANNEL ? '<br>Ch: ' + p.CHANNEL : ''));
                    }
                });
                replaceLayerGroup('navaids', layer);
            }).catch(function(e) { console.warn('[Map] Navaids:', e); });
    }

    function fetchFixes() {
        var L = window.L;
        fetch(addsUrl('Enroute_Reporting_Points', 'FIX_ID,TYPE_CODE', '1=1'))
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!leafletMap.current || !data.features) return;
                var layer = L.geoJSON(data, {
                    pointToLayer: function(f, ll) {
                        return L.marker(ll, {
                            icon: L.divIcon({
                                className: '',
                                html: '<div style="width:8px;height:8px;transform:rotate(45deg);background:#A855F7;border:1px solid #5B21B6;"></div>',
                                iconSize: [8, 8], iconAnchor: [4, 4]
                            })
                        });
                    },
                    onEachFeature: function(f, lyr) {
                        var p = f.properties || {};
                        lyr.bindTooltip(p.FIX_ID || '', { direction: 'top', offset: [0, -7] });
                    }
                });
                replaceLayerGroup('fixes', layer);
            }).catch(function(e) { console.warn('[Map] Fixes:', e); });
    }

    function fetchRoutesData() {
        var L = window.L;
        fetch(addsUrl('ATS_Route', 'IDENT,RTE_TYPE', '1=1'))
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!leafletMap.current || !data.features) return;
                var layer = L.geoJSON(data, {
                    style: function(f) {
                        var rt = ((f.properties || {}).RTE_TYPE || '').toUpperCase();
                        var isJet = rt.indexOf('J') >= 0;
                        return { color: isJet ? '#22D3EE' : '#6B7280', weight: isJet ? 1.8 : 1.2, opacity: 0.7, dashArray: isJet ? '' : '6 4' };
                    },
                    onEachFeature: function(f, lyr) {
                        var p = f.properties || {};
                        lyr.bindTooltip((p.IDENT || '') + (p.RTE_TYPE ? ' (' + p.RTE_TYPE + ')' : ''), { sticky: true });
                    }
                });
                replaceLayerGroup('routes', layer);
            }).catch(function(e) { console.warn('[Map] Routes:', e); });
    }

    function fetchSUA() {
        var L = window.L;
        fetch(addsUrl('Special_Use_Airspace', 'NAME,TYPE_CODE,LOWER_VAL,UPPER_VAL', '1=1'))
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!leafletMap.current || !data.features) return;
                var suaColors = { R: '#FF3B30', P: '#FF3B30', M: '#FF9500', A: '#FF9500', W: '#FFCC00' };
                var layer = L.geoJSON(data, {
                    style: function(f) {
                        var tc = ((f.properties || {}).TYPE_CODE || '').charAt(0).toUpperCase();
                        var c = suaColors[tc] || '#FF6B6B';
                        return { color: c, fillColor: c, weight: 1.5, fillOpacity: 0.12, dashArray: tc === 'M' ? '8 4' : '' };
                    },
                    onEachFeature: function(f, lyr) {
                        var p = f.properties || {};
                        lyr.bindTooltip((p.TYPE_CODE || 'SUA') + ' \u00B7 ' + (p.NAME || ''), { sticky: true });
                        lyr.bindPopup('<b>' + (p.TYPE_CODE || '') + ' ' + (p.NAME || '') + '</b>' +
                            (p.LOWER_VAL != null ? '<br>Floor: ' + p.LOWER_VAL + ' ft' : '') +
                            (p.UPPER_VAL != null ? '<br>Ceiling: ' + p.UPPER_VAL + ' ft' : ''));
                    }
                });
                replaceLayerGroup('sua', layer);
            }).catch(function(e) { console.warn('[Map] SUA:', e); });
    }

    function fetchAirspace(addBoundaries) {
        var L = window.L;
        var classColors = { B: '#0A84FF', C: '#FF44FF', D: '#FF9500' };
        var classWeight = { B: 2.5, C: 2, D: 1.5 };
        var classAlpha  = { B: 0.12, C: 0.10, D: 0.08 };

        fetch(addsUrl('Class_Airspace', 'CLASS,NAME,LOWER_VAL,UPPER_VAL', "CLASS IN ('B','C','D')"))
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!leafletMap.current || !data.features) return;

                var bdyLayer = L.geoJSON(data, {
                    style: function(f) {
                        var cls = ((f.properties || {}).CLASS || 'D').toUpperCase();
                        return {
                            color: classColors[cls] || '#888',
                            fillColor: classColors[cls] || '#888',
                            weight: classWeight[cls] || 1.5,
                            fillOpacity: classAlpha[cls] || 0.08,
                            opacity: 0.9
                        };
                    },
                    onEachFeature: function(f, lyr) {
                        var p = f.properties || {};
                        lyr.bindTooltip('Class ' + p.CLASS + ' \u00B7 ' + (p.NAME || ''), { sticky: true });
                    }
                });
                if (addBoundaries) {
                    replaceLayerGroup('airspaceBdy', bdyLayer);
                }

                // Permanent altitude labels
                if (altLabelRef.current) { leafletMap.current.removeLayer(altLabelRef.current); }
                var labelGroup = L.layerGroup();
                data.features.forEach(function(f) {
                    var p = f.properties || {};
                    var upper = fmtAlt(p.UPPER_VAL);
                    var lower = fmtAlt(p.LOWER_VAL);
                    var text  = upper + '/' + lower + ' MSL';
                    var cls = (p.CLASS || 'D').toUpperCase();

                    var geom = f.geometry;
                    if (!geom) return;
                    var coords;
                    if (geom.type === 'Polygon') { coords = geom.coordinates[0]; }
                    else if (geom.type === 'MultiPolygon') { coords = geom.coordinates[0][0]; }
                    else { return; }
                    if (!coords || coords.length === 0) return;

                    var cx = 0, cy = 0, n = coords.length;
                    for (var i = 0; i < n; i++) { cx += coords[i][0]; cy += coords[i][1]; }
                    cx /= n; cy /= n;

                    var icon = L.divIcon({
                        className: 'airspace-alt-label class-' + cls,
                        html: '<span>' + text + '</span>',
                        iconSize: [90, 16],
                        iconAnchor: [45, 8]
                    });
                    L.marker([cy, cx], { icon: icon, interactive: false, pane: 'tooltipPane' }).addTo(labelGroup);
                });
                altLabelRef.current = labelGroup;
                labelGroup.addTo(leafletMap.current);

            }).catch(function(e) { console.warn('[Map] Airspace:', e); });
    }

    // ── Fetch all active layers ──
    function fetchAllLayers() {
        if (!leafletMap.current) return;
        if (showAirports)    fetchAirports();    else removeLayerGroup('airports');
        if (showObstacles)   fetchObstacles();   else removeLayerGroup('obstacles');
        if (showNavaids)     fetchNavaids();     else removeLayerGroup('navaids');
        if (showFixes)       fetchFixes();       else removeLayerGroup('fixes');
        if (showRoutes)      fetchRoutesData();  else removeLayerGroup('routes');
        if (showSUA)         fetchSUA();         else removeLayerGroup('sua');
        if (showAirspaceBdy) fetchAirspace(true); else { removeLayerGroup('airspaceBdy'); fetchAirspace(false); }
    }
    fetchRef.current = fetchAllLayers;

    // Track light/dark theme changes
    useEffect(function() {
        var obs = new MutationObserver(function() {
            setIsDark(!document.body.classList.contains('light-theme'));
        });
        obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        return function() { obs.disconnect(); };
    }, []);

    // Swap base tile layer when theme changes
    useEffect(function() {
        var L = window.L;
        if (!L || !leafletMap.current) return;
        if (baseTileRef.current) leafletMap.current.removeLayer(baseTileRef.current);
        baseTileRef.current = L.tileLayer(isDark ? TILE_DARK : TILE_LIGHT, {
            attribution: TILE_ATTR, subdomains: 'abcd', maxZoom: 19
        });
        baseTileRef.current.addTo(leafletMap.current);
        baseTileRef.current.setZIndex(0);
    }, [isDark]);

    // ── Initialize map ──
    useEffect(function() {
        var L = window.L;
        if (!L || !mapEl.current) return;

        if (!leafletMap.current) {
            leafletMap.current = L.map(mapEl.current, { zoomControl: true });
            baseTileRef.current = L.tileLayer(isDark ? TILE_DARK : TILE_LIGHT, {
                attribution: TILE_ATTR, subdomains: 'abcd', maxZoom: 19
            }).addTo(leafletMap.current);
            L.tileLayer(TILE_VFR, { attribution: TILE_VFR_ATTR, maxZoom: 13, minZoom: 4 }).addTo(leafletMap.current);

            leafletMap.current.on('moveend', function() {
                clearTimeout(debounceRef.current);
                debounceRef.current = setTimeout(function() { if (fetchRef.current) fetchRef.current(); }, 600);
            });
        }

        var map = leafletMap.current;

        // Route line
        if (routeLayerRef.current) { map.removeLayer(routeLayerRef.current); routeLayerRef.current = null; }
        if (allPts.length < 1) { map.setView([39.5, -98.35], 6); return; }

        var latLngs = allPts.map(function(p) { return [p.lat, p.lon]; });
        if (allPts.length >= 2) {
            routeLayerRef.current = L.polyline(latLngs, { color: '#D42BE0', weight: 3, opacity: 0.9, dashArray: '8 6' });
            routeLayerRef.current.addTo(map);
            map.fitBounds(latLngs, { padding: [80, 80] });
        } else {
            map.setView(latLngs[0], 9);
        }
    }, [dep, arr, JSON.stringify(wps)]);

    // ── Re-fetch layers when toggles change ──
    useEffect(function() {
        fetchAllLayers();
    }, [showAirports, showObstacles, showNavaids, showFixes, showRoutes, showSUA, showAirspaceBdy]);

    // ── Toggle airspace boundaries without affecting altitude labels ──
    useEffect(function() {
        if (!leafletMap.current) return;
        var bdy = layerGroupRef.current['airspaceBdy'];
        if (bdy) {
            if (showAirspaceBdy && !leafletMap.current.hasLayer(bdy)) bdy.addTo(leafletMap.current);
            if (!showAirspaceBdy && leafletMap.current.hasLayer(bdy)) leafletMap.current.removeLayer(bdy);
        }
    }, [showAirspaceBdy]);

    // Cleanup
    useEffect(function() {
        return function() {
            if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null; }
        };
    }, []);

    // ── Layer toggle definitions ──
    var toggleDefs = [
        { key: 'airports',    label: 'Airports',            color: '#34C759', get: showAirports,    set: setShowAirports },
        { key: 'obstacles',   label: 'Obstacles',           color: '#FF3B30', get: showObstacles,   set: setShowObstacles },
        { key: 'navaids',     label: 'Navaids',             color: '#00CED1', get: showNavaids,     set: setShowNavaids },
        { key: 'fixes',       label: 'Fixes / Waypoints',   color: '#A855F7', get: showFixes,       set: setShowFixes },
        { key: 'routes',      label: 'Aviation Routes',     color: '#6B7280', get: showRoutes,      set: setShowRoutes },
        { key: 'sua',         label: 'Special Use Airspace', color: '#FF6B6B', get: showSUA,         set: setShowSUA },
        { key: 'airspaceBdy', label: 'Airspace Boundaries', color: '#0A84FF', get: showAirspaceBdy, set: setShowAirspaceBdy },
    ];

    var rgbaMap = {
        airports: '52,199,89', obstacles: '255,59,48', navaids: '0,206,209',
        fixes: '168,85,247', routes: '107,114,128', sua: '255,107,107', airspaceBdy: '10,132,255'
    };

    return (
        <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column' }}>
            {/* ── Header with title ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--card-border-soft)' }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--accent-dim)', border: '1px solid rgba(10,132,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MdIcon name="layers" style={{ color: 'var(--accent)', fontSize: 18 }} />
                </div>
                <div>
                    <div style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--text-primary)' }}>VFR Vector Overlay</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>FAA ADDS &middot; Live GeoJSON &middot; Airspace altitudes always visible</div>
                </div>
            </div>

            {/* ── Layer toggle checkboxes ── */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', padding: '10px 18px', borderBottom: '1px solid var(--card-border-soft)', background: 'var(--card-high)' }}>
                {toggleDefs.map(function(td) {
                    return (
                        <label key={td.key} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 8, border: '1px solid', fontFamily: 'var(--font-sans)', userSelect: 'none', transition: 'all 0.15s',
                            background: td.get ? 'rgba(' + (rgbaMap[td.key] || '10,132,255') + ',0.12)' : 'var(--card)',
                            color: td.get ? td.color : 'var(--text-tertiary)',
                            borderColor: td.get ? td.color : 'var(--card-border)' }}>
                            <input type="checkbox" checked={td.get} onChange={function() { td.set(function(v) { return !v; }); }}
                                style={{ accentColor: td.color, width: 13, height: 13, margin: 0, cursor: 'pointer' }} />
                            {td.label}
                        </label>
                    );
                })}
            </div>

            {/* ── Map container ── */}
            <div ref={mapEl} style={{ width: '100%', height: 'calc(100vh - 280px)', minHeight: 500 }} />

            {/* ── Legend ── */}
            <div style={{ padding: '10px 18px', borderTop: '1px solid var(--card-border-soft)', display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                {[['Airports', '#34C759', '\u25CF'], ['Obstacles', '#FF3B30', '\u25CF'], ['Navaids', '#00CED1', '\u25CF'], ['Fixes', '#A855F7', '\u25C6'],
                  ['Victor', '#6B7280', '---'], ['Jet', '#22D3EE', '\u2014'], ['Class B', '#0A84FF', '\u25A0'], ['Class C', '#FF44FF', '\u25A0'], ['Class D', '#FF9500', '\u25A0'],
                  ['Restricted', '#FF3B30', '\u25A0'], ['MOA', '#FF9500', '\u25A0']
                ].map(function(item) {
                    return (
                        <div key={item[0]} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-secondary)' }}>
                            <span style={{ color: item[1], fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{item[2]}</span>
                            {item[0]}
                        </div>
                    );
                })}
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-tertiary)' }}>Altitude labels always on &middot; FAA ADDS</span>
            </div>
        </div>
    );
}

export default VfrChartsMap;
