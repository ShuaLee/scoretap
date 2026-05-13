import { useGameStore } from '../stores/gameStore'
import type { PlateAppearanceResult } from '../types/game'

type LiveGamePageProps = {
  onExit: () => void
}

const scoringButtons: Array<{ label: string; result: PlateAppearanceResult }> = [
  { label: 'Single', result: 'single' },
  { label: 'Double', result: 'double' },
  { label: 'Triple', result: 'triple' },
  { label: 'Home Run', result: 'home_run' },
  { label: 'Walk', result: 'walk' },
  { label: 'Error', result: 'error' },
  { label: 'Strikeout', result: 'strikeout' },
  { label: 'Ground Out', result: 'ground_out' },
  { label: 'Fly Out', result: 'fly_out' },
  { label: "Fielder's Choice", result: 'fielders_choice' },
]

function formatHalfInning(value: string) {
  return value === 'top' ? 'Top' : 'Bottom'
}

function BaseIndicator({ label, occupied }: { label: string; occupied: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
      <span className="text-sm font-bold text-zinc-300">{label}</span>
      <span
        className={
          occupied
            ? 'h-5 w-5 rounded-full bg-emerald-400'
            : 'h-5 w-5 rounded-full border-2 border-zinc-600'
        }
      />
    </div>
  )
}

export function LiveGamePage({ onExit }: LiveGamePageProps) {
  const game = useGameStore((state) => state.currentGame)
  const isLoading = useGameStore((state) => state.isLoading)
  const error = useGameStore((state) => state.error)
  const scoreResult = useGameStore((state) => state.scoreResult)
  const undo = useGameStore((state) => state.undo)
  const finalize = useGameStore((state) => state.finalize)

  if (!game) return null

  const awayTeam = game.teams.find((team) => team.side === 'away')
  const homeTeam = game.teams.find((team) => team.side === 'home')
  const gameIsFinal = game.status === 'final'

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 px-4 py-4">
        <header className="flex items-center justify-between">
          <button
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-bold text-zinc-200"
            onClick={onExit}
            type="button"
          >
            Home
          </button>
          <div className="text-center">
            <div className="text-sm font-bold uppercase text-emerald-300">
              {gameIsFinal ? 'Final' : `${formatHalfInning(game.half_inning)} ${game.inning}`}
            </div>
            <div className="text-xs font-semibold text-zinc-400">
              {game.outs} {game.outs === 1 ? 'out' : 'outs'}
            </div>
          </div>
          <button
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-bold text-zinc-200 disabled:opacity-50"
            disabled={isLoading}
            onClick={undo}
            type="button"
          >
            Undo
          </button>
        </header>

        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <div className="grid grid-cols-[1fr_auto] gap-3 text-2xl font-black">
            <div className={game.batting_side === 'away' ? 'text-emerald-300' : ''}>
              {awayTeam?.name ?? 'Away'}
            </div>
            <div>{game.away_score}</div>
            <div className={game.batting_side === 'home' ? 'text-emerald-300' : ''}>
              {homeTeam?.name ?? 'Home'}
            </div>
            <div>{game.home_score}</div>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-3">
          <BaseIndicator label="1st" occupied={Boolean(game.runner_on_first)} />
          <BaseIndicator label="2nd" occupied={Boolean(game.runner_on_second)} />
          <BaseIndicator label="3rd" occupied={Boolean(game.runner_on_third)} />
        </section>

        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <div className="text-sm font-bold uppercase text-zinc-400">Now Batting</div>
          <div className="mt-1 text-3xl font-black">
            {game.current_batter?.name ?? 'Score Only'}
          </div>
        </section>

        {error ? (
          <div className="rounded-lg border border-red-500/50 bg-red-950 px-4 py-3 text-sm font-semibold text-red-100">
            {error}
          </div>
        ) : null}

        <section className="grid flex-1 grid-cols-2 gap-3">
          {scoringButtons.map((button) => (
            <button
              className="min-h-16 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-lg font-black text-white active:scale-[0.99] disabled:opacity-50"
              disabled={isLoading || gameIsFinal}
              key={button.result}
              onClick={() => scoreResult(button.result)}
              type="button"
            >
              {button.label}
            </button>
          ))}
        </section>

        <button
          className="min-h-14 rounded-lg border border-zinc-700 px-5 text-base font-black text-zinc-200 disabled:opacity-50"
          disabled={isLoading || gameIsFinal}
          onClick={finalize}
          type="button"
        >
          Finalize Game
        </button>
      </div>
    </main>
  )
}
