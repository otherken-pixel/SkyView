import React, { useState } from 'react';
import { MdIcon, MdButton } from '../common';
import { getPersonalMinimums, savePersonalMinimums } from '../../utils/personalMinimums';

export default function PilotProfileModal({ onClose, onSave }) {
  const saved = getPersonalMinimums() || {};
  const [vals, setVals] = useState({
    ceilingDay: saved.ceilingDay || '',
    ceilingNight: saved.ceilingNight || '',
    visDay: saved.visDay || '',
    visNight: saved.visNight || '',
    maxWind: saved.maxWind || '',
    maxGustSpread: saved.maxGustSpread || '',
    maxCrosswind: saved.maxCrosswind || '',
  });
  const [saved2, setSaved2] = useState(false);

  function field(key) { return vals[key] === '' ? '' : String(vals[key]); }
  function setField(key, raw) {
    const n = raw === '' ? '' : parseInt(raw);
    setVals(v => ({ ...v, [key]: isNaN(n) ? '' : n }));
  }
  function handleSave() {
    const out = {};
    Object.keys(vals).forEach(k => { out[k] = vals[k] === '' ? null : Number(vals[k]); });
    savePersonalMinimums(out);
    setSaved2(true);
    setTimeout(() => setSaved2(false), 1800);
    if (onSave) onSave(out);
  }
  function handleClear() {
    savePersonalMinimums(null);
    setVals({ ceilingDay:'', ceilingNight:'', visDay:'', visNight:'', maxWind:'', maxGustSpread:'', maxCrosswind:'' });
    if (onSave) onSave(null);
  }

  const groups = [
    { label: 'Ceiling', icon: 'cloud', color: 'var(--mvfr)', fields: [
      { key: 'ceilingDay', label: 'Day Minimum', unit: 'ft', placeholder: '3000', hint: 'e.g. 3,000 ft AGL' },
      { key: 'ceilingNight', label: 'Night Minimum', unit: 'ft', placeholder: '5000', hint: 'e.g. 5,000 ft AGL' },
    ]},
    { label: 'Visibility', icon: 'visibility', color: 'var(--go)', fields: [
      { key: 'visDay', label: 'Day Minimum', unit: 'SM', placeholder: '5', hint: 'e.g. 5 SM' },
      { key: 'visNight', label: 'Night Minimum', unit: 'SM', placeholder: '7', hint: 'e.g. 7 SM' },
    ]},
    { label: 'Wind Limits', icon: 'air', color: 'var(--caution)', fields: [
      { key: 'maxWind', label: 'Max Total Wind', unit: 'kt', placeholder: '20', hint: 'Sustained wind limit' },
      { key: 'maxGustSpread', label: 'Max Gust Spread', unit: 'kt', placeholder: '10', hint: 'Gust minus steady wind' },
      { key: 'maxCrosswind', label: 'Max Crosswind', unit: 'kt', placeholder: '12', hint: 'Aircraft crosswind limit' },
    ]},
  ];

  return (
    <div className="ios-sheet-overlay" onClick={e => { if(e.target===e.currentTarget) onClose(); }}
      role="dialog" aria-modal="true" aria-label="Pilot Profile">
      <div className="ios-sheet" style={{ maxHeight: '92vh' }}>
        <div className="ios-sheet-grabber" />
        <div style={{ display:'flex', alignItems:'center', gap:14, padding:'16px 22px 16px', borderBottom:'1px solid var(--card-border-soft)' }}>
          <div style={{ width:40, height:40, borderRadius:12, background:'var(--accent-dim)', border:'1px solid rgba(10,132,255,0.3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <MdIcon name="person" style={{ color:'var(--accent)', fontSize:22 }} />
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800, fontSize:16, color:'var(--text-primary)', letterSpacing:'-0.01em' }}>Pilot Profile</div>
            <div style={{ fontSize:12, color:'var(--text-tertiary)', marginTop:2 }}>Personal minimums — used in flight safety scoring</div>
          </div>
          <button onClick={onClose} aria-label="Close pilot profile" style={{
            background:'var(--card-high)', border:'none', borderRadius:8,
            minWidth:44, minHeight:44, display:'flex', alignItems:'center', justifyContent:'center',
            cursor:'pointer', flexShrink:0
          }}>
            <MdIcon name="close" style={{ fontSize:18, color:'var(--text-secondary)' }} />
          </button>
        </div>
        <div style={{ overflowY: 'auto' }}>
          <div style={{ margin:'16px 22px 0', padding:'12px 14px', borderRadius:12, background:'var(--caution-bg)', border:'1px solid rgba(255,149,0,0.25)', display:'flex', gap:10 }}>
            <MdIcon name="admin_panel_settings" style={{ color:'var(--caution)', fontSize:18, flexShrink:0, marginTop:1 }} aria-hidden="true" />
            <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.55 }}>
              <strong style={{ color:'var(--caution)' }}>ADM Notice:</strong> Leaving personal minimums blank applies a <strong>−25 pt ADM penalty</strong> to your safety score.
            </div>
          </div>
          <div style={{ padding:'16px 22px' }}>
            {groups.map(g => (
              <div key={g.label} style={{ marginBottom:20 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, paddingBottom:8, borderBottom:'1px solid var(--card-border-soft)' }}>
                  <div style={{ width:26, height:26, borderRadius:7, background:g.color+'22', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <MdIcon name={g.icon} style={{ fontSize:14, color:g.color }} aria-hidden="true" />
                  </div>
                  <span style={{ fontWeight:600, fontSize:12, letterSpacing:'0.3px', color:g.color }}>{g.label}</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns: g.fields.length === 3 ? '1fr 1fr 1fr' : '1fr 1fr', gap:10 }}>
                  {g.fields.map(f => (
                    <div key={f.key}>
                      <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.3px', color:'var(--text-tertiary)', marginBottom:5 }}>{f.label}</div>
                      <div style={{ display:'flex', alignItems:'center', gap:0, background:'var(--card-mid)', border:'1px solid var(--card-border-soft)', borderRadius:10, overflow:'hidden' }}>
                        <input type="number" min="0" placeholder={f.placeholder} value={field(f.key)}
                          aria-label={g.label + ' ' + f.label}
                          onChange={e => setField(f.key, e.target.value)}
                          style={{ flex:1, background:'none', border:'none', outline:'none', padding:'12px 10px', fontSize:14, fontWeight:700, color:'var(--text-primary)', fontFamily:'var(--font-mono)', width:0, minHeight:44 }} />
                        <span style={{ padding:'0 10px 0 4px', fontSize:11, fontWeight:600, color:'var(--text-tertiary)', flexShrink:0 }}>{f.unit}</span>
                      </div>
                      <div style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:4 }}>{f.hint}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display:'flex', gap:10, padding:'0 22px 22px', borderTop:'1px solid var(--card-border-soft)', paddingTop:16 }}>
          <button onClick={handleClear} style={{ background:'var(--card-high)', border:'1px solid var(--card-border-soft)', borderRadius:10, padding:'10px 16px', fontSize:13, fontWeight:600, color:'var(--text-tertiary)', cursor:'pointer', flexShrink:0, minHeight:44 }}>Clear All</button>
          <button onClick={handleSave} style={{ flex:1, background: saved2 ? 'var(--go)' : 'var(--accent)', border:'none', borderRadius:10, padding:'10px 0', fontSize:14, fontWeight:700, color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, minHeight:44 }}>
            <MdIcon name={saved2 ? 'check_circle' : 'save'} style={{ fontSize:16, color:'#fff' }} />
            {saved2 ? 'Saved!' : 'Save Minimums'}
          </button>
        </div>
      </div>
    </div>
  );
}
