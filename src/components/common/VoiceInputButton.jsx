import React, { useState } from 'react';
import MdIcon from './MdIcon';
import { AIRPORTS } from '../../data';

const PHONETIC = { ALPHA:'A',BRAVO:'B',CHARLIE:'C',DELTA:'D',ECHO:'E',FOXTROT:'F',GOLF:'G',HOTEL:'H',INDIA:'I',JULIET:'J',KILO:'K',LIMA:'L',MIKE:'M',NOVEMBER:'N',OSCAR:'O',PAPA:'P',QUEBEC:'Q',ROMEO:'R',SIERRA:'S',TANGO:'T',UNIFORM:'U',VICTOR:'V',WHISKEY:'W',XRAY:'X',YANKEE:'Y',ZULU:'Z' };

function VoiceInputButton({ onResult, style }) {
    const [listening, setListening] = useState(false);
    const canListen = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!canListen) return null;

    function start() {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        const rec = new SR();
        rec.lang = 'en-US'; rec.continuous = false; rec.interimResults = false;
        rec.onresult = function(e) {
            const t = e.results[0][0].transcript.trim().toUpperCase();
            const direct = t.replace(/\s+/g, '');
            if (/^[A-Z]{4}$/.test(direct)) { onResult(direct); setListening(false); return; }
            const words = t.split(/\s+/);
            const conv = words.map(function(w) { return PHONETIC[w] || (w.length === 1 ? w : null); }).filter(Boolean).join('');
            if (/^[A-Z]{4}$/.test(conv)) { onResult(conv); setListening(false); return; }
            const match = Object.entries(AIRPORTS).find(function([, a]) {
                return a.city.toUpperCase() === t || a.name.toUpperCase().includes(t);
            });
            if (match) onResult(match[0]);
            setListening(false);
        };
        rec.onerror = function() { setListening(false); };
        rec.onend = function() { setListening(false); };
        rec.start(); setListening(true);
    }

    return (
        <button onClick={start} title={listening ? 'Listening\u2026' : 'Voice input'} style={{ background:'none', border:'none', cursor:'pointer', padding:'4px', display:'inline-flex', alignItems:'center', ...(style || {}) }}>
            <MdIcon name={listening ? 'mic' : 'mic_none'} style={{ fontSize:20, color: listening ? 'var(--md-sys-color-error)' : 'var(--md-sys-color-outline)', transition:'color 0.2s' }} />
        </button>
    );
}

export default VoiceInputButton;
