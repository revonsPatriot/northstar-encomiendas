const API_URL = import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3000/api';

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const TOKEN_KEY = 'northstar_access_token';
const USER_KEY = 'northstar_user';

function getToken(): string | null {
  return typeof localStorage === 'undefined'
    ? null
    : localStorage.getItem(TOKEN_KEY);
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    // Error de red: se distingue para poder encolar operaciones offline.
    throw new ApiError('Sin conexión con el servidor.', 0);
  }

  const payload = (await response.json().catch(() => null)) as
    | { message?: string }
    | null;

  if (!response.ok) {
    if (response.status === 401 && token && typeof window !== 'undefined') {
      clearSession();
      window.location.href = '/login';
    }
    throw new ApiError(
      payload?.message ?? 'No se pudo completar la solicitud.',
      response.status,
    );
  }

  return payload as T;
}

export function saveSession(accessToken: string, user: unknown): void {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getSessionUser<T>(): T | null {
  if (typeof localStorage === 'undefined') return null;
  const value = localStorage.getItem(USER_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/** Redirige al login si no hay sesión. Devuelve true si hay sesión válida. */
export function requireSession(): boolean {
  if (!getToken() || !getSessionUser()) {
    clearSession();
    window.location.replace('/login');
    return false;
  }
  return true;
}

export function isNetworkError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0;
}
