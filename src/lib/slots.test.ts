import { DEFAULT_SLOTS } from './defaults';
import { dayKey, slotFor } from './slots';

const at = (h: number, m = 0) => new Date(2026, 8, 30, h, m);

describe('slotFor', () => {
  it.each([
    [5, 0, 'morning'],
    [10, 59, 'morning'],
    [11, 0, 'noon'],
    [16, 30, 'noon'],
    [17, 0, 'evening'],
    [21, 0, 'night'],
    [23, 59, 'night'],
    [1, 30, 'night'],
    [4, 59, 'night'],
  ])('%i:%i → %s', (h, m, slot) => {
    expect(slotFor(at(h, m), DEFAULT_SLOTS).id).toBe(slot);
  });

  it('does not depend on the order slots are stored in', () => {
    expect(slotFor(at(12), [...DEFAULT_SLOTS].reverse()).id).toBe('noon');
  });
});

describe('dayKey', () => {
  it('uses the local calendar date during the day', () => {
    expect(dayKey(at(7), DEFAULT_SLOTS)).toBe('2026-09-30');
    expect(dayKey(at(23), DEFAULT_SLOTS)).toBe('2026-09-30');
  });

  it('assigns a reading after midnight to the previous day (Night)', () => {
    expect(dayKey(new Date(2026, 9, 1, 1, 30), DEFAULT_SLOTS)).toBe('2026-09-30');
  });

  it('handles month and year boundaries', () => {
    expect(dayKey(new Date(2027, 0, 1, 2, 0), DEFAULT_SLOTS)).toBe('2026-12-31');
  });
});
