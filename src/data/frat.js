export const FRAT_QUESTIONS = [
    // -- P: Pilot (35%) --
    { id:'P1', cat:'P', label:'Flight Currency (most recent flight)',
      opts:[{l:'Within last 7 days',p:0},{l:'8\u201314 days ago',p:1},{l:'15\u201330 days ago',p:3},{l:'31\u201390 days ago',p:5},{l:'More than 90 days ago',p:8}] },
    { id:'P2', cat:'P', label:'Currency in Aircraft Type (SR22)',
      opts:[{l:'Flown this type in last 30 days',p:0},{l:'Flown this type in last 60 days',p:2},{l:'Flown this type in last 90 days',p:4},{l:'Not flown this type in 90+ days',p:7}] },
    { id:'P3', cat:'P', label:'Night Currency (skip if day VFR)',
      opts:[{l:'Current night (3 T/Os & landings in last 90 days)',p:0},{l:'Not current night \u2014 flight is daytime',p:0},{l:'Not current night \u2014 flight includes night portion',p:6}] },
    { id:'P4', cat:'P', label:'IFR Currency (skip if VFR flight)',
      opts:[{l:'Current IFR (6 approaches in last 6 months)',p:0},{l:'Not required \u2014 VFR flight',p:0},{l:'IFR required, not current \u2014 filed with safety pilot',p:3},{l:'IFR required, not current \u2014 flying solo',p:8}] },
    { id:'P5', cat:'P', label:'Pilot Physical / Physiological State (IMSAFE)',
      hint:'Illness \u00b7 Medication \u00b7 Stress \u00b7 Alcohol \u00b7 Fatigue \u00b7 Emotion',
      opts:[{l:'All IMSAFE items checked \u2014 feeling good',p:0},{l:'Minor concern (mild fatigue, slight congestion)',p:2},{l:'Moderate concern (poor sleep, stress, medications)',p:5},{l:'Significant concern (fatigue, illness, emotional distress)',p:9}] },
    { id:'P6', cat:'P', label:'Total Pilot Experience',
      opts:[{l:'500+ hours',p:0},{l:'200\u2013499 hours',p:1},{l:'100\u2013199 hours',p:3},{l:'50\u201399 hours',p:5},{l:'Under 50 hours',p:7}] },
    { id:'P7', cat:'P', label:'Familiarity with Route / Destination',
      opts:[{l:'Flown this route before, familiar with destination',p:0},{l:'New route but familiar with similar terrain/airspace',p:1},{l:'Unfamiliar route and/or new airport',p:3},{l:'Unfamiliar route, complex airspace, or high-elevation destination',p:5}] },
    // -- A: Aircraft (25%) --
    { id:'A1', cat:'A', label:'Aircraft Airworthiness Status',
      opts:[{l:'All systems normal, no open squawks',p:0},{l:'Minor deferred item (MEL/MMEL; legal to fly)',p:2},{l:'Recent maintenance performed (within 10 hours)',p:2},{l:'Open question about airworthiness',p:8}] },
    { id:'A2', cat:'A', label:'Aircraft Currency for Intended Flight',
      opts:[{l:'IFR certified and current (pitot-static, transponder current)',p:0},{l:'VFR only / VFR flight only intended',p:0},{l:'IFR flight intended but IFR currency check overdue',p:7}] },
    { id:'A3', cat:'A', label:'Fuel State / Fuel Planning',
      opts:[{l:'Full tanks + reserve exceeds FAA minimum by 45+ min',p:0},{l:'Meets FAA reserve requirements + 30 min margin',p:1},{l:'Meets FAA minimum reserve only',p:4},{l:'Fuel planning not confirmed',p:8}] },
    { id:'A4', cat:'A', label:'Weight & Balance / Performance',
      opts:[{l:'W&B calculated, within limits with margin',p:0},{l:'W&B estimated, likely within limits',p:2},{l:'Not calculated',p:5},{l:'Near limits or exceeding in any category',p:9}] },
    // -- V: enVironment (25%) --
    { id:'V1', cat:'V', label:'Weather Complexity at Departure', auto:true,
      opts:[{l:'VFR \u2014 clear of clouds, good visibility',p:0},{l:'MVFR \u2014 marginal but comfortable',p:2},{l:'IFR \u2014 in actual IMC on departure',p:5},{l:'LIFR or rapidly changing conditions',p:9}] },
    { id:'V2', cat:'V', label:'En Route Weather', auto:true,
      opts:[{l:'Clear or scattered, no significant weather',p:0},{l:'Some clouds or reduced visibility en route',p:2},{l:'Embedded convection, icing, or heavy IMC en route',p:7},{l:'SIGMETs or AIRMETs for severe icing/turbulence/convection',p:10}] },
    { id:'V3', cat:'V', label:'Destination Weather at ETA', auto:true,
      opts:[{l:'VFR forecast at ETA',p:0},{l:'MVFR forecast at ETA',p:2},{l:'IFR forecast at ETA',p:4},{l:'LIFR or below minimums forecast at ETA',p:8}] },
    { id:'V4', cat:'V', label:'Alternate Airport Availability',
      opts:[{l:'Alternate available and VFR/better',p:0},{l:'Alternate available and IFR',p:2},{l:'No practical alternate within range',p:6}] },
    { id:'V5', cat:'V', label:'Terrain / Special Use Airspace',
      opts:[{l:'Flat terrain, no special airspace concerns',p:0},{l:'Some terrain or TFRs in the area',p:1},{l:'Mountain terrain, complex airspace, or overwater',p:3},{l:'High terrain + IMC, or ADIZ crossing',p:6}] },
    // -- E: External Pressures (15%) --
    { id:'E1', cat:'E', label:'Schedule / Time Pressure',
      opts:[{l:'No time pressure \u2014 can delay or cancel freely',p:0},{l:'Mild preference to arrive on time',p:2},{l:'Moderate pressure (meeting, commitment)',p:4},{l:'Strong pressure (must arrive \u2014 wedding, medical, etc.)',p:7}] },
    { id:'E2', cat:'E', label:'Passenger Expectations',
      opts:[{l:'No passengers, or passengers understand weather delays',p:0},{l:'Passengers present but flexible',p:1},{l:'Passengers present with expectations; reluctant to cancel',p:4},{l:'Significant pressure from passengers to fly',p:7}] },
    { id:'E3', cat:'E', label:'Continuation Bias Check',
      opts:[{l:'I would comfortably cancel this flight if conditions changed',p:0},{l:"I'd probably push through minor issues",p:3},{l:'I feel committed to this flight regardless of new information',p:7}] },
];

export const FRAT_CAT_MAX    = { P:45, A:29, V:30, E:21 };
export const FRAT_CAT_WEIGHT = { P:0.35, A:0.25, V:0.25, E:0.15 };
export const FRAT_CAT_LABEL  = { P:'Pilot', A:'Aircraft', V:'Environment', E:'External Pressures' };
export const FRAT_CAT_ICON   = { P:'person', A:'flight', V:'cloud', E:'schedule' };
export const FRAT_TOTAL = FRAT_QUESTIONS.length; // 19
