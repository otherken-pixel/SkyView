import React, { useState, useEffect } from 'react';
import { MdIcon, MdCard } from '../common';
import { getAirport, fetchAirportInfo } from '../../utils/airports';
import { AIRPORTS } from '../../data/airports';

export default function FreqPanel({ icao }) {
  const [aptReady, setAptReady] = useState(!!AIRPORTS[icao]);
  useEffect(() => {
    if (!AIRPORTS[icao]) {
      fetchAirportInfo(icao).then(a => { if (a) setAptReady(true); });
    }
  }, [icao]);
  const apt = getAirport(icao);
  if (!apt) return null;
  const labels = { atis: "ATIS", twr: "Tower", gnd: "Ground", app: "Approach", dep: "Departure", clnc: "Clearance" };

  return (
    <MdCard style={{ marginBottom: '16px' }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MdIcon name="cell_tower" style={{ color: 'var(--md-sys-color-primary)' }} />
          <span className="font-mono" style={{ fontSize: 18, fontWeight: 700 }}>{icao}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--md-sys-color-on-surface)" }}>{apt.facility || apt.artcc}</div>
          {apt.facility && <div style={{ fontSize: 12, color: "var(--md-sys-color-on-surface-variant)", marginTop: 1 }}>En Route: {apt.artcc}</div>}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
        {apt.freq && Object.entries(apt.freq).map(([key, val]) => (
          <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: 'center', borderBottom: '1px solid var(--md-sys-color-outline-variant)', paddingBottom: 4 }}>
            <span style={{ color: "var(--md-sys-color-on-surface-variant)", fontSize: 13 }}>{labels[key] || key}</span>
            <span className="font-mono" style={{ color: "var(--md-sys-color-primary)", fontWeight: 600, fontSize: 15 }}>{val}</span>
          </div>
        ))}
      </div>
    </MdCard>
  );
}
