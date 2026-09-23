import Taro from '@tarojs/taro'
import { syncDefaultAddress } from './address'

declare const FAKEMART_API_BASE: string

function inferApiBase(): string {
  if (typeof window !== 'undefined' && window.location) {
    const { hostname, origin } = window.location
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:4000'
    }
    return `${origin}/fakemart/api`
  }

  return 'http://localhost:4000'
}

const API_BASE = FAKEMART_API_BASE || inferApiBase()
const TOKEN_KEY = 'fakemart_user_token'
const SESSION_KEY = 'fakemart_session_id'

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export function sessionId(): string {
  let current = Taro.getStorageSync<string>(SESSION_KEY)
  if (!current) {
    current = `session_${Date.now()}_${Math.random().toString(16).slice(2)}`
    Taro.setStorageSync(SESSION_KEY, current)
  }
  return current
}

export function token(): string {
  return Taro.getStorageSync<string>(TOKEN_KEY) || ''
}

export function setToken(nextToken: string): void {
  Taro.setStorageSync(TOKEN_KEY, nextToken)
}

export async function request<T>(path: string, method: Method = 'GET', data?: unknown): Promise<T> {
  const authToken = token()
  const header = {
    ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
  }
  const response = await Taro.request<T>({
    url: `${API_BASE}${path}`,
    method,
    data,
    header
  })
  if (response.statusCode < 200 || response.statusCode >= 300) {
    const message = typeof response.data === 'object' && response.data && 'message' in response.data
      ? String((response.data as { message?: string }).message)
      : '请求失败'
    throw new Error(message)
  }
  return response.data
}

export async function ensureAuth(): Promise<void> {
  if (token()) return
  let code = ''
  try {
    const loginResult = await Taro.login()
    code = loginResult.code
  } catch {
    code = `h5_${Date.now()}`
  }
  const result = await request<{ token: string; user?: { defaultAddressLabel?: string | null } }>('/auth/wechat', 'POST', {
    code,
    nickname: '假装购用户',
    platform: Taro.getEnv() === Taro.ENV_TYPE.WEAPP ? 'wechat_mp' : 'h5'
  })
  setToken(result.token)
  syncDefaultAddress(result.user?.defaultAddressLabel)
}

export async function track(eventName: string, properties: Record<string, unknown> = {}, pagePath = ''): Promise<void> {
  try {
    await ensureAuth()
    await request('/events', 'POST', {
      events: [
        {
          eventName,
          sessionId: sessionId(),
          platform: Taro.getEnv() === Taro.ENV_TYPE.WEAPP ? 'wechat_mp' : 'h5',
          pagePath,
          occurredAt: new Date().toISOString(),
          appVersion: '0.1.0',
          properties
        }
      ]
    })
  } catch (error) {
    console.warn('track failed', error)
  }
}

export function formatMoney(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`
}
