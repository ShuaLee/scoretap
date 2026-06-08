import { useEffect, useState } from 'react'

export type TeamKey = 'teamOne' | 'teamTwo'

export type GameConfig = {
  homeTeam: TeamKey
  innings: number
  teamOneName: string
  teamTwoName: string
  teamOnePlayers: string[]
  teamOneTracksBatting: boolean
  teamTwoPlayers: string[]
  teamTwoTracksBatting: boolean
}

type GameSetupPageProps = {
  onBeginGame: (config: GameConfig) => void
}

const TEAM_NAME_MAX_LENGTH = 45
export const PLAYER_NAME_MAX_LENGTH = 24
export const MIN_TRACKED_LINEUP_PLAYERS = 4
const GAME_SETUP_STORAGE_KEY = 'scoretap.gameSetupDraft'

type GameSetupDraft = {
  homeTeam: TeamKey
  innings: number
  teamOneDraftPlayer: string
  teamOneName: string
  teamOnePlayers: string[]
  teamOneTracksBatting: boolean
  teamTwoDraftPlayer: string
  teamTwoName: string
  teamTwoPlayers: string[]
  teamTwoTracksBatting: boolean
}

const defaultGameSetupDraft: GameSetupDraft = {
  homeTeam: 'teamOne',
  innings: 7,
  teamOneDraftPlayer: '',
  teamOneName: '',
  teamOnePlayers: [],
  teamOneTracksBatting: true,
  teamTwoDraftPlayer: '',
  teamTwoName: '',
  teamTwoPlayers: [],
  teamTwoTracksBatting: false,
}

export function GameSetupPage({ onBeginGame }: GameSetupPageProps) {
  const [setupDraft] = useState<GameSetupDraft>(() => readGameSetupDraft())
  const [trackedBatting, setTrackedBatting] = useState<Record<TeamKey, boolean>>({
    teamOne: setupDraft.teamOneTracksBatting,
    teamTwo: setupDraft.teamTwoTracksBatting,
  })
  const [teamOneName, setTeamOneName] = useState(setupDraft.teamOneName)
  const [teamTwoName, setTeamTwoName] = useState(setupDraft.teamTwoName)
  const [homeTeam, setHomeTeam] = useState<TeamKey>(setupDraft.homeTeam)
  const [innings, setInnings] = useState(setupDraft.innings)
  const [teamOnePlayers, setTeamOnePlayers] = useState<string[]>(setupDraft.teamOnePlayers)
  const [teamTwoPlayers, setTeamTwoPlayers] = useState<string[]>(setupDraft.teamTwoPlayers)
  const [draggedPlayer, setDraggedPlayer] = useState<{ team: TeamKey; index: number } | null>(null)
  const [dropTarget, setDropTarget] = useState<{ team: TeamKey; index: number } | null>(null)
  const [teamOneDraftPlayer, setTeamOneDraftPlayer] = useState(setupDraft.teamOneDraftPlayer)
  const [teamTwoDraftPlayer, setTeamTwoDraftPlayer] = useState(setupDraft.teamTwoDraftPlayer)
  const [showMissingLineupNotice, setShowMissingLineupNotice] = useState(false)

  const teamOneLabel = teamOneName.trim() || 'Team 1'
  const teamTwoLabel = teamTwoName.trim() || 'Team 2'
  const hasDuplicateTeamNames = teamOneLabel.toLowerCase() === teamTwoLabel.toLowerCase()
  const teamOneLineupCount = teamOnePlayers.filter((player) => player.trim()).length
  const teamTwoLineupCount = teamTwoPlayers.filter((player) => player.trim()).length
  const missingTrackedLineups =
    (trackedBatting.teamOne && teamOneLineupCount < MIN_TRACKED_LINEUP_PLAYERS) ||
    (trackedBatting.teamTwo && teamTwoLineupCount < MIN_TRACKED_LINEUP_PLAYERS)
  const cannotStartGame = hasDuplicateTeamNames

  useEffect(() => {
    const nextDraft: GameSetupDraft = {
      homeTeam,
      innings,
      teamOneDraftPlayer,
      teamOneName,
      teamOnePlayers,
      teamOneTracksBatting: trackedBatting.teamOne,
      teamTwoDraftPlayer,
      teamTwoName,
      teamTwoPlayers,
      teamTwoTracksBatting: trackedBatting.teamTwo,
    }

    localStorage.setItem(GAME_SETUP_STORAGE_KEY, JSON.stringify(nextDraft))
  }, [
    homeTeam,
    innings,
    teamOneDraftPlayer,
    teamOneName,
    teamOnePlayers,
    teamTwoDraftPlayer,
    teamTwoName,
    teamTwoPlayers,
    trackedBatting,
  ])

  function handleBeginGame() {
    if (missingTrackedLineups) {
      setShowMissingLineupNotice(true)
      return
    }

    const finalTeamOnePlayers = teamOnePlayers.map((player) => player.trim()).filter(Boolean)
    const finalTeamTwoPlayers = teamTwoPlayers.map((player) => player.trim()).filter(Boolean)

    setTeamOnePlayers(finalTeamOnePlayers)
    setTeamTwoPlayers(finalTeamTwoPlayers)
    setTeamOneDraftPlayer('')
    setTeamTwoDraftPlayer('')
    localStorage.removeItem(GAME_SETUP_STORAGE_KEY)
    onBeginGame({
      homeTeam,
      innings,
      teamOneName: teamOneLabel,
      teamTwoName: teamTwoLabel,
      teamOnePlayers: finalTeamOnePlayers,
      teamOneTracksBatting: trackedBatting.teamOne,
      teamTwoPlayers: finalTeamTwoPlayers,
      teamTwoTracksBatting: trackedBatting.teamTwo,
    })
  }

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
      const targetPlayer = nextPlayers[toIndex]
      nextPlayers[toIndex] = nextPlayers[fromIndex]
      nextPlayers[fromIndex] = targetPlayer
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
      </div>

      <div className="create-game-stack">
        <div className="team-card-grid">
          <div className="team-column">
            <TeamSetupCard
              draggedPlayer={draggedPlayer}
              dropTarget={dropTarget}
              draftPlayerName={teamOneDraftPlayer}
              hasDuplicateTeamNames={hasDuplicateTeamNames}
              isHome={homeTeam === 'teamOne'}
              name={teamOneName}
              onBattingTrackingChange={(shouldTrackBatting) => setTeamBattingTracking('teamOne', shouldTrackBatting)}
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
            <TeamSetupCard
              draggedPlayer={draggedPlayer}
              dropTarget={dropTarget}
              draftPlayerName={teamTwoDraftPlayer}
              hasDuplicateTeamNames={hasDuplicateTeamNames}
              isHome={homeTeam === 'teamTwo'}
              name={teamTwoName}
              onBattingTrackingChange={(shouldTrackBatting) => setTeamBattingTracking('teamTwo', shouldTrackBatting)}
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
      </div>

      {hasDuplicateTeamNames && <p className="setup-error">Team names must be different.</p>}
      {showMissingLineupNotice && missingTrackedLineups && (
        <p className="setup-notice">Add at least {MIN_TRACKED_LINEUP_PLAYERS} batters for each team set to At-Bats & Runs.</p>
      )}

      <div className="create-game-actions">
        <div className="floating-innings-control">
          <div
            className="innings-pill-stepper"
            aria-label="Number of innings"
            onWheel={(event) => {
              event.preventDefault()
              setInnings((current) => {
                const direction = event.deltaY < 0 ? 1 : -1
                return Math.min(20, Math.max(1, current + direction))
              })
            }}
          >
            <span>Innings</span>
            <button type="button" aria-label="Decrease innings" onClick={() => setInnings((current) => Math.max(1, current - 1))}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="m10 4-4 4 4 4" />
              </svg>
            </button>
            <input
              aria-label="Innings"
              inputMode="numeric"
              max={20}
              min={1}
              type="number"
              value={innings}
              onChange={(event) => {
                const nextInnings = Number(event.target.value)
                if (!Number.isNaN(nextInnings)) {
                  setInnings(Math.min(20, Math.max(1, nextInnings)))
                }
              }}
            />
            <button type="button" aria-label="Increase innings" onClick={() => setInnings((current) => Math.min(20, current + 1))}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="m6 4 4 4-4 4" />
              </svg>
            </button>
          </div>
        </div>
        <button type="button" onClick={handleBeginGame} disabled={cannotStartGame}>
          Start Game
        </button>
      </div>

    </section>
  )
}

function readGameSetupDraft(): GameSetupDraft {
  try {
    const rawDraft = localStorage.getItem(GAME_SETUP_STORAGE_KEY)
    if (!rawDraft) {
      return defaultGameSetupDraft
    }

    const parsedDraft = JSON.parse(rawDraft) as Partial<GameSetupDraft>
    const homeTeam = parsedDraft.homeTeam === 'teamTwo' ? 'teamTwo' : 'teamOne'
    const innings = typeof parsedDraft.innings === 'number' ? parsedDraft.innings : defaultGameSetupDraft.innings

    return {
      homeTeam,
      innings: Math.min(20, Math.max(1, innings)),
      teamOneDraftPlayer: readString(parsedDraft.teamOneDraftPlayer),
      teamOneName: readString(parsedDraft.teamOneName).slice(0, TEAM_NAME_MAX_LENGTH),
      teamOnePlayers: readStringArray(parsedDraft.teamOnePlayers),
      teamOneTracksBatting: typeof parsedDraft.teamOneTracksBatting === 'boolean' ? parsedDraft.teamOneTracksBatting : true,
      teamTwoDraftPlayer: readString(parsedDraft.teamTwoDraftPlayer),
      teamTwoName: readString(parsedDraft.teamTwoName).slice(0, TEAM_NAME_MAX_LENGTH),
      teamTwoPlayers: readStringArray(parsedDraft.teamTwoPlayers),
      teamTwoTracksBatting: typeof parsedDraft.teamTwoTracksBatting === 'boolean' ? parsedDraft.teamTwoTracksBatting : false,
    }
  } catch {
    localStorage.removeItem(GAME_SETUP_STORAGE_KEY)
    return defaultGameSetupDraft
  }
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

type TeamSetupCardProps = {
  draggedPlayer: { team: TeamKey; index: number } | null
  draftPlayerName: string
  dropTarget: { team: TeamKey; index: number } | null
  hasDuplicateTeamNames: boolean
  isHome: boolean
  name: string
  onBattingTrackingChange: (shouldTrackBatting: boolean) => void
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
  onBattingTrackingChange,
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
  const isPreviewingSwap = draggedPlayer?.team === team && dropTarget?.team === team
  const previewRows = players.map((player, index) => ({ player, sourceIndex: index }))

  if (isPreviewingSwap && draggedPlayer.index !== dropTarget.index) {
    const targetRow = previewRows[dropTarget.index]
    previewRows[dropTarget.index] = previewRows[draggedPlayer.index]
    previewRows[draggedPlayer.index] = targetRow
  }

  return (
    <div className="team-setup-card has-lineup">
      <div className="team-setup-heading">
        <input
          className={hasDuplicateTeamNames ? 'team-heading-input has-error' : 'team-heading-input'}
          aria-label={`${placeholder} name`}
          maxLength={TEAM_NAME_MAX_LENGTH}
          value={name}
          onBlur={() => onNameChange(name.trim())}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder={placeholder}
        />
        <div className="team-card-controls">
          <button
            className={trackBatting ? 'team-mode-action active' : 'team-mode-action'}
            type="button"
            onClick={() => onBattingTrackingChange(!trackBatting)}
          >
            <span>{trackBatting ? 'At-Bats & Runs' : 'Runs Only'}</span>
            <svg className="mode-swap-icon" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4.5 4.25h7m0 0-2-2m2 2-2 2M11.5 11.75h-7m0 0 2 2m-2-2 2-2" />
            </svg>
          </button>
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
            {previewRows.map(({ player, sourceIndex }, index) => {
              const isDraggedPosition = draggedPlayer?.team === team && draggedPlayer.index === sourceIndex
              const isDropPosition = dropTarget?.team === team && dropTarget.index === index

              return (
                <div
                  className={[
                    'player-tile',
                    isPreviewingSwap ? 'swap-preview' : '',
                    isDraggedPosition ? 'dragging' : '',
                    isDropPosition ? 'drop-target' : '',
                  ].filter(Boolean).join(' ')}
                  key={index}
                  onDragEnd={onDragEnd}
                  onDragOver={(event) => {
                    event.preventDefault()
                    onDragOver(index)
                  }}
                  onDragEnter={() => onDragOver(index)}
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
                    maxLength={PLAYER_NAME_MAX_LENGTH}
                    value={player}
                    onChange={(event) => onUpdatePlayer(sourceIndex, event.target.value)}
                  />
                  <button className="remove-player-button" type="button" aria-label={`Remove ${player}`} onClick={() => onRemovePlayer(sourceIndex)}>
                    <span aria-hidden="true" />
                  </button>
                </div>
              )
            })}
            <form
              className="inline-player-row"
              onSubmit={(event) => {
                event.preventDefault()
                onSubmitPlayer()
              }}
            >
              <span className="player-order draft">{players.length + 1}</span>
              <input
                maxLength={PLAYER_NAME_MAX_LENGTH}
                placeholder="Player name"
                value={draftPlayerName}
                onChange={(event) => onDraftPlayerNameChange(event.target.value)}
              />
              <button className="add-inline-player-button" type="submit" aria-label={`Add player to ${displayName}`}>
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M8 3.5v9M3.5 8h9" />
                </svg>
              </button>
            </form>
          </>
        ) : (
          <div className="lineup-disabled-message">
            <p>Batting order and at-bats are not tracked. Runs are entered per inning for this team.</p>
          </div>
        )}
      </div>
    </div>
  )
}
