import React from 'react';
import { MdIcon } from '../common';
import { calculateDensityAltitude } from '../../utils/aviation';

function DensityAltBadge({ tempC, altimeterInHg, elevationFt }) {
    if (tempC == null) return null;
    const da = calculateDensityAltitude(tempC, altimeterInHg, elevationFt);
    const diff = da - (elevationFt || 0);
    const warn = diff >= 2000;
    return (
        <span className="font-mono" style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: '10px',
            fontSize: '11px', fontWeight: '600',
            background: warn ? 'rgba(255,204,0,0.15)' : 'var(--card-high)',
            color: warn ? '#FFCC00' : 'var(--text-secondary)',
            border: warn ? '1px solid rgba(255,204,0,0.30)' : '1px solid transparent'
        }} title={'Density Altitude: ' + da.toLocaleString() + ' ft (' + (diff >= 0 ? '+' : '') + diff + ' ft vs field)'}>
            <MdIcon name={warn ? 'warning' : 'thermostat'} style={{ fontSize: 12 }} aria-hidden="true" />
            DA {da.toLocaleString()}ft
        </span>
    );
}

export default DensityAltBadge;
