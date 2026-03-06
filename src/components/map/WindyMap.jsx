import React, { useMemo } from 'react';
import { MdIcon } from '../common';
import { getAirport } from '../../utils/airports';

export default function WindyMap({ dep, arr, wps }) {
  const allPts = useMemo(() => [dep, ...(wps || []), arr].map(getAirport).filter(Boolean), [dep, arr, JSON.stringify(wps)]);
  if (allPts.length < 2) return null;
  const midLat = allPts.reduce((s, p) => s + p.lat, 0) / allPts.length;
  const midLon = allPts.reduce((s, p) => s + p.lon, 0) / allPts.length;
  const src = `https://embed.windy.com/embed2.html?lat=${midLat.toFixed(2)}&lon=${midLon.toFixed(2)}&detailLat=${midLat.toFixed(2)}&detailLon=${midLon.toFixed(2)}&zoom=6&level=surface&overlay=wind&product=ecmwf&menu=&message=&marker=&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=kt&metricTemp=%C2%B0F&radarRange=-1`;
  return (
    <div style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 500, margin: "0 0 12px", color: "var(--md-sys-color-on-surface)", display: "flex", alignItems: "center", gap: 8 }}>
        <MdIcon name="storm" style={{ color: "var(--md-sys-color-primary)" }} />
        Live Wind &amp; Weather Radar
      </h2>
      <div style={{ borderRadius: "16px", overflow: "hidden", border: "1px solid var(--md-sys-color-outline-variant)" }}>
        <iframe src={src} style={{ width: "100%", height: "450px", border: "none" }} allowFullScreen title="Windy Weather Radar" />
      </div>
    </div>
  );
}
