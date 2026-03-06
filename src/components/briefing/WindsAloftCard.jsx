import React from 'react';
import { MdIcon } from '../common';
import { getAirport } from '../../utils/airports';
import { closestWindStation, getWindAtAlt } from '../../services/weather';

function WindsAloftCard({ allRoutePts, stations, cruiseAlt }) {
    if (!stations || stations.length === 0) return null;
    const alt = cruiseAlt || 6000;
    const rows = allRoutePts.map(function(icao) {
        const apt = getAirport(icao);
        if (!apt) return null;
        const stn = closestWindStation(stations, apt.lat, apt.lon);
        const w = stn ? getWindAtAlt(stn, alt) : null;
        return { icao, apt, w, stnId: stn ? (stn.icaoId || stn.stn || '') : '' };
    }).filter(Boolean);
    if (rows.every(function(r) { return !r.w; })) return null;
    return (
        <div style={{ background:'var(--md-sys-color-surface-container)', borderRadius:16, padding:16, marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                <MdIcon name="air" style={{ color:'var(--md-sys-color-secondary)', fontSize:18 }} />
                <span style={{ fontWeight:700, fontSize:13, textTransform:'uppercase', letterSpacing:'0.5px', color:'var(--text-secondary)' }}>Winds Aloft</span>
                <span style={{ fontSize:12, fontWeight:700, background:'var(--card-high)', color:'var(--text-primary)', borderRadius:6, padding:'2px 8px', letterSpacing:'0.5px' }}>
                    {(alt/1000).toFixed(0)}K FT · FD WINDS
                </span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {rows.map(function(r) {
                    return (
                        <div key={r.icao} style={{ display:'grid', gridTemplateColumns:'50px 1fr', gap:'6px 12px', alignItems:'center', padding:'6px 0', borderBottom:'1px solid var(--card-border-soft)' }}>
                            <span className="font-mono" style={{ fontWeight:700, fontSize:13 }}>{r.icao}</span>
                            {r.w ? (
                                <div className="font-mono" style={{ fontSize:12, color:'var(--text-primary)' }}>
                                    {r.w.lv ? 'LGT & VRB' : (r.w.wdir + '\u00B0 @ ' + r.w.wspd + 'kt')}
                                    {r.w.temp != null && <span style={{ marginLeft:10, color:'var(--text-secondary)' }}>{r.w.temp > 0 ? '+' : ''}{r.w.temp}&deg;C</span>}
                                    <span style={{ marginLeft:8, fontSize:12, color:'var(--text-tertiary)' }}>(via {r.stnId})</span>
                                </div>
                            ) : (
                                <span style={{ fontSize:12, color:'var(--text-secondary)' }}>No FD data</span>
                            )}
                        </div>
                    );
                })}
            </div>
            <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:8, lineHeight:1.5 }}>
                Nearest FD reporting station used per waypoint. Source: AviationWeather.gov /api/data/windtemp.
            </div>
        </div>
    );
}

export default WindsAloftCard;
