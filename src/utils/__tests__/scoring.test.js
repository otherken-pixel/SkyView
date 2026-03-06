import { describe, it, expect } from 'vitest';
import { calcFratGoScore, calcGoScoreFromMetars } from '../scoring';

// ── calcFratGoScore ─────────────────────────────────────────────────────
describe('calcFratGoScore', () => {
  it('returns 100 when all answers are zero (no risk)', () => {
    const answers = {
      P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0, P7: 0,
      A1: 0, A2: 0, A3: 0, A4: 0,
      V1: 0, V2: 0, V3: 0, V4: 0, V5: 0,
      E1: 0, E2: 0, E3: 0,
    };
    expect(calcFratGoScore(answers)).toBe(100);
  });

  it('returns less than 100 with some risk answers', () => {
    const answers = {
      P1: 3, P2: 0, P3: 0, P4: 0, P5: 2, P6: 1, P7: 0,
      A1: 0, A2: 0, A3: 1, A4: 0,
      V1: 2, V2: 0, V3: 0, V4: 0, V5: 0,
      E1: 2, E2: 0, E3: 0,
    };
    const score = calcFratGoScore(answers);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });

  it('returns a low score with high risk across all categories', () => {
    // Use near-maximum penalty values
    const answers = {
      P1: 8, P2: 7, P3: 6, P4: 8, P5: 9, P6: 7, P7: 0,
      A1: 8, A2: 7, A3: 8, A4: 5,
      V1: 9, V2: 10, V3: 8, V4: 6, V5: 0,
      E1: 7, E2: 7, E3: 7,
    };
    const score = calcFratGoScore(answers);
    expect(score).toBeLessThanOrEqual(10);
  });

  it('handles empty answers object gracefully', () => {
    const score = calcFratGoScore({});
    expect(score).toBe(100);
  });

  it('handles partial answers (only some questions answered)', () => {
    const answers = { P1: 5, A1: 2 };
    const score = calcFratGoScore(answers);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });
});

// ── calcGoScoreFromMetars ───────────────────────────────────────────────
describe('calcGoScoreFromMetars', () => {
  it('returns 50 when either metar is missing', () => {
    expect(calcGoScoreFromMetars(null, { cat: 'VFR', wspd: 5 })).toBe(50);
    expect(calcGoScoreFromMetars({ cat: 'VFR', wspd: 5 }, null)).toBe(50);
    expect(calcGoScoreFromMetars(null, null)).toBe(50);
  });

  it('returns high score for VFR/VFR with calm winds', () => {
    const dep = { cat: 'VFR', wspd: 5 };
    const arr = { cat: 'VFR', wspd: 5 };
    const score = calcGoScoreFromMetars(dep, arr);
    expect(score).toBeGreaterThanOrEqual(90);
  });

  it('returns 0 for IFR conditions', () => {
    const dep = { cat: 'IFR', wspd: 5 };
    const arr = { cat: 'VFR', wspd: 5 };
    expect(calcGoScoreFromMetars(dep, arr)).toBe(0);
  });

  it('returns 0 for LIFR conditions', () => {
    const dep = { cat: 'VFR', wspd: 5 };
    const arr = { cat: 'LIFR', wspd: 5 };
    expect(calcGoScoreFromMetars(dep, arr)).toBe(0);
  });

  it('returns moderate score for MVFR conditions', () => {
    const dep = { cat: 'MVFR', wspd: 8 };
    const arr = { cat: 'VFR', wspd: 8 };
    const score = calcGoScoreFromMetars(dep, arr);
    expect(score).toBeGreaterThanOrEqual(50);
    expect(score).toBeLessThan(90);
  });

  it('penalizes high winds', () => {
    const calm = calcGoScoreFromMetars(
      { cat: 'VFR', wspd: 5 },
      { cat: 'VFR', wspd: 5 }
    );
    const windy = calcGoScoreFromMetars(
      { cat: 'VFR', wspd: 25 },
      { cat: 'VFR', wspd: 25 }
    );
    expect(windy).toBeLessThan(calm);
  });

  it('clamps score between 5 and 99', () => {
    // VFR + calm → high score, but max is 99
    const high = calcGoScoreFromMetars(
      { cat: 'VFR', wspd: 0 },
      { cat: 'VFR', wspd: 0 }
    );
    expect(high).toBeLessThanOrEqual(99);

    // MVFR + extreme winds → low score, but min is 5 (for non-IFR)
    const low = calcGoScoreFromMetars(
      { cat: 'MVFR', wspd: 50 },
      { cat: 'MVFR', wspd: 50 }
    );
    expect(low).toBeGreaterThanOrEqual(5);
  });
});
