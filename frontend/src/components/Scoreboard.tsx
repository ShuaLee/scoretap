type ScoreboardProps = {
  homeTeamName: string
  awayTeamName: string
  inningLabel: string
  outs: number
}

export function Scoreboard({ homeTeamName, awayTeamName, inningLabel, outs }: ScoreboardProps) {
  return (
    <header className="score-header">
      <div className="score-teams-row">
        <div className="team-score">
          <span>{homeTeamName}</span>
          <strong>0</strong>
        </div>
        <div className="team-score muted">
          <span>{awayTeamName}</span>
          <strong>0</strong>
        </div>
      </div>
      <div className="score-status-row">
        <span>{inningLabel}</span>
        <span>{outs === 1 ? '1 Out' : `${outs} Outs`}</span>
      </div>
    </header>
  )
}
