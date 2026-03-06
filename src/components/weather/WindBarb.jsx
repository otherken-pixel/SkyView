import React from 'react';

function WindBarb({ deg, kts, size }) {
    size = size || 36;
    if (deg == null || kts == null || isNaN(deg) || isNaN(kts)) return null;
    const cx = size / 2, cy = size / 2;
    const shaftLen = size * 0.40;
    const color = kts >= 25 ? 'var(--nogo)' : kts >= 15 ? 'var(--caution)' : 'var(--text-secondary)';

    // Build barb marks along shaft
    const barbs = [];
    let remaining = kts;
    const barbSpacing = size * 0.08;
    const barbLen = size * 0.22;
    let barbX = -shaftLen + barbSpacing; // relative to center
    while (remaining >= 50) {
        // Pennant (filled triangle)
        barbs.push(
            <polygon key={'p'+barbs.length}
                points={`${cx+barbX},${cy} ${cx+barbX+barbSpacing},${cy-barbLen} ${cx+barbX+barbSpacing*2},${cy}`}
                fill={color} />
        );
        barbX += barbSpacing * 2.5;
        remaining -= 50;
    }
    while (remaining >= 10) {
        barbs.push(<line key={'f'+barbs.length} x1={cx+barbX} y1={cy} x2={cx+barbX+barbLen} y2={cy-barbLen*0.65} stroke={color} strokeWidth="1.8" strokeLinecap="round" />);
        barbX += barbSpacing;
        remaining -= 10;
    }
    if (remaining >= 5) {
        barbs.push(<line key="h" x1={cx+barbX} y1={cy} x2={cx+barbX+barbLen*0.5} y2={cy-barbLen*0.32} stroke={color} strokeWidth="1.8" strokeLinecap="round" />);
    }

    return (
        <div className="wind-barb-wrapper" title={`${kts}kt from ${deg}\u00B0`}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
                style={{ transform: `rotate(${deg}deg)`, display:'block' }}
                className="wx-icon-svg">
                {/* Shaft */}
                <line x1={cx - shaftLen} y1={cy} x2={cx + shaftLen * 0.15} y2={cy}
                    stroke={color} strokeWidth="1.8" strokeLinecap="round" />
                {/* Arrowhead */}
                <polygon points={`${cx+shaftLen*0.15},${cy-4} ${cx+shaftLen*0.40},${cy} ${cx+shaftLen*0.15},${cy+4}`}
                    fill={color} />
                {kts < 3
                    ? <circle cx={cx} cy={cy} r="4" fill="none" stroke={color} strokeWidth="1.8" />
                    : barbs}
            </svg>
        </div>
    );
}

export default WindBarb;
