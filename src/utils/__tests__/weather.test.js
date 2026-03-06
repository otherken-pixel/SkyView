import { describe, it, expect } from 'vitest';
import {
  deriveCat,
  getCategoryColor,
  calculateDensityAltitude,
  getGoColor,
  parseCeilingFt,
  parseVisSMNum,
  decodeMetarWind,
  decodeMetarVis,
  decodeMetarSky,
  decodeMetarTemp,
  decodeMetarAlt,
  calcWindComponents,
} from '../weather';

describe('deriveCat', () => {
  it('returns VFR for high ceiling and good visibility', () => {
    expect(deriveCat(5000, 10)).toBe('VFR');
  });
  it('returns MVFR for ceiling 1000-3000', () => {
    expect(deriveCat(2000, 10)).toBe('MVFR');
  });
  it('returns IFR for ceiling 500-999', () => {
    expect(deriveCat(700, 10)).toBe('IFR');
  });
  it('returns LIFR for ceiling < 500', () => {
    expect(deriveCat(300, 10)).toBe('LIFR');
  });
  it('uses worst of ceiling and vis', () => {
    expect(deriveCat(5000, 2)).toBe('IFR');
  });
});

describe('decodeMetarWind', () => {
  it('decodes standard wind', () => {
    const result = decodeMetarWind({ wind: '27015G25KT' });
    expect(result).toContain('270');
    expect(result).toContain('15');
  });
  it('returns calm for no wind', () => {
    const result = decodeMetarWind({ wind: '00000KT' });
    expect(result.toLowerCase()).toContain('calm');
  });
  it('handles null metar', () => {
    expect(decodeMetarWind(null)).toBe('—');
  });
});

describe('decodeMetarVis', () => {
  it('decodes P6SM', () => {
    const result = decodeMetarVis('P6SM');
    expect(result).toContain('6');
  });
  it('handles null', () => {
    expect(decodeMetarVis(null)).toBe('—');
  });
});

describe('decodeMetarSky', () => {
  it('decodes CLR', () => {
    const result = decodeMetarSky('CLR');
    expect(result.toLowerCase()).toContain('clear');
  });
  it('handles null', () => {
    expect(decodeMetarSky(null)).toBe('—');
  });
});

describe('decodeMetarTemp', () => {
  it('decodes standard temp', () => {
    const result = decodeMetarTemp('22/14');
    expect(result).toContain('22');
  });
  it('handles null', () => {
    expect(decodeMetarTemp(null)).toBe('—');
  });
});

describe('decodeMetarAlt', () => {
  it('decodes altimeter setting', () => {
    const result = decodeMetarAlt('A2992');
    expect(result).toContain('29.92');
  });
  it('handles null', () => {
    expect(decodeMetarAlt(null)).toBe('—');
  });
});
