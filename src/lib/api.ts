// Central HTTP client for the SuratPharma Hono backend
// Replaces all window.electronAPI.* calls

const BASE_URL = 'http://localhost:3001';

function getToken(): string | null {
  return sessionStorage.getItem('sp_token');
}

export function setToken(token: string) {
  sessionStorage.setItem('sp_token', token);
}

export function clearToken() {
  sessionStorage.removeItem('sp_token');
}

async function request<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  auth = true
): Promise<{ success: boolean; data?: T; error?: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const json = await res.json();
    return json;
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

// Convenience methods
export const api = {
  get:    <T>(path: string)              => request<T>('GET',    path),
  post:   <T>(path: string, body: unknown) => request<T>('POST',   path, body),
  put:    <T>(path: string, body: unknown) => request<T>('PUT',    path, body),
  patch:  <T>(path: string, body?: unknown) => request<T>('PATCH',  path, body),
  delete: <T>(path: string)              => request<T>('DELETE', path),

  // Auth (no token required)
  login: (username: string, password: string) =>
    request<{ token: string; username: string; role: string }>(
      'POST', '/api/auth/login', { username, password }, false
    ),
};
