import React, { useState, useEffect } from 'react';
import { MdIcon } from '../common';
import { fetchLiveNotams } from '../../services/weather';

export default function NotamsPanel({ icao }) {
  const [notams, setNotams] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setNotams(null);
    fetchLiveNotams(icao)
      .then(data => { setNotams(data); setLoading(false); })
      .catch(() => { setNotams([]); setLoading(false); });
  }, [icao]);

  const sevColors = { warning: "var(--caution)", tertiary: "var(--text-secondary)", error: "var(--nogo)" };

  function fmtNotamDate(ms, _isEnd) {
    if (!ms) return null;
    const d = new Date(ms);
    const now = Date.now();
    const diffMs = ms - now;
    const diffDays = Math.round(Math.abs(diffMs) / 86400000);
    const rel = diffMs < 0
      ? (diffDays === 0 ? 'Active' : diffDays + ' days ago')
      : (diffDays === 0 ? 'today' : 'in ' + diffDays + ' days');
    const dateStr = d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' });
    return dateStr + ' (' + rel + ')';
  }

  function highlightText(text) {
    const pattern = /(OUT OF SERVICE|CLOSED|UNSERVICEABLE|NOT AVAILABLE|UNUSABLE)/g;
    const parts = text.split(pattern);
    return parts.map((part, i) => {
      return pattern.test(part)
        ? <span key={i} style={{ color: 'var(--md-sys-color-error)', fontWeight: 700 }}>{part}</span>
        : part;
    });
  }

  if (loading) return (
    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--md-sys-color-on-surface-variant)' }}>
      <MdIcon name="sync" style={{ animation: 'spin 1s linear infinite', fontSize: 24 }} />
      <div style={{ marginTop: 8, fontSize: 13 }}>Fetching live NOTAMs…</div>
    </div>
  );

  if (!notams || notams.length === 0) return (
    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--md-sys-color-on-surface-variant)', fontSize: 13 }}>
      <MdIcon name="check_circle" style={{ fontSize: 20, color: 'var(--cat-vfr-color)', display: 'block', margin: '0 auto 6px' }} />
      No active NOTAMs — AviationWeather.gov
    </div>
  );

  const now = Date.now();
  const DAY = 86400000;
  const groups = [
    { label: 'Last 7 Days',  items: notams.filter(n => n.startMs && (now - n.startMs) <= 7 * DAY) },
    { label: 'Last 30 Days', items: notams.filter(n => n.startMs && (now - n.startMs) > 7 * DAY && (now - n.startMs) <= 30 * DAY) },
    { label: 'Older',        items: notams.filter(n => !n.startMs || (now - n.startMs) > 30 * DAY) },
  ].filter(g => g.items.length > 0);

  function NotamCard({ n }) {
    const icon = n.type === 'RWY' || n.type === 'TWY' ? 'edit_road'
      : n.type === 'TFR' || n.type === 'SECURITY' ? 'block'
      : n.type === 'NAV' ? 'navigation' : 'warning';
    const color = sevColors[n.severity] || 'var(--md-sys-color-outline)';
    return (
      <div style={{ background: 'var(--md-sys-color-surface-container)', borderRadius: '12px', padding: '12px', borderLeft: `4px solid ${color}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <MdIcon name={icon} style={{ fontSize: 16, color }} />
          <span className="font-mono" style={{ fontSize: 12, fontWeight: 700, color }}>{n.type}</span>
          {n.notamNum && <span className="font-mono" style={{ fontSize: 11, color: 'var(--md-sys-color-on-surface-variant)' }}>{n.notamNum}</span>}
        </div>
        <div className="font-mono" style={{ fontSize: 12, color: 'var(--md-sys-color-on-surface)', lineHeight: 1.5 }}>{highlightText(n.text)}</div>
        {(n.startMs || n.endMs) && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {n.startMs && <div style={{ fontSize: 11, color: 'var(--md-sys-color-primary)' }}>Effective&nbsp;&nbsp;{fmtNotamDate(n.startMs, false)}</div>}
            {n.endMs && <div style={{ fontSize: 11, color: 'var(--md-sys-color-on-surface-variant)' }}>Expires&nbsp;&nbsp;&nbsp;&nbsp;{fmtNotamDate(n.endMs, true)}</div>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ fontSize: 12, color: 'var(--cat-vfr-color)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <MdIcon name="verified" style={{ fontSize: 14 }} />
        Live NOTAMs — AviationWeather.gov ({notams.length} active)
      </div>
      {groups.map(g => (
        <div key={g.label}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--md-sys-color-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>{g.label}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {g.items.map((n, i) => <NotamCard key={i} n={n} />)}
          </div>
        </div>
      ))}
    </div>
  );
}
