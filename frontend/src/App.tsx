import { useState } from 'react'
import { HomePage } from './pages/HomePage'
import { LiveGamePage } from './pages/LiveGamePage'
import { SetupGamePage } from './pages/SetupGamePage'
import { useGameStore } from './stores/gameStore'

type AppScreen = 'home' | 'setup' | 'live'

function App() {
  const [screen, setScreen] = useState<AppScreen>('home')
  const currentGame = useGameStore((state) => state.currentGame)

  if (screen === 'setup') {
    return (
      <SetupGamePage
        onBack={() => setScreen('home')}
        onGameStarted={() => setScreen('live')}
      />
    )
  }

  if (screen === 'live' && currentGame) {
    return <LiveGamePage onExit={() => setScreen('home')} />
  }

  return <HomePage onStartGame={() => setScreen('setup')} />
}

export default App
