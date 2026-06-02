import { useState } from 'react'

type TrackingMode = 'runs' | 'one' | 'both'
type TeamKey = 'teamOne' | 'teamTwo'

type GameSetupPageProps = {
  onBeginGame: () => void
}

export function GameSetupPage({ onBeginGame }: GameSetupPageProps) {
  const [trackedBatting, setTrackedBatting] = useState<Record<TeamKey, boolean>>({
    teamOne: true,
    teamTwo: false,
  })
  const [teamOneName, setTeamOneName] = useState('')
  const [teamTwoName, setTeamTwoName] = useState('')
  const [homeTeam, setHomeTeam] = useState<TeamKey>('teamOne')
  const [innings, setInnings] = useState(7)
  const [teamOnePlayers, setTeamOnePlayers] = useState<string[]>([])
  const [teamTwoPlayers, setTeamTwoPlayers] = useState<string[]>([])
  const [draggedPlayer, setDraggedPlayer] = useState<{ team: TeamKey; index: number } | null>(null)
  const [dropTarget, setDropTarget] = useState<{ team: TeamKey; index: number } | null>(null)
  const [teamOneDraftPlayer, setTeamOneDraftPlayer] = useState('')
  const [teamTwoDraftPlayer, setTeamTwoDraftPlayer] = useState('')

  const teamOneLabel = teamOneName.trim() || 'Team 1'
  const teamTwoLabel = teamTwoName.trim() || 'Team 2'
  const hasDuplicateTeamNames = teamOneLabel.toLowerCase() === teamTwoLabel.toLowerCase()
  const trackedCount = Number(trackedBatting.teamOne) + Number(trackedBatting.teamTwo)
  const trackingMode: TrackingMode = trackedCount === 0 ? 'runs' : trackedCount === 1 ? 'one' : 'both'
  const trackedTeamLabel = trackedBatting.teamOne ? teamOneLabel : teamTwoLabel

  function setTeamBattingTracking(team: TeamKey, shouldTrackBatting: boolean) {
    setTrackedBatting((current) => ({
      ...current,
      [team]: shouldTrackBatting,
    }))
  }

  function swapHomeTeam() {
    setHomeTeam((current) => (current === 'teamOne' ? 'teamTwo' : 'teamOne'))
  }

  function setPlayers(team: TeamKey, updater: (players: string[]) => string[]) {
    if (team === 'teamOne') {
      setTeamOnePlayers(updater)
      return
    }

    setTeamTwoPlayers(updater)
  }

  function addPlayer(team: TeamKey) {
    const playerName = team === 'teamOne' ? teamOneDraftPlayer.trim() : teamTwoDraftPlayer.trim()
    if (!playerName) {
      return
    }

    setPlayers(team, (players) => [...players, playerName])
    if (team === 'teamOne') {
      setTeamOneDraftPlayer('')
      return
    }

    setTeamTwoDraftPlayer('')
  }

  function removePlayer(team: TeamKey, index: number) {
    setPlayers(team, (players) => players.filter((_, playerIndex) => playerIndex !== index))
  }

  function updatePlayer(team: TeamKey, index: number, value: string) {
    setPlayers(team, (players) => players.map((player, playerIndex) => (playerIndex === index ? value : player)))
  }

  function movePlayer(team: TeamKey, fromIndex: number, toIndex: number) {
    setPlayers(team, (players) => {
      if (fromIndex === toIndex) {
        return players
      }

      const nextPlayers = [...players]
      const [movedPlayer] = nextPlayers.splice(fromIndex, 1)
      nextPlayers.splice(toIndex, 0, movedPlayer)
      return nextPlayers
    })
  }

  function dropPlayer(team: TeamKey, index: number) {
    if (draggedPlayer?.team !== team) {
      setDropTarget(null)
      return
    }

    movePlayer(team, draggedPlayer.index, index)
    setDraggedPlayer(null)
    setDropTarget(null)
  }

  return (
    <section className="create-game-page" aria-label="Create a new game">
      <div className="create-game-header">
        <span>New Game</span>
        <h1>Create a game</h1>
        <p>Choose how detailed your scorekeeping should be, then add teams and lineups if needed.</p>
      </div>

      <div className="create-game-stack">
        <section className="create-game-card teams-setup-card" aria-labelledby="game-info-title">
            <div className="create-card-heading teams-card-heading">
              <div>
              <h2 id="game-info-title">Teams</h2>
              <p>
                {trackingMode === 'runs'
                  ? 'Name each team. No batting orders are needed for runs-only scoring.'
                  : trackingMode === 'one'
                    ? `Add ${trackedTeamLabel}'s batting order. The other team's runs can be entered without managing their lineup.`
                    : 'Name each team and add both batting orders.'}
              </p>
              </div>
              <div className="teams-innings-control">
                <span># of Innings</span>
                <div className="innings-stepper" aria-label="Number of innings">
                  <strong>{innings}</strong>
                  <div className="stepper-buttons">
                    <button type="button" aria-label="Increase innings" onClick={() => setInnings((current) => Math.min(20, current + 1))}>
                      ^
                    </button>
                    <button type="button" aria-label="Decrease innings" onClick={() => setInnings((current) => Math.max(1, current - 1))}>
                      v
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="team-card-grid">
              <div className="team-column">
                <TeamTrackingSwitch
                  label={teamOneLabel}
                  onChange={(shouldTrackBatting) => setTeamBattingTracking('teamOne', shouldTrackBatting)}
                  trackBatting={trackedBatting.teamOne}
                />
                <TeamSetupCard
                  draggedPlayer={draggedPlayer}
                  dropTarget={dropTarget}
                  draftPlayerName={teamOneDraftPlayer}
                  hasDuplicateTeamNames={hasDuplicateTeamNames}
                  isHome={homeTeam === 'teamOne'}
                  name={teamOneName}
                  onMakeHome={swapHomeTeam}
                  onNameChange={setTeamOneName}
                  onDragEnd={() => {
                    setDraggedPlayer(null)
                    setDropTarget(null)
                  }}
                  onDragOver={(index) => setDropTarget({ team: 'teamOne', index })}
                  onDragStart={(index) => setDraggedPlayer({ team: 'teamOne', index })}
                  onDrop={(index) => dropPlayer('teamOne', index)}
                  onDraftPlayerNameChange={setTeamOneDraftPlayer}
                  onRemovePlayer={(index) => removePlayer('teamOne', index)}
                  onSubmitPlayer={() => addPlayer('teamOne')}
                  onUpdatePlayer={(index, value) => updatePlayer('teamOne', index, value)}
                  players={teamOnePlayers}
                  placeholder="Team 1"
                  showHomeToggle
                  trackBatting={trackedBatting.teamOne}
                  team="teamOne"
                />
              </div>

              <div className="team-column">
                <TeamTrackingSwitch
                  label={teamTwoLabel}
                  onChange={(shouldTrackBatting) => setTeamBattingTracking('teamTwo', shouldTrackBatting)}
                  trackBatting={trackedBatting.teamTwo}
                />
                <TeamSetupCard
                  draggedPlayer={draggedPlayer}
                  dropTarget={dropTarget}
                  draftPlayerName={teamTwoDraftPlayer}
                  hasDuplicateTeamNames={hasDuplicateTeamNames}
                  isHome={homeTeam === 'teamTwo'}
                  name={teamTwoName}
                  onMakeHome={swapHomeTeam}
                  onNameChange={setTeamTwoName}
                  onDragEnd={() => {
                    setDraggedPlayer(null)
                    setDropTarget(null)
                  }}
                  onDragOver={(index) => setDropTarget({ team: 'teamTwo', index })}
                  onDragStart={(index) => setDraggedPlayer({ team: 'teamTwo', index })}
                  onDrop={(index) => dropPlayer('teamTwo', index)}
                  onDraftPlayerNameChange={setTeamTwoDraftPlayer}
                  onRemovePlayer={(index) => removePlayer('teamTwo', index)}
                  onSubmitPlayer={() => addPlayer('teamTwo')}
                  onUpdatePlayer={(index, value) => updatePlayer('teamTwo', index, value)}
                  players={teamTwoPlayers}
                  placeholder="Team 2"
                  showHomeToggle
                  trackBatting={trackedBatting.teamTwo}
                  team="teamTwo"
                />
              </div>
            </div>
          </section>
      </div>

      {hasDuplicateTeamNames && <p className="setup-error">Team names must be different.</p>}

      <div className="create-game-actions">
        <button type="button" onClick={onBeginGame} disabled={hasDuplicateTeamNames}>
          Start Game
        </button>
      </div>

    </section>
  )
}

type TeamSetupCardProps = {
  draggedPlayer: { team: TeamKey; index: number } | null
  draftPlayerName: string
  dropTarget: { team: TeamKey; index: number } | null
  hasDuplicateTeamNames: boolean
  isHome: boolean
  name: string
  onDraftPlayerNameChange: (name: string) => void
  onDragEnd: () => void
  onDragOver: (index: number) => void
  onDragStart: (index: number) => void
  onDrop: (index: number) => void
  onMakeHome: () => void
  onNameChange: (name: string) => void
  onRemovePlayer: (index: number) => void
  onSubmitPlayer: () => void
  onUpdatePlayer: (index: number, value: string) => void
  placeholder: string
  players: string[]
  showHomeToggle: boolean
  trackBatting: boolean
  team: TeamKey
}

function TeamSetupCard({
  draggedPlayer,
  draftPlayerName,
  dropTarget,
  hasDuplicateTeamNames,
  isHome,
  name,
  onDraftPlayerNameChange,
  onDragEnd,
  onDragOver,
  onDragStart,
  onDrop,
  onMakeHome,
  onNameChange,
  onRemovePlayer,
  onSubmitPlayer,
  onUpdatePlayer,
  placeholder,
  players,
  showHomeToggle,
  trackBatting,
  team,
}: TeamSetupCardProps) {
  const displayName = name.trim() || placeholder

  return (
    <div className="team-setup-card has-lineup">
      <div className="team-setup-heading">
        <input
          className={hasDuplicateTeamNames ? 'team-heading-input has-error' : 'team-heading-input'}
          aria-label={`${placeholder} name`}
          value={name}
          onBlur={() => onNameChange(name.trim())}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder={placeholder}
        />
        <div className="team-card-controls">
          {showHomeToggle ? (
            <button className={isHome ? 'home-status active' : 'home-status'} type="button" onClick={onMakeHome}>
              <span>{isHome ? 'Home' : 'Away'}</span>
              <svg className="home-swap-icon" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M4.5 4.25h7m0 0-2-2m2 2-2 2M11.5 11.75h-7m0 0 2 2m-2-2 2-2" />
              </svg>
            </button>
          ) : (
            <span className="home-status readonly">{team === 'teamOne' ? 'Home' : 'Away'}</span>
          )}
        </div>
      </div>
      <div className={trackBatting ? 'player-tile-list compact' : 'player-tile-list compact disabled'} aria-label={`${displayName} batting order`}>
        {trackBatting ? (
          <>
            {players.length === 0 && <p className="empty-roster">No players added yet.</p>}
            {players.map((player, index) => (
              <div
                className={[
                  'player-tile',
                  draggedPlayer?.team === team && draggedPlayer.index === index ? 'dragging' : '',
                  dropTarget?.team === team && dropTarget.index === index ? 'drop-target' : '',
                ].filter(Boolean).join(' ')}
                key={`${player}-${index}`}
                onDragEnd={onDragEnd}
                onDragOver={(event) => {
                  event.preventDefault()
                  onDragOver(index)
                }}
                onDrop={() => onDrop(index)}
              >
                <span
                  className="drag-handle"
                  draggable
                  role="button"
                  aria-label={`Drag ${player || `player ${index + 1}`}`}
                  onDragStart={() => onDragStart(index)}
                />
                <span className="player-order">{index + 1}</span>
                <input
                  className="player-name-input"
                  aria-label={`Player ${index + 1} name`}
                  value={player}
                  onChange={(event) => onUpdatePlayer(index, event.target.value)}
                />
                <button className="remove-player-button" type="button" aria-label={`Remove ${player}`} onClick={() => onRemovePlayer(index)}>
                  <span aria-hidden="true" />
                </button>
              </div>
            ))}
            <form
              className="inline-player-row"
              onSubmit={(event) => {
                event.preventDefault()
                onSubmitPlayer()
              }}
            >
              <span className="draft-drag-placeholder" aria-hidden="true" />
              <span className="player-order draft">{players.length + 1}</span>
              <input
                placeholder="Player name"
                value={draftPlayerName}
                onBlur={onSubmitPlayer}
                onChange={(event) => onDraftPlayerNameChange(event.target.value)}
              />
              <span className="draft-action-placeholder" aria-hidden="true" />
            </form>
          </>
        ) : (
          <div className="lineup-disabled-message">
            Batting order not tracked. Runs will be entered as they score.
          </div>
        )}
      </div>
    </div>
  )
}

type TeamTrackingSwitchProps = {
  label: string
  onChange: (shouldTrackBatting: boolean) => void
  trackBatting: boolean
}

function TeamTrackingSwitch({ label, onChange, trackBatting }: TeamTrackingSwitchProps) {
  return (
    <div className="team-tracking-row">
      <div className="team-track-switch" aria-label={`${label} batting tracking`}>
        <button className={trackBatting ? 'active' : ''} type="button" onClick={() => onChange(true)}>
          Track Batting
        </button>
        <button className={!trackBatting ? 'active' : ''} type="button" onClick={() => onChange(false)}>
          Runs Only
        </button>
      </div>
    </div>
  )
}
