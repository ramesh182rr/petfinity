import {
  cancelPreview,
  eventLabel,
  newIdempotencyKey,
  PAYMENT_LABEL,
  policyLine,
  STATUS_INFO,
} from '@/features/bookings/format';
import type { Booking } from '@/features/bookings/types';

const base = {
  status: 'confirmed',
  payment_status: 'unpaid',
  policy: {
    free_cancellation_until: '2026-12-01T01:30:00Z',
    free_cancellation_hours_before: 2,
    late_cancellation: 'no_refund',
    provider_cancellation: 'full_refund',
  },
} as unknown as Booking;

const before = new Date('2026-11-30T10:00:00Z');
const after = new Date('2026-12-01T02:00:00Z');

describe('booking formatting', () => {
  it('previews what a cancellation means (decision 0012)', () => {
    expect(cancelPreview({ ...base, status: 'pending_provider' } as Booking, before)).toMatch(
      /withdrawn/,
    );
    expect(cancelPreview(base, before)).toBe('Free cancellation. Nothing is charged.');
    expect(cancelPreview({ ...base, payment_status: 'paid' } as Booking, before)).toMatch(
      /refunded in full/,
    );
    expect(cancelPreview({ ...base, payment_status: 'paid' } as Booking, after)).toMatch(
      /late cancellation and the payment isn't refunded/,
    );
    expect(cancelPreview(base, after)).toMatch(/late cancellation/);
  });

  it('labels policy, events and states', () => {
    expect(policyLine(base.policy.free_cancellation_until, before)).toMatch(
      /^Free cancellation until/,
    );
    expect(policyLine(base.policy.free_cancellation_until, after)).toMatch(/has ended/);
    expect(eventLabel('created', 'pending_provider')).toBe('Request sent');
    expect(eventLabel('created', 'confirmed')).toBe('Booked');
    expect(eventLabel('something_new')).toBe('something new');
    expect(STATUS_INFO.expired.label).toBe('Not confirmed');
    expect(PAYMENT_LABEL.paid).toBe('Paid (mock)');
  });

  it('makes unique idempotency keys within the API limits', () => {
    const keys = new Set(Array.from({ length: 50 }, () => newIdempotencyKey()));
    expect(keys.size).toBe(50);
    for (const key of keys) {
      expect(key.length).toBeGreaterThanOrEqual(8);
      expect(key.length).toBeLessThanOrEqual(64);
    }
  });
});
