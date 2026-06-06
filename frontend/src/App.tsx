import { useCallback, useState } from 'react'
import { MainArea } from './components/MainArea'
import { TopNav } from './components/TopNav'
import { GameSetupPage, type GameConfig } from './pages/GameSetupPage'
import { HomePage } from './pages/HomePage'
import { ScoreGamePage, type PersistedGameState } from './pages/ScoreGamePage'

type Page = 'home' | 'game-setup' | 'score-game'
type StoredGame = {
  version: 1
  gameConfig: GameConfig
  gameState: PersistedGameState
}

const ACTIVE_GAME_STORAGE_KEY = 'scoretap.activeGame'
const defaultGameConfig: GameConfig = {
  homeTeam: 'teamOne',
  innings: 7,
  teamOneName: 'Team 1',
  teamTwoName: 'Team 2',
  teamOnePlayers: [],
  teamOneTracksBatting: true,
  teamTwoPlayers: [],
  teamTwoTracksBatting: false,
}

export default function App() {
  const [storedGame, setStoredGame] = useState<StoredGame | null>(() => readStoredGame())
  const [page, setPage] = useState<Page>(() => (storedGame ? 'score-game' : 'home'))
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false)
  const [gameConfig, setGameConfig] = useState<GameConfig>(() => storedGame?.gameConfig ?? defaultGameConfig)

  function beginGame(config: GameConfig) {
    setGameConfig(config)
    setStoredGame(null)
    localStorage.removeItem(ACTIVE_GAME_STORAGE_KEY)
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
      version: 1 as const,
      gameConfig,
      gameState,
    }

    setStoredGame(nextStoredGame)
    localStorage.setItem(ACTIVE_GAME_STORAGE_KEY, JSON.stringify(nextStoredGame))
  }, [gameConfig])

  function endActiveGame() {
    setStoredGame(null)
    setGameConfig(defaultGameConfig)
    localStorage.removeItem(ACTIVE_GAME_STORAGE_KEY)
    setPage('home')
  }

  function updateActiveGameConfig(config: GameConfig) {
    setGameConfig(config)
    setStoredGame((currentStoredGame) => {
      if (!currentStoredGame) {
        return currentStoredGame
      }

      const nextStoredGame = {
        ...currentStoredGame,
        gameConfig: config,
      }

      localStorage.setItem(ACTIVE_GAME_STORAGE_KEY, JSON.stringify(nextStoredGame))
      return nextStoredGame
    })
  }

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
            onEndGame={endActiveGame}
            onGameConfigChange={updateActiveGameConfig}
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

    const parsedStoredGame = JSON.parse(rawStoredGame) as Partial<StoredGame>
    if (!isStoredGame(parsedStoredGame)) {
      localStorage.removeItem(ACTIVE_GAME_STORAGE_KEY)
      return null
    }

    return parsedStoredGame
  } catch {
    localStorage.removeItem(ACTIVE_GAME_STORAGE_KEY)
    return null
  }
}

function isStoredGame(value: Partial<StoredGame>): value is StoredGame {
  return value.version === 1 && isGameConfig(value.gameConfig) && isPersistedGameState(value.gameState)
}

function isGameConfig(value: unknown): value is GameConfig {
  if (!value || typeof value !== 'object') {
    return false
  }

  const gameConfig = value as GameConfig
  return (
    (gameConfig.homeTeam === 'teamOne' || gameConfig.homeTeam === 'teamTwo') &&
    typeof gameConfig.innings === 'number' &&
    gameConfig.innings >= 1 &&
    gameConfig.innings <= 20 &&
    typeof gameConfig.teamOneName === 'string' &&
    typeof gameConfig.teamTwoName === 'string' &&
    Array.isArray(gameConfig.teamOnePlayers) &&
    gameConfig.teamOnePlayers.every((player) => typeof player === 'string') &&
    typeof gameConfig.teamOneTracksBatting === 'boolean' &&
    Array.isArray(gameConfig.teamTwoPlayers) &&
    gameConfig.teamTwoPlayers.every((player) => typeof player === 'string') &&
    typeof gameConfig.teamTwoTracksBatting === 'boolean'
  )
}

function isPersistedGameState(value: unknown): value is PersistedGameState {
  if (!value || typeof value !== 'object') {
    return false
  }

  const gameState = value as PersistedGameState
  return (
    typeof gameState.awayBatterIndex === 'number' &&
    typeof gameState.awayScore === 'number' &&
    typeof gameState.homeBatterIndex === 'number' &&
    typeof gameState.homeScore === 'number' &&
    typeof gameState.inning === 'number' &&
    typeof gameState.outs === 'number' &&
    (gameState.halfInning === 'top' || gameState.halfInning === 'bottom') &&
    Boolean(gameState.bases) &&
    Array.isArray(gameState.pendingScorers) &&
    Boolean(gameState.scoreAdjustments) &&
    Boolean(gameState.scoreModification) &&
    Array.isArray(gameState.teamOnePlayers) &&
    Array.isArray(gameState.teamTwoPlayers)
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
