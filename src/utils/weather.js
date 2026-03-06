/**
 * Weather data processing utilities — METAR decoding, category derivation, etc.
 */

export function deriveCat(ceilingFt, visMi) {
  if (ceilingFt < 500 || visMi < 1)    return 'LIFR';
  if (ceilingFt < 1000 || visMi < 3)   return 'IFR';
  if (ceilingFt < 3000 || visMi < 5)   return 'MVFR';
  return 'VFR';
}

export function getCategoryColor(cat) {
  switch ((cat || '').toUpperCase()) {
    case 'VFR':  return 'var(--vfr)';
    case 'MVFR': return 'var(--mvfr)';
    case 'IFR':  return 'var(--ifr)';
    case 'LIFR': return 'var(--lifr)';
    default:     return 'var(--text-secondary)';
  }
}

export function calculateDensityAltitude(tempC, altimeterInHg, elevationFt) {
  const pressureAlt = elevationFt + (29.92 - altimeterInHg) * 1000;
  const isaTemp = 15 - (pressureAlt * 0.002);
  return Math.round(pressureAlt + 120 * (tempC - isaTemp));
}

export function getGoColor(s) {
  return s >= 75 ? "var(--go)" : s >= 50 ? "var(--caution)" : "var(--nogo)";
}

export function parseCeilingFt(skyStr) {
  if (!skyStr) return 99999;
  const layers = skyStr.split(' ');
  for (const layer of layers) {
    const m = layer.match(/^(BKN|OVC|VV)(\d{3})$/);
    if (m) return parseInt(m[2]) * 100;
  }
  return 99999;
}

export function parseVisSMNum(s) {
  if (!s) return 10;
  if (s === 'P6SM') return 7;
  const m = s.match(/^([\d\/]+)SM$/);
  if (m) {
    const parts = m[1].trim().split('/');
    if (parts.length === 2) return parseInt(parts[0]) / parseInt(parts[1]);
    return parseFloat(parts[0]);
  }
  return 10;
}

// METAR human-readable decoder helpers
export function metarCompassDir(deg) {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

export function decodeMetarWind(metar) {
  if (!metar.wind) return 'N/A';
  const m = metar.wind.match(/^(VRB|\d{3})(\d{2,3})(G(\d{2,3}))?KT$/);
  if (!m) return metar.wind;
  const dir = m[1], spd = parseInt(m[2]), gst = m[4] ? parseInt(m[4]) : null;
  const dirStr = dir === 'VRB' ? 'Variable' : metarCompassDir(parseInt(dir)) + ' (' + parseInt(dir) + '\u00b0)';
  return dirStr + ' at ' + spd + ' kts' + (gst ? ', gusting ' + gst + ' kts' : '');
}

export function decodeMetarVis(vis) {
  if (!vis) return 'N/A';
  if (vis === 'P6SM') return 'Greater than 6 miles';
  const m = vis.match(/^([\d\/ ]+)SM$/);
  if (m) { const v = m[1].trim(); return v + ' statute mile' + (v === '1' ? '' : 's'); }
  return vis;
}

export function decodeMetarSkyLayer(layer) {
  const codes = { CLR:'Clear', SKC:'Sky Clear', FEW:'Few Clouds', SCT:'Scattered Clouds', BKN:'Broken Clouds', OVC:'Overcast', VV:'Vertical Visibility' };
  const m = layer.match(/^(CLR|SKC|FEW|SCT|BKN|OVC|VV)(\d{3})?$/);
  if (!m) return layer;
  const name = codes[m[1]] || m[1];
  if (m[2]) { const ft = parseInt(m[2]) * 100; return name + ' at ' + ft.toLocaleString() + ' ft'; }
  return name;
}

export function decodeMetarSky(sky) {
  if (!sky) return 'N/A';
  return sky.split(' ').map(decodeMetarSkyLayer).join(', ');
}

export function decodeMetarTemp(temp) {
  if (!temp) return 'N/A';
  const parts = temp.split('/');
  function parseC(s) { const neg = s.startsWith('M'); return neg ? -parseInt(s.slice(1)) : parseInt(s); }
  const tc = parseC(parts[0]), dc = parseC(parts[1] || '0');
  const tf = Math.round(tc * 9 / 5 + 32), df = Math.round(dc * 9 / 5 + 32);
  return tc + '\u00b0C (' + tf + '\u00b0F)\u2002\u00b7\u2002Dewpt ' + dc + '\u00b0C (' + df + '\u00b0F)';
}

export function decodeMetarAlt(alt) {
  if (!alt) return 'N/A';
  const m = alt.match(/^A(\d{4})$/);
  if (!m) return alt;
  return (parseInt(m[1]) / 100).toFixed(2) + ' inHg';
}

export function getRunwayRecommendation(metar, apt) {
  if (!metar || !apt || !apt.rwy || apt.rwy.length === 0) return null;
  if (metar.wdir == null || !metar.wspd || metar.wspd < 3) return null;
  const windDir = metar.wdir;
  const windSpd = metar.wspd;
  let best = null;
  let bestCross = Infinity;
  apt.rwy.forEach(function(rwyPair) {
    rwyPair.split("/").forEach(function(rwyEnd) {
      const m = rwyEnd.match(/^(\d+)/);
      if (!m) return;
      const rwyHdg = parseInt(m[1]) * 10;
      let angle = ((windDir - rwyHdg) % 360 + 360) % 360;
      if (angle > 180) angle -= 360;
      const rad = angle * Math.PI / 180;
      const cross = Math.abs(windSpd * Math.sin(rad));
      const head = windSpd * Math.cos(rad);
      if (cross < bestCross) {
        bestCross = cross;
        best = { rwy: rwyEnd, crosswind: Math.round(cross), headwind: Math.round(head) };
      }
    });
  });
  return best;
}

export function calcWindComponents(windDir, windSpd, runwayHdg) {
  let angle = ((windDir - runwayHdg) % 360 + 360) % 360;
  if (angle > 180) angle -= 360;
  const rad = angle * Math.PI / 180;
  return {
    crosswind: Math.round(Math.abs(windSpd * Math.sin(rad))),
    headwind: Math.round(windSpd * Math.cos(rad))
  };
}
