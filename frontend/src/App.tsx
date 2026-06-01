import { useEffect, useState } from 'react'
import {
  getCurrentUser,
  logout,
  refreshSession,
  type User,
} from './api'
import { AppFooter } from './components/AppFooter'
import { AppHeader } from './components/AppHeader'
import { AuthScreen } from './features/auth/AuthScreen'
import { Dashboard } from './features/dashboard/Dashboard'
import { NewGameFlow } from './features/new-game/NewGameFlow'
import './App.css'

type View = 'home' | 'new-game'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [view, setView] = useState<View>('home')
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function restoreSession() {
      try {
        const current = await getCurrentUser()
        setUser(current.user)
      } catch {
        try {
          await refreshSession()
          const current = await getCurrentUser()
          setUser(current.user)
        } catch {
          setUser(null)
        }
      } finally {
        setIsLoading(false)
      }
    }

    restoreSession()
  }, [])

  async function handleLogout() {
    try {
      await logout()
    } finally {
      setUser(null)
      setProfileMenuOpen(false)
      setView('home')
    }
  }

  if (isLoading) {
    return <main className="app app-center">Loading</main>
  }

  if (!user) {
    return <AuthScreen onAuthenticated={setUser} />
  }

  return (
    <main className="app">
      <AppHeader
        user={user}
        title={view === 'new-game' ? 'New Game' : undefined}
        profileMenuOpen={profileMenuOpen}
        onBack={view === 'new-game' ? () => setView('home') : undefined}
        onLogout={handleLogout}
        onToggleProfileMenu={() => setProfileMenuOpen((isOpen) => !isOpen)}
      />

      {view === 'home' ? (
        <Dashboard onNewGame={() => setView('new-game')} />
      ) : (
        <NewGameFlow onFinished={() => setView('home')} />
      )}

      <AppFooter />
    </main>
  )
}

export default App
