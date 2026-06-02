import { useState } from 'react'
import { MainArea } from './components/MainArea'
import { TopNav } from './components/TopNav'
import { GameSetupPage } from './pages/GameSetupPage'
import { HomePage } from './pages/HomePage'
import { ScoreGamePage } from './pages/ScoreGamePage'

type Page = 'home' | 'game-setup' | 'score-game'

export default function App() {
  const [page, setPage] = useState<Page>('home')
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false)

  if (page === 'score-game') {
    return <ScoreGamePage />
  }

  return (
    <div className="app-shell">
      <TopNav
        onHome={() => setPage('home')}
        onJoinWaitlist={() => setIsWaitlistOpen(true)}
        onStartGame={() => setPage('game-setup')}
        variant={page === 'home' ? 'home' : 'setup'}
      />
      <MainArea>
        {page === 'home' && <HomePage />}
        {page === 'game-setup' && <GameSetupPage onBeginGame={() => setPage('score-game')} />}
      </MainArea>
      {isWaitlistOpen && <WaitlistModal onClose={() => setIsWaitlistOpen(false)} />}
    </div>
  )
}

type WaitlistModalProps = {
  onClose: () => void
}

function WaitlistModal({ onClose }: WaitlistModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="waitlist-modal"
        role="dialog"
        aria-labelledby="waitlist-modal-title"
        aria-modal="true"
      >
        <button className="modal-close-button" type="button" aria-label="Close waitlist" onClick={onClose}>
          <span aria-hidden="true" />
        </button>
        <span className="modal-eyebrow">Launch updates</span>
        <h2 id="waitlist-modal-title">Join the waitlist</h2>
        <p>Enter your email and we will let you know when the full app is ready.</p>
        <form className="modal-waitlist-form" onSubmit={(event) => event.preventDefault()}>
          <input type="email" placeholder="Email address" autoFocus />
          <button type="submit">Join Waitlist</button>
        </form>
      </section>
    </div>
  )
}
