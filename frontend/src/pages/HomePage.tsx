type HomePageProps = {
  onStartGame: () => void
}

export function HomePage({ onStartGame }: HomePageProps) {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-between px-5 py-8">
        <header className="flex items-center justify-between">
          <div className="text-xl font-black tracking-wide">ScoreTap</div>
          <div className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-semibold text-zinc-300">
            Softball MVP
          </div>
        </header>

        <section className="space-y-7">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase text-emerald-300">
              Live scorekeeping
            </p>
            <h1 className="text-5xl font-black leading-none tracking-normal">
              Score a game in seconds.
            </h1>
            <p className="max-w-sm text-lg leading-7 text-zinc-300">
              Start fast, tap outcomes, undo mistakes, and keep the game moving.
            </p>
          </div>

          <button
            className="min-h-16 w-full rounded-lg bg-emerald-400 px-6 text-xl font-black text-zinc-950 shadow-lg shadow-emerald-950/40 active:scale-[0.99]"
            onClick={onStartGame}
            type="button"
          >
            Start New Game
          </button>
        </section>

        <footer className="grid grid-cols-3 gap-3 text-center text-sm text-zinc-400">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-3">
            No signup
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-3">
            Big taps
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-3">
            Undo ready
          </div>
        </footer>
      </div>
    </main>
  )
}
