export type ApiResult<T> =
  | { ok: true;  data: T;      status: number }
  | { ok: false; error: string; status: number }

interface FetchOptions {
  method?: string
  json?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
}

export async function apiFetch<T>(
  url: string,
  options: FetchOptions = {},
): Promise<ApiResult<T>> {
  const { method = 'GET', json, headers = {}, signal } = options

  const init: RequestInit = { method, signal }

  if (json !== undefined) {
    init.body = JSON.stringify(json)
    headers['Content-Type'] = 'application/json'
  }

  init.headers = headers

  try {
    const res = await fetch(url, init)
    const text = await res.text()

    let data: unknown
    try { data = JSON.parse(text) } catch { data = text }

    if (!res.ok) {
      const msg =
        (data && typeof data === 'object' && 'error' in data && typeof (data as Record<string,unknown>).error === 'string')
          ? (data as Record<string,unknown>).error as string
          : `HTTP ${res.status}`
      return { ok: false, error: msg, status: res.status }
    }

    return { ok: true, data: data as T, status: res.status }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error', status: 0 }
  }
}
