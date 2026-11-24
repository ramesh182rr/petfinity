import { createApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { shouldRetry } from '@/api/queryClient';

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

describe('api client', () => {
  it('calls the versioned API with tracing headers and returns JSON', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(200, { status: 'ok' }));
    const client = createApiClient({ baseUrl: 'http://api.test', fetchImpl });

    await expect(client.request('/health')).resolves.toEqual({ status: 'ok' });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://api.test/api/v1/health');
    expect(init.method).toBe('GET');
    expect(init.headers['X-Request-ID']).toMatch(/^m-/);
    expect(init.headers['Content-Type']).toBeUndefined();
  });

  it('sends JSON bodies', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(201, { id: '1' }));
    const client = createApiClient({ baseUrl: 'http://api.test', fetchImpl });

    await client.request('/pets', { method: 'POST', body: { name: 'Bruno' } });

    const [, init] = fetchImpl.mock.calls[0];
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"name":"Bruno"}');
  });

  it('maps the server error envelope to ApiError', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(409, {
        error: {
          code: 'slot_unavailable',
          message: 'That slot was just taken.',
          details: null,
          request_id: 'srv-1',
        },
      }),
    );
    const client = createApiClient({ baseUrl: 'http://api.test', fetchImpl });

    const error = await client.request('/bookings').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: 'slot_unavailable',
      message: 'That slot was just taken.',
      status: 409,
      requestId: 'srv-1',
      isRetryable: false,
    });
  });

  it('reports non-envelope failures as invalid_response', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }));
    const client = createApiClient({ baseUrl: 'http://api.test', fetchImpl });

    await expect(client.request('/health')).rejects.toMatchObject({
      code: 'invalid_response',
      status: 502,
      isRetryable: true,
    });
  });

  it('reports network failures', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    const client = createApiClient({ baseUrl: 'http://api.test', fetchImpl });

    await expect(client.request('/health')).rejects.toMatchObject({
      code: 'network_error',
      status: null,
    });
  });

  it('times out slow requests', async () => {
    const fetchImpl: typeof fetch = (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    const client = createApiClient({ baseUrl: 'http://api.test', fetchImpl, timeoutMs: 10 });

    await expect(client.request('/health')).rejects.toMatchObject({ code: 'timeout' });
  });
});

describe('query retry policy', () => {
  it('retries network and server errors a limited number of times', () => {
    const network = new ApiError('network_error', 'x', null);
    expect(shouldRetry(0, network)).toBe(true);
    expect(shouldRetry(2, network)).toBe(false);
    expect(shouldRetry(0, new ApiError('internal_error', 'x', 500))).toBe(true);
  });

  it('never retries client errors or unknown errors', () => {
    expect(shouldRetry(0, new ApiError('not_found', 'x', 404))).toBe(false);
    expect(shouldRetry(0, new Error('boom'))).toBe(false);
  });
});
