const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000'

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('fakemart_admin_token')
  const headers = {
    ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.message ?? `Request failed: ${response.status}`)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function formatMoney(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`
}
