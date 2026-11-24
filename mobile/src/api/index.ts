import { env } from '@/config/env';

import { createApiClient } from './client';

/** App-wide API client. Feature modules wrap it in typed functions + TanStack Query hooks. */
export const apiClient = createApiClient({ baseUrl: env.apiBaseUrl });

export { createApiClient, type ApiClient } from './client';
export { ApiError, isApiError } from './errors';
export { createQueryClient } from './queryClient';
