import { Scoreboard } from '../components/Scoreboard'
import type { GameConfig } from './GameSetupPage'

type ScoreGamePageProps = {
  gameConfig: GameConfig
}

export function ScoreGamePage({ gameConfig }: ScoreGamePageProps) {
  return (
    <section className="score-game-page" aria-label="Score game">
      <Scoreboard
        awayTeamName={gameConfig.teamTwoName}
        homeTeamName={gameConfig.teamOneName}
        inningLabel="Top 1st"
        outs={0}
      />
      <BaseOccupancy />
    </section>
  )
}

function BaseOccupancy() {
  const bases = ['3B', '2B', '1B']

  return (
    <section className="base-occupancy-card" aria-label="Base runners">
      {bases.map((base) => (
        <div className={`base-slot base-slot-${base.toLowerCase()}`} key={base}>
          <span>{base}</span>
        </div>
      ))}
    </section>
  )
}
