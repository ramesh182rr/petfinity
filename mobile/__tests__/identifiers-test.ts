import {
  displayNameSchema,
  emailFormSchema,
  normalizeIndianMobile,
  phoneFormSchema,
} from '@/features/auth/identifiers';

describe('identifier validation (mirrors the server)', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['+91 98765 43210', '+919876543210'],
    ['0091-98765-43210', '+919876543210'],
    ['09876543210', '+919876543210'],
  ])('normalises %s', (raw, expected) => {
    expect(normalizeIndianMobile(raw)).toBe(expected);
  });

  it.each(['12345', '1234567890', '+91 5876543210', '98765432101'])('rejects %s', (raw) => {
    expect(normalizeIndianMobile(raw)).toBeNull();
    expect(phoneFormSchema.safeParse({ destination: raw }).success).toBe(false);
  });

  it('validates email addresses', () => {
    expect(emailFormSchema.safeParse({ destination: ' priya@example.com ' }).success).toBe(true);
    expect(emailFormSchema.safeParse({ destination: 'not-an-email' }).success).toBe(false);
    expect(emailFormSchema.safeParse({ destination: '' }).success).toBe(false);
  });

  it('cleans display names', () => {
    expect(displayNameSchema.parse({ displayName: '  Priya   Nair ' })).toEqual({
      displayName: 'Priya Nair',
    });
    expect(displayNameSchema.safeParse({ displayName: '   ' }).success).toBe(false);
    expect(displayNameSchema.safeParse({ displayName: 'x'.repeat(61) }).success).toBe(false);
  });
});
