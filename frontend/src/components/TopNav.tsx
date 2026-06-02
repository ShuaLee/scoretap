import logo from '../assets/logo.png'

type TopNavProps = {
  onHome: () => void
  onJoinWaitlist: () => void
  onStartGame: () => void
  variant: 'home' | 'setup'
}

export function TopNav({ onHome, onJoinWaitlist, onStartGame, variant }: TopNavProps) {
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
              Start New Game!
            </button>
          ) : (
            <button className="nav-waitlist-button" type="button" onClick={onJoinWaitlist}>
              Join Waitlist
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
