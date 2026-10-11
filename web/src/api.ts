import type { User, VoiceTranscribeResponse } from '../../shared/types';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type ApiErrorBody = { error?: unknown };

function errorFrom(data: unknown, status: number): string {
  if (typeof data === 'object' && data !== null && 'error' in data) {
    const { error } = data as ApiErrorBody;
    if (typeof error === 'string' && error) return error;
  }
  return `Request failed (${status})`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
  });
  if (res.status === 401) {
    throw new ApiError(401, 'Not logged in');
  }
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, errorFrom(data, res.status));
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  // Multipart upload. No Content-Type header: the browser sets the boundary.
  postForm: async <T>(path: string, form: FormData): Promise<T> => {
    const res = await fetch(`/api${path}`, { method: 'POST', credentials: 'same-origin', body: form });
    if (res.status === 401) throw new ApiError(401, 'Not logged in');
    const data: unknown = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, errorFrom(data, res.status));
    return data as T;
  },
  // Binary download (auth-cookie image endpoints).
  getBlob: async (path: string): Promise<Blob> => {
    const res = await fetch(`/api${path}`, { credentials: 'same-origin' });
    if (res.status === 401) throw new ApiError(401, 'Not logged in');
    if (!res.ok) throw new ApiError(res.status, `Request failed (${res.status})`);
    return res.blob();
  },
  postVoice(audio: string, mime: string): Promise<VoiceTranscribeResponse> {
    return api.post<VoiceTranscribeResponse>('/voice/transcribe', { audio, mime });
  },
};

export type { User };
