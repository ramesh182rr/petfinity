import { ConfigError, resolveApiBaseUrl } from '@/config/env';

describe('resolveApiBaseUrl', () => {
  it('strips trailing slashes', () => {
    expect(resolveApiBaseUrl('http://10.0.2.2:8000/', true)).toBe('http://10.0.2.2:8000');
  });

  it('falls back to a local default in development when unset', () => {
    expect(resolveApiBaseUrl(undefined, true)).toMatch(/^http:\/\/(10\.0\.2\.2|localhost):8000$/);
  });

  it('requires a value outside development', () => {
    expect(() => resolveApiBaseUrl('', false)).toThrow(ConfigError);
  });

  it('requires https outside development', () => {
    expect(() => resolveApiBaseUrl('http://api.example.com', false)).toThrow('https');
    expect(resolveApiBaseUrl('https://api.example.com', false)).toBe('https://api.example.com');
  });

  it('rejects invalid URLs and non-http schemes', () => {
    expect(() => resolveApiBaseUrl('not a url', true)).toThrow(ConfigError);
    expect(() => resolveApiBaseUrl('ftp://example.com', true)).toThrow('http or https');
  });
});
