import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MdIcon, MdButton, MdCard } from '../common';
import { GoScoreRing, CatBadge } from '../weather';
import ScoreBreakdown from './ScoreBreakdown';
import RouteTimeline from './RouteTimeline';
import LivePireps from './LivePireps';
import HazardAdvisories from './HazardAdvisories';
import WindsAloftCard from './WindsAloftCard';
import {
  fetchLiveMetar, fetchLiveTaf, fetchLiveNotams,
  fetchSigmets, fetchGairmets, fetchCwas, fetchWindsAloft,
  fetchNwsForecast, fetchEffectiveWxForTrip,
  windRegionForLon, lonToIanaTz, getTripTargetUtc,
  closestWindStation, getWindAtAlt, resolveAptCoords,
} from '../../services/weather';
import { callGeminiApi } from '../../services/ai';
import { getAirport, fetchAirportInfo } from '../../utils/airports';
import { AIRPORTS } from '../../data/airports';
import { getGoColor, calculateDensityAltitude } from '../../utils/weather';
import { makeMetar } from '../../utils/aviation';
import { calcDetailedScore, calcFratGoScore } from '../../utils/scoring';
import { calcDist, routeBboxFromPts, geojsonPolyInBbox } from '../../utils/geo';
import { checkPersonalMinimums } from '../../utils/personalMinimums';
import { AIRCRAFT } from '../../data/aircraft';
import { FRAT_QUESTIONS, FRAT_TOTAL, FRAT_CAT_MAX, FRAT_CAT_WEIGHT, FRAT_CAT_LABEL, FRAT_CAT_ICON } from '../../data/frat';

function parseTempDp(tempStr) {
  if (!tempStr || !tempStr.includes('/')) return { t: null, dp: null };
  function parseCelsius(s) {
    if (s == null || s === '' || s === '—') return null;
    const neg = String(s).startsWith('M');
    const val = parseFloat(String(s).replace('M', ''));
    return isNaN(val) ? null : (neg ? -val : val);
  }
  const parts = tempStr.split('/');
  return { t: parseCelsius(parts[0]), dp: parseCelsius(parts[1]) };
}

function parseAltInHg(altStr) {
  if (!altStr || !String(altStr).startsWith('A')) return null;
  const v = parseFloat(String(altStr).slice(1)) / 100;
  return isNaN(v) ? null : v;
}

export default function BriefingPanel({ trip, onScoreUpdate, onFratUpdate, tab, pendingAiPrompt, onClearPendingPrompt, user, personalMinimums }) {
  const [wxData, setWxData] = useState(null);
  const [loadingWx, setLoadingWx] = useState(true);
  const [nwsData, setNwsData] = useState({});
  const [effectiveWxData, setEffectiveWxData] = useState(null);

  // FRAT state
  const fratKey = 'flightscore_frat_' + trip.id;
  const [fratAnswers, setFratAnswers] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem(fratKey) || 'null');
      if (s && s.answers) return s.answers;
    } catch (e) {}
    return trip.fratAnswers || {};
  });
  const [fratSkipped, setFratSkipped] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem(fratKey) || 'null');
      if (s && s.skipped != null) return s.skipped;
    } catch (e) {}
    return trip.fratSkipped || false;
  });
  const [fratExpanded, setFratExpanded] = useState(false);

  // Persist FRAT to localStorage and notify parent
  useEffect(() => {
    try {
      localStorage.setItem(fratKey, JSON.stringify({ answers: fratAnswers, skipped: fratSkipped }));
    } catch (e) {}
    if (onFratUpdate) onFratUpdate(fratAnswers, fratSkipped);
  }, [fratAnswers, fratSkipped]);

  // AI state
  const briefingKey = 'skyview_ai_briefing_' + trip.id;
  const [aiResult, setAiResult] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem(briefingKey) || 'null');
      return s && s.result ? s.result : null;
    } catch (e) { return null; }
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [showAI, setShowAI] = useState(true);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);
  const chatInputRef = useRef(null);
  const [speaking, setSpeaking] = useState(false);

  // Advisory state
  const [sigmets, setSigmets] = useState([]);
  const [gairmets, setGairmets] = useState([]);
  const [cwas, setCwas] = useState([]);
  const [windsAloft, setWindsAloft] = useState([]);
  const [loadingAdvisory, setLoadingAdvisory] = useState(true);
  const [notamsByAirport, setNotamsByAirport] = useState({});

  useEffect(() => {
    if (!aiResult) return;
    try {
      localStorage.setItem(briefingKey, JSON.stringify({ result: aiResult, savedAt: Date.now() }));
    } catch (e) {}
  }, [aiResult]);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('skyview_ai_briefing_' + trip.id) || 'null');
      setAiResult(s && s.result ? s.result : null);
    } catch (e) { setAiResult(null); }
    setAiError(null);
  }, [trip.id]);

  // Inject pending AI prompt
  useEffect(() => {
    if (!pendingAiPrompt) return;
    setShowAI(true);
    setChatInput(pendingAiPrompt);
    if (onClearPendingPrompt) onClearPendingPrompt();
  }, [pendingAiPrompt]);

  const ac = AIRCRAFT.find(a => a.id === trip.aircraft) || AIRCRAFT[0];
  const allRoutePts = useMemo(() =>
    [trip.dep, ...(trip.wps || []), trip.arr],
    [trip.dep, trip.arr, JSON.stringify(trip.wps)]
  );

  const tripTargetUtc = useMemo(() => {
    const apt = getAirport(trip.dep);
    return getTripTargetUtc(trip, apt ? (apt.tz || lonToIanaTz(apt.lon)) : 'America/New_York');
  }, [trip.dep, trip.date, trip.time]);

  const routeDist = useMemo(() => {
    let d = 0;
    for (let i = 0; i < allRoutePts.length - 1; i++) {
      const p1 = getAirport(allRoutePts[i]), p2 = getAirport(allRoutePts[i + 1]);
      if (p1 && p2) d += calcDist(p1.lat, p1.lon, p2.lat, p2.lon);
    }
    return Math.round(d);
  }, [allRoutePts]);

  const eteStr = useMemo(() => {
    if (!routeDist || !ac || !ac.kts) return '--';
    const h = routeDist / ac.kts;
    return Math.floor(h) + 'h ' + Math.round((h % 1) * 60) + 'm';
  }, [routeDist, ac]);

  const hoursUntilTrip = useMemo(() => {
    if (!tripTargetUtc) return null;
    return (tripTargetUtc.getTime() - Date.now()) / 3600000;
  }, [tripTargetUtc]);

  // Fetch weather
  useEffect(() => {
    setLoadingWx(true);
    setWxData(null);
    Promise.all(allRoutePts.map(async icao => {
      const [m, t] = await Promise.all([fetchLiveMetar(icao), fetchLiveTaf(icao)]).catch(() => [null, null]);
      const metarLive = !!m;
      const metar = m || makeMetar(icao);
      return { icao, metar, taf: t, metarLive };
    })).then(data => { setWxData(data); setLoadingWx(false); })
      .catch(() => setLoadingWx(false));
  }, [allRoutePts.join(',')]);

  // Fetch NWS
  useEffect(() => {
    setNwsData({});
    Promise.all(allRoutePts.map(async icao => {
      const a = await resolveAptCoords(icao).catch(() => null);
      if (!a) return [icao, null];
      const nws = await fetchNwsForecast(a.lat, a.lon).catch(() => null);
      return [icao, nws];
    })).then(entries => {
      const result = {};
      entries.forEach(([icao, nws]) => { if (nws) result[icao] = nws; });
      setNwsData(result);
    }).catch(() => setNwsData({}));
  }, [allRoutePts.join(',')]);

  // Fetch advisories
  useEffect(() => {
    setLoadingAdvisory(true);
    const aptPts = allRoutePts.map(getAirport).filter(Boolean);
    const bb = aptPts.length ? routeBboxFromPts(aptPts, 3) : null;
    const midLon = aptPts.length ? aptPts.reduce((s, a) => s + a.lon, 0) / aptPts.length : -90;
    const region = windRegionForLon(midLon);
    Promise.all([fetchSigmets(), fetchGairmets(), fetchCwas(), fetchWindsAloft(region)])
      .then(([rawSig, rawG, rawC, rawW]) => {
        if (bb) {
          setSigmets(rawSig.filter(f => f.geometry && geojsonPolyInBbox(f.geometry.coordinates, bb)));
          setGairmets(rawG.filter(f => f.geometry && geojsonPolyInBbox(f.geometry.coordinates, bb)));
          setCwas(rawC);
        } else {
          setSigmets(rawSig);
          setGairmets(rawG);
          setCwas(rawC);
        }
        setWindsAloft(Array.isArray(rawW) ? rawW : []);
        setLoadingAdvisory(false);
      }).catch(() => setLoadingAdvisory(false));
  }, [allRoutePts.join(',')]);

  // Fetch NOTAMs
  useEffect(() => {
    const pts = allRoutePts.filter(Boolean);
    Promise.all(pts.map(icao =>
      fetchLiveNotams(icao).then(data => ({ icao, data: data || [] })).catch(() => ({ icao, data: [] }))
    )).then(results => {
      const byApt = {};
      results.forEach(r => { byApt[r.icao] = r.data; });
      setNotamsByAirport(byApt);
    });
  }, [trip.id]);

  // Fetch effective weather for scoring
  useEffect(() => {
    fetchEffectiveWxForTrip(trip, allRoutePts).then(data => {
      setEffectiveWxData(data);
    }).catch(() => setEffectiveWxData(null));
  }, [trip.dep, trip.arr, trip.date, trip.time, JSON.stringify(trip.wps)]);

  // Calculate scores
  const detailedScore = useMemo(() => {
    if (!effectiveWxData || effectiveWxData.length === 0) return null;
    return calcDetailedScore(effectiveWxData, routeDist);
  }, [effectiveWxData, routeDist]);

  const fratDone = FRAT_QUESTIONS.filter(q => fratAnswers[q.id] !== undefined).length === FRAT_TOTAL;
  const fratScore = fratDone ? calcFratGoScore(fratAnswers) : null;

  const combinedScore = useMemo(() => {
    if (!detailedScore) return null;
    const ws = detailedScore.total;
    if (fratDone && fratScore !== null) {
      return Math.max(0, Math.min(100, Math.round(ws * 0.70 + fratScore * 0.30)));
    }
    return Math.max(0, ws - 20);
  }, [detailedScore, fratDone, fratScore]);

  const minimumsCheck = useMemo(() => {
    if (!effectiveWxData) return null;
    return checkPersonalMinimums(effectiveWxData, personalMinimums, tripTargetUtc);
  }, [effectiveWxData, personalMinimums, tripTargetUtc]);

  const finalDisplayScore = useMemo(() => {
    let score = combinedScore;
    if (score === null) return null;
    if (minimumsCheck && minimumsCheck.penalty > 0) {
      score = Math.max(0, score - minimumsCheck.penalty);
    }
    if (detailedScore && detailedScore.scoreCap !== null && detailedScore.scoreCap !== undefined) {
      score = Math.min(detailedScore.scoreCap, score);
    }
    return score;
  }, [combinedScore, minimumsCheck, detailedScore]);

  // Notify parent of score updates
  useEffect(() => {
    if (finalDisplayScore !== null && onScoreUpdate) {
      onScoreUpdate(finalDisplayScore);
    }
  }, [finalDisplayScore]);

  // Analysis verdict
  const analysis = useMemo(() => {
    const score = finalDisplayScore ?? combinedScore;
    if (score === null) return null;
    let verdict, verdictDesc;
    if (score >= 80) { verdict = 'GO'; verdictDesc = 'Conditions are favorable for flight.'; }
    else if (score >= 50) { verdict = 'CAUTION'; verdictDesc = 'Marginal conditions — review weather carefully and consider alternatives.'; }
    else { verdict = 'NO-GO'; verdictDesc = 'Conditions are unfavorable for safe flight.'; }
    return { verdict, verdictDesc, recs: [] };
  }, [finalDisplayScore, combinedScore]);

  // AI briefing
  const runAiBriefing = useCallback(async (force) => {
    if (!wxData || wxData.length === 0) return;
    setAiLoading(true);
    setAiError(null);

    const wxSummary = wxData.map(w => {
      const m = w.metar;
      return w.icao + ': ' + (m ? (m.cat || 'VFR') + ' wind=' + (m.wind || 'calm') + ' vis=' + (m.vis || 'P6SM') + ' sky=' + (m.sky || 'CLR') : 'no data');
    }).join('\n');

    const nwsSummary = Object.entries(nwsData).map(([icao, days]) => {
      if (!days || !days.length) return '';
      return icao + ' NWS: ' + days.slice(0, 3).map(d => d.dateStr + ' ' + (d.shortForecast || '') + ' hi=' + d.hi + ' wind=' + d.ws + 'mph cat=' + d.cat).join('; ');
    }).filter(Boolean).join('\n');

    const effectiveSummary = effectiveWxData ? effectiveWxData.map(e => {
      const wx = e.effectiveWx;
      return e.icao + ' [' + (e.sourceLabel || e.source) + ']: ' + (wx ? wx.cat + ' wind=' + wx.wind + ' vis=' + wx.vis + ' sky=' + wx.sky : 'no data');
    }).join('\n') : '';

    const prompt = [
      `Flight: ${ac.name} (${ac.id}) ${allRoutePts.join(' → ')}`,
      `Date: ${trip.date} Time: ${trip.time} local`,
      `Route distance: ${routeDist}nm ETE: ${eteStr}`,
      `Hours until departure: ${hoursUntilTrip !== null ? hoursUntilTrip.toFixed(1) : 'unknown'}`,
      '', '--- Live METAR/TAF Data ---', wxSummary,
      nwsSummary ? '\n--- NWS 7-Day Forecasts ---\n' + nwsSummary : '',
      effectiveSummary ? '\n--- Effective Weather Used for Scoring ---\n' + effectiveSummary : '',
      sigmets.length ? '\n--- SIGMETs ---\n' + sigmets.map(s => JSON.stringify(s)).join('\n') : '',
      gairmets.length ? '\n--- G-AIRMETs ---\n' + gairmets.map(g => JSON.stringify(g)).join('\n') : '',
      `\nSafety Score: ${finalDisplayScore ?? combinedScore ?? 'N/A'}/100`,
    ].filter(Boolean).join('\n');

    const BRIEFING_SYSTEM = [
      "You are a certified aviation weather briefer (FSS-level).",
      "Structure response with: **ROUTE OVERVIEW**, **SYNOPTIC OVERVIEW**, **DEPARTURE CONDITIONS**, **EN ROUTE CONDITIONS**, **DESTINATION CONDITIONS**, **WINDS ALOFT**, **HAZARDS SUMMARY**, **GO/NO-GO ASSESSMENT**, **RECOMMENDED ACTIONS / CONTINGENCIES**.",
      "Decode all METARs/TAFs fully. Be specific with numbers. NEVER say 'no data provided'.",
    ].join('\n');

    try {
      const data = await callGeminiApi({
        system: BRIEFING_SYSTEM,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000,
        apiKey: null
      });
      const text = typeof data === 'string' ? data : data?.content?.[0]?.text || '';
      if (!text) throw new Error('Empty response');
      setAiResult(text);
    } catch (e) {
      setAiError('Briefing failed: ' + (e.message || 'Please try again.'));
    } finally {
      setAiLoading(false);
    }
  }, [trip, wxData, nwsData, effectiveWxData, hoursUntilTrip]);

  // Auto-run AI briefing when weather loads
  useEffect(() => {
    if (wxData && wxData.length > 0 && !aiResult && !aiLoading && tab === 'brief') {
      runAiBriefing(false);
    }
  }, [wxData, tab]);

  // Chat
  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    const updated = [...chatMessages, { role: 'user', content: userMsg }];
    setChatMessages(updated);
    setChatLoading(true);
    const wxSummary = effectiveWxData ? effectiveWxData.map(e => {
      const wx = e.effectiveWx;
      return wx ? (e.icao + ': ' + wx.cat + ' wind=' + wx.wind + ' vis=' + wx.vis) : (e.icao + ': no data');
    }).join('; ') : 'No weather data';
    try {
      const data = await callGeminiApi({
        system: 'Aviation weather assistant for ' + allRoutePts.join('→') + '. Score: ' + (finalDisplayScore ?? 'N/A') + '. Wx: ' + wxSummary,
        messages: updated.map(m => ({ role: m.role, content: m.content })),
        max_tokens: 1200, apiKey: null
      });
      const reply = typeof data === 'string' ? data : data?.content?.[0]?.text || 'No response.';
      setChatMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Error: ' + e.message }]);
    } finally { setChatLoading(false); }
  }, [chatInput, chatMessages, effectiveWxData, allRoutePts, chatLoading, finalDisplayScore]);

  function speakBriefing() {
    if (!window.speechSynthesis) return;
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const text = aiResult ? aiResult.replace(/\*\*/g, '').replace(/\*/g, '') : 'No briefing available.';
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.95;
    utt.onend = () => setSpeaking(false);
    utt.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utt);
  }

  const aiSections = useMemo(() => {
    if (!aiResult) return [];
    const out = [];
    let current = null;
    const validHeaders = [
      'ROUTE OVERVIEW', 'SYNOPTIC OVERVIEW', 'DEPARTURE CONDITIONS',
      'EN ROUTE CONDITIONS', 'DESTINATION CONDITIONS', 'WINDS ALOFT',
      'HAZARDS SUMMARY', 'GO/NO-GO ASSESSMENT', 'RECOMMENDED ACTIONS / CONTINGENCIES'
    ];
    aiResult.split('\n').forEach(line => {
      const cleanLine = line.replace(/\*/g, '').trim();
      if (validHeaders.includes(cleanLine)) {
        if (current) out.push(current);
        current = { title: cleanLine, body: '' };
      } else if (current) {
        current.body += line + '\n';
      }
    });
    if (current) out.push(current);
    return out;
  }, [aiResult]);

  const sectionMeta = {
    'ROUTE OVERVIEW': { icon: 'route', color: 'var(--accent)' },
    'SYNOPTIC OVERVIEW': { icon: 'public', color: 'var(--text-secondary)' },
    'DEPARTURE CONDITIONS': { icon: 'flight_takeoff', color: 'var(--accent)' },
    'EN ROUTE CONDITIONS': { icon: 'linear_scale', color: 'var(--text-secondary)' },
    'DESTINATION CONDITIONS': { icon: 'flight_land', color: 'var(--accent)' },
    'WINDS ALOFT': { icon: 'air', color: 'var(--text-secondary)' },
    'HAZARDS SUMMARY': { icon: 'warning', color: 'var(--nogo)' },
    'GO/NO-GO ASSESSMENT': { icon: 'check_circle', color: 'var(--accent)' },
    'RECOMMENDED ACTIONS / CONTINGENCIES': { icon: 'tips_and_updates', color: 'var(--accent)' }
  };

  // Build score breakdown for display
  const augBreakdown = useMemo(() => {
    if (!detailedScore) return [];
    let bd = [...(detailedScore.breakdown || [])];
    if (fratDone && fratScore !== null) {
      const fsColor = fratScore >= 80 ? 'var(--go)' : fratScore >= 50 ? 'var(--caution)' : 'var(--nogo)';
      bd.push({
        label: 'FRAT Assessment', score: fratScore, max: 100, color: fsColor, icon: 'checklist_rtl',
        detail: 'FRAT score ' + fratScore + '/100 — 30% weight blended with weather (70%)'
      });
    }
    if (minimumsCheck) {
      const mPenalty = minimumsCheck.penalty;
      bd.push({
        label: 'Personal Minimums', score: Math.max(0, 50 - mPenalty), max: 50,
        color: minimumsCheck.color, icon: 'person', detail: minimumsCheck.detail,
        isPenalty: true, penaltyAmount: mPenalty
      });
    }
    return bd;
  }, [detailedScore, fratDone, fratScore, minimumsCheck]);

  const displayTotal = finalDisplayScore ?? combinedScore ?? (detailedScore ? detailedScore.total : null);

  // Export tab
  if (tab === 'export') {
    if (loadingWx) {
      return (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-secondary)' }}>
          <MdIcon name="sync" style={{ fontSize: 40, animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 12px' }} />
          <div style={{ fontSize: 14 }}>Loading weather data for briefing…</div>
        </div>
      );
    }
    return (
      <div style={{ padding: 20 }}>
        <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 16, padding: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>NavLog / Preflight Briefing</h2>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
            {allRoutePts.join(' → ')} · {ac.name} · {trip.date} {trip.time}L
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Distance: {routeDist}nm · ETE: {eteStr} · Score: {displayTotal ?? '--'}/100
          </div>
          {effectiveWxData && effectiveWxData.map(e => (
            <div key={e.icao} style={{ marginBottom: 12, padding: 12, background: 'var(--card-mid)', borderRadius: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{e.icao} ({e.sourceLabel || e.source})</div>
              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                {e.effectiveWx ? `${e.effectiveWx.cat} · wind=${e.effectiveWx.wind} vis=${e.effectiveWx.vis} sky=${e.effectiveWx.sky}` : 'No data'}
              </div>
            </div>
          ))}
          {aiResult && (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>AI Briefing</h3>
              <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                {aiResult}
              </div>
            </div>
          )}
          <MdButton variant="outlined" icon="print" onClick={() => window.print()} style={{ marginTop: 16 }}>
            Print Briefing
          </MdButton>
        </div>
      </div>
    );
  }

  // Loading state
  if (loadingWx) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-secondary)' }}>
        <MdIcon name="sync" style={{ fontSize: 40, animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 12px' }} />
        <div style={{ fontSize: 14 }}>Loading weather data…</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Score card */}
      {displayTotal !== null && (
        <ScoreBreakdown breakdown={augBreakdown} total={displayTotal} />
      )}

      {/* Trip details */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <GoScoreRing score={displayTotal} size={56} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>
              {trip.name || (trip.dep + ' → ' + trip.arr)}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {routeDist}nm · {eteStr} · {ac.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {trip.date} {trip.time}L
              {hoursUntilTrip !== null && (
                <span> · {hoursUntilTrip > 0 ? `in ${Math.round(hoursUntilTrip)}h` : 'now/past'}</span>
              )}
            </div>
          </div>
        </div>

        {/* Verdict banner */}
        {analysis && (
          <div style={{
            padding: '10px 14px', borderRadius: 10, marginBottom: 8,
            background: analysis.verdict === 'GO' ? 'rgba(52,199,89,0.15)' :
                       analysis.verdict === 'CAUTION' ? 'rgba(255,149,0,0.15)' : 'rgba(255,59,48,0.15)',
            color: analysis.verdict === 'GO' ? 'var(--go)' :
                  analysis.verdict === 'CAUTION' ? 'var(--caution)' : 'var(--nogo)',
            fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8
          }}>
            <MdIcon name={analysis.verdict === 'GO' ? 'check_circle' : analysis.verdict === 'CAUTION' ? 'warning' : 'cancel'} style={{ fontSize: 20 }} />
            {analysis.verdict} — {analysis.verdictDesc}
          </div>
        )}
      </div>

      {/* Route Timeline */}
      <RouteTimeline trip={trip} wxData={wxData} effectiveWxData={effectiveWxData} />

      {/* Hazard Advisories */}
      {!loadingAdvisory && (sigmets.length > 0 || gairmets.length > 0 || cwas.length > 0) && (
        <HazardAdvisories sigmets={sigmets} gairmets={gairmets} cwas={cwas} />
      )}

      {/* Winds Aloft */}
      {windsAloft.length > 0 && (
        <WindsAloftCard windsAloft={windsAloft} allRoutePts={allRoutePts} ac={ac} />
      )}

      {/* Live PIREPs */}
      <LivePireps allRoutePts={allRoutePts} />

      {/* FRAT Assessment */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
          onClick={() => setFratExpanded(!fratExpanded)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MdIcon name="checklist_rtl" style={{ color: 'var(--accent)', fontSize: 16 }} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--text-secondary)' }}>
              FRAT Assessment
            </span>
            <span style={{ fontSize: 12, color: fratDone ? 'var(--go)' : 'var(--text-tertiary)' }}>
              {FRAT_QUESTIONS.filter(q => fratAnswers[q.id] !== undefined).length}/{FRAT_TOTAL}
              {fratSkipped && ' (skipped)'}
            </span>
          </div>
          <MdIcon name={fratExpanded ? 'expand_less' : 'expand_more'} style={{ fontSize: 20, color: 'var(--text-secondary)' }} />
        </div>
        {fratExpanded && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FRAT_QUESTIONS.map(q => (
              <div key={q.id} style={{
                padding: '10px 14px', borderRadius: 10,
                background: fratAnswers[q.id] !== undefined ? 'var(--card-high)' : 'var(--card-mid)',
                border: '1px solid var(--card-border-soft)'
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{q.label}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {q.opts.map(opt => (
                    <button key={opt.l} onClick={() => {
                      setFratAnswers(prev => ({ ...prev, [q.id]: opt.p }));
                    }} style={{
                      padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.15s',
                      background: fratAnswers[q.id] === opt.p ? 'var(--accent)' : 'var(--card)',
                      color: fratAnswers[q.id] === opt.p ? '#fff' : 'var(--text-secondary)',
                      border: '1px solid ' + (fratAnswers[q.id] === opt.p ? 'var(--accent)' : 'var(--card-border)')
                    }}>
                      {opt.l} ({opt.p}pt{opt.p !== 1 ? 's' : ''})
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <MdButton variant="text" onClick={() => { setFratAnswers({}); setFratSkipped(false); }}>Reset</MdButton>
              <MdButton variant="text" onClick={() => setFratSkipped(true)}>Skip FRAT</MdButton>
            </div>
          </div>
        )}
      </div>

      {/* AI Briefing */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showAI ? 12 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setShowAI(!showAI)}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MdIcon name="auto_awesome" style={{ color: 'var(--accent)', fontSize: 16 }} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--text-secondary)' }}>
              AI Weather Briefing
            </span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <IconBtn icon={speaking ? 'stop' : 'volume_up'} onClick={speakBriefing} title={speaking ? 'Stop' : 'Read aloud'} />
            <IconBtn icon="refresh" onClick={() => runAiBriefing(true)} title="Regenerate" />
            <MdIcon name={showAI ? 'expand_less' : 'expand_more'} style={{ fontSize: 20, color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setShowAI(!showAI)} />
          </div>
        </div>

        {showAI && (
          <>
            {aiLoading && (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-secondary)' }}>
                <MdIcon name="sync" style={{ fontSize: 24, animation: 'spin 1s linear infinite' }} />
                <div style={{ fontSize: 13, marginTop: 8 }}>Generating briefing…</div>
              </div>
            )}
            {aiError && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,59,48,0.1)', color: 'var(--nogo)', fontSize: 13, marginBottom: 12 }}>
                {aiError}
              </div>
            )}
            {aiSections.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {aiSections.map((sec, idx) => {
                  const meta = sectionMeta[sec.title] || { icon: 'info', color: 'var(--text-secondary)' };
                  return (
                    <div key={idx} style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--card-mid)', border: '1px solid var(--card-border-soft)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <MdIcon name={meta.icon} style={{ fontSize: 16, color: meta.color }} />
                        <span style={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', color: meta.color }}>{sec.title}</span>
                      </div>
                      <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                        {sec.body.trim()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Chat */}
            <div style={{ marginTop: 16 }}>
              {chatMessages.length > 0 && (
                <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} style={{
                      padding: '8px 12px', borderRadius: 10, fontSize: 13, lineHeight: 1.5,
                      background: msg.role === 'user' ? 'var(--accent-dim)' : 'var(--card-mid)',
                      color: 'var(--text-primary)', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '85%', whiteSpace: 'pre-wrap'
                    }}>
                      {msg.content}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <input ref={chatInputRef} value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendChat()}
                  placeholder="Ask about this flight's weather…"
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: 10,
                    background: 'var(--card-mid)', border: '1px solid var(--card-border)',
                    color: 'var(--text-primary)', fontSize: 13, outline: 'none'
                  }} />
                <MdButton variant="filled" icon={chatLoading ? 'sync' : 'send'} onClick={sendChat}
                  disabled={chatLoading} style={{ borderRadius: 10, padding: '10px 14px' }} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const IconBtn = ({ icon, onClick, title, active, style: s }) => (
  <button onClick={onClick} title={title} style={{
    background: active ? 'var(--accent-dim)' : 'none',
    border: '1px solid ' + (active ? 'rgba(10,132,255,0.3)' : 'transparent'),
    borderRadius: 8, padding: 6, cursor: 'pointer', lineHeight: 1,
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...s
  }}>
    <MdIcon name={icon} style={{ fontSize: 18 }} />
  </button>
);
