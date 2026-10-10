import axios, { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { toast } from 'sonner';
import { tokenStorage, isPublicPath } from '@/lib/tokenStorage';
import { rateLimitMessage } from '@/utils/error-handler.util';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const publicApi = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Timeouts ────────────────────────────────────────────────────────────────
// No request may spin forever. Ordinary reads and saves get 30 s; work that is
// legitimately slow gets longer: uploads and downloads/exports (2 min), the AI
// assistant (3 min — the server allows up to 60 s per provider call and a
// question can take several), and attendance imports (5 min — a Mustard file is
// parsed and matched on the server). A call that sets its own `timeout` keeps it.
const TIMEOUT_MS = { default: 30_000, transfer: 120_000, ai: 180_000, import: 300_000 };

function timeoutFor(config: InternalAxiosRequestConfig): number {
  const url = config.url ?? '';
  if (/\/attendance\/imports?(\/|$)|\/attendance-imports?/.test(url)) return TIMEOUT_MS.import;
  if (/^\/?ai(\/|$)/.test(url)) return TIMEOUT_MS.ai;
  if (config.data instanceof FormData || config.responseType === 'blob' || /\/export|\/reports?\//.test(url)) {
    return TIMEOUT_MS.transfer;
  }
  return TIMEOUT_MS.default;
}

const applyTimeout = (config: InternalAxiosRequestConfig) => {
  if (!config.timeout) config.timeout = timeoutFor(config);
  return config;
};
api.interceptors.request.use(applyTimeout);
publicApi.interceptors.request.use(applyTimeout);

// ─── Error bodies of file downloads ──────────────────────────────────────────
// A download asks for a Blob, so a JSON error comes back as a Blob too and its
// message is unreadable. Turn it back into JSON first, so a failed export says
// why instead of "could not be exported".
async function readBlobErrorBody(error: AxiosError): Promise<void> {
  const data = error.response?.data;
  if (typeof Blob === 'undefined' || !(data instanceof Blob)) return;
  if (!/json/i.test(data.type)) return;
  try {
    (error.response as AxiosResponse).data = JSON.parse(await data.text());
  } catch (parseErr) {
    // Not JSON after all: keep the Blob; the caller's fallback message applies.
    console.warn('[api] Could not read the error body of a download:', parseErr);
  }
}

// A download that "succeeds" with zero bytes is a failure: no export or
// document may be saved as an empty file and reported as done.
export class EmptyDownloadError extends Error {
  constructor() {
    super('EMPTY_DOWNLOAD');
    this.name = 'EmptyDownloadError';
  }
}

function rejectEmptyDownload(response: AxiosResponse) {
  if (response.config.responseType === 'blob' && response.data instanceof Blob && response.data.size === 0) {
    return Promise.reject(new EmptyDownloadError());
  }
  return response;
}

publicApi.interceptors.response.use(
  rejectEmptyDownload,
  async (error) => {
    await readBlobErrorBody(error);
    return Promise.reject(error);
  }
);

// ─── Token storage (Remember Me aware) ───────────────────────────────────────
// One implementation lives in tokenStorage.ts and is shared by the API client and
// the AuthProvider so there is never a second, divergent session mechanism.
const getAccessToken = tokenStorage.getAccessToken;
const getRefreshToken = tokenStorage.getRefreshToken;
const clearTokens = tokenStorage.clear;
const storeTokens = (accessToken: string, refreshToken: string): void => {
  tokenStorage.setTokens(accessToken, refreshToken);
};

// ─── Request Interceptor: Attach current access token ────────────────────────
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor: Refresh token on 401 ──────────────────────────────
let isRefreshing = false;
let sessionExpiredToastShown = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null): void => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const handleSessionExpiry = (): void => {
  clearTokens();
  
  const pathname = window.location.pathname;
  const isPublic = isPublicPath(pathname);
  
  window.dispatchEvent(new CustomEvent('auth_logout', { detail: { isPublic } }));
  
  // Guard against showing multiple session-expired toasts simultaneously
  if (!isPublic && !sessionExpiredToastShown) {
    sessionExpiredToastShown = true;
    toast.error('Your session has expired. Please log in again.', {
      id: 'session-expired',
      onDismiss: () => { sessionExpiredToastShown = false; },
      onAutoClose: () => { sessionExpiredToastShown = false; },
    });
  }
};

// Endpoints that must NOT trigger the refresh / retry logic
const AUTH_ENDPOINTS = ['/auth/login', '/auth/refresh', '/auth/logout'];

api.interceptors.response.use(
  rejectEmptyDownload,
  async (error) => {
    const originalRequest = error.config;
    await readBlobErrorBody(error);

    // 429 — the server's rate limit. One "slow down" toast at a time, saying how
    // long to wait when the server said so; no internals, no automatic retry.
    if (error.response?.status === 429) {
      toast.error(rateLimitMessage(error), { id: 'rate-limited' });
      return Promise.reject(error);
    }

    // The account is still on a temporary password: the API refuses everything
    // except changing it. Send the user to the one page that can.
    if (
      error.response?.status === 403 &&
      error.response?.data?.code === 'PASSWORD_CHANGE_REQUIRED' &&
      !window.location.pathname.startsWith('/change-password')
    ) {
      window.location.assign('/change-password');
      return Promise.reject(error);
    }

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !AUTH_ENDPOINTS.some((ep) => originalRequest.url?.includes(ep))
    ) {
      // Refresh endpoint specifically failing means session is truly dead
      if (originalRequest.url?.includes('/auth/refresh')) {
        handleSessionExpiry();
        return Promise.reject(error);
      }

      // Queue concurrent 401s while a refresh is already in flight
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        isRefreshing = false;
        handleSessionExpiry();
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
          response.data.data;

        storeTokens(newAccessToken, newRefreshToken);

        // Update the Authorization header and flush the queue
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        processQueue(null, newAccessToken);
        isRefreshing = false;

        return api(originalRequest);
      } catch (refreshError) {
        // Multi-tab/HMR Concurrency check: 
        // If refresh fails, check if another instance ALREADY refreshed the tokens
        const currentRefreshToken = getRefreshToken();
        if (currentRefreshToken && currentRefreshToken !== refreshToken) {
          const newAccessToken = getAccessToken();
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          processQueue(null, newAccessToken);
          isRefreshing = false;
          return api(originalRequest);
        }

        processQueue(refreshError, null);
        isRefreshing = false;
        handleSessionExpiry();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
