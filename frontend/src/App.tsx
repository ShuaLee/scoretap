import { useState } from 'react'
import { Footer } from './components/Footer'
import { MainArea } from './components/MainArea'
import { TopNav } from './components/TopNav'
import { GameSetupPage } from './pages/GameSetupPage'
import { HomePage } from './pages/HomePage'
import { ScoreGamePage } from './pages/ScoreGamePage'

type Page = 'home' | 'game-setup' | 'score-game'

export default function App() {
  const [page, setPage] = useState<Page>('home')

  if (page === 'score-game') {
    return <ScoreGamePage />
  }

  return (
    <div className="app-shell">
      <TopNav />
      <MainArea>
        {page === 'home' && <HomePage onStartGame={() => setPage('game-setup')} />}
        {page === 'game-setup' && <GameSetupPage onBeginGame={() => setPage('score-game')} />}
      </MainArea>
      <Footer />
    </div>
  )
}
