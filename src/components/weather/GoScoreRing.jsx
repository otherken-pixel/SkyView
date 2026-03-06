import React from 'react';
import { getGoColor } from '../../utils/aviation';

function GoScoreRing({ score, size }) {
    size = size || 100;
    const strokeW = size >= 80 ? 7 : 5;
    const r = (size - strokeW * 2) / 2;
    const circ = 2 * Math.PI * r;
    const col = getGoColor(score);
    // Glow color mapped from the CSS var to an rgba for filter
    const glowMap = {
        'var(--go)':      '52,199,89',
        'var(--caution)': '255,149,0',
        'var(--nogo)':    '255,59,48'
    };
    const glowRgb = glowMap[col] || '10,132,255';
    return (
        <div style={{ position: "relative", width: size, height: size, animation: 'scorePop 0.45s cubic-bezier(0.34,1.56,0.64,1) both' }}>
            <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
                {/* Track */}
                <circle cx={size/2} cy={size/2} r={r} fill="none"
                    stroke="var(--card-high)" strokeWidth={strokeW} />
                {/* Progress arc */}
                <circle cx={size/2} cy={size/2} r={r} fill="none"
                    stroke={col} strokeWidth={strokeW}
                    strokeDasharray={circ}
                    strokeDashoffset={circ * (1 - Math.min(score,100) / 100)}
                    strokeLinecap="round"
                    style={{
                        transition: 'stroke-dashoffset 0.9s ease-out',
                        filter: `drop-shadow(0 0 ${size * 0.07}px rgba(${glowRgb},0.55))`
                    }} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <div className="font-mono" style={{ fontSize: size * 0.28, fontWeight: 800, color: col, lineHeight: 1, letterSpacing: '-0.02em' }}>{score}</div>
                {size >= 70 && (
                    <div style={{ fontSize: size * 0.095, color: "var(--text-tertiary)", fontWeight: 600, letterSpacing: "0.08em", marginTop: 2, textTransform: 'uppercase' }}>Score</div>
                )}
            </div>
        </div>
    );
}

export default GoScoreRing;
