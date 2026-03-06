import React, { useState, useEffect } from 'react';
import MdInput from './MdInput';
import MdIcon from './MdIcon';
import VoiceInputButton from './VoiceInputButton';
import { searchOurAirports, enrichAirportFromOpenAIP } from '../../utils/airports';
import { AIRPORTS, isOurAirportsLoading } from '../../data';

function AirportInput({ label, value, onChange, placeholder, containerStyle }) {
    const [open, setOpen] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [isLoadingOA, setIsLoadingOA] = useState(isOurAirportsLoading());

    // Re-compute suggestions whenever the typed value changes
    useEffect(() => {
        const q = (value || '').trim().toUpperCase();
        if (q.length < 2) { setSuggestions([]); return; }

        // 1. Hardcoded AIRPORTS — always instant
        const staticHits = Object.entries(AIRPORTS)
            .filter(function([k, a]) {
                return k.startsWith(q) ||
                       (a.city  && a.city.toUpperCase().startsWith(q)) ||
                       (a.name  && a.name.toUpperCase().includes(q));
            })
            .slice(0, 5)
            .map(function([k, a]) {
                return { icao: k, name: a.name, city: a.city, state: a.state, src: 'built-in' };
            });

        // 2. OurAirports — synchronous once loaded
        const oaHits = searchOurAirports(q, 8 - staticHits.length);

        const seen = new Set(staticHits.map(function(s) { return s.icao; }));
        const merged = staticHits.slice();
        oaHits.forEach(function(m) {
            if (!seen.has(m.icao)) {
                merged.push({ icao: m.icao, name: m.name, city: m.city,
                              state: m.state, country: m.country, src: 'OurAirports' });
                seen.add(m.icao);
            }
        });

        setSuggestions(merged.slice(0, 8));
        setIsLoadingOA(isOurAirportsLoading());
    }, [value]);

    function pick(icao, row) {
        // Seed AIRPORTS so getAirport()/calcDist() work without an extra fetch
        if (row && row.src === 'OurAirports' && !AIRPORTS[icao]) {
            AIRPORTS[icao] = {
                name: row.name, city: row.city || icao,
                state: row.state || row.country || 'US',
                lat: row.lat || 0, lon: row.lon || 0, elev: row.elev || 0,
                rwy: [], artcc: 'Center', facility: null,
                freq: { atis: '', twr: '', gnd: '', app: '', dep: '', clnc: '' }
            };
            // Background-enrich with OpenAIP (frequencies etc) — fire & forget
            enrichAirportFromOpenAIP(icao);
        }
        onChange(icao);
        setSuggestions([]);
        setOpen(false);
    }

    const showDrop = open && (suggestions.length > 0 || isLoadingOA);
    return (
        <div style={{ position:'relative', flex:1, ...(containerStyle || {}) }}>
            <div style={{ display:'flex', alignItems:'center', gap:0 }}>
                <MdInput
                    label={label} value={value} placeholder={placeholder} maxLength={4}
                    containerStyle={{ flex:1 }}
                    onChange={function(e) { onChange(e.target.value.trim().toUpperCase()); setOpen(true); }}
                    onFocus={function() { setOpen(true); }}
                    onBlur={function() { setTimeout(function() { setOpen(false); }, 160); }}
                />
                <VoiceInputButton onResult={function(v) { onChange(v); setSuggestions([]); }} style={{ marginLeft:4 }} />
            </div>
            {showDrop && (
                <div className="apt-suggest-drop">
                    {suggestions.map(function(s) {
                        return (
                            <div key={s.icao} className="apt-suggest-item" onMouseDown={function() { pick(s.icao, s); }}>
                                <span className="font-mono" style={{ fontWeight:700, fontSize:14, color:'var(--md-sys-color-primary)', minWidth:46 }}>{s.icao}</span>
                                <div style={{ flex:1, minWidth:0 }}>
                                    <div style={{ fontSize:12, color:'var(--md-sys-color-on-surface)', lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</div>
                                    <div style={{ fontSize:12, color:'var(--md-sys-color-on-surface-variant)' }}>
                                        {[s.city, s.state, s.country && s.country !== 'US' ? s.country : null].filter(Boolean).join(', ')}
                                    </div>
                                </div>
                                {s.src === 'OurAirports' && (
                                    <span style={{ fontSize:12, color:'var(--md-sys-color-on-surface-variant)', background:'var(--md-sys-color-surface-container-high)', borderRadius:3, padding:'1px 4px', flexShrink:0, alignSelf:'center' }}>OA</span>
                                )}
                            </div>
                        );
                    })}
                    {isLoadingOA && suggestions.length < 3 && (
                        <div style={{ padding:'8px 14px', fontSize:12, color:'var(--md-sys-color-on-surface-variant)', display:'flex', alignItems:'center', gap:6 }}>
                            <MdIcon name="sync" style={{ fontSize:14, animation:'spin 1s linear infinite' }} />
                            Loading airport database...
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default AirportInput;
