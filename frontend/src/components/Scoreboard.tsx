type ScoreboardProps = {
  activeBattingTeam: 'home' | 'away'
  homeTeamName: string
  awayTeamName: string
  homeScore: number
  awayScore: number
  inningLabel: string
  outs: number
}

export function Scoreboard({ activeBattingTeam, homeTeamName, awayTeamName, homeScore, awayScore, inningLabel, outs }: ScoreboardProps) {
  return (
    <header className="score-header">
      <div className="score-teams-row">
        <div className={activeBattingTeam === 'home' ? 'team-score batting' : 'team-score'}>
          <span>{activeBattingTeam === 'home' && <i aria-label="Batting" />} {homeTeamName}</span>
          <strong>{homeScore}</strong>
        </div>
        <div className={activeBattingTeam === 'away' ? 'team-score batting' : 'team-score'}>
          <span>{activeBattingTeam === 'away' && <i aria-label="Batting" />} {awayTeamName}</span>
          <strong>{awayScore}</strong>
        </div>
      </div>
      <div className="score-status-row">
        <span>{inningLabel}</span>
        <span>{outs === 1 ? '1 Out' : `${outs} Outs`}</span>
      </div>
    </header>
  )
}
