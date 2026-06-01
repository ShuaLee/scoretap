import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, login, register, type User } from '../../api'

type AuthMode = 'login' | 'register'

type AuthScreenProps = {
  onAuthenticated: (user: User) => void
}

const passwordRequirements =
  'Use at least 8 characters with an uppercase letter, lowercase letter, number, and symbol.'
const passwordPattern = '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,}$'

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [authVisible, setAuthVisible] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const displayNameInputRef = useRef<HTMLInputElement>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)
  const passwordInputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    clearValidity()
    setIsSubmitting(true)

    try {
      const response =
        authMode === 'login'
          ? await login(email, password)
          : await register(email, password, displayName)
      onAuthenticated(response.user)
    } catch (authError) {
      if (authError instanceof ApiError && Object.keys(authError.fields).length > 0) {
        reportFieldErrors(authError.fields)
      } else {
        setError(authError instanceof Error ? authError.message : 'Authentication failed.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  function clearValidity() {
    displayNameInputRef.current?.setCustomValidity('')
    emailInputRef.current?.setCustomValidity('')
    passwordInputRef.current?.setCustomValidity('')
  }

  function reportFieldErrors(fields: Record<string, string[]>) {
    const targets: Record<string, HTMLInputElement | null> = {
      display_name: displayNameInputRef.current,
      email: emailInputRef.current,
      password: passwordInputRef.current,
    }
    const firstField = Object.keys(fields)[0]
    const firstTarget = targets[firstField]

    for (const [field, messages] of Object.entries(fields)) {
      targets[field]?.setCustomValidity(messages[0] ?? 'Please check this field.')
    }

    if (firstTarget) {
      firstTarget.focus()
      firstTarget.reportValidity()
    } else {
      setError(Object.values(fields)[0]?.[0] ?? 'Please check the submitted values.')
    }
  }

  return (
    <main className="app app-center auth-screen">
      {!authVisible ? (
        <button className="primary-action large-action" type="button" onClick={() => setAuthVisible(true)}>
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

          <form className="form-stack" onSubmit={handleSubmit}>
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
                type="password"
                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                minLength={authMode === 'register' ? 8 : undefined}
                pattern={authMode === 'register' ? passwordPattern : undefined}
                title={authMode === 'register' ? passwordRequirements : undefined}
                required
              />
              {authMode === 'register' && <span className="field-hint">{passwordRequirements}</span>}
            </label>
            <button className="primary-action" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Working' : authMode === 'login' ? 'Log in' : 'Create account'}
            </button>
          </form>
        </section>
      )}
      {error && <p className="error-message">{error}</p>}
    </main>
  )
}
