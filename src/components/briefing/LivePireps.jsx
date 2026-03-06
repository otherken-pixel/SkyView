import React, { useState, useEffect } from 'react';
import { MdIcon } from '../common';
import { fetchLivePireps } from '../../services/weather';
import { getAirport } from '../../utils';

function LivePireps({ dep, arr }) {
    const [pireps, setPireps] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        setLoading(true); setPireps(null);
        const depApt = getAirport(dep), arrApt = getAirport(arr);
        if (!depApt) { setLoading(false); return; }
        let lat = depApt.lat, lon = depApt.lon;
        if (arrApt) { lat = (depApt.lat + arrApt.lat) / 2; lon = (depApt.lon + arrApt.lon) / 2; }
        fetchLivePireps(lat, lon, 200).then(function(data) {
            setPireps(data); setLoading(false);
        }).catch(function() { setLoading(false); });
    }, [dep, arr]);

    if (loading) return (
        <div style={{ padding:'24px', textAlign:'center', color:'var(--text-secondary)' }}>
            <MdIcon name="sync" style={{ animation:'spin 1s linear infinite', fontSize:24 }} />
            <div style={{ marginTop:8, fontSize:13 }}>Fetching live PIREPs...</div>
        </div>
    );
    if (!pireps || pireps.length === 0) {
        return (
            <div style={{ padding:'16px', textAlign:'center', color:'var(--text-secondary)', fontSize:13 }}>
                <MdIcon name="check_circle" style={{ fontSize:20, color:'var(--go)', display:'block', margin:'0 auto 6px' }} />
                No PIREPs within 200 NM — AviationWeather.gov
            </div>
        );
    }
    return (
        <div>
            <div style={{ fontSize:12, color:'var(--go)', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                <MdIcon name="verified" style={{ fontSize:14 }} />
                Live PIREPs — AviationWeather.gov ({pireps.length} report{pireps.length !== 1 ? 's' : ''} within 200 NM)
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {pireps.slice(0, 8).map(function(p, i) {
                const raw = p.rawOb || p.rawPirep || '';
                const type = (p.reportType === 'PIREP' || !p.reportType) ? 'UA' : 'UUA';
                const fallback = [p.acId, p.altitudeFtMsl ? ('FL' + Math.round(p.altitudeFtMsl / 100)) : null, p.turbIntensity ? ('TB ' + p.turbIntensity) : null, p.icingIntensity ? ('IC ' + p.icingIntensity) : null].filter(Boolean).join(' ');
                return (
                    <div key={i} className="font-mono" style={{ background:'var(--card-high)', borderRadius:10, padding:12, borderLeft:'3px solid var(--accent)', fontSize:12, color:'var(--text-primary)', lineHeight:1.6 }}>
                        <span style={{ color:'var(--accent)', fontWeight:700, marginRight:8 }}>{type}</span>
                        {raw || fallback || 'No detail available'}
                    </div>
                );
            })}
            </div>
        </div>
    );
}

export default LivePireps;
