const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'

export class ApiError extends Error {
  fields: Record<string, string[]>

  constructor(message: string, fields: Record<string, string[]> = {}) {
    super(message)
    this.name = 'ApiError'
    this.fields = fields
  }
}

export type User = {
  id: number
  email: string
  is_email_verified: boolean
  profile?: {
    display_name: string
    timezone: string
    locale: string
    avatar_url: string
  }
}

export type Game = {
  id: number
  game_type: 'quick' | 'team'
  tracking_mode: 'own_team' | 'both_teams'
  team: number | null
  opponent_name: string
  number_of_innings: number
  game_date: string
  status: string
}

export type GameTeam = {
  id: number
  game: number
  side: 'home' | 'away'
  display_name: string
  is_tracked: boolean
}

type RequestOptions = {
  method?: string
  body?: unknown
  csrf?: boolean
}

function getCookie(name: string) {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1]
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: HeadersInit = {
    Accept: 'application/json',
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  if (options.csrf) {
    const csrfToken = getCookie('csrftoken')
    if (csrfToken) {
      headers['X-CSRFToken'] = decodeURIComponent(csrfToken)
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  const data = response.status === 204 ? null : await response.json().catch(() => null)

  if (!response.ok) {
    const fields = data?.error?.fields ?? {}
    const detail = data?.error?.message ?? data?.detail ?? data?.non_field_errors?.[0] ?? data?.[0]
    throw new ApiError(detail || 'Request failed.', fields)
  }

  return data as T
}

export async function ensureCsrf() {
  return request<{ csrfToken: string }>('/accounts/auth/csrf/')
}

export async function getCurrentUser() {
  return request<{ user: User }>('/accounts/auth/me/')
}

export async function refreshSession() {
  await ensureCsrf()
  return request<{ detail: string }>('/accounts/auth/refresh/', {
    method: 'POST',
    csrf: true,
  })
}

export async function login(email: string, password: string) {
  await ensureCsrf()
  return request<{ user: User }>('/accounts/auth/login/', {
    method: 'POST',
    csrf: true,
    body: { email, password },
  })
}

export async function register(email: string, password: string, displayName: string) {
  await ensureCsrf()
  return request<{ user: User; detail: string }>('/accounts/auth/register/', {
    method: 'POST',
    csrf: true,
    body: {
      email,
      password,
      display_name: displayName,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: navigator.language || 'en-US',
    },
  })
}

export async function logout() {
  await ensureCsrf()
  return request<{ detail: string }>('/accounts/auth/logout/', {
    method: 'POST',
    csrf: true,
    body: {},
  })
}

export async function createQuickGame(input: {
  opponent_name: string
  game_date: string
  number_of_innings: number
  tracking_mode: Game['tracking_mode']
  location?: string
  notes?: string
}) {
  await ensureCsrf()
  return request<Game>('/games/', {
    method: 'POST',
    csrf: true,
    body: input,
  })
}

export async function createGameTeam(gameId: number, input: {
  side: GameTeam['side']
  display_name: string
  is_tracked: boolean
}) {
  await ensureCsrf()
  return request<GameTeam>(`/games/${gameId}/teams/`, {
    method: 'POST',
    csrf: true,
    body: input,
  })
}

export async function createGamePlayer(gameId: number, gameTeamId: number, input: {
  display_name: string
  batting_order: number
}) {
  await ensureCsrf()
  return request(`/games/${gameId}/teams/${gameTeamId}/players/`, {
    method: 'POST',
    csrf: true,
    body: input,
  })
}
