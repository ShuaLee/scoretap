import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ApiError,
  createGamePlayer,
  createGameTeam,
  createQuickGame,
  getCurrentUser,
  login,
  logout,
  refreshSession,
  register,
  type Game,
  type User,
} from './api'
import './App.css'

type AuthMode = 'login' | 'register'
type TrackingMode = 'own_team' | 'both_teams'

const today = new Date().toISOString().slice(0, 10)
const passwordRequirements =
  'Use at least 8 characters with an uppercase letter, lowercase letter, number, and symbol.'
const passwordPattern = '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,}$'

function splitRoster(value: string) {
  return value
    .split('\n')
    .map((name) => name.trim())
    .filter(Boolean)
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authVisible, setAuthVisible] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [activeView, setActiveView] = useState<'home' | 'quick-game'>('home')
  const [teamsHelpOpen, setTeamsHelpOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [innings, setInnings] = useState(7)
  const trackingMode: TrackingMode = 'own_team'
  const [yourTeamName, setYourTeamName] = useState('Team 1')
  const [opponentTeamName, setOpponentTeamName] = useState('Team 2')
  const [primarySide, setPrimarySide] = useState<'home' | 'away'>('home')
  const [yourRoster, setYourRoster] = useState('')
  const [savedGame, setSavedGame] = useState<Game | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const displayNameInputRef = useRef<HTMLInputElement>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)
  const passwordInputRef = useRef<HTMLInputElement>(null)
  const yourTeamNameInputRef = useRef<HTMLInputElement>(null)
  const opponentTeamNameInputRef = useRef<HTMLInputElement>(null)

  const yourPlayers = useMemo(() => splitRoster(yourRoster), [yourRoster])

  useEffect(() => {
    async function restoreSession() {
      try {
        const current = await getCurrentUser()
        setUser(current.user)
      } catch {
        try {
          await refreshSession()
          const current = await getCurrentUser()
          setUser(current.user)
        } catch {
          setUser(null)
        }
      } finally {
        setIsLoading(false)
      }
    }

    restoreSession()
  }, [])

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    clearAuthInputValidity()
    setIsAuthSubmitting(true)
    try {
      if (authMode === 'login') {
        const response = await login(email, password)
        setUser(response.user)
        setAuthVisible(false)
        setMessage('Signed in.')
      } else {
        const response = await register(email, password, displayName)
        setUser(response.user)
        setAuthVisible(false)
      }
    } catch (authError) {
      if (authError instanceof ApiError && Object.keys(authError.fields).length > 0) {
        reportAuthFieldErrors(authError.fields)
      } else {
        setError(authError instanceof Error ? authError.message : 'Authentication failed.')
      }
    } finally {
      setIsAuthSubmitting(false)
    }
  }

  function handlePasswordInvalid(event: FormEvent<HTMLInputElement>) {
    const input = event.currentTarget
    if (authMode === 'register' && input.validity.patternMismatch) {
      input.setCustomValidity(passwordRequirements)
    }
  }

  function clearAuthInputValidity() {
    displayNameInputRef.current?.setCustomValidity('')
    emailInputRef.current?.setCustomValidity('')
    passwordInputRef.current?.setCustomValidity('')
  }

  function reportAuthFieldErrors(fields: Record<string, string[]>) {
    const fieldTargets: Record<string, HTMLInputElement | null> = {
      display_name: displayNameInputRef.current,
      email: emailInputRef.current,
      password: passwordInputRef.current,
    }
    const firstField = Object.keys(fields)[0]
    const firstTarget = fieldTargets[firstField]

    for (const [field, messages] of Object.entries(fields)) {
      fieldTargets[field]?.setCustomValidity(messages[0] ?? 'Please check this field.')
    }

    if (firstTarget) {
      firstTarget.focus()
      firstTarget.reportValidity()
    } else {
      setError(Object.values(fields)[0]?.[0] ?? 'Please check the submitted values.')
    }
  }

  function swapTeamSides() {
    setPrimarySide((side) => (side === 'home' ? 'away' : 'home'))
  }

  async function handleLogout() {
    setError('')
    clearAuthInputValidity()
    setMessage('')
    try {
      await logout()
    } finally {
      setUser(null)
      setSavedGame(null)
      setProfileMenuOpen(false)
      setActiveView('home')
    }
  }

  async function handleQuickGameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsSaving(true)

    try {
      const primarySideValue = primarySide
      const opponentSideValue = primarySideValue === 'home' ? 'away' : 'home'
      const game = await createQuickGame({
        opponent_name: opponentTeamName,
        game_date: today,
        number_of_innings: innings,
        tracking_mode: trackingMode,
      })

      const primaryGameTeam = await createGameTeam(game.id, {
        side: primarySideValue,
        display_name: yourTeamName,
        is_tracked: true,
      })

      await createGameTeam(game.id, {
        side: opponentSideValue,
        display_name: opponentTeamName,
        is_tracked: trackingMode === 'both_teams',
      })

      await Promise.all(
        yourPlayers.map((name, index) =>
          createGamePlayer(game.id, primaryGameTeam.id, {
            display_name: name,
            batting_order: index + 1,
          }),
        ),
      )

      setSavedGame(game)
      setMessage('Quick game setup saved.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save game setup.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <main className="app app-center">Loading</main>
  }

  if (!user) {
    return (
      <main className="app app-center">
        {!authVisible ? (
          <button className="primary-action" type="button" onClick={() => setAuthVisible(true)}>
            Log in
          </button>
        ) : (
          <section className="auth-panel" aria-label="Account access">
            <div className="segmented-control">
              <button
                className={authMode === 'login' ? 'active' : ''}
                type="button"
                onClick={() => setAuthMode('login')}
              >
                Log in
              </button>
              <button
                className={authMode === 'register' ? 'active' : ''}
                type="button"
                onClick={() => setAuthMode('register')}
              >
                Create account
              </button>
            </div>
            <form className="stack" onSubmit={handleAuthSubmit}>
              {authMode === 'register' && (
                <label>
                  Display name
                  <input
                    ref={displayNameInputRef}
                    value={displayName}
                    onChange={(event) => {
                      event.currentTarget.setCustomValidity('')
                      setDisplayName(event.target.value)
                    }}
                    autoComplete="name"
                    required
                  />
                </label>
              )}
              <label>
                Email
                <input
                  ref={emailInputRef}
                  value={email}
                  onChange={(event) => {
                    event.currentTarget.setCustomValidity('')
                    setEmail(event.target.value)
                  }}
                  type="email"
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                Password
                <input
                  ref={passwordInputRef}
                  value={password}
                  onChange={(event) => {
                    event.currentTarget.setCustomValidity('')
                    setPassword(event.target.value)
                  }}
                  onInvalid={handlePasswordInvalid}
                  type="password"
                  autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                  minLength={authMode === 'register' ? 8 : undefined}
                  pattern={authMode === 'register' ? passwordPattern : undefined}
                  title={authMode === 'register' ? passwordRequirements : undefined}
                  required
                />
                {authMode === 'register' && (
                  <span className="field-hint">{passwordRequirements}</span>
                )}
              </label>
              <button className="primary-action" type="submit" disabled={isAuthSubmitting}>
                {isAuthSubmitting ? 'Working' : authMode === 'login' ? 'Log in' : 'Create account'}
              </button>
            </form>
          </section>
        )}
        {message && <p className="status-message">{message}</p>}
        {error && <p className="error-message">{error}</p>}
      </main>
    )
  }

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            ST
          </div>
          <span>ScoreTap</span>
        </div>
        {activeView === 'quick-game' && (
          <div className="nav-title">
            <button
              className="back-button"
              type="button"
              aria-label="Back to dashboard"
              onClick={() => setActiveView('home')}
            >
              ←
            </button>
            <span>Quick Game Setup</span>
          </div>
        )}
        <div className="profile-menu">
          <button
            className="profile-button"
            type="button"
            aria-label="Open profile menu"
            aria-expanded={profileMenuOpen}
            onClick={() => setProfileMenuOpen((isOpen) => !isOpen)}
          >
            {user.profile?.display_name?.slice(0, 1).toUpperCase() || user.email.slice(0, 1).toUpperCase()}
          </button>
          {profileMenuOpen && (
            <div className="profile-dropdown">
              <button type="button" onClick={() => setProfileMenuOpen(false)}>
                Settings
              </button>
              <button type="button" onClick={handleLogout}>
                Log out
              </button>
            </div>
          )}
        </div>
      </header>

      {activeView === 'home' && (
        <section className="home-actions" aria-label="Game actions">
          <button className="primary-action" type="button" onClick={() => setActiveView('quick-game')}>
            Quick Game
          </button>
          <button type="button" disabled>
            Team Play
          </button>
        </section>
      )}

      {activeView === 'quick-game' && (
      <form className="setup-card" onSubmit={handleQuickGameSubmit}>
        <section className="form-block">
          <div className="section-heading">
            <h2>Teams</h2>
            <button
              className="help-button"
              type="button"
              aria-label="Teams help"
              aria-expanded={teamsHelpOpen}
              onClick={() => setTeamsHelpOpen((isOpen) => !isOpen)}
            >
              ?
            </button>
            {teamsHelpOpen && (
              <div className="help-popover">
                <p>Team 1 is the primary team. Track my team only records Team 1 batting and lets Team 2 runs be entered later by inning.</p>
                <p>Track both teams records batting orders for both teams. Home/away controls which side each team uses.</p>
              </div>
            )}
          </div>
          <div className="team-name-list">
            <div className="team-name-field">
              <span className="team-input-row">
                <span className="side-label">{primarySide === 'home' ? 'Home Team' : 'Away'}</span>
                <button
                  className="side-swap-button"
                  type="button"
                  aria-label="Swap home and away"
                  onClick={swapTeamSides}
                >
                  ⇅
                </button>
                <input
                  ref={yourTeamNameInputRef}
                  value={yourTeamName}
                  onChange={(event) => setYourTeamName(event.target.value)}
                  aria-label="Team 1 name"
                  placeholder="Team 1"
                  required
                />
              </span>
            </div>
            <div className="team-name-field">
              <span className="team-input-row">
                <span className="side-label">{primarySide === 'home' ? 'Away' : 'Home Team'}</span>
                <button
                  className="side-swap-button"
                  type="button"
                  aria-label="Swap home and away"
                  onClick={swapTeamSides}
                >
                  ⇅
                </button>
                <input
                  ref={opponentTeamNameInputRef}
                  value={opponentTeamName}
                  onChange={(event) => setOpponentTeamName(event.target.value)}
                  aria-label="Team 2 name"
                  placeholder="Team 2"
                  required
                />
              </span>
            </div>
          </div>
        </section>

        <section className="form-block">
          <h2>Game</h2>
          <label>
            Innings
            <input
              value={innings}
              onChange={(event) => setInnings(Number(event.target.value))}
              type="number"
              min={1}
              max={20}
              required
            />
          </label>
        </section>

        <section className="form-block">
          <h2>Team 1 Roster</h2>
          <label>
            Batting order
            <textarea
              value={yourRoster}
              onChange={(event) => setYourRoster(event.target.value)}
              placeholder={'Jake\nSam\nCasey'}
              rows={8}
              required
            />
          </label>
        </section>

        <footer className="setup-footer">
          <div>
            {message && <p className="status-message">{message}</p>}
            {error && <p className="error-message">{error}</p>}
            {savedGame && <p className="saved-message">Saved game #{savedGame.id}</p>}
          </div>
          <button className="primary-action" type="submit" disabled={isSaving}>
            {isSaving ? 'Saving' : 'Start game'}
          </button>
        </footer>
      </form>
      )}
    </main>
  )
}

export default App
