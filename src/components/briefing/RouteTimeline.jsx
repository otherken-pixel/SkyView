import React from 'react';
import { MdIcon } from '../common';
import { WindBarb, WeatherIcon } from '../weather';
import { getAirport } from '../../utils/airports';
import { calcDist } from '../../utils/geo';

function RouteTimeline({ routePts, wxData, effectiveWxData }) {
    function catColor(cat) {
        return ({ VFR: 'var(--vfr)', MVFR: 'var(--mvfr)', IFR: 'var(--ifr)', LIFR: 'var(--lifr)' })[cat] || 'var(--text-tertiary)';
    }
    function catBgColor(cat) {
        return ({ VFR: 'var(--vfr-bg)', MVFR: 'var(--mvfr-bg)', IFR: 'var(--ifr-bg)', LIFR: 'var(--lifr-bg)' })[cat] || 'var(--card-high)';
    }
    function parseDeg(windStr) {
        if (!windStr) return null;
        const m = windStr.match(/^(\d{3})@(\d+)/);
        return m ? parseInt(m[1]) : null;
    }
    function parseKts(windStr) {
        if (!windStr) return null;
        const m = windStr.match(/^(\d{3})@(\d+)/);
        return m ? parseInt(m[2]) : null;
    }

    return (
        <div className="route-timeline" style={{ marginBottom: 20 }}>
            {routePts.map(function(icao, idx) {
                const isFirst = idx === 0;
                const isLast  = idx === routePts.length - 1;
                const apt = getAirport(icao);
                const wxEntry = wxData && wxData.find(function(w){ return w.icao === icao; });
                const effEntry = effectiveWxData && effectiveWxData.find(function(e){ return e.icao === icao; });
                const wx = effEntry ? effEntry.effectiveWx : (wxEntry ? wxEntry.metar : null);
                const cat = wx ? wx.cat : null;
                const nodeClr = cat ? catColor(cat) : 'var(--text-tertiary)';
                const nodeBg  = cat ? catBgColor(cat) : 'var(--card-high)';
                const role = isFirst ? 'DEP' : isLast ? 'DEST' : ('WP' + idx);

                // Wind direction and speed for barb
                const windDeg = wx ? parseDeg(wx.wind) : null;
                const windKts = wx ? parseKts(wx.wind) : null;

                // Next leg distance
                let legDist = null;
                if (!isLast) {
                    const p1 = apt;
                    const p2 = getAirport(routePts[idx + 1]);
                    if (p1 && p2) {
                        legDist = Math.round(calcDist(p1.lat, p1.lon, p2.lat, p2.lon));
                    }
                }

                return (
                    <div key={icao} className="timeline-node">
                        {/* Spine column */}
                        <div className="timeline-spine">
                            <div className="timeline-line" style={{ background: isFirst ? 'transparent' : 'var(--card-border)', minHeight: isFirst ? 8 : 12 }} />
                            <div className="timeline-dot" style={{ background: nodeBg, border: '2.5px solid ' + nodeClr, boxShadow: cat ? ('0 0 10px ' + nodeClr + '55') : 'none' }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: nodeClr }} />
                            </div>
                            <div className="timeline-line" style={{ background: isLast ? 'transparent' : 'var(--card-border)' }} />
                        </div>

                        {/* Station card */}
                        <div style={{ flex: 1, paddingBottom: isLast ? 0 : 4, paddingTop: 0 }}>
                            <div className="timeline-station-card" style={{
                                borderLeftColor: nodeClr,
                                background: 'var(--card-mid)',
                                border: '1px solid var(--card-border-soft)',
                                borderLeftWidth: 3,
                            }}>
                                {/* Station header */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                                    <span className="font-mono" style={{ fontSize: 17, fontWeight: 800, color: nodeClr, letterSpacing: '-0.3px' }}>{icao}</span>
                                    <span style={{ fontSize: 9, fontWeight: 800, background: nodeClr, color: '#fff', borderRadius: 99, padding: '1px 8px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{role}</span>
                                    {cat && (
                                        <span className={'cat-badge cat-' + cat.toLowerCase()}>
                                            <MdIcon name={cat === 'VFR' ? 'check_circle' : cat === 'MVFR' ? 'warning' : 'cancel'} style={{ fontSize: 10 }} />
                                            {cat}
                                        </span>
                                    )}
                                    {apt && <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{apt.city || apt.name}</span>}
                                </div>

                                {/* Weather data row */}
                                {wx && (
                                    <div className="wx-metric-grid">
                                        {/* Wind with barb */}
                                        <div className="wx-metric-tile" style={{ gridColumn: 'span 1' }}>
                                            <div className="wx-metric-label">Wind</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                {windDeg != null && windKts != null && (
                                                    <WindBarb deg={windDeg} kts={windKts} size={24} />
                                                )}
                                                <span className="wx-metric-value" style={{ fontSize: 11 }}>{wx.wind || '\u2014'}</span>
                                            </div>
                                        </div>
                                        {/* Visibility */}
                                        <div className="wx-metric-tile">
                                            <div className="wx-metric-label">Vis</div>
                                            <span className="wx-metric-value" style={{ fontSize: 11 }}>{wx.vis || '\u2014'}</span>
                                        </div>
                                        {/* Sky with icon */}
                                        <div className="wx-metric-tile">
                                            <div className="wx-metric-label">Sky</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <WeatherIcon sky={wx.sky} size={18} color="var(--text-secondary)" />
                                                <span className="wx-metric-value" style={{ fontSize: 10 }}>{wx.sky || '\u2014'}</span>
                                            </div>
                                        </div>
                                        {/* Temp */}
                                        <div className="wx-metric-tile">
                                            <div className="wx-metric-label">Temp</div>
                                            <span className="wx-metric-value" style={{ fontSize: 11 }}>{wx.temp || '\u2014'}</span>
                                        </div>
                                    </div>
                                )}
                                {!wx && (
                                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No weather data available</div>
                                )}
                            </div>

                            {/* Inter-leg distance strip */}
                            {!isLast && legDist && (
                                <div className="timeline-leg-strip" style={{ paddingLeft: 6, paddingRight: 8, marginBottom: 4 }}>
                                    <div className="timeline-leg-line" />
                                    <span className="timeline-leg-label">
                                        <MdIcon name="flight" style={{ fontSize: 10, marginRight: 3, display: 'inline-block', transform: 'rotate(45deg)' }} />
                                        {legDist} NM
                                    </span>
                                    <div className="timeline-leg-line" />
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default RouteTimeline;
