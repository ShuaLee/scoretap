type ScoreboardProps = {
  homeTeamName: string
  awayTeamName: string
  homeScore: number
  awayScore: number
  inningLabel: string
  outs: number
  onEdit: () => void
}

export function Scoreboard({ homeTeamName, awayTeamName, homeScore, awayScore, inningLabel, outs, onEdit }: ScoreboardProps) {
  return (
    <header className="score-header">
      <div className="score-teams-row">
        <div className="team-score">
          <span>{homeTeamName}</span>
          <strong>{homeScore}</strong>
        </div>
        <div className="team-score muted">
          <span>{awayTeamName}</span>
          <strong>{awayScore}</strong>
        </div>
      </div>
      <div className="score-status-row">
        <button className="scoreboard-edit-button" type="button" aria-label="Edit scoreboard" onClick={onEdit}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M4 6h8.25M15.25 6H16" />
            <path d="M4 10h1.25M8.75 10H16" />
            <path d="M4 14h6.25M13.75 14H16" />
            <circle cx="13.75" cy="6" r="1.5" />
            <circle cx="7.25" cy="10" r="1.5" />
            <circle cx="12.25" cy="14" r="1.5" />
          </svg>
        </button>
        <span>{inningLabel}</span>
        <span>{outs === 1 ? '1 Out' : `${outs} Outs`}</span>
      </div>
    </header>
  )
}
