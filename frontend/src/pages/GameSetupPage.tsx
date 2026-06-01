import { useState } from 'react'

type TrackingMode = 'one' | 'both'
type TeamKey = 'teamOne' | 'teamTwo'
type SetupStep = 'mode' | 'teams' | 'lineups' | 'settings'

type GameSetupPageProps = {
  onBeginGame: () => void
}

const setupSteps: Array<{ id: SetupStep; label: string }> = [
  { id: 'mode', label: 'Mode' },
  { id: 'teams', label: 'Teams' },
  { id: 'lineups', label: 'Lineups' },
  { id: 'settings', label: 'Settings' },
]

export function GameSetupPage({ onBeginGame }: GameSetupPageProps) {
  const [activeStep, setActiveStep] = useState<SetupStep>('mode')
  const [trackingMode, setTrackingMode] = useState<TrackingMode>('one')
  const [teamOneName, setTeamOneName] = useState('')
  const [teamTwoName, setTeamTwoName] = useState('')
  const [homeTeam, setHomeTeam] = useState<TeamKey>('teamOne')
  const [innings, setInnings] = useState(7)
  const [activeLineupTeam, setActiveLineupTeam] = useState<TeamKey>('teamOne')
  const [teamOnePlayers, setTeamOnePlayers] = useState<string[]>([])
  const [teamTwoPlayers, setTeamTwoPlayers] = useState<string[]>([])
  const [teamOnePlayerName, setTeamOnePlayerName] = useState('')
  const [teamTwoPlayerName, setTeamTwoPlayerName] = useState('')
  const [draggedPlayer, setDraggedPlayer] = useState<{ team: TeamKey; index: number } | null>(null)

  const teamOneLabel = teamOneName.trim() || (trackingMode === 'one' ? 'My Team' : 'Home Team')
  const teamTwoLabel = teamTwoName.trim() || (trackingMode === 'one' ? 'Opponent' : 'Away Team')
  const hasDuplicateTeamNames = teamOneLabel.toLowerCase() === teamTwoLabel.toLowerCase()
  const trackedTeams: TeamKey[] = trackingMode === 'both' ? ['teamOne', 'teamTwo'] : ['teamOne']
  const visibleLineupTeam = trackingMode === 'both' ? activeLineupTeam : 'teamOne'

  function selectTrackingMode(mode: TrackingMode) {
    setTrackingMode(mode)
    if (mode === 'one') {
      setActiveLineupTeam('teamOne')
      return
    }

    setHomeTeam('teamOne')
  }

  function addPlayer(team: TeamKey) {
    const playerName = team === 'teamOne' ? teamOnePlayerName.trim() : teamTwoPlayerName.trim()
    if (!playerName) {
      return
    }

    if (team === 'teamOne') {
      setTeamOnePlayers((players) => [...players, playerName])
      setTeamOnePlayerName('')
      return
    }

    setTeamTwoPlayers((players) => [...players, playerName])
    setTeamTwoPlayerName('')
  }

  function movePlayer(team: TeamKey, fromIndex: number, toIndex: number) {
    const updatePlayers = (players: string[]) => {
      if (fromIndex === toIndex) {
        return players
      }

      const nextPlayers = [...players]
      const [movedPlayer] = nextPlayers.splice(fromIndex, 1)
      nextPlayers.splice(toIndex, 0, movedPlayer)
      return nextPlayers
    }

    if (team === 'teamOne') {
      setTeamOnePlayers(updatePlayers)
      return
    }

    setTeamTwoPlayers(updatePlayers)
  }

  function handlePlayerDragOver(team: TeamKey, index: number) {
    if (draggedPlayer?.team !== team || draggedPlayer.index === index) {
      return
    }

    movePlayer(team, draggedPlayer.index, index)
    setDraggedPlayer({ team, index })
  }

  function removePlayer(team: TeamKey, index: number) {
    const updatePlayers = (players: string[]) => players.filter((_, playerIndex) => playerIndex !== index)

    if (team === 'teamOne') {
      setTeamOnePlayers(updatePlayers)
      return
    }

    setTeamTwoPlayers(updatePlayers)
  }

  function nextStep() {
    const currentIndex = setupSteps.findIndex((step) => step.id === activeStep)
    const next = setupSteps[currentIndex + 1]
    if (next) {
      setActiveStep(next.id)
    }
  }

  return (
    <section className="setup-flow-page" aria-label="New game setup">
      <div className="setup-flow-header">
        <div>
          <span>New Game</span>
          <h1>{stepTitle(activeStep, trackingMode, visibleLineupTeam, teamOneLabel, teamTwoLabel)}</h1>
        </div>
        <nav className="setup-step-nav" aria-label="Game setup sections">
          {setupSteps.map((step) => (
            <button
              className={activeStep === step.id ? 'active' : ''}
              key={step.id}
              type="button"
              onClick={() => setActiveStep(step.id)}
            >
              {step.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="setup-flow-card">
        {activeStep === 'mode' && (
          <SetupModeStep trackingMode={trackingMode} onSelect={selectTrackingMode} />
        )}

        {activeStep === 'teams' && (
          <TeamSetupStep
            hasDuplicateTeamNames={hasDuplicateTeamNames}
            homeTeam={homeTeam}
            setHomeTeam={setHomeTeam}
            setTeamOneName={setTeamOneName}
            setTeamTwoName={setTeamTwoName}
            teamOneName={teamOneName}
            teamTwoName={teamTwoName}
            trackingMode={trackingMode}
          />
        )}

        {activeStep === 'lineups' && (
          <LineupStep
            activeLineupTeam={visibleLineupTeam}
            addPlayer={addPlayer}
            draggedPlayer={draggedPlayer}
            onDragEnd={() => setDraggedPlayer(null)}
            onDragOver={handlePlayerDragOver}
            onDragStart={(team, index) => setDraggedPlayer({ team, index })}
            onRemovePlayer={removePlayer}
            setActiveLineupTeam={setActiveLineupTeam}
            setTeamOnePlayerName={setTeamOnePlayerName}
            setTeamTwoPlayerName={setTeamTwoPlayerName}
            teamOneLabel={teamOneLabel}
            teamOnePlayerName={teamOnePlayerName}
            teamOnePlayers={teamOnePlayers}
            teamTwoLabel={teamTwoLabel}
            teamTwoPlayerName={teamTwoPlayerName}
            teamTwoPlayers={teamTwoPlayers}
            trackedTeams={trackedTeams}
            trackingMode={trackingMode}
          />
        )}

        {activeStep === 'settings' && (
          <SettingsStep innings={innings} setInnings={setInnings} />
        )}
      </div>

      {hasDuplicateTeamNames && (
        <p className="setup-error">Team names must be different.</p>
      )}

      <div className="setup-flow-actions">
        {activeStep !== 'settings' ? (
          <button type="button" onClick={nextStep} disabled={hasDuplicateTeamNames}>
            Continue
          </button>
        ) : (
          <button type="button" onClick={onBeginGame} disabled={hasDuplicateTeamNames}>
            Start Game
          </button>
        )}
      </div>
    </section>
  )
}

type SetupModeStepProps = {
  trackingMode: TrackingMode
  onSelect: (mode: TrackingMode) => void
}

function SetupModeStep({ trackingMode, onSelect }: SetupModeStepProps) {
  return (
    <div className="setup-step-content">
      <div className="setup-option-grid">
        <button
          className={trackingMode === 'one' ? 'setup-option active' : 'setup-option'}
          type="button"
          onClick={() => onSelect('one')}
        >
          <strong>My Team Only</strong>
          <span>Track your lineup and enter opponent runs by inning.</span>
        </button>
        <button
          className={trackingMode === 'both' ? 'setup-option active' : 'setup-option'}
          type="button"
          onClick={() => onSelect('both')}
        >
          <strong>Both Teams</strong>
          <span>Score both batting orders like the official scorekeeper.</span>
        </button>
      </div>
    </div>
  )
}

type TeamSetupStepProps = {
  hasDuplicateTeamNames: boolean
  homeTeam: TeamKey
  setHomeTeam: (team: TeamKey) => void
  setTeamOneName: (name: string) => void
  setTeamTwoName: (name: string) => void
  teamOneName: string
  teamTwoName: string
  trackingMode: TrackingMode
}

function TeamSetupStep({
  hasDuplicateTeamNames,
  homeTeam,
  setHomeTeam,
  setTeamOneName,
  setTeamTwoName,
  teamOneName,
  teamTwoName,
  trackingMode,
}: TeamSetupStepProps) {
  if (trackingMode === 'both') {
    return (
      <div className="setup-form-stack">
        <SetupTextField
          hasError={hasDuplicateTeamNames}
          label="Home Team"
          onChange={setTeamOneName}
          placeholder="Thunder"
          value={teamOneName}
        />
        <SetupTextField
          hasError={hasDuplicateTeamNames}
          label="Away Team"
          onChange={setTeamTwoName}
          placeholder="Wildcats"
          value={teamTwoName}
        />
      </div>
    )
  }

  return (
    <div className="setup-form-stack">
      <SetupTextField
        hasError={hasDuplicateTeamNames}
        label="Team Name"
        onChange={setTeamOneName}
        placeholder="Thunder"
        value={teamOneName}
      />
      <SetupTextField
        hasError={hasDuplicateTeamNames}
        label="Opponent"
        onChange={setTeamTwoName}
        placeholder="Wildcats"
        value={teamTwoName}
      />
      <div className="setup-field">
        <span>You Are</span>
        <div className="setup-segmented">
          <button
            className={homeTeam === 'teamOne' ? 'active' : ''}
            type="button"
            onClick={() => setHomeTeam('teamOne')}
          >
            Home
          </button>
          <button
            className={homeTeam === 'teamTwo' ? 'active' : ''}
            type="button"
            onClick={() => setHomeTeam('teamTwo')}
          >
            Away
          </button>
        </div>
      </div>
    </div>
  )
}

type SetupTextFieldProps = {
  hasError: boolean
  label: string
  onChange: (value: string) => void
  placeholder: string
  value: string
}

function SetupTextField({ hasError, label, onChange, placeholder, value }: SetupTextFieldProps) {
  return (
    <label className="setup-field">
      <span>{label}</span>
      <input
        className={hasError ? 'has-error' : ''}
        value={value}
        onBlur={() => onChange(value.trim())}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  )
}

type LineupStepProps = {
  activeLineupTeam: TeamKey
  addPlayer: (team: TeamKey) => void
  draggedPlayer: { team: TeamKey; index: number } | null
  onDragEnd: () => void
  onDragOver: (team: TeamKey, index: number) => void
  onDragStart: (team: TeamKey, index: number) => void
  onRemovePlayer: (team: TeamKey, index: number) => void
  setActiveLineupTeam: (team: TeamKey) => void
  setTeamOnePlayerName: (name: string) => void
  setTeamTwoPlayerName: (name: string) => void
  teamOneLabel: string
  teamOnePlayerName: string
  teamOnePlayers: string[]
  teamTwoLabel: string
  teamTwoPlayerName: string
  teamTwoPlayers: string[]
  trackedTeams: TeamKey[]
  trackingMode: TrackingMode
}

function LineupStep({
  activeLineupTeam,
  addPlayer,
  draggedPlayer,
  onDragEnd,
  onDragOver,
  onDragStart,
  onRemovePlayer,
  setActiveLineupTeam,
  setTeamOnePlayerName,
  setTeamTwoPlayerName,
  teamOneLabel,
  teamOnePlayerName,
  teamOnePlayers,
  teamTwoLabel,
  teamTwoPlayerName,
  teamTwoPlayers,
  trackedTeams,
  trackingMode,
}: LineupStepProps) {
  const isTeamOneActive = activeLineupTeam === 'teamOne'

  return (
    <div className="setup-form-stack">
      {trackingMode === 'both' && (
        <div className="lineup-switch">
          <button
            className={activeLineupTeam === 'teamOne' ? 'active' : ''}
            type="button"
            onClick={() => setActiveLineupTeam('teamOne')}
          >
            Home Team
          </button>
          <button
            className={activeLineupTeam === 'teamTwo' ? 'active' : ''}
            type="button"
            onClick={() => setActiveLineupTeam('teamTwo')}
          >
            Away Team
          </button>
        </div>
      )}

      <div>
        <span className="lineup-team-name">{isTeamOneActive ? teamOneLabel : teamTwoLabel}</span>
        <RosterEditor
          addPlayer={() => addPlayer(activeLineupTeam)}
          draggedPlayer={draggedPlayer}
          inputValue={isTeamOneActive ? teamOnePlayerName : teamTwoPlayerName}
          onDragEnd={onDragEnd}
          onDragOver={(index) => onDragOver(activeLineupTeam, index)}
          onDragStart={(index) => onDragStart(activeLineupTeam, index)}
          onDrop={(index) => {
            if (draggedPlayer?.team === activeLineupTeam) {
              onDragOver(activeLineupTeam, index)
            }
          }}
          onInputChange={isTeamOneActive ? setTeamOnePlayerName : setTeamTwoPlayerName}
          onRemovePlayer={(index) => onRemovePlayer(activeLineupTeam, index)}
          players={isTeamOneActive ? teamOnePlayers : teamTwoPlayers}
          team={activeLineupTeam}
        />
      </div>

      {trackingMode === 'both' && trackedTeams.includes('teamTwo') && activeLineupTeam === 'teamOne' && (
        <button className="secondary-setup-button" type="button" onClick={() => setActiveLineupTeam('teamTwo')}>
          Next Lineup
        </button>
      )}
    </div>
  )
}

type SettingsStepProps = {
  innings: number
  setInnings: (updater: (current: number) => number) => void
}

function SettingsStep({ innings, setInnings }: SettingsStepProps) {
  return (
    <div className="setup-form-stack">
      <div className="setup-field">
        <span>Innings</span>
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
  )
}

function stepTitle(
  step: SetupStep,
  trackingMode: TrackingMode,
  activeLineupTeam: TeamKey,
  teamOneLabel: string,
  teamTwoLabel: string,
) {
  if (step === 'mode') {
    return 'Tracking Mode'
  }

  if (step === 'teams') {
    return trackingMode === 'one' ? 'My Team Setup' : 'Team Setup'
  }

  if (step === 'lineups') {
    if (trackingMode === 'one') {
      return `${teamOneLabel} Lineup`
    }

    return activeLineupTeam === 'teamOne' ? 'Home Team Lineup' : 'Away Team Lineup'
  }

  return 'Game Settings'
}

type RosterEditorProps = {
  addPlayer: () => void
  draggedPlayer: { team: TeamKey; index: number } | null
  inputValue: string
  onDragEnd: () => void
  onDragOver: (index: number) => void
  onDragStart: (index: number) => void
  onDrop: (index: number) => void
  onInputChange: (value: string) => void
  onRemovePlayer: (index: number) => void
  players: string[]
  team: TeamKey
}

function RosterEditor({
  addPlayer,
  draggedPlayer,
  inputValue,
  onDragEnd,
  onDragOver,
  onDragStart,
  onDrop,
  onInputChange,
  onRemovePlayer,
  players,
  team,
}: RosterEditorProps) {
  return (
    <div className="roster-editor">
      <div className="player-tile-list" aria-label="Batting order">
        {players.length === 0 && <p className="empty-roster">No players added yet.</p>}
        {players.map((player, index) => (
          <div
            className={draggedPlayer?.team === team && draggedPlayer.index === index ? 'player-tile dragging' : 'player-tile'}
            key={`${player}-${index}`}
            onDragEnd={onDragEnd}
            onDragOver={(event) => {
              event.preventDefault()
              onDragOver(index)
            }}
            onDrop={() => onDrop(index)}
          >
            <span className="player-order">{index + 1}</span>
            <span className="player-name">{player}</span>
            <button className="remove-player-button" type="button" aria-label={`Remove ${player}`} onClick={() => onRemovePlayer(index)}>
              <span aria-hidden="true" />
            </button>
            <span
              className="drag-handle"
              draggable
              role="button"
              aria-label={`Drag ${player}`}
              onDragStart={() => onDragStart(index)}
            />
          </div>
        ))}
      </div>

      <form
        className="add-player-row"
        onSubmit={(event) => {
          event.preventDefault()
          addPlayer()
        }}
      >
        <input
          value={inputValue}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="Add player"
        />
        <button type="submit">Add</button>
      </form>
    </div>
  )
}
