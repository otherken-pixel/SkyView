import { describe, it, expect } from 'vitest';
import { calcDist, calcBearing, lonToIanaTz } from '../geo';

// ── calcDist ────────────────────────────────────────────────────────────
describe('calcDist', () => {
  it('calculates KCLT to KATL as approximately 226 NM', () => {
    // KCLT: 35.2144, -80.9431
    // KATL: 33.6407, -84.4277
    const dist = calcDist(35.2144, -80.9431, 33.6407, -84.4277);
    expect(dist).toBeGreaterThan(200);
    expect(dist).toBeLessThan(250);
  });

  it('returns 0 for same point', () => {
    const dist = calcDist(35.0, -80.0, 35.0, -80.0);
    expect(dist).toBeCloseTo(0, 5);
  });

  it('calculates KJFK to KLAX as approximately 2145 NM', () => {
    // KJFK: 40.6413, -73.7781
    // KLAX: 33.9425, -118.4081
    const dist = calcDist(40.6413, -73.7781, 33.9425, -118.4081);
    expect(dist).toBeGreaterThan(2100);
    expect(dist).toBeLessThan(2200);
  });

  it('is symmetric (A→B equals B→A)', () => {
    const ab = calcDist(35.0, -80.0, 40.0, -74.0);
    const ba = calcDist(40.0, -74.0, 35.0, -80.0);
    expect(ab).toBeCloseTo(ba, 5);
  });
});

// ── calcBearing ─────────────────────────────────────────────────────────
describe('calcBearing', () => {
  it('returns ~0/360 for due north', () => {
    // Going from a point straight north
    const brg = calcBearing(35.0, -80.0, 40.0, -80.0);
    expect(brg).toBeGreaterThan(355);
  });

  it('returns ~180 for due south', () => {
    const brg = calcBearing(40.0, -80.0, 35.0, -80.0);
    expect(brg).toBeGreaterThan(175);
    expect(brg).toBeLessThan(185);
  });

  it('returns ~90 for due east', () => {
    const brg = calcBearing(35.0, -80.0, 35.0, -75.0);
    expect(brg).toBeGreaterThan(85);
    expect(brg).toBeLessThan(95);
  });

  it('returns ~270 for due west', () => {
    const brg = calcBearing(35.0, -75.0, 35.0, -80.0);
    expect(brg).toBeGreaterThan(265);
    expect(brg).toBeLessThan(275);
  });

  it('returns value between 0 and 360', () => {
    const brg = calcBearing(35.2144, -80.9431, 33.6407, -84.4277);
    expect(brg).toBeGreaterThanOrEqual(0);
    expect(brg).toBeLessThan(360);
  });
});

// ── lonToIanaTz ─────────────────────────────────────────────────────────
describe('lonToIanaTz', () => {
  it('returns Eastern for longitude east of -87', () => {
    // New York area: -74
    expect(lonToIanaTz(-74)).toBe('America/New_York');
  });

  it('returns Central for longitude between -102 and -87', () => {
    // Chicago area: -88
    expect(lonToIanaTz(-88)).toBe('America/Chicago');
  });

  it('returns Mountain for longitude between -115 and -102', () => {
    // Denver area: -105
    expect(lonToIanaTz(-105)).toBe('America/Denver');
  });

  it('returns Pacific for longitude west of -115', () => {
    // Los Angeles area: -118
    expect(lonToIanaTz(-118)).toBe('America/Los_Angeles');
  });

  it('returns Eastern for null/falsy longitude', () => {
    expect(lonToIanaTz(null)).toBe('America/New_York');
    expect(lonToIanaTz(0)).toBe('America/New_York');
  });

  it('returns Eastern for positive longitude (e.g. Europe)', () => {
    // Positive longitudes are > -87
    expect(lonToIanaTz(10)).toBe('America/New_York');
  });
});
