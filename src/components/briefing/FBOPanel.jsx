import React from 'react';
import { MdIcon, MdCard } from '../common';
import { getAirport } from '../../utils/airports';
import { FBO_DATA } from '../../data/airports';

export default function FBOPanel({ icao, label }) {
  const apt = getAirport(icao);
  const fbos = FBO_DATA[icao] || [];
  const aopaUrl = "https://www.aopa.org/destinations/airports/" + icao + "/details";

  function fuelColor(type) {
    if (type.startsWith("100LL")) return { bg: "var(--cat-mvfr-bg)", color: "var(--cat-mvfr-color)" };
    if (type.startsWith("Jet-A"))  return { bg: "var(--cat-ifr-bg)", color: "var(--cat-ifr-color)" };
    if (type.startsWith("MOGAS"))   return { bg: "var(--cat-vfr-bg)", color: "var(--cat-vfr-color)" };
    return { bg: "var(--md-sys-color-surface-container)", color: "var(--md-sys-color-on-surface)" };
  }

  return (
    <MdCard style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--md-sys-color-primary)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>{label}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="font-mono" style={{ fontSize: 20, fontWeight: 700 }}>{icao}</span>
            {apt && <span style={{ fontSize: 14, color: "var(--md-sys-color-on-surface-variant)" }}>{apt.city}, {apt.state}</span>}
          </div>
        </div>
        <a href={aopaUrl} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "var(--md-sys-color-primary)", textDecoration: "none", background: "var(--md-sys-color-primary-container)", borderRadius: 8, padding: "6px 10px" }}>
          <MdIcon name="open_in_new" style={{ fontSize: 14 }} />
          AOPA
        </a>
      </div>
      {fbos.length === 0 && (
        <div style={{ color: "var(--md-sys-color-on-surface-variant)", fontSize: 13, padding: "8px 0" }}>
          No FBO data on file for {icao}. View current operators and fuel prices on AOPA.
        </div>
      )}
      {fbos.map((fbo, i) => (
        <div key={i} style={{ borderTop: i > 0 ? "1px solid var(--md-sys-color-outline-variant)" : "none", paddingTop: i > 0 ? 16 : 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <MdIcon name="local_gas_station" style={{ fontSize: 18, color: "var(--md-sys-color-secondary)" }} />
                <span style={{ fontSize: 17, fontWeight: 700, color: "var(--md-sys-color-on-surface)" }}>{fbo.name}</span>
              </div>
              <a href={"tel:" + fbo.phone.replace(/\D/g, "")} style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none", color: "var(--md-sys-color-primary)", fontSize: 15, fontWeight: 600, marginLeft: 26 }}>
                <MdIcon name="call" style={{ fontSize: 16 }} />
                {fbo.phone}
              </a>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--md-sys-color-on-surface-variant)", fontSize: 13, marginLeft: 26 }}>
              <MdIcon name="schedule" style={{ fontSize: 15 }} />
              <span>{fbo.hours}</span>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--md-sys-color-on-surface-variant)", marginBottom: 8 }}>Fuel Available</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {fbo.fuel.map((f, fi) => {
                const c = fuelColor(f.type);
                return (
                  <div key={fi} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="font-mono" style={{ fontWeight: 700, fontSize: 13, background: c.bg, color: c.color, borderRadius: 6, padding: "3px 8px", minWidth: 52, textAlign: "center" }}>{f.type}</span>
                    <span style={{ fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>{f.service}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <a href={aopaUrl} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", background: "var(--md-sys-color-surface-container-high)", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
            <MdIcon name="price_check" style={{ fontSize: 20, color: "var(--md-sys-color-primary)", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--md-sys-color-on-surface)" }}>View Live Fuel Prices</div>
              <div style={{ fontSize: 12, color: "var(--md-sys-color-on-surface-variant)" }}>Current 100LL &amp; Jet-A prices at {icao} on AOPA</div>
            </div>
            <MdIcon name="chevron_right" style={{ fontSize: 18, color: "var(--md-sys-color-on-surface-variant)" }} />
          </a>
          {fbo.services.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--md-sys-color-on-surface-variant)", marginBottom: 8 }}>Services</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {fbo.services.map((s, si) => (
                  <span key={si} style={{ fontSize: 12, background: "var(--md-sys-color-surface-container)", color: "var(--md-sys-color-on-surface-variant)", borderRadius: 6, padding: "3px 8px" }}>{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--md-sys-color-outline-variant)", fontSize: 12, color: "var(--md-sys-color-on-surface-variant)", lineHeight: 1.5 }}>
        Verify phone &amp; hours before flight. Fuel prices change daily — always confirm with the FBO.
      </div>
    </MdCard>
  );
}
