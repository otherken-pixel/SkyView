import React, { useState } from 'react';
import { MdIcon } from '../common';

const _SCRATCH_LS_KEY = 'flightscore_scratchpad';

function Scratchpad() {
    const [open, setOpen] = useState(false);
    const [text, setText] = useState(function() {
        try { return localStorage.getItem(_SCRATCH_LS_KEY) || ''; } catch(e) { return ''; }
    });

    function handleChange(e) {
        const v = e.target.value;
        setText(v);
        try { localStorage.setItem(_SCRATCH_LS_KEY, v); } catch(e) {}
    }

    function handleClear() {
        setText('');
        try { localStorage.removeItem(_SCRATCH_LS_KEY); } catch(e) {}
    }

    if (!open) {
        return (
            <button className="scratchpad-fab" onClick={function() { setOpen(true); }} title="Open Scratchpad">
                <MdIcon name="edit_note" style={{ fontSize: 24 }} />
            </button>
        );
    }

    return (
        <div className="scratchpad-panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 6px', borderBottom: '1px solid var(--card-border-soft)' }}>
                <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.3px', color: 'var(--text-secondary)' }}>
                    <MdIcon name="edit_note" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }} />
                    Scratchpad
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={handleClear} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 12, fontWeight: 600, padding: '4px 8px', borderRadius: 6 }} title="Clear notes">Clear</button>
                    <button onClick={function() { setOpen(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '4px', borderRadius: 6, display: 'flex', alignItems: 'center' }} title="Minimize">
                        <MdIcon name="close" style={{ fontSize: 18 }} />
                    </button>
                </div>
            </div>
            <textarea value={text} onChange={handleChange} placeholder={"ATIS Info: ___\nRunway: ___\nAltimeter: ___\nClearance: ___\nSquawk: ___\nFreq: ___"} autoFocus />
        </div>
    );
}

export default Scratchpad;
