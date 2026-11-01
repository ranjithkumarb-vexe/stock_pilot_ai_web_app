import { applyTick, normalizeBars, toSeconds } from './chartData';

const b = (time: number, o: number, h: number, l: number, c: number, volume = 10) => ({
  time,
  open: o,
  high: h,
  low: l,
  close: c,
  volume,
});

describe('chartData', () => {
  it('normalises seconds, milliseconds and ISO times, sorts and dedupes', () => {
    expect(toSeconds(1_700_000_000)).toBe(1_700_000_000);
    expect(toSeconds(1_700_000_000_000)).toBe(1_700_000_000);
    expect(toSeconds('2026-10-30T14:00:00Z')).toBe(Date.parse('2026-10-30T14:00:00Z') / 1000);
    expect(toSeconds('nope')).toBeNull();
    const out = normalizeBars([
      b(600, 1, 2, 1, 2),
      b(300, 1, 1, 1, 1),
      b(600, 1, 3, 1, 3),
      { ...b(900, 1, 1, 1, 1), close: NaN },
    ]);
    expect(out.map(x => x.time)).toEqual([300, 600]);
    expect(out[1]?.high).toBe(3);
  });

  it('folds a tick into the open bar', () => {
    const bars = normalizeBars([b(300, 10, 11, 9, 10)]);
    const next = applyTick(bars, 12, 450);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ high: 12, low: 9, close: 12, open: 10 });
  });

  it('starts a new bar when the 5 minute bucket rolls over and ignores late ticks', () => {
    const bars = normalizeBars([b(300, 10, 11, 9, 10)]);
    const next = applyTick(bars, 10.5, 650);
    expect(next).toHaveLength(2);
    expect(next[1]).toMatchObject({ time: 600, open: 10, close: 10.5, volume: 0 });
    expect(applyTick(next, 99, 100)).toBe(next);
  });

  it('seeds an empty series and returns the same array for no-op ticks', () => {
    expect(applyTick([], 5, 1000)[0]).toMatchObject({ time: 900, open: 5, close: 5 });
    const bars = normalizeBars([b(300, 10, 11, 9, 10)]);
    expect(applyTick(bars, 10, 310)).toBe(bars);
  });
});
