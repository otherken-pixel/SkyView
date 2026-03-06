import React, { useRef, useEffect, useState } from 'react';
import L from 'leaflet';
import { MdIcon } from '../common';
import { getAirport } from '../../utils/airports';
import { calcDist, calcBearing } from '../../utils/geo';
import { fetchLiveMetar } from '../../services/weather';

// CartoDB tile URLs — dark and light variants match app themes
const TILE_DARK  = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_LIGHT = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const TILE_ATTR  = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

function RouteMap({ dep, arr, wps }) {
    const mapContainerRef = useRef(null);
    const leafletMapRef   = useRef(null);
    const tileLayerRef    = useRef(null);
    const overlaysRef     = useRef([]);

    const [isDark, setIsDark] = useState(!document.body.classList.contains('light-theme'));

    const allCodes = [dep].concat(wps || []).concat([arr]).filter(function(c){ return c && c.trim().length === 4; });
    const allPts   = allCodes.map(function(c){ return getAirport(c); }).filter(Boolean);

    let totalDist = 0, heading = 0;
    if (allPts.length >= 2) {
        for (let di = 0; di < allPts.length - 1; di++)
            totalDist += calcDist(allPts[di].lat, allPts[di].lon, allPts[di+1].lat, allPts[di+1].lon);
        heading = calcBearing(allPts[0].lat, allPts[0].lon, allPts[allPts.length-1].lat, allPts[allPts.length-1].lon);
    }

    // Track light/dark theme changes
    useEffect(function() {
        const obs = new MutationObserver(function(){
            setIsDark(!document.body.classList.contains('light-theme'));
        });
        obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        return function(){ obs.disconnect(); };
    }, []);

    // Swap tile layer when theme changes
    useEffect(function() {
        if (!leafletMapRef.current) return;
        if (tileLayerRef.current) leafletMapRef.current.removeLayer(tileLayerRef.current);
        tileLayerRef.current = L.tileLayer(isDark ? TILE_DARK : TILE_LIGHT,
            { attribution: TILE_ATTR, subdomains: 'abcd', maxZoom: 19 }
        ).addTo(leafletMapRef.current);
    }, [isDark]);

    // Build map and route overlay
    useEffect(function() {
        if (!mapContainerRef.current) return;

        if (!leafletMapRef.current) {
            leafletMapRef.current = L.map(mapContainerRef.current, { zoomControl: true });
            tileLayerRef.current  = L.tileLayer(isDark ? TILE_DARK : TILE_LIGHT,
                { attribution: TILE_ATTR, subdomains: 'abcd', maxZoom: 19 }
            ).addTo(leafletMapRef.current);
        }

        const map = leafletMapRef.current;
        overlaysRef.current.forEach(function(l){ map.removeLayer(l); });
        overlaysRef.current = [];

        if (allPts.length < 2) return;

        const latLngs = allPts.map(function(p){ return [p.lat, p.lon]; });

        // Glow halo + solid route line — magenta for high contrast on all backgrounds
        const lineColor = isDark ? '#FF6BF0' : '#D42BE0';
        const glow = L.polyline(latLngs, { color: lineColor, weight: 16, opacity: isDark ? 0.22 : 0.4 });
        const line = L.polyline(latLngs, { color: lineColor, weight: 4,  opacity: 0.95 });
        glow.addTo(map); overlaysRef.current.push(glow);
        line.addTo(map); overlaysRef.current.push(line);

        // Markers — aviation-standard colours matching app theme vars
        const _catColors  = { VFR: '#34C759', MVFR: '#0A84FF', IFR: '#FF3B30', LIFR: '#BF5AF2' };
        const _freqLabels = { atis: 'ATIS', twr: 'Tower', gnd: 'Ground', app: 'Approach', dep: 'Departure', clnc: 'Clearance' };
        allPts.forEach(function(p, i) {
            const isDepPt = i === 0, isArrPt = i === allPts.length - 1;
            const color = isDepPt ? '#34C759' : isArrPt ? '#FF3B30' : '#0A84FF';
            const marker = L.circleMarker([p.lat, p.lon], {
                radius: isDepPt || isArrPt ? 9 : 7,
                fillColor: color, color: isDark ? '#000' : '#fff',
                weight: 2, fillOpacity: 1,
            });
            marker.addTo(map);
            marker.bindTooltip(allCodes[i], {
                permanent: true, direction: 'top', offset: [0, -10],
                className: 'route-icao-label',
            });

            // Contextual popup on click
            const icao      = allCodes[i];
            const roleLabel = isDepPt ? 'DEPARTURE' : isArrPt ? 'ARRIVAL' : ('WAYPOINT ' + i);
            const wxSpanId  = 'rmap-wx-' + icao;
            const freqRows  = Object.keys(_freqLabels)
                .filter(function(k) { return p.freq && p.freq[k]; })
                .map(function(k) {
                    return '<tr>'
                        + '<td style="color:var(--text-secondary);font-size:11px;padding:2px 14px 2px 0;white-space:nowrap;">' + _freqLabels[k] + '</td>'
                        + '<td style="font-size:12px;font-weight:700;font-family:var(--font-mono);white-space:nowrap;">' + p.freq[k] + '</td>'
                        + '</tr>';
                }).join('');
            const popupContent =
                '<div style="padding:14px 16px 12px;min-width:195px;">'
                + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">'
                + '<span style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--text-secondary);">' + roleLabel + '</span>'
                + '<span id="' + wxSpanId + '" style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;background:#555;color:#fff;min-width:36px;text-align:center;">WX\u2026</span>'
                + '</div>'
                + '<div style="font-size:18px;font-weight:800;font-family:var(--font-mono);margin-bottom:3px;">' + icao + '</div>'
                + '<div style="font-size:13px;font-weight:600;margin-bottom:2px;">' + (p.name || '') + '</div>'
                + '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:' + (freqRows ? '12px' : '2px') + ';">' + (p.city || '') + (p.state ? ', ' + p.state : '') + '</div>'
                + (freqRows ? '<table style="width:100%;border-collapse:collapse;">' + freqRows + '</table>' : '')
                + '</div>';
            marker.bindPopup(
                L.popup({ maxWidth: 280, minWidth: 200, className: 'route-apt-popup' })
                 .setContent(popupContent)
            );
            marker.on('popupopen', function() {
                fetchLiveMetar(icao).then(function(metar) {
                    const span = document.getElementById(wxSpanId);
                    if (!span) return;
                    const cat = metar ? metar.cat : null;
                    span.textContent = cat || 'N/A';
                    span.style.background = _catColors[cat] || '#666';
                }).catch(function() {});
            });

            overlaysRef.current.push(marker);
        });

        map.fitBounds(latLngs, { padding: [50, 50] });
    }, [dep, arr, JSON.stringify(wps), allPts.length]);

    // Update marker ring stroke when theme changes
    useEffect(function() {
        overlaysRef.current.forEach(function(l) {
            if (typeof l.getRadius === 'function') {
                l.setStyle({ color: isDark ? '#000' : '#fff' });
            }
        });
    }, [isDark]);

    // Cleanup on unmount
    useEffect(function() {
        return function() {
            if (leafletMapRef.current) {
                leafletMapRef.current.remove();
                leafletMapRef.current = null;
            }
        };
    }, []);

    const overlayStyle = {
        background: isDark ? 'rgba(10,10,15,0.75)' : 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderRadius: 10, padding: '6px 12px',
        color: 'var(--text-primary)', border: '1px solid var(--card-border)',
    };

    if (allPts.length < 2) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 360, color: 'var(--text-tertiary)', fontSize: 14 }}>
                Enter a valid route to view map
            </div>
        );
    }
    return (
        <div style={{ position: 'relative' }}>
            <div ref={mapContainerRef} style={{ width: '100%', height: 400 }} />
            <div className="font-mono" style={{ position: 'absolute', bottom: 40, left: 12, zIndex: 1000, display: 'flex', gap: 8, fontSize: 12, pointerEvents: 'none' }}>
                <div style={overlayStyle}><span style={{ color: 'var(--text-tertiary)' }}>DIST </span><strong>{Math.round(totalDist)} NM</strong></div>
                <div style={overlayStyle}><span style={{ color: 'var(--text-tertiary)' }}>HDG </span><strong>{String(Math.round(heading)).padStart(3, '0')}&deg;</strong></div>
            </div>
        </div>
    );
}

export default RouteMap;
