import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  createGamePlayer,
  createGameTeam,
  createQuickGame,
  createTeam,
  createTeamGame,
  createTeamPlayer,
  listTeamPlayers,
  listTeams,
  startGame,
  type Game,
  type Team,
  type TeamPlayer,
} from '../../api'

type NewGameFlowProps = {
  onFinished: () => void
}

type StartMode = 'quick' | 'existing-team' | 'new-team'

const today = new Date().toISOString().slice(0, 10)

function splitRoster(value: string) {
  return value
    .split('\n')
    .map((name) => name.trim())
    .filter(Boolean)
}

export function NewGameFlow({ onFinished }: NewGameFlowProps) {
  const [mode, setMode] = useState<StartMode | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)
  const [teamName, setTeamName] = useState('Team 1')
  const [opponentName, setOpponentName] = useState('Team 2')
  const [roster, setRoster] = useState('')
  const [trackOpponent, setTrackOpponent] = useState(false)
  const [opponentRoster, setOpponentRoster] = useState('')
  const [innings, setInnings] = useState(7)
  const [savedGame, setSavedGame] = useState<Game | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const players = useMemo(() => splitRoster(roster), [roster])
  const opponentPlayers = useMemo(() => splitRoster(opponentRoster), [opponentRoster])

  useEffect(() => {
    async function loadTeams() {
      try {
        setTeams(await listTeams())
      } catch {
        setTeams([])
      }
    }

    loadTeams()
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!mode) {
      return
    }

    setError('')
    setMessage('')
    setIsSaving(true)

    try {
      const activeGame =
        mode === 'quick'
          ? await startQuickGame()
          : mode === 'existing-team'
            ? await startExistingTeamGame()
            : await startNewTeamGame()

      setSavedGame(activeGame)
      setMessage('Game started.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not start game.')
    } finally {
      setIsSaving(false)
    }
  }

  async function startQuickGame() {
    const game = await createQuickGame({
      opponent_name: opponentName,
      game_date: today,
      number_of_innings: innings,
      tracking_mode: trackOpponent ? 'both_teams' : 'own_team',
    })
    const primaryGameTeam = await createGameTeam(game.id, {
      side: 'home',
      display_name: teamName,
      is_tracked: true,
    })
    const opponentGameTeam = await createGameTeam(game.id, {
      side: 'away',
      display_name: opponentName,
      is_tracked: trackOpponent,
    })
    await createPlayersFromNames(game.id, primaryGameTeam.id, players)
    if (trackOpponent) {
      await createPlayersFromNames(game.id, opponentGameTeam.id, opponentPlayers)
    }
    return startGame(game.id)
  }

  async function startExistingTeamGame() {
    const team = teams.find((candidate) => candidate.id === selectedTeamId)
    if (!team) {
      throw new Error('Select a team.')
    }

    const teamPlayers = await listTeamPlayers(team.id)
    const game = await createTeamGame(team.id, {
      opponent_name: opponentName,
      game_date: today,
      number_of_innings: innings,
      tracking_mode: 'own_team',
    })
    const primaryGameTeam = await createGameTeam(game.id, {
      side: 'home',
      display_name: team.name,
      is_tracked: true,
      linked_team: team.id,
    })
    await createGameTeam(game.id, {
      side: 'away',
      display_name: opponentName,
      is_tracked: false,
    })
    await createPlayersFromTeamPlayers(game.id, primaryGameTeam.id, teamPlayers)
    return startGame(game.id)
  }

  async function startNewTeamGame() {
    const team = await createTeam({ name: teamName })
    const teamPlayers = await Promise.all(
      players.map((name) => createTeamPlayer(team.id, { display_name: name })),
    )
    setTeams((currentTeams) => [...currentTeams, team])

    const game = await createTeamGame(team.id, {
      opponent_name: opponentName,
      game_date: today,
      number_of_innings: innings,
      tracking_mode: 'own_team',
    })
    const primaryGameTeam = await createGameTeam(game.id, {
      side: 'home',
      display_name: team.name,
      is_tracked: true,
      linked_team: team.id,
    })
    await createGameTeam(game.id, {
      side: 'away',
      display_name: opponentName,
      is_tracked: false,
    })
    await createPlayersFromTeamPlayers(game.id, primaryGameTeam.id, teamPlayers)
    return startGame(game.id)
  }

  return (
    <form className="setup-card" onSubmit={handleSubmit}>
      <section className="form-block">
        <h2>How would you like to start?</h2>
        <div className="choice-grid">
          <ChoiceButton
            active={mode === 'quick'}
            label="Quick Game"
            description="Start scoring now. No team saved."
            onClick={() => setMode('quick')}
          />
          <ChoiceButton
            active={mode === 'existing-team'}
            label="Use Existing Team"
            description="Load a saved roster and count team stats."
            onClick={() => setMode('existing-team')}
          />
          <ChoiceButton
            active={mode === 'new-team'}
            label="Create New Team"
            description="Save this roster permanently, then start."
            onClick={() => setMode('new-team')}
          />
        </div>
      </section>

      {mode === 'existing-team' && (
        <section className="form-block">
          <h2>Select Team</h2>
          <div className="team-select-list">
            {teams.length === 0 && <p className="muted-text">No teams yet.</p>}
            {teams.map((team) => (
              <button
                className={selectedTeamId === team.id ? 'team-select active' : 'team-select'}
                key={team.id}
                type="button"
                onClick={() => setSelectedTeamId(team.id)}
              >
                <strong>{team.name}</strong>
                <span>{team.active_player_count} Players</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {(mode === 'quick' || mode === 'new-team') && (
        <section className="form-block">
          <h2>{mode === 'quick' ? 'Quick Team' : 'New Team'}</h2>
          <label>
            Team name
            <input
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              required
            />
          </label>
          <label>
            {mode === 'quick' ? 'Optional roster' : 'Create roster'}
            <textarea
              value={roster}
              onChange={(event) => setRoster(event.target.value)}
              placeholder={'Jake\nSam\nCasey'}
              rows={7}
              required={mode === 'new-team'}
            />
          </label>
        </section>
      )}

      {mode && (
        <section className="form-block">
          <h2>Opponent</h2>
          <div className="opponent-row">
            <label>
              Opposing team
              <input
                value={opponentName}
                onChange={(event) => setOpponentName(event.target.value)}
                required
              />
            </label>
            {mode === 'quick' && (
              <button
                className={trackOpponent ? 'toggle-button active' : 'toggle-button'}
                type="button"
                aria-pressed={trackOpponent}
                onClick={() => setTrackOpponent((isTracked) => !isTracked)}
              >
                Track opponent batting
              </button>
            )}
          </div>
          {mode === 'quick' && trackOpponent && (
            <label>
              Opponent batting order
              <textarea
                value={opponentRoster}
                onChange={(event) => setOpponentRoster(event.target.value)}
                placeholder={'Mia\nAlex\nJordan'}
                rows={7}
                required
              />
            </label>
          )}
          <label>
            Innings
            <input
              value={innings}
              onChange={(event) => setInnings(Number(event.target.value))}
              type="number"
              min={1}
              max={20}
              required
            />
          </label>
        </section>
      )}

      <footer className="setup-footer">
        <div>
          {message && <p className="status-message">{message}</p>}
          {error && <p className="error-message">{error}</p>}
          {savedGame && <p className="saved-message">Active {savedGame.game_type} game #{savedGame.id}</p>}
        </div>
        <div className="footer-actions">
          <button type="button" onClick={onFinished}>Done</button>
          <button className="primary-action" type="submit" disabled={!mode || isSaving}>
            {isSaving ? 'Starting' : 'Start Game'}
          </button>
        </div>
      </footer>
    </form>
  )
}

type ChoiceButtonProps = {
  active: boolean
  label: string
  description: string
  onClick: () => void
}

function ChoiceButton({ active, label, description, onClick }: ChoiceButtonProps) {
  return (
    <button
      className={active ? 'choice-button active' : 'choice-button'}
      type="button"
      onClick={onClick}
    >
      <strong>{label}</strong>
      <span>{description}</span>
    </button>
  )
}

async function createPlayersFromNames(gameId: number, gameTeamId: number, names: string[]) {
  await Promise.all(
    names.map((name, index) =>
      createGamePlayer(gameId, gameTeamId, {
        display_name: name,
        batting_order: index + 1,
      }),
    ),
  )
}

async function createPlayersFromTeamPlayers(
  gameId: number,
  gameTeamId: number,
  teamPlayers: TeamPlayer[],
) {
  await Promise.all(
    teamPlayers.map((player, index) =>
      createGamePlayer(gameId, gameTeamId, {
        display_name: player.display_name,
        batting_order: index + 1,
        linked_team_player: player.id,
      }),
    ),
  )
}
