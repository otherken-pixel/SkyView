import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { MdIcon, MdButton, AirportInput } from './components/common';
import LoginScreen from './components/auth/LoginScreen';
import { BriefingPanel, WeatherDetail, RunwayPanel, FBOPanel, FreqPanel } from './components/briefing';
import { GoScoreRing } from './components/weather';
import ForecastStrip from './components/weather/ForecastStrip';
import { VfrChartsMap, WindyMap } from './components/map';
import { DataModal, PilotProfileModal, SettingsModal } from './components/modals';
import Scratchpad from './components/layout/Scratchpad';
import { fetchLiveMetar, fetchLiveTaf, fetchEffectiveWxForTrip } from './services/weather';
import { callGeminiApi } from './services/ai';
import { loadTrips, saveTrip, deleteTrip as firestoreDeleteTrip, migrateLocalStorageTrips } from './services/firestore';
import { getAirport, fetchAirportInfo, loadOurAirports } from './utils/airports';
import { AIRPORTS } from './data/airports';
import { getGoColor } from './utils/weather';
import { calcDetailedScore, calcFratGoScore } from './utils/scoring';
import { calcDist } from './utils/geo';
import { getPersonalMinimums } from './utils/personalMinimums';
import { AIRCRAFT } from './data/aircraft';
import { AVIATION_DAD_JOKES } from './data/jokes';
import { FRAT_QUESTIONS, FRAT_TOTAL } from './data/frat';
import { Sentry } from './services/sentry';

const DEFAULT_TRIPS = [
  { id: 1, dep: 'KCLT', arr: 'KATL', aircraft: 'c172', date: '2026-03-06', time: '09:00', wps: [], name: 'Charlotte to Atlanta', goScore: null },
  { id: 2, dep: 'KJFK', arr: 'KBOS', aircraft: 'sr22', date: '2026-03-08', time: '14:30', wps: ['KORH'], name: 'New York to Boston', goScore: null },
];

const THEME_ICONS = { dark: 'light_mode', light: 'nightlight', night: 'dark_mode' };
const THEME_LABELS = { dark: 'Light Mode', light: 'Night Mode', night: 'Dark Mode' };

/* ── Haptics helper (Capacitor) ── */
let _hapticsModule = null;
async function triggerHaptic(style) {
  try {
    if (!_hapticsModule) {
      _hapticsModule = await import('@capacitor/haptics').then(m => m.Haptics).catch(() => null);
    }
    if (_hapticsModule) {
      if (style === 'warning') _hapticsModule.notification({ type: 'WARNING' });
      else if (style === 'success') _hapticsModule.notification({ type: 'SUCCESS' });
      else _hapticsModule.impact({ style: 'LIGHT' });
    }
  } catch (_) {}
}

async function parseTripWithAi(inputText) {
  const now = new Date();
  const pad2 = n => String(n).padStart(2, '0');
  const today = now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate());
  const acList = AIRCRAFT.map(a => '"' + a.id + '" (' + a.name + ')').join(', ');
  const system = [
    'You are an aviation flight parser. Today\'s date is ' + today + '.',
    'Extract flight details from the user input and respond with ONLY a single raw JSON object.',
    'Required fields: "dep" (ICAO), "arr" (ICAO), "wps" (array), "aircraft" (one of: ' + acList + '), "date" (YYYY-MM-DD), "time" (HH:MM), "name".',
    'Output ONLY the JSON object.'
  ].join('\n');
  const raw = await callGeminiApi({ system, messages: [{ role: 'user', content: inputText }], max_tokens: 1024, thinkingBudget: 0 });
  const cleaned = (typeof raw === 'string' ? raw : '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  let parsed;
  try { parsed = JSON.parse(cleaned); } catch (e) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) try { parsed = JSON.parse(match[0]); } catch (_) {}
    if (!parsed) throw new Error('Could not parse AI response');
  }
  if (!parsed.dep || !parsed.arr) throw new Error('Could not identify airports');
  parsed.dep = parsed.dep.toUpperCase();
  parsed.arr = parsed.arr.toUpperCase();
  parsed.wps = (parsed.wps || []).map(w => w.toUpperCase());
  return parsed;
}

class WxErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) {
    if (Sentry) Sentry.captureException(error, { extra: { componentStack: info?.componentStack } });
  }
  render() {
    if (this.state.hasError) {
      return this.props.compact ? null : (
        <div style={{ padding: 16, color: 'var(--text-secondary)', fontSize: 13 }} role="alert">
          <span style={{ fontSize: 18, verticalAlign: 'middle', marginRight: 6 }}>⚠️</span>
          {this.props.label || 'Component'} encountered an error.
        </div>
      );
    }
    return this.props.children;
  }
}

/* P0: Touch targets enlarged to 44x44pt minimum */
const IconBtn = ({ icon, onClick, title, active, style: s, 'aria-label': ariaLabel }) => (
  <button onClick={(e) => { triggerHaptic('light'); onClick && onClick(e); }}
    title={title} aria-label={ariaLabel || title} role="button" style={{
    background: active ? 'var(--accent-dim)' : 'none',
    border: '1px solid ' + (active ? 'rgba(10,132,255,0.3)' : 'transparent'),
    borderRadius: 12, cursor: 'pointer', lineHeight: 1,
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s',
    minWidth: 44, minHeight: 44, padding: 10,
    ...s
  }}>
    <MdIcon name={icon} style={{ fontSize: 22 }} />
  </button>
);

/* P1: iOS Action Sheet (replaces window.confirm) */
function IOSActionSheet({ title, message, actions, onClose }) {
  return (
    <div className="ios-action-sheet-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="ios-action-sheet" onClick={e => e.stopPropagation()}>
        <div className="ios-action-sheet-group">
          {title && <div className="ios-action-sheet-title">{title}</div>}
          {message && <div className="ios-action-sheet-message">{message}</div>}
          {actions.map((a, i) => (
            <button key={i} className={'ios-action-sheet-btn' + (a.destructive ? ' destructive' : '')}
              onClick={() => { a.handler(); onClose(); }}>
              {a.label}
            </button>
          ))}
        </div>
        <div className="ios-action-sheet-group">
          <button className="ios-action-sheet-btn cancel" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* P2: iOS Context Menu (long-press on trip cards) */
function IOSContextMenu({ items, position, onClose }) {
  return (
    <div className="ios-context-overlay" onClick={onClose}>
      <div className="ios-context-menu" onClick={e => e.stopPropagation()} role="menu">
        {items.map((item, i) => item.separator ? (
          <div key={i} className="ios-context-sep" />
        ) : (
          <button key={i} className={'ios-context-item' + (item.destructive ? ' destructive' : '')}
            role="menuitem" onClick={() => { item.handler(); onClose(); }}>
            <span>{item.label}</span>
            <MdIcon name={item.icon} style={{ fontSize: 18, opacity: 0.7 }} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* P3: Pull-to-refresh hook */
function usePullToRefresh(onRefresh, containerRef) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const isPulling = useRef(false);
  const threshold = 80;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function handleTouchStart(e) {
      if (el.scrollTop <= 0) {
        startY.current = e.touches[0].clientY;
        isPulling.current = true;
      }
    }
    function handleTouchMove(e) {
      if (!isPulling.current) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0 && el.scrollTop <= 0) {
        const dist = Math.min(dy * 0.5, 120);
        setPullDistance(dist);
        setPulling(dist > 10);
        if (dist > 20) e.preventDefault();
      } else {
        isPulling.current = false;
        setPulling(false);
        setPullDistance(0);
      }
    }
    function handleTouchEnd() {
      if (pullDistance >= threshold && !refreshing) {
        setRefreshing(true);
        setPulling(false);
        triggerHaptic('light');
        Promise.resolve(onRefresh()).finally(() => {
          setRefreshing(false);
          setPullDistance(0);
        });
      } else {
        setPulling(false);
        setPullDistance(0);
      }
      isPulling.current = false;
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [containerRef, onRefresh, pullDistance, refreshing]);

  return { pulling, refreshing, pullDistance };
}

/* P3: Swipe-to-delete hook for individual trip cards */
function useSwipeToDelete(onDelete) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startX = useRef(0);
  const isSwiping = useRef(false);

  const handlers = useMemo(() => ({
    onTouchStart(e) {
      startX.current = e.touches[0].clientX;
      isSwiping.current = true;
    },
    onTouchMove(e) {
      if (!isSwiping.current) return;
      const dx = startX.current - e.touches[0].clientX;
      if (dx > 10) {
        setSwiping(true);
        setSwipeOffset(Math.min(dx * 0.6, 80));
      }
    },
    onTouchEnd() {
      if (swipeOffset >= 70) {
        triggerHaptic('warning');
        onDelete();
      }
      isSwiping.current = false;
      setSwiping(false);
      setSwipeOffset(0);
    }
  }), [swipeOffset, onDelete]);

  return { swipeOffset, swiping, handlers };
}

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const { theme, cycleTheme } = useTheme();
  const [view, setView] = useState('trips');
  const [prevView, setPrevView] = useState(null);
  const dadJoke = useMemo(() => AVIATION_DAD_JOKES[Math.floor(Math.random() * AVIATION_DAD_JOKES.length)], []);
  const defaultTimeStr = (new Date(Date.now() + 7200000)).toTimeString().slice(0, 5);

  const [showDataModal, setShowDataModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [personalMinimums, setPersonalMinimums] = useState(getPersonalMinimums);
  const [showHamburger, setShowHamburger] = useState(false);
  const [isDecodedWx, setIsDecodedWx] = useState(false);
  const [pendingAiPrompt, setPendingAiPrompt] = useState(null);

  const [nlInput, setNlInput] = useState('');
  const [nlLoading, setNlLoading] = useState(false);
  const [nlError, setNlError] = useState(null);

  /* P1: iOS Action Sheet state (replaces window.confirm) */
  const [actionSheet, setActionSheet] = useState(null);

  /* P2: Context menu state */
  const [contextMenu, setContextMenu] = useState(null);

  /* Pull-to-refresh ref */
  const tripsScrollRef = useRef(null);

  useEffect(() => {
    if (user) setShowLoginModal(false);
  }, [user]);

  // Trips state
  const [trips, setTrips] = useState([]);
  const [tripsLoaded, setTripsLoaded] = useState(false);
  const skipNextFirestoreWrite = useRef(false);
  const prevTripIds = useRef(null);
  const scoredTripSigs = useRef(new Map());
  const prevTripJsons = useRef(new Map());
  const [activeTrip, setActiveTrip] = useState(null);
  const [tab, setTab] = useState(() => {
    try { return sessionStorage.getItem('sc_tab') || 'brief'; } catch (e) { return 'brief'; }
  });

  // Persist current view to sessionStorage for post-reload restoration
  useEffect(() => {
    if (view === 'briefing' && activeTrip) {
      try {
        sessionStorage.setItem('sc_view', 'briefing');
        sessionStorage.setItem('sc_active_trip_id', String(activeTrip.id));
        sessionStorage.setItem('sc_tab', tab);
      } catch (_) {}
    } else {
      try {
        sessionStorage.removeItem('sc_view');
        sessionStorage.removeItem('sc_active_trip_id');
        sessionStorage.removeItem('sc_tab');
      } catch (_) {}
    }
  }, [view, activeTrip, tab]);
  const [forecastDay, setForecastDay] = useState(0);
  const [newTrip, setNewTrip] = useState({ route: ['', ''], aircraft: 'c172', date: '', time: defaultTimeStr, name: '' });
  const [editingTripId, setEditingTripId] = useState(null);
  const [wizardStep, setWizardStep] = useState(1);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [aptVersion, setAptVersion] = useState(0);
  const [copiedTripId, setCopiedTripId] = useState(null);

  const handleNlGenerate = useCallback(async () => {
    if (!nlInput.trim() || nlLoading) return;
    setNlLoading(true); setNlError(null);
    try {
      const parsed = await parseTripWithAi(nlInput.trim());
      const trip = {
        id: Date.now(), goScore: null, dep: parsed.dep, arr: parsed.arr,
        wps: parsed.wps || [],
        aircraft: AIRCRAFT.some(a => a.id === parsed.aircraft) ? parsed.aircraft : 'c172',
        date: parsed.date || '', time: parsed.time || '09:00',
        name: parsed.name || (parsed.dep + ' to ' + parsed.arr)
      };
      setTrips(prev => [trip, ...prev]);
      setNlInput('');
      triggerHaptic('success');
    } catch (e) {
      setNlError(e.message || 'Failed to parse trip');
      triggerHaptic('warning');
    } finally { setNlLoading(false); }
  }, [nlInput, nlLoading]);

  useEffect(() => { loadOurAirports(); }, []);

  // Auto-score trips
  useEffect(() => {
    if (!tripsLoaded) return;
    trips.forEach(t => {
      const sig = [t.dep, t.arr, (t.wps || []).join(','), t.date, t.time].join('|');
      const id = String(t.id);
      if (scoredTripSigs.current.get(id) === sig) return;
      scoredTripSigs.current.set(id, sig);
      const allPts = [t.dep, ...(t.wps || []), t.arr].filter(Boolean);
      let dist = 0;
      for (let i = 0; i < allPts.length - 1; i++) {
        const p1 = getAirport(allPts[i]), p2 = getAirport(allPts[i + 1]);
        if (p1 && p2) dist += calcDist(p1.lat, p1.lon, p2.lat, p2.lon);
      }
      const routeDist = Math.round(dist);
      fetchEffectiveWxForTrip(t, allPts).then(wxData => {
        if (wxData.length > 0) {
          const ds = calcDetailedScore(wxData, routeDist);
          const weatherScore = ds.total;
          let savedAnswers = {};
          try {
            const s = JSON.parse(localStorage.getItem('flightscore_frat_' + t.id) || 'null');
            if (s && s.answers) savedAnswers = s.answers;
          } catch (e) {}
          if (!Object.keys(savedAnswers).length) savedAnswers = t.fratAnswers || {};
          const fratDone = FRAT_QUESTIONS.filter(q => savedAnswers[q.id] !== undefined).length === FRAT_TOTAL;
          let score;
          if (fratDone) {
            const fratScore = calcFratGoScore(savedAnswers);
            score = Math.max(0, Math.min(100, Math.round(weatherScore * 0.70 + fratScore * 0.30)));
          } else {
            score = Math.max(0, weatherScore - 20);
          }
          if (ds.scoreCap !== null && ds.scoreCap !== undefined) score = Math.min(ds.scoreCap, score);
          setTrips(prev => prev.map(x => x.id === t.id ? { ...x, goScore: score } : x));
        }
      }).catch(() => {});
    });
  }, [trips, tripsLoaded]);

  // Load trips from Firestore or localStorage
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      try {
        const raw = localStorage.getItem('flightscore_trips');
        const saved = raw ? JSON.parse(raw) : null;
        const initial = Array.isArray(saved) ? saved : DEFAULT_TRIPS;
        skipNextFirestoreWrite.current = true;
        setTrips(initial);
        setTripsLoaded(true);
        prevTripIds.current = new Set(initial.map(t => String(t.id)));
      } catch (e) {
        skipNextFirestoreWrite.current = true;
        setTrips(DEFAULT_TRIPS);
        setTripsLoaded(true);
        prevTripIds.current = new Set(DEFAULT_TRIPS.map(t => String(t.id)));
      }
      return;
    }
    loadTrips(user.uid).then(loaded => {
      if (loaded.length > 0) {
        skipNextFirestoreWrite.current = true;
        setTrips(loaded);
        setTripsLoaded(true);
        prevTripIds.current = new Set(loaded.map(t => String(t.id)));
        try {
          if (sessionStorage.getItem('sc_view') === 'briefing') {
            const sid = sessionStorage.getItem('sc_active_trip_id');
            const restored = loaded.find(t => String(t.id) === sid);
            if (restored) { setActiveTrip(restored); setView('briefing'); }
          }
        } catch (e) {}
      } else {
        migrateLocalStorageTrips(user.uid).then(async (result) => {
          skipNextFirestoreWrite.current = true;
          const seenKey = 'flightscore_uid_seen_' + user.uid;
          let hasLocalData = false;
          try { hasLocalData = localStorage.getItem('flightscore_trips') !== null; } catch (e) {}
          let seenBefore = false;
          try { seenBefore = !!localStorage.getItem(seenKey); } catch (e) {}
          let initial;
          if (result.migrated > 0) {
            try { initial = await loadTrips(user.uid); } catch (e) { initial = []; }
          } else {
            initial = hasLocalData || seenBefore ? [] : DEFAULT_TRIPS;
          }
          try { localStorage.setItem(seenKey, '1'); } catch (e) {}
          setTrips(initial);
          setTripsLoaded(true);
          prevTripIds.current = new Set(initial.map(t => String(t.id)));
        });
      }
    }).catch(e => {
      console.warn('[FlightScore] Firestore load failed:', e);
      skipNextFirestoreWrite.current = true;
      setTrips(DEFAULT_TRIPS);
      setTripsLoaded(true);
      prevTripIds.current = new Set(DEFAULT_TRIPS.map(t => String(t.id)));
    });
  }, [user, authLoading]);

  // Persist trips
  useEffect(() => {
    if (!tripsLoaded) return;
    if (skipNextFirestoreWrite.current) { skipNextFirestoreWrite.current = false; return; }
    if (!user) {
      try { localStorage.setItem('flightscore_trips', JSON.stringify(trips)); } catch (e) {}
      return;
    }
    const newIds = new Set(trips.map(t => String(t.id)));
    trips.forEach(t => {
      const id = String(t.id);
      const json = JSON.stringify(t);
      if (prevTripJsons.current.get(id) !== json) {
        prevTripJsons.current.set(id, json);
        saveTrip(user.uid, t).catch(console.warn);
      }
    });
    if (prevTripIds.current) {
      prevTripIds.current.forEach(id => {
        if (!newIds.has(id)) {
          prevTripJsons.current.delete(id);
          firestoreDeleteTrip(user.uid, id).catch(console.warn);
        }
      });
    }
    prevTripIds.current = newIds;
  }, [trips, tripsLoaded, user]);

  // Share URL handler
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith('#share=')) return;
    try {
      const encoded = hash.slice(7);
      const json = decodeURIComponent(escape(atob(encoded)));
      const sharedTrip = JSON.parse(json);
      if (sharedTrip && sharedTrip.dep && sharedTrip.arr) {
        const label = sharedTrip.name || (sharedTrip.dep + ' → ' + sharedTrip.arr);
        setActionSheet({
          title: 'Add Shared Trip',
          message: 'Add "' + label + '" to your flight list?',
          actions: [{ label: 'Add Trip', handler: () => setTrips(prev => [{ ...sharedTrip, id: crypto.randomUUID() }, ...prev]) }]
        });
      }
    } catch (e) {}
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }, []);

  function importTrips(data) {
    setTrips(prev => {
      const existingIds = new Set(prev.map(t => String(t.id)));
      const toAdd = data.filter(t => !existingIds.has(String(t.id)));
      return toAdd.length ? [...toAdd, ...prev] : prev;
    });
  }

  function copyTripLink(trip, e) {
    e && e.stopPropagation();
    try {
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(trip))));
      const url = window.location.href.split('#')[0] + '#share=' + encoded;
      navigator.clipboard.writeText(url).then(() => {
        setCopiedTripId(trip.id);
        triggerHaptic('success');
        setTimeout(() => setCopiedTripId(null), 2000);
      });
    } catch (ex) {}
  }

  useEffect(() => {
    const candidates = newTrip.route.map(r => r.trim().toUpperCase()).filter(r => r.length === 4 && !AIRPORTS[r]);
    if (candidates.length === 0) return;
    Promise.all(candidates.map(fetchAirportInfo)).then(results => {
      if (results.some(Boolean)) setAptVersion(v => v + 1);
    }).catch(() => {});
  }, [newTrip.route.join(',')]);

  function createTrip() {
    const validRoute = newTrip.route.map(r => r.trim().toUpperCase()).filter(r => r.length === 4);
    if (validRoute.length < 2) return;
    const dep = validRoute[0], arr = validRoute[validRoute.length - 1];
    const tripName = newTrip.name || (dep + ' to ' + arr);
    if (editingTripId) {
      const editedWps = validRoute.slice(1, -1);
      setTrips(prev => prev.map(t => t.id === editingTripId ? {
        ...t, dep, arr, wps: editedWps, aircraft: newTrip.aircraft,
        date: newTrip.date, time: newTrip.time, name: tripName
      } : t));
      if (activeTrip && activeTrip.id === editingTripId) {
        setActiveTrip(prev => prev ? { ...prev, dep, arr, wps: editedWps, aircraft: newTrip.aircraft, date: newTrip.date, time: newTrip.time, name: tripName } : prev);
      }
      setEditingTripId(null);
    } else {
      const t = {
        id: Date.now(), dep, arr, wps: validRoute.slice(1, -1),
        aircraft: newTrip.aircraft, date: newTrip.date, time: newTrip.time,
        name: tripName, goScore: null
      };
      setTrips(prev => [t, ...prev]);
    }
    setNewTrip({ route: ['', ''], aircraft: 'c172', date: '', time: defaultTimeStr, name: '' });
    setWizardStep(1);
    setResetConfirm(false);
    triggerHaptic('success');
    setView('trips');
  }

  function editTrip(trip, e) {
    e && e.stopPropagation();
    setEditingTripId(trip.id);
    setNewTrip({
      route: [trip.dep, ...(trip.wps || []), trip.arr],
      aircraft: trip.aircraft, date: trip.date, time: trip.time, name: trip.name || ''
    });
    setWizardStep(1);
    setResetConfirm(false);
    setView('create');
  }

  /* P2: view transitions */
  function openTrip(trip) {
    triggerHaptic('light');
    setPrevView(view);
    setActiveTrip(trip); setTab('brief'); setForecastDay(0);
    setView('briefing');
  }

  /* P1: iOS Action Sheet for delete confirmation (replaces window.confirm) */
  function handleDeleteTrip(id) {
    const trip = trips.find(t => t.id === id);
    const label = trip ? (trip.name || (trip.dep + ' → ' + trip.arr)) : 'this trip';
    triggerHaptic('warning');
    setActionSheet({
      title: 'Delete Flight',
      message: 'Delete "' + label + '"? This cannot be undone.',
      actions: [{
        label: 'Delete', destructive: true,
        handler: () => {
          setTrips(prev => prev.filter(t => t.id !== id));
          scoredTripSigs.current.delete(String(id));
          try { localStorage.removeItem('flightscore_frat_' + id); } catch (e) {}
          if (activeTrip && activeTrip.id === id) { setActiveTrip(null); setView('trips'); }
        }
      }]
    });
  }

  function duplicateTrip(trip, e) {
    e && e.stopPropagation();
    triggerHaptic('light');
    setTrips(prev => [{ ...trip, id: crypto.randomUUID(), name: trip.name + ' (Copy)' }, ...prev]);
  }

  /* P2: Long-press context menu for trip cards */
  const longPressTimerRef = useRef(null);
  function handleTripTouchStart(trip, e) {
    longPressTimerRef.current = setTimeout(() => {
      triggerHaptic('light');
      setContextMenu({
        items: [
          { label: 'Edit Flight', icon: 'edit', handler: () => editTrip(trip) },
          { label: 'Share Link', icon: 'share', handler: () => copyTripLink(trip) },
          { label: 'Duplicate', icon: 'content_copy', handler: () => duplicateTrip(trip) },
          { separator: true },
          { label: 'Delete', icon: 'delete', destructive: true, handler: () => handleDeleteTrip(trip.id) }
        ]
      });
    }, 500);
  }
  function handleTripTouchEnd() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  /* Pull-to-refresh: re-score all trips */
  const handlePullRefresh = useCallback(async () => {
    // Reset all scoring signatures to force re-evaluation
    scoredTripSigs.current.clear();
    // Trigger re-score by updating trips with a new array reference
    setTrips(prev => [...prev]);
    // Small delay to let the scoring effect run
    await new Promise(r => setTimeout(r, 1500));
  }, []);

  const { pulling, refreshing, pullDistance } = usePullToRefresh(handlePullRefresh, tripsScrollRef);

  const tabList = [
    { id: 'brief', label: 'Briefing', icon: 'auto_awesome' },
    { id: 'wx', label: 'Weather', icon: 'partly_cloudy_day' },
    { id: 'maps', label: 'Maps', icon: 'map' },
    { id: 'runway', label: 'Runways', icon: 'flight_land' },
    { id: 'freq', label: 'Freqs', icon: 'cell_tower' },
    { id: 'fbo', label: 'FBO', icon: 'local_gas_station' },
    { id: 'export', label: 'Export', icon: 'print' }
  ];

  // Auth loading splash
  if (authLoading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-elevated)', gap: 16 }} role="status" aria-label="Loading application">
      <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <MdIcon name="flight" style={{ fontSize: 30, color: '#fff' }} />
      </div>
      <div style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Loading…</div>
    </div>
  );

  const ac = activeTrip ? (AIRCRAFT.find(a => a.id === activeTrip.aircraft) || AIRCRAFT[0]) : AIRCRAFT[0];
  const fullRoute = activeTrip ? [activeTrip.dep, ...(activeTrip.wps || []), activeTrip.arr] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg-elevated)' }}>
      {/* P0: Header with safe area inset */}
      <header style={{
        minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 12px 0 16px',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        background: 'var(--header-bg)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--header-border)', zIndex: 100, flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {view === 'briefing' ? (
            <button onClick={() => { setPrevView('briefing'); setView('trips'); setActiveTrip(null); triggerHaptic('light'); }}
              aria-label="Back to flights" role="button" style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '6px 4px 6px 0',
              color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 15, fontWeight: 600,
              minHeight: 44
            }}>
              <MdIcon name="chevron_left" style={{ fontSize: 22 }} /> Flights
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MdIcon name="flight" style={{ fontSize: 20, color: '#fff' }} />
              </div>
              <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>FlightScore</span>
            </div>
          )}
        </div>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 2 }} aria-label="Header actions">
          {view === 'briefing' && (
            <IconBtn icon={isDecodedWx ? 'code_off' : 'code'} onClick={() => setIsDecodedWx(!isDecodedWx)}
              title={isDecodedWx ? 'Show raw METAR' : 'Decode METAR'} active={isDecodedWx} />
          )}
          <IconBtn icon={THEME_ICONS[theme]} onClick={cycleTheme} title={THEME_LABELS[theme]} />
          <IconBtn icon="person" onClick={() => user ? setShowProfileModal(true) : setShowLoginModal(true)}
            title={user ? 'Profile' : 'Sign In'} />
          <IconBtn icon="more_vert" onClick={() => setShowHamburger(!showHamburger)} title="Menu" />
        </nav>
      </header>

      {/* P3: Hamburger as iOS pull-down menu */}
      {showHamburger && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 150 }} onClick={() => setShowHamburger(false)} role="presentation">
          <div className="hamburger-dropdown" style={{
            position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 50px)', right: 12
          }} onClick={e => e.stopPropagation()} role="menu" aria-label="App menu">
            <button className="hamburger-dropdown-item" role="menuitem"
              onClick={() => { setShowDataModal(true); setShowHamburger(false); }}>
              <MdIcon name="folder" style={{ fontSize: 18, color: 'var(--text-secondary)' }} /> My Trip Data
            </button>
            <div className="hamburger-dropdown-sep" />
            <button className="hamburger-dropdown-item" role="menuitem"
              onClick={() => { setShowSettingsModal(true); setShowHamburger(false); }}>
              <MdIcon name="settings" style={{ fontSize: 18, color: 'var(--text-secondary)' }} /> Settings
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main ref={tripsScrollRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Pull-to-refresh indicator */}
        {view === 'trips' && (pulling || refreshing) && (
          <div className="pull-to-refresh-indicator" style={{
            height: refreshing ? 48 : Math.min(pullDistance, 80),
            opacity: refreshing ? 1 : Math.min(pullDistance / 60, 1)
          }}>
            {refreshing ? (
              <div className="pull-to-refresh-spinner" />
            ) : (
              <MdIcon name="arrow_downward" style={{
                fontSize: 20, color: 'var(--accent)',
                transform: pullDistance > 60 ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s'
              }} />
            )}
          </div>
        )}

        {/* Trips list view */}
        {view === 'trips' && (
          <div style={{
            padding: '20px 16px', maxWidth: 600, margin: '0 auto', width: '100%',
            animation: prevView === 'briefing' ? 'fadeIn 0.25s ease' : undefined
          }}>
            {/* P2: Inline "New Flight" button (replaces FAB) */}
            <button onClick={() => { triggerHaptic('light'); setView('create'); }}
              aria-label="Create new flight" role="button" style={{
              width: '100%', padding: '14px 18px', marginBottom: 16,
              background: 'var(--accent)', color: '#fff', border: 'none',
              borderRadius: 14, fontSize: 15, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: 'var(--font-sans)', minHeight: 50
            }}>
              <MdIcon name="add" style={{ fontSize: 22 }} /> New Flight
            </button>

            {/* NL input */}
            <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
              <input value={nlInput} onChange={e => setNlInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleNlGenerate()}
                placeholder='Try "KCLT to KATL tomorrow at 9am"'
                aria-label="Natural language flight input"
                style={{
                  flex: 1, padding: '12px 14px', borderRadius: 12,
                  background: 'var(--card)', border: '1px solid var(--card-border)',
                  color: 'var(--text-primary)', fontSize: 14, outline: 'none',
                  minHeight: 44, fontFamily: 'var(--font-sans)'
                }} />
              <MdButton variant="filled" icon={nlLoading ? 'sync' : 'auto_awesome'} onClick={handleNlGenerate}
                disabled={nlLoading} style={{ borderRadius: 12, minHeight: 44 }}>
                {nlLoading ? '' : 'Go'}
              </MdButton>
            </div>
            {nlError && <div role="alert" style={{ color: 'var(--nogo)', fontSize: 13, marginBottom: 12 }}>{nlError}</div>}

            {/* Trip cards — P0: accessible, P2: context menu, P3: swipe-to-delete */}
            {trips.map(trip => (
              <TripCard key={trip.id} trip={trip}
                copiedTripId={copiedTripId}
                onOpen={openTrip}
                onEdit={editTrip}
                onDelete={handleDeleteTrip}
                onDuplicate={duplicateTrip}
                onCopyLink={copyTripLink}
                onTouchStart={handleTripTouchStart}
                onTouchEnd={handleTripTouchEnd}
              />
            ))}

            {trips.length === 0 && tripsLoaded && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary)' }} role="status">
                <MdIcon name="flight" style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }} aria-hidden="true" />
                <div style={{ fontSize: 15, marginBottom: 8 }}>No flights yet</div>
                <div style={{ fontSize: 13 }}>Use the input above to create a flight</div>
                {dadJoke && <div style={{ marginTop: 24, fontSize: 12, fontStyle: 'italic', opacity: 0.6 }}>{dadJoke}</div>}
              </div>
            )}
          </div>
        )}

        {/* Create/Edit trip view */}
        {view === 'create' && (
          <div style={{ padding: '20px 16px', maxWidth: 500, margin: '0 auto', width: '100%', animation: 'fadeIn 0.2s ease' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>
              {editingTripId ? 'Edit Flight' : 'New Flight'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {newTrip.route.map((r, idx) => (
                <AirportInput key={idx} value={r} placeholder={idx === 0 ? 'Departure (ICAO)' : idx === newTrip.route.length - 1 ? 'Destination (ICAO)' : 'Waypoint (ICAO)'}
                  onChange={v => setNewTrip(prev => ({ ...prev, route: prev.route.map((x, i) => i === idx ? v : x) }))} />
              ))}
              <MdButton variant="text" icon="add" onClick={() => setNewTrip(prev => ({
                ...prev, route: [...prev.route.slice(0, -1), '', prev.route[prev.route.length - 1]]
              }))}>Add Waypoint</MdButton>
              <select value={newTrip.aircraft} onChange={e => setNewTrip(prev => ({ ...prev, aircraft: e.target.value }))}
                aria-label="Aircraft type"
                style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--text-primary)', fontSize: 14, minHeight: 44 }}>
                {AIRCRAFT.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 10 }}>
                <input type="date" value={newTrip.date} onChange={e => setNewTrip(prev => ({ ...prev, date: e.target.value }))}
                  aria-label="Flight date"
                  style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--text-primary)', fontSize: 14, minHeight: 44 }} />
                <input type="time" value={newTrip.time} onChange={e => setNewTrip(prev => ({ ...prev, time: e.target.value }))}
                  aria-label="Departure time"
                  style={{ width: 120, padding: '12px 14px', borderRadius: 10, background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--text-primary)', fontSize: 14, minHeight: 44 }} />
              </div>
              <input value={newTrip.name} onChange={e => setNewTrip(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Trip name (optional)" aria-label="Trip name"
                style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--text-primary)', fontSize: 14, minHeight: 44 }} />
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <MdButton variant="outlined" onClick={() => { setView('trips'); setEditingTripId(null); }} style={{ flex: 1, minHeight: 44 }}>Cancel</MdButton>
                <MdButton variant="filled" onClick={createTrip} style={{ flex: 1, minHeight: 44 }}>
                  {editingTripId ? 'Save Changes' : 'Create Flight'}
                </MdButton>
              </div>
            </div>
          </div>
        )}

        {/* Briefing view — P2: slide-in animation */}
        {view === 'briefing' && activeTrip && (() => {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', animation: 'slideInRight 0.3s ease' }}>
              {/* P2: iOS Pill Tab Bar (replaces Material underline tabs) */}
              <div className="ios-pill-tabs" role="tablist" aria-label="Briefing sections">
                {tabList.map(t => (
                  <button key={t.id} onClick={() => { setTab(t.id); triggerHaptic('light'); }}
                    className={'ios-pill-tab' + (tab === t.id ? ' active' : '')}
                    role="tab" aria-selected={tab === t.id} aria-label={t.label}>
                    <MdIcon name={t.icon} style={{ fontSize: 16 }} /> {t.label}
                  </button>
                ))}
              </div>

              {/* Trip info header */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--card-border-soft)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {fullRoute.map((rt, idx) => (
                    <React.Fragment key={idx}>
                      {idx > 0 && <MdIcon name="arrow_forward" style={{ fontSize: 14, color: 'var(--text-tertiary)' }} aria-hidden="true" />}
                      <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{rt}</span>
                    </React.Fragment>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500 }}>
                  {ac.name}
                  <span style={{ margin: '0 6px', opacity: 0.4 }}>·</span>
                  {activeTrip.date}
                </div>
              </div>

              {/* Tab content */}
              <div className="briefing-content" role="tabpanel" style={{ flex: 1, overflowY: 'auto', padding: 24, maxWidth: 900, margin: '0 auto', width: '100%' }}>
                {(tab === 'brief' || tab === 'export') && (
                  <WxErrorBoundary label="Flight Briefing">
                    <BriefingPanel trip={activeTrip} tab={tab}
                      user={user} personalMinimums={personalMinimums}
                      pendingAiPrompt={pendingAiPrompt}
                      onClearPendingPrompt={() => setPendingAiPrompt(null)}
                      onScoreUpdate={score => {
                        setActiveTrip(prev => prev ? { ...prev, goScore: score } : prev);
                        setTrips(prev => prev.map(t => t.id === activeTrip.id ? { ...t, goScore: score } : t));
                      }}
                      onFratUpdate={(answers, skipped) => {
                        setActiveTrip(prev => prev ? { ...prev, fratAnswers: answers, fratSkipped: skipped } : prev);
                        setTrips(prev => prev.map(t => t.id === activeTrip.id ? { ...t, fratAnswers: answers, fratSkipped: skipped } : t));
                      }} />
                  </WxErrorBoundary>
                )}
                {tab === 'wx' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {fullRoute.map((rt, idx) => {
                      const label = idx === 0 ? 'Departure' : idx === fullRoute.length - 1 ? 'Destination' : `Waypoint ${idx}`;
                      return (
                        <div key={idx}>
                          <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px', color: 'var(--text-secondary)', letterSpacing: '0.3px' }}>
                            {label} · {getAirport(rt)?.city || rt}
                          </h2>
                          <WeatherDetail icao={rt} label={label} isDecodedWx={isDecodedWx}
                            onAskAI={prompt => { setTab('brief'); setPendingAiPrompt(prompt); }} />
                          <WxErrorBoundary label={`Forecast Strip (${rt})`} compact>
                            <ForecastStrip icao={rt} selectedDay={forecastDay} onSelect={setForecastDay} />
                          </WxErrorBoundary>
                        </div>
                      );
                    })}
                    <WindyMap dep={activeTrip.dep} arr={activeTrip.arr} wps={activeTrip.wps || []} />
                  </div>
                )}
                {tab === 'maps' && (
                  <VfrChartsMap dep={activeTrip.dep} arr={activeTrip.arr} wps={activeTrip.wps || []} />
                )}
                {tab === 'runway' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {fullRoute.map((rt, idx) => (
                      <div key={idx}>
                        <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px', color: 'var(--text-secondary)', letterSpacing: '0.3px' }}>
                          Runways · {rt}
                        </h2>
                        <RunwayPanel icao={rt} />
                      </div>
                    ))}
                  </div>
                )}
                {tab === 'freq' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {fullRoute.map((rt, idx) => <FreqPanel key={idx} icao={rt} />)}
                  </div>
                )}
                {tab === 'fbo' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {fullRoute.map((rt, idx) => {
                      const label = idx === 0 ? 'Departure' : idx === fullRoute.length - 1 ? 'Destination' : `Waypoint ${idx}`;
                      return <FBOPanel key={idx} icao={rt} label={label} />;
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </main>

      {/* Scratchpad */}
      <Scratchpad />

      {/* Modals — P1: now using bottom sheet pattern */}
      {showLoginModal && <LoginScreen onClose={() => setShowLoginModal(false)} />}
      {showDataModal && <DataModal trips={trips} onImport={importTrips} onClose={() => setShowDataModal(false)} />}
      {showSettingsModal && <SettingsModal onClose={() => setShowSettingsModal(false)} />}
      {showProfileModal && <PilotProfileModal user={user} personalMinimums={personalMinimums}
        onSaveMinimums={setPersonalMinimums} onClose={() => setShowProfileModal(false)} />}

      {/* P1: iOS Action Sheet */}
      {actionSheet && (
        <IOSActionSheet
          title={actionSheet.title}
          message={actionSheet.message}
          actions={actionSheet.actions}
          onClose={() => setActionSheet(null)}
        />
      )}

      {/* P2: Context Menu */}
      {contextMenu && (
        <IOSContextMenu
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

/* ── Trip Card Component (extracted for swipe + context menu support) ── */
function TripCard({ trip, copiedTripId, onOpen, onEdit, onDelete, onDuplicate, onCopyLink, onTouchStart, onTouchEnd }) {
  const [swipeX, setSwipeX] = useState(0);
  const startX = useRef(0);
  const swiping = useRef(false);

  function handleTS(e) {
    startX.current = e.touches[0].clientX;
    swiping.current = false;
    onTouchStart(trip, e);
  }
  function handleTM(e) {
    const dx = startX.current - e.touches[0].clientX;
    if (dx > 15) {
      swiping.current = true;
      setSwipeX(Math.min(dx * 0.5, 80));
      onTouchEnd(); // cancel long-press if swiping
    }
  }
  function handleTE() {
    onTouchEnd();
    if (swipeX >= 65) {
      onDelete(trip.id);
    }
    setSwipeX(0);
    swiping.current = false;
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 16, marginBottom: 12 }}>
      {/* Swipe delete background */}
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 80,
        background: 'var(--nogo)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 13, fontWeight: 600, opacity: swipeX > 10 ? 1 : 0,
        transition: 'opacity 0.15s'
      }}>
        <MdIcon name="delete" style={{ fontSize: 22 }} />
      </div>

      <div
        role="button" tabIndex={0} aria-label={'Open flight ' + (trip.name || trip.dep + ' to ' + trip.arr)}
        onClick={() => !swiping.current && onOpen(trip)}
        onKeyDown={e => e.key === 'Enter' && onOpen(trip)}
        onTouchStart={handleTS}
        onTouchMove={handleTM}
        onTouchEnd={handleTE}
        style={{
          background: 'var(--card)', border: '1px solid var(--card-border)',
          borderRadius: 16, padding: '16px 18px',
          cursor: 'pointer', transition: swipeX > 0 ? 'none' : 'all 0.15s',
          transform: swipeX > 0 ? `translateX(-${swipeX}px)` : 'none',
          position: 'relative', zIndex: 1
        }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <GoScoreRing score={trip.goScore} size={42} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                {trip.name || (trip.dep + ' → ' + trip.arr)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {trip.dep} → {(trip.wps || []).length > 0 ? trip.wps.join(' → ') + ' → ' : ''}{trip.arr}
              </div>
            </div>
          </div>
          {/* P2: Inline actions hidden on mobile (use long-press instead), visible on desktop */}
          <div style={{ display: 'flex', gap: 2 }} className="header-icon-btns">
            <IconBtn icon="edit" onClick={e => onEdit(trip, e)} title="Edit" />
            <IconBtn icon={copiedTripId === trip.id ? 'check' : 'share'} onClick={e => onCopyLink(trip, e)} title="Share link" />
            <IconBtn icon="content_copy" onClick={e => onDuplicate(trip, e)} title="Duplicate" />
            <IconBtn icon="delete" onClick={e => { e.stopPropagation(); onDelete(trip.id); }} title="Delete" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-tertiary)' }}>
          <span>{(AIRCRAFT.find(a => a.id === trip.aircraft) || AIRCRAFT[0]).name}</span>
          {trip.date && <span>{trip.date}</span>}
          {trip.time && <span>{trip.time}</span>}
        </div>
      </div>
    </div>
  );
}
