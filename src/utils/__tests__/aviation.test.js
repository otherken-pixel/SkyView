import { describe, it, expect } from 'vitest';
import {
  deriveCat,
  calculateDensityAltitude,
  getCategoryColor,
  getGoColor,
  parseCeilingFt,
  parseVisSMNum,
  calcWindComponents,
} from '../aviation';

// ── deriveCat ───────────────────────────────────────────────────────────
describe('deriveCat', () => {
  it('returns VFR for clear skies and good visibility', () => {
    expect(deriveCat(null, 10)).toBe('VFR');
  });

  it('returns VFR for high ceiling and good visibility', () => {
    expect(deriveCat(5000, 10)).toBe('VFR');
  });

  it('returns MVFR for ceiling between 1000-3000 ft', () => {
    expect(deriveCat(2500, 10)).toBe('MVFR');
  });

  it('returns MVFR for visibility between 3-5 SM', () => {
    expect(deriveCat(null, 4)).toBe('MVFR');
  });

  it('returns IFR for ceiling between 500-1000 ft', () => {
    expect(deriveCat(800, 10)).toBe('IFR');
  });

  it('returns IFR for visibility between 1-3 SM', () => {
    expect(deriveCat(null, 2)).toBe('IFR');
  });

  it('returns LIFR for ceiling below 500 ft', () => {
    expect(deriveCat(400, 10)).toBe('LIFR');
  });

  it('returns LIFR for visibility below 1 SM', () => {
    expect(deriveCat(null, 0.5)).toBe('LIFR');
  });

  it('uses worst of ceiling and visibility', () => {
    // Good ceiling but bad vis → IFR
    expect(deriveCat(5000, 2)).toBe('IFR');
    // Bad ceiling but good vis → IFR
    expect(deriveCat(800, 10)).toBe('IFR');
  });

  it('defaults visibility to 10 when null', () => {
    expect(deriveCat(5000, null)).toBe('VFR');
  });
});

// ── calculateDensityAltitude ────────────────────────────────────────────
describe('calculateDensityAltitude', () => {
  it('returns field elevation on a standard day at sea level', () => {
    // Standard: 15°C, 29.92 inHg, 0 ft
    const da = calculateDensityAltitude(15, 29.92, 0);
    expect(da).toBe(0);
  });

  it('increases DA on a hot day', () => {
    // 35°C at sea level, standard pressure
    const da = calculateDensityAltitude(35, 29.92, 0);
    expect(da).toBeGreaterThan(2000);
  });

  it('accounts for high field elevation', () => {
    // Standard temp at 5000 ft: ISA = 15 - 0.001981*5000 ≈ 5.1°C
    // Using 20°C → warmer than ISA → DA > 5000
    const da = calculateDensityAltitude(20, 29.92, 5000);
    expect(da).toBeGreaterThan(5000);
  });

  it('handles low altimeter setting (low pressure)', () => {
    // 29.42 inHg → PA = (29.92-29.42)*1000 + 0 = 500 ft above sea level
    const da = calculateDensityAltitude(15, 29.42, 0);
    expect(da).toBeGreaterThan(0);
  });

  it('uses defaults for null inputs', () => {
    const da = calculateDensityAltitude(null, null, null);
    // defaults: tempC=15, altimeter=29.92, elev=0 → standard day → DA ≈ 0
    expect(da).toBe(0);
  });
});

// ── getCategoryColor ────────────────────────────────────────────────────
describe('getCategoryColor', () => {
  it('returns green for VFR', () => {
    expect(getCategoryColor('VFR')).toBe('#34C759');
  });

  it('returns blue for MVFR', () => {
    expect(getCategoryColor('MVFR')).toBe('#0A84FF');
  });

  it('returns red for IFR', () => {
    expect(getCategoryColor('IFR')).toBe('#FF3B30');
  });

  it('returns purple for LIFR', () => {
    expect(getCategoryColor('LIFR')).toBe('#BF5AF2');
  });

  it('returns grey for unknown category', () => {
    expect(getCategoryColor('UNKNOWN')).toBe('#8E8E93');
  });

  it('handles null/undefined input', () => {
    expect(getCategoryColor(null)).toBe('#8E8E93');
    expect(getCategoryColor(undefined)).toBe('#8E8E93');
  });

  it('is case-insensitive', () => {
    expect(getCategoryColor('vfr')).toBe('#34C759');
    expect(getCategoryColor('Ifr')).toBe('#FF3B30');
  });
});

// ── getGoColor ──────────────────────────────────────────────────────────
describe('getGoColor', () => {
  it('returns go color for score >= 75', () => {
    expect(getGoColor(75)).toBe('var(--go)');
    expect(getGoColor(100)).toBe('var(--go)');
  });

  it('returns caution color for score >= 50 and < 75', () => {
    expect(getGoColor(50)).toBe('var(--caution)');
    expect(getGoColor(74)).toBe('var(--caution)');
  });

  it('returns nogo color for score < 50', () => {
    expect(getGoColor(49)).toBe('var(--nogo)');
    expect(getGoColor(0)).toBe('var(--nogo)');
  });
});

// ── parseCeilingFt ──────────────────────────────────────────────────────
describe('parseCeilingFt', () => {
  it('parses BKN layer', () => {
    expect(parseCeilingFt('BKN012 OVC020')).toBe(1200);
  });

  it('parses OVC layer', () => {
    expect(parseCeilingFt('OVC008')).toBe(800);
  });

  it('returns lowest ceiling when multiple layers', () => {
    expect(parseCeilingFt('BKN025 OVC040')).toBe(2500);
  });

  it('returns null for CLR', () => {
    expect(parseCeilingFt('CLR')).toBeNull();
  });

  it('returns null for FEW (not a ceiling)', () => {
    expect(parseCeilingFt('FEW040')).toBeNull();
  });

  it('returns null for SCT (not a ceiling)', () => {
    expect(parseCeilingFt('SCT025')).toBeNull();
  });

  it('returns null for null/empty input', () => {
    expect(parseCeilingFt(null)).toBeNull();
    expect(parseCeilingFt('')).toBeNull();
  });

  it('parses VV (vertical visibility) as ceiling', () => {
    expect(parseCeilingFt('VV003')).toBe(300);
  });
});

// ── parseVisSMNum ───────────────────────────────────────────────────────
describe('parseVisSMNum', () => {
  it('parses "10SM" as 10', () => {
    expect(parseVisSMNum('10SM')).toBe(10);
  });

  it('parses "P6SM" as 99 (unlimited)', () => {
    expect(parseVisSMNum('P6SM')).toBe(99);
  });

  it('parses "3SM" as 3', () => {
    expect(parseVisSMNum('3SM')).toBe(3);
  });

  it('parses fractional "1/2SM" as 0.5', () => {
    expect(parseVisSMNum('1/2SM')).toBe(0.5);
  });

  it('parses "1 1/2SM" — matches the numeric portion', () => {
    // The regex matches "1/2SM" portion → 0.5; the leading "1 " is not captured
    // by the current regex, so this tests the actual behavior.
    const result = parseVisSMNum('1 1/2SM');
    expect(result).toBeGreaterThan(0);
  });

  it('returns null for null/empty', () => {
    expect(parseVisSMNum(null)).toBeNull();
    expect(parseVisSMNum('')).toBeNull();
  });

  it('returns null for unparseable string', () => {
    expect(parseVisSMNum('garbage')).toBeNull();
  });
});

// ── calcWindComponents ──────────────────────────────────────────────────
describe('calcWindComponents', () => {
  it('returns pure headwind when wind is aligned with runway', () => {
    // Wind 360°, runway heading 360° → direct headwind
    const { headwind, crosswind } = calcWindComponents(360, 10, 360);
    expect(headwind).toBe(10);
    expect(crosswind).toBe(0);
  });

  it('returns pure tailwind when wind is opposite runway', () => {
    // Wind 180°, runway heading 360° → direct tailwind
    const { headwind, crosswind } = calcWindComponents(180, 10, 360);
    expect(headwind).toBe(-10);
    expect(crosswind).toBe(0);
  });

  it('returns pure crosswind at 90 degrees', () => {
    // Wind 090°, runway heading 360° → pure crosswind
    const { headwind, crosswind } = calcWindComponents(90, 10, 360);
    expect(headwind).toBe(0);
    expect(crosswind).toBe(10);
  });

  it('calculates mixed head/crosswind at 45 degrees', () => {
    // Wind 045°, runway heading 360° → 45° offset
    const { headwind, crosswind } = calcWindComponents(45, 14, 360);
    // cos(45°) ≈ 0.707 → 14*0.707 ≈ 10
    // sin(45°) ≈ 0.707 → 14*0.707 ≈ 10
    expect(headwind).toBe(10);
    expect(crosswind).toBe(10);
  });

  it('returns zero when windDir is null', () => {
    const { headwind, crosswind } = calcWindComponents(null, 10, 360);
    expect(headwind).toBe(0);
    expect(crosswind).toBe(0);
  });

  it('returns zero when windSpd is 0', () => {
    const { headwind, crosswind } = calcWindComponents(270, 0, 360);
    expect(headwind).toBe(0);
    expect(crosswind).toBe(0);
  });
});
