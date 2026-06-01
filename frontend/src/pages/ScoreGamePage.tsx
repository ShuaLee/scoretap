import { BaseballField } from '../components/BaseballField'

export function ScoreGamePage() {
  return (
    <section className="score-game-page" aria-label="Score game">
      <ScoreHeader />

      <div className="score-game-stage">
        <BaseballField />
        <BatterPanel />
        <LineupPanel />
      </div>

      <ActionBar />
    </section>
  )
}

function ScoreHeader() {
  return (
    <header className="score-header">
      <div className="game-state">
        <strong>Top 3rd</strong>
        <span>1 Out</span>
        <span>0-1</span>
      </div>
      <div className="team-score">
        <span>Thunder</span>
        <strong>2</strong>
      </div>
      <div className="team-score muted">
        <span>Wildcats</span>
        <strong>1</strong>
      </div>
      <div className="pitch-count">
        <span>Pitch Count</span>
        <strong>24</strong>
      </div>
    </header>
  )
}

function BatterPanel() {
  return (
    <aside className="batter-panel">
      <span>Batting</span>
      <strong>Jake T.</strong>
      <small>#24 | LF</small>
      <div />
      <strong>0 - 1</strong>
      <small>Strikeout in 1st</small>
    </aside>
  )
}

function LineupPanel() {
  return (
    <aside className="lineup-panel">
      <span>On Deck</span>
      <strong>Steve L.</strong>
      <small>#8 | 3B</small>
      <div />
      <span>In The Hole</span>
      <strong>Mike B.</strong>
      <small>#2 | CF</small>
    </aside>
  )
}

function ActionBar() {
  const actions = ['Single', 'Double', 'Triple', 'Home Run', 'Out']

  return (
    <nav className="score-action-bar" aria-label="Scoring actions">
      {actions.map((action) => (
        <button type="button" key={action}>
          <span className={`action-icon action-icon-${action.toLowerCase().replaceAll(' ', '-')}`} />
          {action}
        </button>
      ))}
    </nav>
  )
}
