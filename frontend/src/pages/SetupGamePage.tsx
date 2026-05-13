import { useState } from 'react'
import type { FormEvent } from 'react'
import { useGameStore } from '../stores/gameStore'

type SetupGamePageProps = {
  onBack: () => void
  onGameStarted: () => void
}

function splitLineup(value: string) {
  return value
    .split('\n')
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ name }))
}

export function SetupGamePage({ onBack, onGameStarted }: SetupGamePageProps) {
  const [awayTeamName, setAwayTeamName] = useState('Away')
  const [homeTeamName, setHomeTeamName] = useState('Home')
  const [scheduledInnings, setScheduledInnings] = useState(7)
  const [awayLineup, setAwayLineup] = useState('')
  const [homeLineup, setHomeLineup] = useState('')
  const startGame = useGameStore((state) => state.startGame)
  const isLoading = useGameStore((state) => state.isLoading)
  const error = useGameStore((state) => state.error)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    await startGame({
      away_team_name: awayTeamName.trim() || 'Away',
      home_team_name: homeTeamName.trim() || 'Home',
      scheduled_innings: scheduledInnings,
      away_lineup: splitLineup(awayLineup),
      home_lineup: splitLineup(homeLineup),
    })

    onGameStarted()
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <form
        className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-5 py-5"
        onSubmit={handleSubmit}
      >
        <header className="flex items-center justify-between">
          <button
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-bold text-zinc-200"
            onClick={onBack}
            type="button"
          >
            Back
          </button>
          <h1 className="text-lg font-black">New Game</h1>
          <div className="w-16" />
        </header>

        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase text-zinc-400">Teams</h2>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-zinc-300">Away Team</span>
            <input
              className="min-h-14 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 text-lg font-bold outline-none focus:border-emerald-400"
              onChange={(event) => setAwayTeamName(event.target.value)}
              value={awayTeamName}
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-zinc-300">Home Team</span>
            <input
              className="min-h-14 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 text-lg font-bold outline-none focus:border-emerald-400"
              onChange={(event) => setHomeTeamName(event.target.value)}
              value={homeTeamName}
            />
          </label>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase text-zinc-400">Game</h2>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-zinc-300">Innings</span>
            <input
              className="min-h-14 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 text-lg font-bold outline-none focus:border-emerald-400"
              max={20}
              min={1}
              onChange={(event) => setScheduledInnings(Number(event.target.value))}
              type="number"
              value={scheduledInnings}
            />
          </label>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-zinc-300">
              Away Lineup Optional
            </span>
            <textarea
              className="min-h-36 w-full resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-base outline-none focus:border-emerald-400"
              onChange={(event) => setAwayLineup(event.target.value)}
              placeholder={'Mike\nSam\nLeo'}
              value={awayLineup}
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-zinc-300">
              Home Lineup Optional
            </span>
            <textarea
              className="min-h-36 w-full resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-base outline-none focus:border-emerald-400"
              onChange={(event) => setHomeLineup(event.target.value)}
              placeholder={'Maya\nJess\nNina'}
              value={homeLineup}
            />
          </label>
        </section>

        {error ? (
          <div className="rounded-lg border border-red-500/50 bg-red-950 px-4 py-3 text-sm font-semibold text-red-100">
            {error}
          </div>
        ) : null}

        <button
          className="mt-auto min-h-16 w-full rounded-lg bg-emerald-400 px-6 text-xl font-black text-zinc-950 disabled:opacity-60"
          disabled={isLoading}
          type="submit"
        >
          {isLoading ? 'Starting...' : 'Start Scoring'}
        </button>
      </form>
    </main>
  )
}
