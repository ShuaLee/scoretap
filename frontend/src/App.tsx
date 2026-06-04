import { useCallback, useState } from 'react'
import { MainArea } from './components/MainArea'
import { TopNav } from './components/TopNav'
import { GameSetupPage, type GameConfig } from './pages/GameSetupPage'
import { HomePage } from './pages/HomePage'
import { ScoreGamePage, type PersistedGameState } from './pages/ScoreGamePage'

type Page = 'home' | 'game-setup' | 'score-game'
type StoredGame = {
  gameConfig: GameConfig
  gameState: PersistedGameState
}

const ACTIVE_GAME_STORAGE_KEY = 'scoretap.activeGame'
const defaultGameConfig: GameConfig = {
  teamOneName: 'Team 1',
  teamTwoName: 'Team 2',
  teamOnePlayers: [],
  teamTwoPlayers: [],
}

export default function App() {
  const [storedGame, setStoredGame] = useState<StoredGame | null>(() => readStoredGame())
  const [page, setPage] = useState<Page>(() => (readStoredGame() ? 'score-game' : 'home'))
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false)
  const [gameConfig, setGameConfig] = useState<GameConfig>(() => storedGame?.gameConfig ?? defaultGameConfig)

  function beginGame(config: GameConfig) {
    setGameConfig(config)
    setStoredGame(null)
    setPage('score-game')
  }

  function startOrContinueGame() {
    if (storedGame) {
      setGameConfig(storedGame.gameConfig)
      setPage('score-game')
      return
    }

    setPage('game-setup')
  }

  const persistGameState = useCallback((gameState: PersistedGameState) => {
    const nextStoredGame = {
      gameConfig,
      gameState,
    }

    setStoredGame(nextStoredGame)
    localStorage.setItem(ACTIVE_GAME_STORAGE_KEY, JSON.stringify(nextStoredGame))
  }, [gameConfig])

  return (
    <div className={page === 'score-game' ? 'app-shell score-app-shell' : 'app-shell'}>
      <TopNav
        hasActiveGame={Boolean(storedGame)}
        onHome={() => setPage('home')}
        onJoinWaitlist={() => setIsWaitlistOpen(true)}
        onStartGame={startOrContinueGame}
        variant={page === 'home' ? 'home' : 'setup'}
      />
      <MainArea>
        {page === 'home' && <HomePage />}
        {page === 'game-setup' && <GameSetupPage onBeginGame={beginGame} />}
        {page === 'score-game' && (
          <ScoreGamePage
            gameConfig={gameConfig}
            initialState={storedGame?.gameConfig === gameConfig ? storedGame.gameState : undefined}
            onGameStateChange={persistGameState}
          />
        )}
      </MainArea>
      {isWaitlistOpen && <WaitlistModal onClose={() => setIsWaitlistOpen(false)} />}
    </div>
  )
}

function readStoredGame() {
  try {
    const rawStoredGame = localStorage.getItem(ACTIVE_GAME_STORAGE_KEY)
    if (!rawStoredGame) {
      return null
    }

    return JSON.parse(rawStoredGame) as StoredGame
  } catch {
    localStorage.removeItem(ACTIVE_GAME_STORAGE_KEY)
    return null
  }
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
