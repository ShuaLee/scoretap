export function TopNav() {
  return (
    <header className="top-nav" aria-label="Top navigation">
      <div className="top-nav-inner">
        <div className="logo-lockup" aria-label="Scoretap">
          <span className="logo-mark" aria-hidden="true">
            ST
          </span>
          <sup className="logo-beta">BETA</sup>
        </div>

        <div className="top-nav-actions">
          <button className="waitlist-button" type="button">
            Join Waitlist
          </button>
        </div>
      </div>
    </header>
  )
}
