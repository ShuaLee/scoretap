import { useState } from 'react'
import gameplayPreview from '../assets/download.png'

export function HomePage() {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('submitting')
    const form = event.currentTarget
    const data = new FormData(form)
    try {
      const res = await fetch('https://formspree.io/f/mgobqqyy', {
        method: 'POST',
        body: data,
        headers: { Accept: 'application/json' },
      })
      if (res.ok) {
        setStatus('success')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <section className="home-page" aria-label="Scoretap home">
      <div className="home-copy">
        <span className="home-eyebrow">Free tracker — full app coming soon</span>
        <h1>Simple Softball Game Tracking.</h1>
        <p>
          We're building a full beer league management app — team rosters, player stats,
          league standings, and more. While we put the finishing touches on it, we've
          released this free game tracker so you can start keeping score today.
        </p>

        <div className="home-actions">
          <div className="waitlist-signup">
            {status === 'success' ? (
              <p className="waitlist-success">You're on the list! We'll be in touch.</p>
            ) : (
              <>
                <form className="home-waitlist-form" onSubmit={handleSubmit}>
                  <input type="email" name="email" placeholder="Email address" required />
                  <button type="submit" disabled={status === 'submitting'}>
                    {status === 'submitting' ? 'Joining…' : 'Join Waitlist'}
                  </button>
                </form>
                {status === 'error' && <p className="form-error">Something went wrong. Please try again.</p>}
                <span>Get notified when the full app launches.</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="home-mockup" aria-label="App gameplay preview">
        <div className="home-mockup-preview">
          <img src={gameplayPreview} alt="Gameplay screen preview" className="home-mockup-img" />
        </div>
      </div>
    </section>
  )
}

