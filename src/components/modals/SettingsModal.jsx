import React, { useState } from 'react';
import { MdIcon, MdButton } from '../common';

export default function SettingsModal({ onClose }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,0.72)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background:'var(--card)', border:'1px solid var(--card-border)', borderRadius:20, padding:'24px 24px 20px', width:'min(460px, 94vw)', boxShadow:'0 24px 80px rgba(0,0,0,0.6)', display:'flex', flexDirection:'column', gap:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14, borderBottom:'1px solid var(--card-border-soft)', paddingBottom:16, marginBottom:4 }}>
          <div style={{ width:40, height:40, borderRadius:12, background:'var(--accent-dim)', border:'1px solid rgba(10,132,255,0.3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <MdIcon name="settings" style={{ color:'var(--accent)', fontSize:22 }} />
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800, fontSize:16, color:'var(--text-primary)', letterSpacing:'-0.01em' }}>Settings</div>
            <div style={{ fontSize:12, color:'var(--text-tertiary)' }}>App configuration &amp; data sources</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-secondary)', padding:6, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:8 }}>
            <MdIcon name="close" style={{ fontSize:20 }} />
          </button>
        </div>

        <div>
          <div style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', color:'var(--accent)', borderBottom:'1px solid var(--card-border-soft)', paddingBottom:8, marginBottom:10 }}>Airport Database (OurAirports)</div>
          <div style={{ fontSize:13, color:'var(--text-secondary)', lineHeight:1.6 }}>
            Powers airport autocomplete with ~12,000 airports worldwide. Loaded once from <strong>ourairports.com</strong> open data and cached locally for 30 days.
          </div>
        </div>

        <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.6, borderTop:'1px solid var(--card-border-soft)', paddingTop:14 }}>
          <strong>Weather:</strong> NOAA AviationWeather.gov (free, no key) ·
          <strong> Airports:</strong> OurAirports CC0 public domain ·
          <strong> Enrichment:</strong> OpenAIP (rate-limited, 1 h cache)
        </div>
      </div>
    </div>
  );
}
