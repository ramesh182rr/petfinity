/** Minimal fake of the Petfinity API for client-side tests: routes by method + path. */

type Handler = (body: unknown, headers: Record<string, string>) => [number, unknown];

export type FakeApi = {
  on(method: string, path: string, handler: Handler): void;
  calls: {
    method: string;
    path: string;
    query: URLSearchParams;
    body: unknown;
    headers: Record<string, string>;
  }[];
  fetch: jest.Mock;
};

export function json(status: number, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function createFakeApi(): FakeApi {
  const routes = new Map<string, Handler>();
  const calls: FakeApi['calls'] = [];
  const fetchMock = jest.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    const parsed = new URL(url);
    const path = parsed.pathname.replace('/api/v1', '');
    const headers = (init.headers ?? {}) as Record<string, string>;
    // Only JSON (string) bodies are parsed; binary uploads (Blob) are passed through.
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
    calls.push({ method, path, query: parsed.searchParams, body, headers });
    const handler = routes.get(`${method} ${path}`);
    if (!handler) {
      return json(404, { error: { code: 'not_found', message: 'Not Found', request_id: 'x' } });
    }
    const [status, responseBody] = handler(body, headers);
    return json(status, status === 204 ? undefined : responseBody);
  });
  return {
    on: (method, path, handler) => routes.set(`${method} ${path}`, handler),
    calls,
    fetch: fetchMock,
  };
}

export const USER = {
  id: '3f0a6f5e-0000-4000-8000-000000000001',
  display_name: null as string | null,
  email: null,
  email_verified: false,
  phone: '+919876543210',
  phone_verified: true,
  capabilities: ['pet_parent'],
  created_at: '2026-11-24T10:00:00Z',
};

export function tokens(n: number) {
  return {
    access_token: `access-${n}`,
    refresh_token: `refresh-${n}-${'x'.repeat(30)}`,
    token_type: 'bearer',
    expires_in: 900,
    refresh_expires_at: '2026-12-24T10:00:00Z',
  };
}
