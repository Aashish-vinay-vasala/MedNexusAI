export const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? 'http://localhost:8000'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(method: string, path: string, body?: unknown, timeoutMs = 8000): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new ApiError(res.status, text || `Request failed: ${method} ${path} (${res.status})`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

/** GETs are idempotent, so retry once on a network-level failure (not on a real
 * non-2xx ApiError) before giving up — absorbs transient connection hiccups instead
 * of surfacing a spurious error for a read that would succeed a moment later. */
export async function apiGet<T>(path: string, timeoutMs?: number): Promise<T> {
  try {
    return await request<T>('GET', path, undefined, timeoutMs)
  } catch (err) {
    if (err instanceof ApiError) throw err
    await new Promise(r => setTimeout(r, 250))
    return request<T>('GET', path, undefined, timeoutMs)
  }
}
export const apiPost = <T>(path: string, body?: unknown, timeoutMs?: number): Promise<T> => request<T>('POST', path, body, timeoutMs)
export const apiPut = <T>(path: string, body?: unknown, timeoutMs?: number): Promise<T> => request<T>('PUT', path, body, timeoutMs)
export const apiPatch = <T>(path: string, body?: unknown, timeoutMs?: number): Promise<T> => request<T>('PATCH', path, body, timeoutMs)
export const apiDelete = (path: string, timeoutMs?: number): Promise<void> => request<void>('DELETE', path, undefined, timeoutMs)

/**
 * Calls a backend JSON endpoint expecting `{ content: string }`. Returns the
 * content on success, or null on any failure (network, timeout, non-2xx,
 * missing field) — used only for optional AI-generated narrative text, where
 * the caller shows a short "unavailable" message rather than fabricated content.
 */
export async function fetchGeneratedContent(url: string, body: unknown, timeoutMs = 8000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (res.ok) {
      const data = await res.json()
      return data.content ?? null
    }
  } catch { /* fall through to caller's fallback */ }
  return null
}
