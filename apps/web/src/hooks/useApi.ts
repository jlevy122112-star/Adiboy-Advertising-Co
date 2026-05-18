import { getAccessToken } from '../auth/useAuth'

type ApiOptions = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>
  json?: unknown
}

type ApiResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: string; status: number }

export async function apiFetch<T = unknown>(
  url: string,
  options: ApiOptions = {},
): Promise<ApiResult<T>> {
  const { json, headers = {}, ...rest } = options
  const token = getAccessToken()

  const init: RequestInit = {
    ...rest,
    headers: {
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
  }

  try {
    const res = await fetch(url, init)
    const text = await res.text()
    let data: unknown
    try { data = JSON.parse(text) } catch { data = text }

    if (!res.ok) {
      const error = (data as Record<string, unknown>)?.error as string ?? `http_${res.status}`
      return { ok: false, error, status: res.status }
    }
    return { ok: true, data: data as T, status: res.status }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'network_error', status: 0 }
  }
}

export function makeApi(baseUrl: string) {
  return {
    get: <T>(path: string, opts?: ApiOptions) => apiFetch<T>(`${baseUrl}${path}`, { method: 'GET', ...opts }),
    post: <T>(path: string, body: unknown, opts?: ApiOptions) => apiFetch<T>(`${baseUrl}${path}`, { method: 'POST', json: body, ...opts }),
    put: <T>(path: string, body: unknown, opts?: ApiOptions) => apiFetch<T>(`${baseUrl}${path}`, { method: 'PUT', json: body, ...opts }),
    del: <T>(path: string, opts?: ApiOptions) => apiFetch<T>(`${baseUrl}${path}`, { method: 'DELETE', ...opts }),
  }
}
