import React from 'react';

function WeatherIcon({ sky, wx, size, color }) {
    size = size || 32;
    color = color || 'var(--text-secondary)';
    const skyU = (sky || '').toUpperCase();
    const wxU  = (wx  || '').toUpperCase();

    const hasTS  = wxU.includes('TS');
    const hasRA  = wxU.includes('RA') || wxU.includes('DZ') || wxU.includes('SH');
    const hasSN  = wxU.includes('SN') || wxU.includes('SG') || wxU.includes('GS');
    const hasFG  = wxU.includes('FG') || wxU.includes('BR') || wxU.includes('HZ') || wxU.includes('FU');
    const hasOVC = skyU.includes('OVC') || skyU.includes('VV');
    const hasBKN = !hasOVC && skyU.includes('BKN');
    const hasSCT = !hasOVC && !hasBKN && skyU.includes('SCT');
    const hasFEW = !hasOVC && !hasBKN && !hasSCT && skyU.includes('FEW');

    if (hasTS) {
        return (
            <svg width={size} height={size} viewBox="0 0 32 32" className="wx-icon-svg">
                <ellipse cx="14" cy="11" rx="9" ry="7" fill={color} opacity="0.85" />
                <ellipse cx="21" cy="15" rx="7" ry="5.5" fill={color} opacity="0.65" />
                <polygon points="16,18 11,27 15,22 10,31 21,21 16,26" fill="#FFD700" opacity="0.95" />
            </svg>
        );
    }
    if (hasFG) {
        return (
            <svg width={size} height={size} viewBox="0 0 32 32" className="wx-icon-svg">
                <rect x="2"  y="10" width="28" height="3" rx="1.5" fill={color} opacity="0.75" />
                <rect x="6"  y="16" width="20" height="3" rx="1.5" fill={color} opacity="0.55" />
                <rect x="4"  y="22" width="24" height="3" rx="1.5" fill={color} opacity="0.40" />
            </svg>
        );
    }
    if (hasSN) {
        return (
            <svg width={size} height={size} viewBox="0 0 32 32" className="wx-icon-svg">
                <ellipse cx="14" cy="12" rx="8" ry="6" fill={color} opacity="0.80" />
                <ellipse cx="21" cy="15" rx="6" ry="5" fill={color} opacity="0.65" />
                {[9,16,23].map(function(x,i) {
                    return <text key={i} x={x} y="29" fontSize="9" fill="#aaccff" textAnchor="middle" fontFamily="sans-serif">{'\u2744'}</text>;
                })}
            </svg>
        );
    }
    if (hasRA) {
        return (
            <svg width={size} height={size} viewBox="0 0 32 32" className="wx-icon-svg">
                <ellipse cx="14" cy="12" rx="8" ry="6" fill={color} opacity="0.80" />
                <ellipse cx="22" cy="15" rx="6.5" ry="5" fill={color} opacity="0.65" />
                <line x1="10" y1="22" x2="8"  y2="29" stroke="#4fc3f7" strokeWidth="2" strokeLinecap="round" />
                <line x1="16" y1="22" x2="14" y2="29" stroke="#4fc3f7" strokeWidth="2" strokeLinecap="round" />
                <line x1="22" y1="22" x2="20" y2="29" stroke="#4fc3f7" strokeWidth="2" strokeLinecap="round" />
            </svg>
        );
    }
    if (hasOVC) {
        return (
            <svg width={size} height={size} viewBox="0 0 32 32" className="wx-icon-svg">
                <ellipse cx="12" cy="14" rx="9"   ry="7.5" fill={color} opacity="0.90" />
                <ellipse cx="22" cy="17" rx="8.5" ry="6.5" fill={color} opacity="0.80" />
                <rect    x="4"  y="19"  width="24" height="6" rx="3" fill={color} opacity="0.75" />
            </svg>
        );
    }
    if (hasBKN) {
        return (
            <svg width={size} height={size} viewBox="0 0 32 32" className="wx-icon-svg">
                <circle  cx="9"  cy="12" r="5.5" fill="#FFD700" opacity="0.75" />
                <ellipse cx="19" cy="16" rx="9"   ry="7"   fill={color} opacity="0.85" />
                <ellipse cx="26" cy="19" rx="6"   ry="4.5" fill={color} opacity="0.70" />
            </svg>
        );
    }
    if (hasSCT) {
        return (
            <svg width={size} height={size} viewBox="0 0 32 32" className="wx-icon-svg">
                <circle  cx="9"  cy="11" r="6"   fill="#FFD700" opacity="0.90" />
                <ellipse cx="20" cy="18" rx="8.5" ry="6"   fill={color} opacity="0.75" />
                <ellipse cx="26" cy="20" rx="5.5" ry="4"   fill={color} opacity="0.60" />
            </svg>
        );
    }
    if (hasFEW) {
        return (
            <svg width={size} height={size} viewBox="0 0 32 32" className="wx-icon-svg">
                <circle  cx="10" cy="11" r="7"   fill="#FFD700" opacity="0.95" />
                <ellipse cx="21" cy="19" rx="8"   ry="5.5" fill={color} opacity="0.60" />
            </svg>
        );
    }
    // Clear / SKC / CLR
    return (
        <svg width={size} height={size} viewBox="0 0 32 32" className="wx-icon-svg">
            <circle cx="16" cy="16" r="8" fill="#FFD700" opacity="0.95" />
            {[0,45,90,135,180,225,270,315].map(function(a, i) {
                const rad = (a * Math.PI) / 180;
                const x1 = (16 + 11 * Math.cos(rad)).toFixed(1);
                const y1 = (16 + 11 * Math.sin(rad)).toFixed(1);
                const x2 = (16 + 14 * Math.cos(rad)).toFixed(1);
                const y2 = (16 + 14 * Math.sin(rad)).toFixed(1);
                return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#FFD700" strokeWidth="2" strokeLinecap="round" />;
            })}
        </svg>
    );
}

export default WeatherIcon;
