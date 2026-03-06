import React, { useState, useEffect } from 'react';
import { MdIcon, MdButton, MdCard } from '../common';
import { CatBadge, DensityAltBadge } from '../weather';
import { fetchLiveMetar, fetchLiveTaf } from '../../services/weather';
import { getAirport, fetchAirportInfo } from '../../utils/airports';
import { makeMetar, makeTaf } from '../../utils/aviation';
import { decodeMetarSky, decodeMetarWind, decodeMetarVis, decodeMetarTemp, decodeMetarAlt, getRunwayRecommendation } from '../../utils/weather';
import { AIRPORTS } from '../../data/airports';

export default function WeatherDetail({ icao, label, isDecodedWx, onAskAI }) {
  const [expanded, setExpanded] = useState(false);
  const [aptReady, setAptReady] = useState(!!AIRPORTS[icao]);
  const [liveMetar, setLiveMetar] = useState(null);
  const [liveTaf, setLiveTaf] = useState(null);
  const [loadingWx, setLoadingWx] = useState(true);

  useEffect(() => {
    if (!AIRPORTS[icao]) {
      fetchAirportInfo(icao).then(a => { if (a) setAptReady(true); });
    }
  }, [icao]);

  useEffect(() => {
    setLoadingWx(true);
    setLiveMetar(null);
    setLiveTaf(null);
    Promise.all([fetchLiveMetar(icao), fetchLiveTaf(icao)]).then(([m, t]) => {
      setLiveMetar(m);
      setLiveTaf(t);
      setLoadingWx(false);
    });
  }, [icao]);

  const metar = liveMetar || (aptReady ? makeMetar(icao) : null);
  const taf = (liveTaf && liveTaf.rawTAF) ? liveTaf.rawTAF : makeTaf(icao);
  const apt = getAirport(icao);
  if (!apt && !loadingWx) return null;
  if (!metar && !loadingWx) return null;

  return (
    <MdCard style={{ marginBottom: '16px' }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--md-sys-color-primary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</span>
            <span style={{ fontSize: 12, color: "var(--md-sys-color-on-surface-variant)", background: "var(--md-sys-color-surface-container-high)", borderRadius: 4, padding: "1px 6px" }}>
              {liveMetar ? "Current observations · Live ASOS/AWOS" : "Current observations · Simulated"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="font-mono" style={{ fontSize: 20, fontWeight: 700 }}>{icao}</span>
            {apt && <span style={{ fontSize: 14, color: "var(--md-sys-color-on-surface-variant)" }}>{apt.city}, {apt.state}</span>}
            {liveMetar && <span style={{ fontSize: 12, color: "var(--md-sys-color-primary)", background: "var(--md-sys-color-primary-container)", borderRadius: 4, padding: "2px 6px", fontWeight: 700, letterSpacing: "0.5px" }}>LIVE NOW</span>}
            {!liveMetar && !loadingWx && <span style={{ fontSize: 12, color: "var(--md-sys-color-on-surface-variant)", background: "var(--md-sys-color-surface-container-high)", borderRadius: 4, padding: "2px 6px", fontWeight: 700, letterSpacing: "0.5px" }}>SIM</span>}
            {loadingWx && <MdIcon name="sync" style={{ fontSize: 14, color: "var(--md-sys-color-on-surface-variant)", animation: "spin 1s linear infinite" }} />}
          </div>
        </div>
        {metar && <CatBadge cat={metar.cat} />}
      </div>

      {loadingWx && !metar && (
        <div style={{ color: "var(--md-sys-color-on-surface-variant)", fontSize: 13, padding: "8px 0" }}>Fetching live weather data...</div>
      )}

      {metar && (
        <>
          {!isDecodedWx && (
            <div className="font-mono" style={{ background: "var(--md-sys-color-surface-container-lowest)", borderRadius: "8px", padding: "12px", fontSize: 13, color: "var(--md-sys-color-on-surface)", lineHeight: 1.6, wordBreak: "break-all", marginBottom: 16, border: "1px solid var(--md-sys-color-outline-variant)" }}>{metar.raw}</div>
          )}

          {isDecodedWx ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px", fontSize: 13, marginBottom: 4 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ color: "var(--md-sys-color-on-surface-variant)", fontSize: 11, fontWeight: 700, display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Sky Conditions</span>
                <span style={{ fontWeight: 600 }}>{decodeMetarSky(metar.sky)}</span>
              </div>
              <div>
                <span style={{ color: "var(--md-sys-color-on-surface-variant)", fontSize: 11, fontWeight: 700, display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Wind</span>
                <span style={{ fontWeight: 600 }}>{decodeMetarWind(metar)}</span>
              </div>
              <div>
                <span style={{ color: "var(--md-sys-color-on-surface-variant)", fontSize: 11, fontWeight: 700, display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Visibility</span>
                <span style={{ fontWeight: 600 }}>{decodeMetarVis(metar.vis)}</span>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ color: "var(--md-sys-color-on-surface-variant)", fontSize: 11, fontWeight: 700, display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Temperature / Dewpoint</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600 }}>{decodeMetarTemp(metar.temp)}</span>
                  {(() => {
                    const tParts = metar.temp ? metar.temp.split('/') : [];
                    const tC = tParts[0] ? (tParts[0].startsWith('M') ? -parseInt(tParts[0].slice(1)) : parseInt(tParts[0])) : null;
                    const aM = metar.alt ? metar.alt.match(/^A(\d{4})$/) : null;
                    const aInHg = aM ? parseInt(aM[1]) / 100 : 29.92;
                    const elev = apt ? (apt.elev || apt.elevation || 0) : 0;
                    return tC != null ? <DensityAltBadge tempC={tC} altimeterInHg={aInHg} elevationFt={elev} /> : null;
                  })()}
                </div>
              </div>
              <div>
                <span style={{ color: "var(--md-sys-color-on-surface-variant)", fontSize: 11, fontWeight: 700, display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Altimeter</span>
                <span style={{ fontWeight: 600 }}>{decodeMetarAlt(metar.alt)}</span>
              </div>
            </div>
          ) : (
            <div className="font-mono" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: "12px 16px", fontSize: 13 }}>
              <div><span style={{ color: "var(--md-sys-color-on-surface-variant)", fontSize: 12, fontWeight: 700, display: 'block' }}>WIND</span><span style={{ fontWeight: 600 }}>{metar.wind}</span></div>
              <div><span style={{ color: "var(--md-sys-color-on-surface-variant)", fontSize: 12, fontWeight: 700, display: 'block' }}>VIS</span><span style={{ fontWeight: 600 }}>{metar.vis}</span></div>
              <div><span style={{ color: "var(--md-sys-color-on-surface-variant)", fontSize: 12, fontWeight: 700, display: 'block' }}>SKY</span><span style={{ fontWeight: 600 }}>{metar.sky}</span></div>
              <div><span style={{ color: "var(--md-sys-color-on-surface-variant)", fontSize: 12, fontWeight: 700, display: 'block' }}>TEMP</span><span style={{ fontWeight: 600 }}>{metar.temp}</span></div>
              <div><span style={{ color: "var(--md-sys-color-on-surface-variant)", fontSize: 12, fontWeight: 700, display: 'block' }}>ALTM</span><span style={{ fontWeight: 600 }}>{metar.alt}</span></div>
            </div>
          )}

          {(() => {
            const rec = getRunwayRecommendation(metar, apt);
            if (!rec) return null;
            const crossColor = rec.crosswind <= 10 ? "var(--md-sys-color-primary)" : rec.crosswind <= 15 ? "var(--cat-mvfr-color)" : "var(--md-sys-color-error)";
            return (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--md-sys-color-outline-variant)", display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <MdIcon name="airline_stops" style={{ fontSize: 16, color: "var(--md-sys-color-on-surface-variant)" }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--md-sys-color-on-surface-variant)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Recommended Runway</span>
                </div>
                <span className="font-mono" style={{ fontWeight: 700, fontSize: 15 }}>{rec.rwy}</span>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--md-sys-color-on-surface-variant)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Crosswind </span>
                  <span className="font-mono" style={{ fontWeight: 700, fontSize: 14, color: crossColor }}>{rec.crosswind}KT</span>
                </div>
                {rec.headwind > 0 && (
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--md-sys-color-on-surface-variant)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Headwind </span>
                    <span className="font-mono" style={{ fontWeight: 700, fontSize: 14 }}>{rec.headwind}KT</span>
                  </div>
                )}
              </div>
            );
          })()}

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--md-sys-color-outline-variant)" }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <MdButton variant="text" onClick={() => setExpanded(!expanded)} icon={expanded ? "expand_less" : "expand_more"} style={{ padding: '4px 8px', margin: '-4px -8px' }}>
                {expanded ? "Hide TAF" : "View TAF"}
              </MdButton>
              {onAskAI && (
                <MdButton variant="text" icon="psychology" style={{ padding: '4px 10px' }}
                  onClick={() => onAskAI('Explain the specific weather hazards in this METAR for a VFR pilot:\n' + metar.raw)}>
                  Ask AI
                </MdButton>
              )}
            </div>
            {expanded && <div className="font-mono" style={{ background: "var(--md-sys-color-surface-container-lowest)", borderRadius: "8px", padding: "12px", fontSize: 12, color: "var(--md-sys-color-on-surface)", lineHeight: 1.8, marginTop: 12 }}>{taf}</div>}
          </div>
        </>
      )}
    </MdCard>
  );
}
