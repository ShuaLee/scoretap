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
        <div className="score-inning-outs">
          <span className="score-inning-label">{inningLabel}</span>
          <div className="score-outs-dots" aria-label={`${outs} out${outs !== 1 ? 's' : ''}`}>
            <span className={outs >= 1 ? 'out-dot filled' : 'out-dot'} />
            <span className={outs >= 2 ? 'out-dot filled' : 'out-dot'} />
          </div>
        </div>
        <div className={activeBattingTeam === 'away' ? 'team-score batting' : 'team-score'}>
          <span>{activeBattingTeam === 'away' && <i aria-label="Batting" />} {awayTeamName}</span>
          <strong>{awayScore}</strong>
        </div>
      </div>
    </header>
  )
}
