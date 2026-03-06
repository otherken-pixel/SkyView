import React from 'react';
import { MdIcon, MdButton } from '../common';

function HazardAdvisories({ sigmets, gairmets, cwas, loading, onAskAI }) {
    if (loading) return (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:'var(--card-mid)', border:'1px solid var(--card-border-soft)', borderRadius:12, marginBottom:12, fontSize:13, color:'var(--text-secondary)' }}>
            <MdIcon name="sync" style={{ fontSize:16, animation:'spin 1s linear infinite', flexShrink:0 }} />
            <span>Fetching SIGMETs, AIRMETs, CWAs...</span>
        </div>
    );
    const items = [];
    sigmets.forEach(function(f) {
        const p = f.properties || {};
        const hz = (p.hazard || '').toUpperCase();
        const icon = hz === 'CONVECTIVE' ? 'thunderstorm' : hz === 'TURB' ? 'air' : hz === 'ICE' ? 'ac_unit' : 'warning';
        const color = hz === 'CONVECTIVE' ? 'var(--nogo)' : hz === 'ICE' ? 'var(--mvfr)' : 'var(--caution)';
        const isConv = hz === 'CONVECTIVE';
        items.push({ icon, color, label: isConv ? 'CONVECTIVE SIGMET' : ('SIGMET \u00B7 ' + hz), text: p.rawAirSigmet || ('Hazard: ' + hz + (p.severity ? ' SEV:'+p.severity : '')), isConv });
    });
    gairmets.forEach(function(g) {
        const hz = (g.hazard || '').toUpperCase();
        const icon = hz.includes('TURB') ? 'air' : hz.includes('ICE') ? 'ac_unit' : hz.includes('IFR') || hz.includes('MTN') ? 'cloud' : hz.includes('LLWS') ? 'swap_vert' : 'warning';
        const color = hz.includes('TURB') ? 'var(--caution)' : hz.includes('ICE') ? 'var(--mvfr)' : 'var(--text-secondary)';
        const sev = g.severity ? (' \u00B7 ' + g.severity) : '';
        const alt = (g.base != null && g.top != null) ? (' \u00B7 ' + (g.base*100) + '-' + (g.top*100) + 'ft') : '';
        items.push({ icon, color, label: 'AIRMET ' + (g.tag||'') + ' \u00B7 ' + hz + sev, text: 'Valid: ' + (g.validTime||'') + alt });
    });
    cwas.forEach(function(c) {
        const hz = (c.hazard || '').toUpperCase();
        const icon = hz === 'TS' ? 'thunderstorm' : hz === 'TURB' ? 'air' : hz === 'ICE' ? 'ac_unit' : hz === 'IFR' ? 'cloud' : 'warning';
        const color = hz === 'TS' ? 'var(--nogo)' : 'var(--caution)';
        const top = c.top ? (' \u00B7 Top ' + c.top + 'ft') : '';
        items.push({ icon, color, label: 'CWA \u00B7 ' + (c.cwsuId||'') + ' \u00B7 ' + hz + (c.qualifier ? ' ' + c.qualifier : ''), text: (c.rawCWA || ('Hazard: ' + hz)) + top });
    });
    if (items.length === 0) return null;
    return (
        <div style={{ background:'var(--card-mid)', border:'1px solid var(--card-border-soft)', borderRadius:16, padding:16, marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                <MdIcon name="notifications_active" style={{ color:'var(--nogo)', fontSize:18 }} />
                <span style={{ fontWeight:700, fontSize:13, textTransform:'uppercase', letterSpacing:'0.5px', color:'var(--nogo)', flex:1 }}>
                    Active Hazard Advisories ({items.length})
                </span>
                {onAskAI && (
                    <MdButton variant="text" icon="psychology" style={{ padding:'2px 8px', marginRight:-8 }}
                        onClick={() => onAskAI('Explain the pilot impact and required precautions for these active hazard advisories:\n\n' + items.map(function(it) { return '[' + it.label + '] ' + it.text; }).join('\n'))}>
                        Ask AI
                    </MdButton>
                )}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {items.map(function(item, i) {
                    return (
                        <div key={i} style={{ background: item.isConv ? 'var(--nogo-bg)' : 'var(--card-high)', borderRadius:10, padding:'10px 12px', borderLeft:'3px solid '+item.color }}>
                            <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4 }}>
                                <MdIcon name={item.icon} style={{ fontSize:15, color:item.color, flexShrink:0 }} />
                                <span style={{ fontSize:12, fontWeight:700, color:item.color, textTransform:'uppercase', letterSpacing:'0.4px' }}>{item.label}</span>
                            </div>
                            <div className="font-mono" style={{ fontSize:12, color:'var(--text-primary)', lineHeight:1.5, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{item.text}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default HazardAdvisories;
