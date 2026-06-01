import { useEffect, useRef } from 'react'
import type { User } from '../api'

const navItems = ['Home', 'Teams', 'Games']

type AppHeaderProps = {
  user: User
  title?: string
  profileMenuOpen: boolean
  onBack?: () => void
  onLogout: () => void
  onToggleProfileMenu: () => void
}

export function AppHeader({
  user,
  title,
  profileMenuOpen,
  onBack,
  onLogout,
  onToggleProfileMenu,
}: AppHeaderProps) {
  const profileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!profileMenuOpen) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        onToggleProfileMenu()
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onToggleProfileMenu()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onToggleProfileMenu, profileMenuOpen])

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">ST</span>
        </div>

        <nav className="top-nav" aria-label="Primary">
          {navItems.map((item) => (
            <button
              key={item}
              className={item === 'Home' ? 'active' : ''}
              type="button"
            >
              {item}
            </button>
          ))}
        </nav>

        {title && (
          <div className="header-title">
            {onBack && (
              <button className="icon-button" type="button" onClick={onBack} aria-label="Back">
                Back
              </button>
            )}
            <span>{title}</span>
          </div>
        )}

        <div className="profile-menu" ref={profileMenuRef}>
          <button
            className="profile-button"
            type="button"
            aria-label={`Open profile menu for ${user.profile?.display_name || user.email}`}
            aria-expanded={profileMenuOpen}
            onClick={onToggleProfileMenu}
          >
            <svg
              aria-hidden="true"
              className="profile-icon"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
            </svg>
          </button>
          {profileMenuOpen && (
            <div className="profile-dropdown">
              <button type="button">Profile</button>
              <button type="button" onClick={onLogout}>Log out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
