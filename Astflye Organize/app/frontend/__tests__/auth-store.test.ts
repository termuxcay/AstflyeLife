import { useAuthStore } from '@/store/auth'

beforeEach(() => useAuthStore.getState().clear())

test('initial state is unauthenticated', () => {
  expect(useAuthStore.getState().isAuthenticated()).toBe(false)
})

test('setTokens marks authenticated', () => {
  useAuthStore.getState().setTokens('access-123', 'refresh-456')
  expect(useAuthStore.getState().isAuthenticated()).toBe(true)
  expect(useAuthStore.getState().accessToken).toBe('access-123')
})

test('clear removes tokens', () => {
  useAuthStore.getState().setTokens('access-123', 'refresh-456')
  useAuthStore.getState().clear()
  expect(useAuthStore.getState().isAuthenticated()).toBe(false)
})
