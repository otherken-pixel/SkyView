import React from 'react';
import { MdIcon } from '../common';
import { getAirport } from '../../utils/airports';

export default function WindyEmbed({ icao, tripTargetUtc }) {
  const apt = getAirport(icao);
  if (!apt) return null;
  const lat = apt.lat.toFixed(3), lon = apt.lon.toFixed(3);
  const windyUrl = [
    `https://embed.windy.com/embed2.html`,
    `?lat=${lat}&lon=${lon}`,
    `&detailLat=${lat}&detailLon=${lon}`,
    `&width=650&height=340&pview=0`,
    `&level=surface&overlay=wind&product=ecmwf`,
    `&menu=&message=true&marker=true&calendar=now`,
    `&type=map&location=coordinates&detail=true`,
    `&metricWind=kt&metricTemp=%C2%B0C&radarRange=-1`
  ].join('');
  const windyFullUrl = `https://www.windy.com/?wind,surface,${lat},${lon},8`;
  return (
    <div>
      <iframe
        src={windyUrl}
        title="Windy.com forecast"
        style={{ width: '100%', height: 340, border: 'none', borderRadius: 10, display: 'block' }}
        allow="geolocation"
        loading="lazy"
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, flexWrap: 'wrap', gap: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--md-sys-color-on-surface-variant)' }}>
          ECMWF model · wind/clouds overlay · centered on <strong>{icao}</strong>
        </span>
        <a href={windyFullUrl} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 12, fontWeight: 600, color: 'var(--md-sys-color-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          <MdIcon name="open_in_new" style={{ fontSize: 13 }} />
          Open Windy.com
        </a>
      </div>
    </div>
  );
}
