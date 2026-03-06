import React from 'react';
import { MdIcon } from '../common';
import { SemiGauge } from '../weather';
import { getGoColor } from '../../utils/aviation';

function ScoreBreakdown({ breakdown, total }) {
    return (
        <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 20, padding: '20px 22px', marginBottom: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.35)' }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MdIcon name="analytics" style={{ color: 'var(--accent)', fontSize: 16 }} />
                </div>
                <span style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--text-secondary)' }}>Safety Score Breakdown</span>
                <span className="font-mono" style={{ marginLeft: 'auto', fontSize: 22, fontWeight: 900, color: getGoColor(total) }}>{total}<span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 500 }}>/100</span></span>
            </div>

            {/* Semi-gauge stays centered */}
            <SemiGauge score={total} size={180} />

            {/* Factor rows */}
            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {breakdown.map(function(f) {
                    if (f.isPenalty) {
                        // Personal Minimums penalty item — show penalty badge + risk bar
                        const penaltyPct = f.penaltyAmount > 0 ? Math.min(100, Math.round((f.penaltyAmount / 50) * 100)) : 0;
                        const penaltyLabel = f.penaltyAmount === 0 ? 'Clear' : '\u2212' + f.penaltyAmount + ' pts';
                        return (
                            <div key={f.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                <div style={{ width: 30, height: 30, borderRadius: 8, background: f.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid ' + f.color + '44' }}>
                                    <MdIcon name={f.icon} style={{ fontSize: 15, color: f.color }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{f.label}</span>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: f.color, background: f.color + '22', border: '1px solid ' + f.color + '55', borderRadius: 6, padding: '2px 7px', letterSpacing: '0.3px' }}>
                                            {penaltyLabel}
                                        </span>
                                    </div>
                                    <div className="score-seg-track">
                                        <div className="score-seg-fill" style={{ width: penaltyPct + '%', background: f.color }} />
                                    </div>
                                    {f.detail && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3, lineHeight: 1.4 }}>{f.detail}</div>}
                                </div>
                            </div>
                        );
                    }
                    const pct = Math.round((f.score / f.max) * 100);
                    return (
                        <div key={f.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: f.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid ' + f.color + '44' }}>
                                <MdIcon name={f.icon} style={{ fontSize: 15, color: f.color }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{f.label}</span>
                                    <span className="font-mono" style={{ fontSize: 13, fontWeight: 800, color: f.color }}>
                                        {f.score}<span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-tertiary)' }}>/{f.max}</span>
                                    </span>
                                </div>
                                <div className="score-seg-track">
                                    <div className="score-seg-fill" style={{ width: pct + '%', background: f.color }} />
                                </div>
                                {f.detail && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3, lineHeight: 1.4 }}>{f.detail}</div>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default ScoreBreakdown;
