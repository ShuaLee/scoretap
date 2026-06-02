import logo from '../assets/logo.png'

type TopNavProps = {
  onStartGame: () => void
}

export function TopNav({ onStartGame }: TopNavProps) {
  return (
    <header className="top-nav" aria-label="Top navigation">
      <div className="top-nav-inner">
        <div className="logo-lockup" aria-label="Scoretap">
          <img className="logo-image" src={logo} alt="" aria-hidden="true" />
          <sup className="logo-beta">BETA</sup>
        </div>

        <div className="top-nav-actions">
          <button className="new-game-button" type="button" onClick={onStartGame}>
            New Game
          </button>
          <button className="waitlist-button" type="button">
            Join Waitlist
          </button>
        </div>
      </div>
    </header>
  )
}
