import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPersonalMinimums, checkPersonalMinimums } from '../personalMinimums';

// Mock the airports module since checkPersonalMinimums calls getAirport
vi.mock('../airports', () => ({
  getAirport: vi.fn(() => null),
}));

// Mock localStorage
beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
});

describe('getPersonalMinimums', () => {
  it('returns null when nothing stored', () => {
    expect(getPersonalMinimums()).toBeNull();
  });

  it('returns parsed data when stored', () => {
    localStorage.getItem = vi.fn(() => JSON.stringify({ ceilingDay: 3000 }));
    const result = getPersonalMinimums();
    expect(result).toEqual({ ceilingDay: 3000 });
  });
});

describe('checkPersonalMinimums', () => {
  it('returns notset penalty when minimums are null', () => {
    const result = checkPersonalMinimums([], null, null);
    expect(result.status).toBe('notset');
    expect(result.penalty).toBe(25);
  });

  it('returns clear when conditions are above minimums', () => {
    const wxData = [{
      icao: 'KCLT',
      effectiveWx: { sky: 'FEW050', vis: 'P6SM', wind: '27010KT', cat: 'VFR' }
    }];
    const mins = { ceilingDay: 2000, visDay: 3 };
    const result = checkPersonalMinimums(wxData, mins, null);
    expect(result.status).toBe('clear');
    expect(result.penalty).toBe(0);
  });

  it('returns exceed when ceiling is below minimum', () => {
    const wxData = [{
      icao: 'KCLT',
      effectiveWx: { sky: 'OVC008', vis: 'P6SM', wind: '27010KT', cat: 'IFR' }
    }];
    const mins = { ceilingDay: 2000, visDay: 3 };
    const result = checkPersonalMinimums(wxData, mins, null);
    expect(result.status).toBe('exceed');
    expect(result.penalty).toBe(50);
  });

  it('returns exceed when vis is below minimum', () => {
    const wxData = [{
      icao: 'KCLT',
      effectiveWx: { sky: 'FEW050', vis: '2SM', wind: '27010KT', cat: 'IFR' }
    }];
    const mins = { ceilingDay: 1000, visDay: 5 };
    const result = checkPersonalMinimums(wxData, mins, null);
    expect(result.status).toBe('exceed');
    expect(result.penalty).toBe(50);
  });

  it('returns buffer when near minimums', () => {
    const wxData = [{
      icao: 'KCLT',
      effectiveWx: { sky: 'BKN022', vis: 'P6SM', wind: '27010KT', cat: 'MVFR' }
    }];
    const mins = { ceilingDay: 2000, visDay: 3 };
    const result = checkPersonalMinimums(wxData, mins, null);
    expect(result.status).toBe('buffer');
    expect(result.penalty).toBe(15);
  });
});
