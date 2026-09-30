// Client for the Scala’s Shelf API (api/), version 1 (/api/v1). Same-origin by default: the Vite dev
// server in development, the Cloudflare Worker in production. A mobile app build sets
// VITE_API_URL to the deployed site, since the app itself isn't served from there.

const API_ORIGIN = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  let payload: BodyInit | undefined;
  if (body instanceof Blob) {
    headers['content-type'] = body.type || 'application/octet-stream';
    payload = body;
  } else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(`${API_ORIGIN}/api/v1${path}`, { method, headers, body: payload, credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, 'No connection. Your changes will be saved when you’re back online.');
  }
  if (!res.ok) {
    let message = res.statusText;
    try { message = ((await res.json()) as { error?: string }).error ?? message; } catch { /* not JSON */ }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, file: Blob) => request<T>('POST', path, file),
};

/** URL for a stored file (e.g. a Studio recording), usable in <audio src>. */
export function fileUrl(key: string): string {
  return `${API_ORIGIN}/api/files/${key}`;
}
