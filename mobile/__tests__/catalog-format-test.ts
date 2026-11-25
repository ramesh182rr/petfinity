import {
  formatDuration,
  formatRupees,
  formatTime,
  parseRupees,
  snapToFive,
} from '@/features/catalog/format';
import { toRules, validateWeek, type Week } from '@/features/catalog/hours';

describe('catalog formatting', () => {
  it('formats and parses rupees via paise', () => {
    expect(formatRupees(50000)).toBe('₹500');
    expect(formatRupees(149950)).toBe('₹1,499.50');
    expect(formatRupees(10000000)).toBe('₹1,00,000');
    expect(parseRupees('499.5')).toBe(49950);
    expect(parseRupees('₹1,200')).toBe(120000);
    expect(parseRupees('12.345')).toBeNull();
    expect(parseRupees('abc')).toBeNull();
  });

  it('formats durations and times', () => {
    expect(formatDuration(30)).toBe('30 min');
    expect(formatDuration(60)).toBe('1 h');
    expect(formatDuration(90)).toBe('1 h 30 min');
    expect(formatTime('09:00:00')).toBe('9:00 am');
    expect(formatTime('12:30')).toBe('12:30 pm');
    expect(formatTime('00:05')).toBe('12:05 am');
    expect(formatTime('17:45')).toBe('5:45 pm');
  });

  it('snaps times to the 5-minute grid', () => {
    const d = new Date(2026, 0, 1, 9, 7);
    expect(snapToFive(d).getMinutes()).toBe(5);
  });
});

describe('weekly hours model', () => {
  const week: Week = [
    [
      { start: '09:00', end: '13:00', capacity: 2 },
      { start: '15:00', end: '18:00', capacity: 1 },
    ],
    [],
    [],
    [],
    [],
    [{ start: '10:00', end: '14:00', capacity: 1 }],
    [],
  ];

  it('converts to API rules with weekday indexes', () => {
    expect(toRules(week)).toEqual([
      { weekday: 0, start_time: '09:00', end_time: '13:00', capacity: 2 },
      { weekday: 0, start_time: '15:00', end_time: '18:00', capacity: 1 },
      { weekday: 5, start_time: '10:00', end_time: '14:00', capacity: 1 },
    ]);
    expect(validateWeek(week)).toBeNull();
  });

  it('catches inverted and overlapping ranges', () => {
    expect(
      validateWeek([[{ start: '13:00', end: '09:00', capacity: 1 }], [], [], [], [], [], []]),
    ).toMatch(/Monday/);
    expect(
      validateWeek([
        [],
        [
          { start: '09:00', end: '12:00', capacity: 1 },
          { start: '11:00', end: '13:00', capacity: 1 },
        ],
        [],
        [],
        [],
        [],
        [],
      ]),
    ).toBe('Tuesday: time ranges overlap.');
  });
});
