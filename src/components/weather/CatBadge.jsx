import React from 'react';
import { MdIcon } from '../common';

function CatBadge({ cat, large }) {
    const lc = (cat || '').toLowerCase();
    /* WCAG AA: icon communicates flight category independent of color */
    const catIcon = { VFR: 'check_circle', MVFR: 'warning', IFR: 'cancel', LIFR: 'dangerous' }[cat] || 'help';
    return (
        <span className={'cat-badge cat-' + lc} aria-label={cat + ' conditions'}
            style={{ fontSize: large ? 13 : 11, padding: large ? '4px 14px' : '3px 10px' }}>
            <MdIcon name={catIcon} style={{ fontSize: large ? 14 : 11 }} aria-hidden="true" />
            {cat}
        </span>
    );
}

export default CatBadge;
