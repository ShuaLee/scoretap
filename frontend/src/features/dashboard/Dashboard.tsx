import { SectionPanel } from '../../components/SectionPanel'

type DashboardProps = {
  onNewGame: () => void
}

const teams = [
  { name: 'Thunder', record: '12-4', players: 14 },
  { name: 'Wildcats', record: '8-7', players: 12 },
  { name: 'Crushers', record: '3-9', players: 11 },
]

const upcomingGames = [
  { date: 'Jun 5', matchup: 'Thunder vs Wildcats' },
  { date: 'Jun 12', matchup: 'Thunder vs Crushers' },
  { date: 'Jun 19', matchup: 'Thunder vs Outlaws' },
]

const recentGames = [
  { badge: 'TEAM', title: 'Thunder vs Wildcats', result: '12-8 W' },
  { badge: 'QUICK', title: "Josh's Pickup Team vs Crushers", result: '9-7 W' },
  { badge: 'LEAGUE', title: 'Wildcats vs Outlaws', result: '4-7 L' },
]

export function Dashboard({ onNewGame }: DashboardProps) {
  return (
    <div className="dashboard">
      <section className="hero-action" aria-label="Quick action">
        <button className="primary-action new-game-button" type="button" onClick={onNewGame}>
          + New Game
        </button>
      </section>

      <div className="dashboard-grid">
        <SectionPanel title="Active Game" className="active-game-panel">
          <div className="active-game-summary">
            <strong>Thunder vs Wildcats</strong>
            <span>Bottom 5th</span>
            <span className="scoreline">8 - 7</span>
          </div>
          <button className="secondary-action" type="button">Resume Game</button>
        </SectionPanel>

        <SectionPanel title="Upcoming Games" className="upcoming-panel">
          <CompactList
            items={upcomingGames.map((game) => ({
              label: game.date,
              value: game.matchup,
            }))}
          />
        </SectionPanel>
      </div>

      <SectionPanel title="My Teams">
        <div className="team-card-grid">
          {teams.map((team) => (
            <article className="team-card" key={team.name}>
              <h3>{team.name}</h3>
              <p>{team.record}</p>
              <span>{team.players} Players</span>
            </article>
          ))}
        </div>
        <button className="text-action mobile-only" type="button">View All</button>
      </SectionPanel>

      <SectionPanel title="Recent Games">
        <div className="recent-game-list">
          {recentGames.map((game) => (
            <article className="recent-game-row" key={`${game.badge}-${game.title}`}>
              <span className={`game-badge game-badge-${game.badge.toLowerCase()}`}>{game.badge}</span>
              <strong>{game.title}</strong>
              <span>{game.result}</span>
            </article>
          ))}
        </div>
      </SectionPanel>
    </div>
  )
}

type CompactListProps = {
  items: Array<{
    label: string
    value: string
  }>
}

function CompactList({ items }: CompactListProps) {
  return (
    <div className="compact-list">
      {items.map((item) => (
        <div className="compact-row" key={`${item.label}-${item.value}`}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  )
}
