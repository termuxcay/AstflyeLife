import { useAuthStore } from '@/store/auth'

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3005'

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = useAuthStore.getState().accessToken
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }
  const res = await fetch(`${SERVER_URL}${path}`, { ...options, headers })
  if (res.status === 401) {
    useAuthStore.getState().clear()
    throw new Error('Unauthorized')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.json()
}
