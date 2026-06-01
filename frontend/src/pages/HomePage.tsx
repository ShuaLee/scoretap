type HomePageProps = {
  onStartGame: () => void
}

export function HomePage({ onStartGame }: HomePageProps) {
  return (
    <section className="home-page" aria-label="Scoretap home">
      <div className="home-copy">
        <span className="home-kicker">Coming Soon</span>
        <h1>Your complete softball score tracking, league management, and team tracking app.</h1>
        <p>
          Track games for free now while the full Scoretap beta is being built.
        </p>

        <div className="home-actions">
          <button className="home-start-button" type="button" onClick={onStartGame}>
            Start New Game
          </button>
          <form className="home-waitlist-form">
            <input type="email" placeholder="Email for full launch" />
            <button type="submit">Join Waitlist</button>
          </form>
        </div>
      </div>

      <div className="home-mockup" aria-label="Softball field mockup placeholder">
        <svg viewBox="0 0 520 420" aria-hidden="true">
          <rect width="520" height="420" rx="28" fill="#343241" />
          <path
            d="M260 340 L108 220 L260 100 L412 220 Z"
            fill="#454254"
            stroke="#68637a"
            strokeWidth="2"
          />
          <path
            d="M260 340 L108 220 M260 340 L412 220 M108 220 L260 100 M260 100 L412 220"
            fill="none"
            stroke="#7b7590"
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
