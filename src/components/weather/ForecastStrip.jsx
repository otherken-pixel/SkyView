import React, { useState, useEffect } from 'react';
import { MdIcon } from '../common';
import { CatBadge } from './';
import { fetchNwsForecast } from '../../services/weather';
import { getAirport, fetchAirportInfo } from '../../utils/airports';

export default function ForecastStrip({ icao, selectedDay, onSelect }) {
  const [forecasts, setForecasts] = useState(null);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    setForecasts(null);
    setIsLive(false);
    const apt = getAirport(icao);
    if (apt) {
      fetchNwsForecast(apt.lat, apt.lon).then(data => {
        setForecasts(data || []);
        if (data) setIsLive(true);
      }).catch(() => setForecasts([]));
    } else {
      fetchAirportInfo(icao).then(a => {
        if (a) {
          fetchNwsForecast(a.lat, a.lon).then(data => {
            setForecasts(data || []);
            if (data) setIsLive(true);
          }).catch(() => setForecasts([]));
        } else {
          setForecasts([]);
        }
      }).catch(() => setForecasts([]));
    }
  }, [icao]);

  if (forecasts === null) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', color: 'var(--md-sys-color-on-surface-variant)', fontSize: 12 }}>
      <MdIcon name="sync" style={{ animation: 'spin 1s linear infinite', fontSize: 14 }} />
      Loading 7-day forecast…
    </div>
  );

  if (forecasts.length === 0) return (
    <div style={{ fontSize: 12, color: 'var(--md-sys-color-on-surface-variant)', padding: '8px 0' }}>
      7-day forecast unavailable for {icao}
    </div>
  );

  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--md-sys-color-on-surface-variant)", marginBottom: 6, display: "flex", alignItems: "center", gap: 4, flexWrap: 'wrap' }}>
        <MdIcon name="calendar_month" style={{ fontSize: 13 }} />
        7-Day Forecast
        <span style={{ color: "var(--md-sys-color-primary)", fontWeight: 700, fontSize: 12, background: "var(--md-sys-color-primary-container)", borderRadius: 4, padding: "1px 5px", marginLeft: 4 }}>NWS LIVE</span>
        <span style={{ fontSize: 12, color: "var(--md-sys-color-on-surface-variant)", marginLeft: 2 }}>· General area outlook · Trip-specific analysis in Brief tab</span>
      </div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "4px 0", WebkitOverflowScrolling: "touch" }}>
        {forecasts.map((f, i) => {
          const selected = selectedDay === i;
          const lc = f.cat.toLowerCase();
          return (
            <button key={i} onClick={() => onSelect(i)} style={{
              flex: "0 0 auto", minWidth: 72, padding: "12px 8px", borderRadius: "12px",
              border: selected ? `2px solid var(--cat-${lc}-color)` : "2px solid transparent",
              background: selected ? `var(--cat-${lc}-bg)` : "var(--md-sys-color-surface-container-high)",
              cursor: "pointer", textAlign: "center", transition: "all 0.2s",
              fontFamily: 'inherit', color: 'inherit'
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: selected ? `var(--cat-${lc}-color)` : "var(--md-sys-color-on-surface)", marginBottom: 2 }}>{f.dayName}</div>
              <div style={{ fontSize: 12, color: "var(--md-sys-color-on-surface-variant)", marginBottom: 8 }}>{f.dateStr}</div>
              <CatBadge cat={f.cat} />
              <div style={{ fontSize: 12, color: "var(--md-sys-color-on-surface)", marginTop: 8, fontWeight: 500 }}>{f.hi}&deg; <span style={{color: "var(--md-sys-color-on-surface-variant)"}}>{f.lo}&deg;</span></div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
