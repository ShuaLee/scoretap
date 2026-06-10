import logo from '../assets/logo.png'

type TopNavProps = {
  hasActiveGame: boolean
  onHome: () => void
  onJoinWaitlist: () => void
  onOpenSettings?: () => void
  onStartGame: () => void
  variant: 'home' | 'setup'
}

export function TopNav({ hasActiveGame, onHome, onJoinWaitlist, onOpenSettings, onStartGame, variant }: TopNavProps) {
  return (
    <header className="top-nav" aria-label="Top navigation">
      <div className="top-nav-inner">
        <button className="logo-lockup" type="button" aria-label="Go to home" onClick={onHome}>
          <img className="logo-image" src={logo} alt="" aria-hidden="true" />
          <sup className="logo-beta">BETA</sup>
        </button>

        <div className="top-nav-actions">
          {variant === 'home' ? (
            <button className="new-game-button" type="button" onClick={onStartGame}>
              {hasActiveGame ? 'Continue Game' : 'Start New Game!'}
            </button>
          ) : (
            <button className="nav-waitlist-button" type="button" onClick={onJoinWaitlist}>
              Join Waitlist
            </button>
          )}
          {onOpenSettings && (
            <button className="nav-settings-button" type="button" aria-label="Open game settings" onClick={onOpenSettings}>
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M8.78 3.34 9.2 2h1.6l.42 1.34c.13.41.5.69.93.76.37.06.72.16 1.06.3.4.16.86.1 1.19-.17l1.06-.88 1.13 1.13-.88 1.06c-.27.33-.33.79-.17 1.19.14.34.24.69.3 1.06.07.43.35.8.76.93L18 9.2v1.6l-1.34.42c-.41.13-.69.5-.76.93-.06.37-.16.72-.3 1.06-.16.4-.1.86.17 1.19l.88 1.06-1.13 1.13-1.06-.88c-.33-.27-.79-.33-1.19-.17-.34.14-.69.24-1.06.3-.43.07-.8.35-.93.76L10.8 18H9.2l-.42-1.34c-.13-.41-.5-.69-.93-.76-.37-.06-.72-.16-1.06-.3-.4-.16-.86-.1-1.19.17l-1.06.88-1.13-1.13.88-1.06c.27-.33.33-.79.17-1.19-.14-.34-.24-.69-.3-1.06-.07-.43-.35-.8-.76-.93L2 10.8V9.2l1.34-.42c.41-.13.69-.5.76-.93.06-.37.16-.72.3-1.06.16-.4.1-.86-.17-1.19l-.88-1.06 1.13-1.13 1.06.88c.33.27.79.33 1.19.17.34-.14.69-.24 1.06-.3.43-.07.8-.35.93-.76Z" />
                <circle cx="10" cy="10" r="2.65" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
