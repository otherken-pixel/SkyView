import React, { useState, useEffect } from 'react';
import { MdIcon } from '../common';
import { fetchLiveMetar } from '../../services/weather';
import { getAirport } from '../../utils/airports';
import { fetchRunwayData, buildRunwayEnds } from '../../utils/aviation';
import { timeoutFetch } from '../../services/weather';

function RunwayWindRose({ relAngle, isBest }) {
  const S = 52, cx = S/2, cy = S/2, r = 17;
  const aRad = relAngle * Math.PI / 180;
  const sx = cx + r * Math.sin(aRad);
  const sy = cy - r * Math.cos(aRad);
  const dx = cx - sx, dy = cy - sy, len = Math.sqrt(dx*dx + dy*dy);
  const ux = dx/len, uy = dy/len;
  const ex = sx + ux * (len - 5), ey = sy + uy * (len - 5);
  const hx = ex - ux*7, hy = ey - uy*7;
  const p1x = hx - uy*4, p1y = hy + ux*4;
  const p2x = hx + uy*4, p2y = hy - ux*4;
  const col = isBest ? 'var(--accent)' : 'var(--text-secondary)';
  return (
    <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r+1} fill="none" stroke="var(--card-border)" strokeWidth="1"/>
      <rect x={cx-3} y={4} width={6} height={S-8} rx={2} fill="rgba(255,255,255,0.07)"/>
      <line x1={cx} y1={4} x2={cx} y2={S-4} stroke="var(--text-tertiary)" strokeWidth="1" strokeDasharray="3,2"/>
      <line x1={cx-6} y1={S-5} x2={cx+6} y2={S-5} stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round"/>
      <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={col} strokeWidth="2.5" strokeLinecap="round"/>
      <polygon points={`${ex},${ey} ${p1x},${p1y} ${p2x},${p2y}`} fill={col}/>
    </svg>
  );
}

export default function RunwayPanel({ icao }) {
  const [runways, setRunways] = useState(null);
  const [loading, setLoading] = useState(true);
  const [windDir, setWindDir] = useState(null);
  const [windSpd, setWindSpd] = useState(0);
  const [windSource, setWindSource] = useState(null);

  useEffect(() => {
    setLoading(true);
    setRunways(null);
    setWindDir(null);
    setWindSpd(0);
    setWindSource(null);
    Promise.all([
      fetchRunwayData(icao).catch(() => []),
      fetchLiveMetar(icao).catch(() => null)
    ]).then(async (results) => {
      setRunways(results[0] || []);
      const metar = results[1];
      if (metar && metar.wdir != null) {
        setWindDir(metar.wdir);
        setWindSpd(metar.wspd || 0);
        setWindSource(null);
        setLoading(false);
        return;
      }
      const apt = getAirport(icao);
      if (apt && apt.lat) {
        try {
          const nearRes = await timeoutFetch(
            'https://aviationweather.gov/api/data/metar?bbox=' +
            (apt.lat - 0.5).toFixed(4) + ',' + (apt.lon - 0.5).toFixed(4) + ',' +
            (apt.lat + 0.5).toFixed(4) + ',' + (apt.lon + 0.5).toFixed(4) +
            '&format=json', {}, 8000
          );
          if (nearRes.ok) {
            const nearData = await nearRes.json();
            if (Array.isArray(nearData) && nearData.length > 0) {
              let best = null, bestDist = Infinity;
              nearData.forEach(m => {
                if (m.wdir == null || m.wspd == null) return;
                const dLat = (m.lat - apt.lat) * 111.32;
                const dLon = (m.lon - apt.lon) * 111.32 * Math.cos(apt.lat * Math.PI / 180);
                const dist = Math.sqrt(dLat * dLat + dLon * dLon);
                if (dist < bestDist) { bestDist = dist; best = m; }
              });
              if (best && best.wdir != null) {
                setWindDir(best.wdir);
                setWindSpd(best.wspd || 0);
                setWindSource(best.icaoId || best.stationId || 'nearby');
              }
            }
          }
        } catch(_e) { /* no nearby wind */ }
      }
      setLoading(false);
    }).catch(() => { setRunways([]); setLoading(false); });
  }, [icao]);

  if (loading) return (
    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
      <MdIcon name="sync" style={{ fontSize: 22, animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 8px' }}/>
      <div style={{ fontSize: 13 }}>Loading runway data…</div>
    </div>
  );

  if (!runways || runways.length === 0) return (
    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
      <MdIcon name="info" style={{ fontSize: 20, display: 'block', margin: '0 auto 6px' }}/>
      No runway data found
    </div>
  );

  const hasWind = windDir != null && windSpd > 0;
  const ends = buildRunwayEnds(runways, windDir, windSpd);
  const source = runways[0].source;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ fontSize: 12, color: hasWind ? 'var(--cat-vfr-color)' : 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <MdIcon name="air" style={{ fontSize: 14 }}/>
        {hasWind
          ? `Wind ${windDir}° at ${windSpd} kt` + (windSource ? ` (via ${windSource})` : '') + ' — best runway highlighted'
          : 'No wind data — showing headings only'
        }
      </div>
      {ends.map((end, i) => {
        const isBest = hasWind && i === 0;
        const relAngle = windDir != null ? ((windDir - end.heading) % 360 + 360) % 360 : 0;
        return (
          <div key={i} style={{
            background: isBest ? 'rgba(10,132,255,0.07)' : 'var(--md-sys-color-surface-container)',
            border: '1px solid ' + (isBest ? 'rgba(10,132,255,0.35)' : 'var(--card-border-soft)'),
            borderRadius: 14, padding: '14px 16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontWeight: 800, fontSize: 24, fontFamily: 'var(--font-mono)', color: isBest ? 'var(--accent)' : 'var(--text-primary)', letterSpacing: 1, lineHeight: 1 }}>
                {end.id}
              </span>
              {isBest && <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--accent)', color: '#fff', borderRadius: 6, padding: '3px 9px', letterSpacing: 0.4, flexShrink: 0 }}>BEST</span>}
              {end.xwindWarn && <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(255,149,0,0.18)', color: 'var(--caution)', borderRadius: 6, padding: '3px 9px', letterSpacing: 0.4, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}><MdIcon name="warning" style={{ fontSize: 11 }}/> X-WIND</span>}
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{end.heading}° mag</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {hasWind && <RunwayWindRose relAngle={relAngle} isBest={isBest}/>}
              {hasWind ? (
                <div style={{ display: 'flex', gap: 24, flex: 1 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 }}>{end.headwind >= 0 ? 'Headwind' : 'Tailwind'}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', color: end.headwind < 0 ? 'var(--nogo)' : isBest ? 'var(--accent)' : 'var(--text-primary)', lineHeight: 1 }}>
                      {Math.abs(end.headwind)}<span style={{ fontSize: 13, fontWeight: 400, marginLeft: 3 }}>kt</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 }}>Crosswind</div>
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', color: end.xwindWarn ? 'var(--caution)' : 'var(--text-primary)', lineHeight: 1 }}>
                      {end.crosswind}<span style={{ fontSize: 13, fontWeight: 400, marginLeft: 3 }}>kt</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', flex: 1 }}>Wind unavailable — enter weather to see components</div>
              )}
            </div>
            {(end.lengthFt || end.surface) && (
              <div style={{ marginTop: 10, display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-tertiary)', borderTop: '1px solid var(--card-border-soft)', paddingTop: 8 }}>
                {end.lengthFt && <span><MdIcon name="straighten" style={{ fontSize: 12, verticalAlign: 'middle', marginRight: 3 }}/>{end.lengthFt.toLocaleString()} ft</span>}
                {end.surface && <span style={{ textTransform: 'capitalize' }}>{end.surface}</span>}
              </div>
            )}
          </div>
        );
      })}
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'right' }}>
        Runway geometry — {source === 'osm' ? 'OpenStreetMap / Overpass' : 'Estimated from designator (±5°)'}
      </div>
    </div>
  );
}
