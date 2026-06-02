export function HomePage() {
  return (
    <section className="home-page" aria-label="Scoretap home">
      <div className="home-copy">
        <span className="home-eyebrow">Free beta now available</span>
        <h1>Softball Scorekeeping Made Easy.</h1>
        <p>
          Track and record your games now with a simple beta scorekeeping tool.
          The full launch will bring league management, team tracking, player
          stats, and team stats together in one place.
        </p>

        <div className="home-actions">
          <div className="waitlist-signup">
            <form className="home-waitlist-form">
              <input type="email" placeholder="Email address" />
              <button type="submit">Join Waitlist</button>
            </form>
            <span>Get notified when the full app launches.</span>
          </div>
        </div>
      </div>

      <div className="home-mockup" aria-label="Softball field mockup placeholder">
        <svg viewBox="0 0 520 420" aria-hidden="true">
          <rect width="520" height="420" rx="28" fill="var(--color-navy)" />
          <path
            d="M260 340 L108 220 L260 100 L412 220 Z"
            fill="var(--color-dark-green)"
            stroke="var(--color-gold-light)"
            strokeWidth="2"
          />
          <path
            d="M260 340 L108 220 M260 340 L412 220 M108 220 L260 100 M260 100 L412 220"
            fill="none"
            stroke="var(--color-gold)"
            strokeLinecap="round"
            strokeWidth="2"
          />
          <Base x={260} y={340} />
          <Base x={412} y={220} />
          <Base x={260} y={100} />
          <Base x={108} y={220} />
        </svg>
      </div>
    </section>
  )
}

type BaseProps = {
  x: number
  y: number
}

function Base({ x, y }: BaseProps) {
  return (
    <rect
      x={x - 13}
      y={y - 13}
      width="26"
      height="26"
      fill="#ffffff"
      stroke="#e7e5f2"
      strokeWidth="2"
      transform={`rotate(45 ${x} ${y})`}
    />
  )
}
