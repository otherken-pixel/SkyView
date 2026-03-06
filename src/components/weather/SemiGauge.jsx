import React from 'react';

function SemiGauge({ score, size }) {
    size = size || 180;
    const cx = size / 2, cy = size * 0.58, r = size * 0.40;
    const arcLen = Math.PI * r;
    const col = score >= 75 ? 'var(--go)' : score >= 50 ? 'var(--caution)' : 'var(--nogo)';
    const pathD = 'M ' + (cx - r).toFixed(1) + ' ' + cy.toFixed(1) + ' A ' + r.toFixed(1) + ' ' + r.toFixed(1) + ' 0 0 1 ' + (cx + r).toFixed(1) + ' ' + cy.toFixed(1);
    return (
        <div style={{ position:'relative', width:size, margin:'0 auto' }}>
            <svg width={size} height={Math.round(cy + 20)} viewBox={'0 0 ' + size + ' ' + Math.round(cy + 20)} style={{ display:'block' }}>
                <path d={pathD} fill="none" stroke="var(--md-sys-color-surface-container-highest)" strokeWidth="10" strokeLinecap="round" />
                <path d={pathD} fill="none" stroke={col} strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={arcLen.toFixed(1)} strokeDashoffset={(arcLen * (1 - score / 100)).toFixed(1)}
                    style={{ transition:'stroke-dashoffset 0.9s ease-out' }} />
                <text x={cx - r - 2} y={cy + 16} textAnchor="middle" fontSize="12" fill="var(--md-sys-color-on-surface-variant)" fontFamily="sans-serif">0</text>
                <text x={cx + r + 2} y={cy + 16} textAnchor="middle" fontSize="12" fill="var(--md-sys-color-on-surface-variant)" fontFamily="sans-serif">100</text>
                <text x={cx} y={cy - r * 0.1} textAnchor="middle" fontSize={Math.round(size * 0.18)} fontWeight="800" fill={col} fontFamily="monospace">{score}</text>
                <text x={cx} y={cy + 8} textAnchor="middle" fontSize="12" fill="var(--md-sys-color-on-surface-variant)" fontFamily="sans-serif" letterSpacing="1">SAFETY SCORE</text>
            </svg>
        </div>
    );
}

export default SemiGauge;
