import { useEffect, useState } from 'react'
import { Scoreboard } from '../components/Scoreboard'
import { PLAYER_NAME_MAX_LENGTH, type GameConfig } from './GameSetupPage'

type ScoreGamePageProps = {
  gameConfig: GameConfig
  initialState?: PersistedGameState
  onGameStateChange: (state: PersistedGameState) => void
}

type TeamSide = 'home' | 'away'
type BaseKey = 'first' | 'second' | 'third'
type RunnerSource = BaseKey | 'atBat'

type Runner = {
  id: number
  name: string
  team: TeamSide
}

type Bases = Record<BaseKey, Runner | null>
type ScoreAdjustments = Record<number, { home: number; away: number }>
type ScoreModification = {
  home: number
  away: number
}

export type PersistedGameState = {
  awayBatterIndex: number
  awayScore: number
  bases: Bases
  halfInning: 'top' | 'bottom'
  homeBatterIndex: number
  homeScore: number
  inning: number
  outs: number
  pendingScorers: Runner[]
  scoreAdjustments: ScoreAdjustments
  scoreModification: ScoreModification
  teamOnePlayers: string[]
  teamTwoPlayers: string[]
}

const emptyBases: Bases = {
  first: null,
  second: null,
  third: null,
}

export function ScoreGamePage({ gameConfig, initialState, onGameStateChange }: ScoreGamePageProps) {
  const [isBattingOrderOpen, setIsBattingOrderOpen] = useState(false)
  const [isScoreEditorOpen, setIsScoreEditorOpen] = useState(false)
  const [teamOnePlayers, setTeamOnePlayers] = useState(initialState?.teamOnePlayers ?? gameConfig.teamOnePlayers)
  const [teamTwoPlayers, setTeamTwoPlayers] = useState(initialState?.teamTwoPlayers ?? gameConfig.teamTwoPlayers)
  const [halfInning, setHalfInning] = useState<'top' | 'bottom'>(initialState?.halfInning ?? 'top')
  const [inning, setInning] = useState(initialState?.inning ?? 1)
  const [outs, setOuts] = useState(initialState?.outs ?? 0)
  const [homeScore, setHomeScore] = useState(initialState?.homeScore ?? 0)
  const [awayScore, setAwayScore] = useState(initialState?.awayScore ?? 0)
  const [homeBatterIndex, setHomeBatterIndex] = useState(initialState?.homeBatterIndex ?? 0)
  const [awayBatterIndex, setAwayBatterIndex] = useState(initialState?.awayBatterIndex ?? 0)
  const [bases, setBases] = useState<Bases>(initialState?.bases ?? emptyBases)
  const [pendingScorers, setPendingScorers] = useState<Runner[]>(initialState?.pendingScorers ?? [])
  const [draggedRunnerSource, setDraggedRunnerSource] = useState<RunnerSource | null>(null)
  const [scoreAdjustments, setScoreAdjustments] = useState<ScoreAdjustments>(initialState?.scoreAdjustments ?? {})
  const [scoreModification, setScoreModification] = useState<ScoreModification>(initialState?.scoreModification ?? { home: 0, away: 0 })

  const battingTeam: TeamSide = halfInning === 'top' ? 'away' : 'home'
  const battingTeamName = battingTeam === 'home' ? gameConfig.teamOneName : gameConfig.teamTwoName
  const battingLineup = battingTeam === 'home' ? teamOnePlayers : teamTwoPlayers
  const batterIndex = battingTeam === 'home' ? homeBatterIndex : awayBatterIndex
  const currentBatterName = battingLineup[batterIndex % Math.max(battingLineup.length, 1)] || `${battingTeamName} Batter`
  const currentBatter: Runner = {
    id: Number(`${battingTeam === 'home' ? 1 : 2}${inning}${batterIndex}`),
    name: currentBatterName,
    team: battingTeam,
  }
  const inningLabel = `${halfInning === 'top' ? 'Top' : 'Bottom'} ${formatInning(inning)}`
  const adjustedHomeScore = homeScore + scoreModification.home + Object.values(scoreAdjustments).reduce((total, adjustment) => total + adjustment.home, 0)
  const adjustedAwayScore = awayScore + scoreModification.away + Object.values(scoreAdjustments).reduce((total, adjustment) => total + adjustment.away, 0)

  useEffect(() => {
    onGameStateChange({
      awayBatterIndex,
      awayScore,
      bases,
      halfInning,
      homeBatterIndex,
      homeScore,
      inning,
      outs,
      pendingScorers,
      scoreAdjustments,
      scoreModification,
      teamOnePlayers,
      teamTwoPlayers,
    })
  }, [
    awayBatterIndex,
    awayScore,
    bases,
    halfInning,
    homeBatterIndex,
    homeScore,
    inning,
    onGameStateChange,
    outs,
    pendingScorers,
    scoreAdjustments,
    scoreModification,
    teamOnePlayers,
    teamTwoPlayers,
  ])

  function scoreRunner(runner: Runner) {
    if (runner.team === 'home') {
      setHomeScore((score) => score + 1)
      return
    }

    setAwayScore((score) => score + 1)
  }

  function confirmScoredRunner() {
    const [runner, ...remainingRunners] = pendingScorers
    if (!runner) {
      return
    }

    scoreRunner(runner)
    setPendingScorers(remainingRunners)
  }

  function advanceBatter() {
    if (battingTeam === 'home') {
      setHomeBatterIndex((index) => index + 1)
      return
    }

    setAwayBatterIndex((index) => index + 1)
  }

  function switchHalfInning() {
    setBases(emptyBases)
    setOuts(0)
    setPendingScorers([])

    if (halfInning === 'top') {
      setHalfInning('bottom')
      return
    }

    setHalfInning('top')
    setInning((currentInning) => currentInning + 1)
  }

  function recordOut() {
    const nextOuts = outs + 1
    advanceBatter()

    if (nextOuts >= 3) {
      switchHalfInning()
      return
    }

    setOuts(nextOuts)
  }

  function recordHit(baseCount: number) {
    const nextBases: Bases = { first: null, second: null, third: null }
    const scoringRunners: Runner[] = []

    ;[
      ['third', 3],
      ['second', 2],
      ['first', 1],
    ].forEach(([base, baseNumber]) => {
      const runner = bases[base as BaseKey]
      if (!runner) {
        return
      }

      const targetBase = (baseNumber as number) + baseCount
      if (targetBase > 3) {
        scoringRunners.push(runner)
        return
      }

      nextBases[baseNumberToKey(targetBase)] = runner
    })

    if (baseCount >= 4) {
      scoringRunners.push(currentBatter)
    } else {
      nextBases[baseNumberToKey(baseCount)] = currentBatter
    }

    setBases(nextBases)
    setPendingScorers((runners) => [...runners, ...scoringRunners])
    advanceBatter()
  }

  function moveRunner(source: RunnerSource, target: RunnerSource) {
    if (source === target) {
      return
    }

    const sourceRunner = source === 'atBat' ? currentBatter : bases[source]
    if (!sourceRunner) {
      return
    }

    setBases((currentBases) => {
      const nextBases = { ...currentBases }
      const targetRunner = target === 'atBat' ? null : nextBases[target]

      if (source !== 'atBat') {
        nextBases[source] = targetRunner
      }

      if (target !== 'atBat') {
        nextBases[target] = sourceRunner
      }

      return nextBases
    })
  }

  function moveBaseRunner(source: BaseKey, direction: -1 | 1) {
    const runner = bases[source]
    if (!runner) {
      return
    }

    const currentBaseNumber = baseKeyToNumber(source)
    const targetBaseNumber = currentBaseNumber + direction

    if (targetBaseNumber < 1) {
      setBases((currentBases) => ({
        ...currentBases,
        [source]: null,
      }))
      return
    }

    if (targetBaseNumber > 3) {
      setBases((currentBases) => ({
        ...currentBases,
        [source]: null,
      }))
      setPendingScorers((runners) => [...runners, runner])
      return
    }

    moveRunner(source, baseNumberToKey(targetBaseNumber))
  }

  return (
    <section className="score-game-page" aria-label="Score game">
      <Scoreboard
        awayTeamName={gameConfig.teamTwoName}
        awayScore={adjustedAwayScore}
        homeTeamName={gameConfig.teamOneName}
        homeScore={adjustedHomeScore}
        inningLabel={inningLabel}
        outs={outs}
        onEdit={() => setIsScoreEditorOpen(true)}
      />
      <BaseOccupancy
        bases={bases}
        currentBatter={currentBatter}
        draggedRunnerSource={draggedRunnerSource}
        onDragEnd={() => setDraggedRunnerSource(null)}
        onDragStart={setDraggedRunnerSource}
        onManageBattingOrder={() => setIsBattingOrderOpen(true)}
        onMoveBaseRunner={moveBaseRunner}
        onMoveRunner={moveRunner}
      />
      <ScoringActions onHit={recordHit} onOut={recordOut} />
      {pendingScorers[0] && (
        <section className="score-confirm-card" aria-label="Confirm run scored">
          <span>{pendingScorers[0].name} made it home?</span>
          <button type="button" onClick={confirmScoredRunner}>
            Yes
          </button>
        </section>
      )}
      {isScoreEditorOpen && (
        <ScoreEditorModal
          awayTeamName={gameConfig.teamTwoName}
          halfInning={halfInning}
          homeTeamName={gameConfig.teamOneName}
          inning={inning}
          outs={outs}
          scoreAdjustments={scoreAdjustments}
          scoreModification={scoreModification}
          onClose={() => setIsScoreEditorOpen(false)}
          onHalfInningChange={setHalfInning}
          onInningChange={setInning}
          onOutsChange={setOuts}
          onScoreAdjustmentsChange={setScoreAdjustments}
          onScoreModificationChange={setScoreModification}
        />
      )}
      {isBattingOrderOpen && (
        <BattingOrderModal
          onClose={() => setIsBattingOrderOpen(false)}
          teamOneName={gameConfig.teamOneName}
          teamOnePlayers={teamOnePlayers}
          teamTwoName={gameConfig.teamTwoName}
          teamTwoPlayers={teamTwoPlayers}
          onTeamOnePlayersChange={setTeamOnePlayers}
          onTeamTwoPlayersChange={setTeamTwoPlayers}
        />
      )}
    </section>
  )
}

type ScoreEditorModalProps = {
  awayTeamName: string
  halfInning: 'top' | 'bottom'
  homeTeamName: string
  inning: number
  onClose: () => void
  onHalfInningChange: (halfInning: 'top' | 'bottom') => void
  onInningChange: (inning: number) => void
  onOutsChange: (outs: number) => void
  onScoreAdjustmentsChange: (adjustments: ScoreAdjustments) => void
  onScoreModificationChange: (modification: ScoreModification) => void
  outs: number
  scoreAdjustments: ScoreAdjustments
  scoreModification: ScoreModification
}

function ScoreEditorModal({
  awayTeamName,
  halfInning,
  homeTeamName,
  inning,
  onClose,
  onHalfInningChange,
  onInningChange,
  onOutsChange,
  onScoreAdjustmentsChange,
  onScoreModificationChange,
  outs,
  scoreAdjustments,
  scoreModification,
}: ScoreEditorModalProps) {
  const inningRows = Array.from({ length: Math.max(7, inning) }, (_, index) => index + 1)

  function updateInningAdjustment(inningNumber: number, team: 'home' | 'away', value: number) {
    onScoreAdjustmentsChange({
      ...scoreAdjustments,
      [inningNumber]: {
        home: scoreAdjustments[inningNumber]?.home ?? 0,
        away: scoreAdjustments[inningNumber]?.away ?? 0,
        [team]: value,
      },
    })
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="score-editor-modal" role="dialog" aria-modal="true" aria-labelledby="score-editor-title">
        <button className="modal-close-button" type="button" aria-label="Close score editor" onClick={onClose}>
          <span aria-hidden="true" />
        </button>
        <span className="modal-eyebrow">Scorebook</span>
        <h2 id="score-editor-title">Edit scoreboard</h2>

        <div className="score-editor-section">
          <h3>Game Position</h3>
          <div className="score-editor-grid compact">
            <label>
              Inning
              <input min={1} type="number" value={inning} onChange={(event) => onInningChange(Math.max(1, Number(event.target.value) || 1))} />
            </label>
            <label>
              Half
              <select value={halfInning} onChange={(event) => onHalfInningChange(event.target.value as 'top' | 'bottom')}>
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
              </select>
            </label>
            <label>
              Outs
              <input min={0} max={2} type="number" value={outs} onChange={(event) => onOutsChange(Math.min(2, Math.max(0, Number(event.target.value) || 0)))} />
            </label>
          </div>
        </div>

        <div className="score-editor-section">
          <h3>Inning Adjustments</h3>
          <p>Use these for corrections tied to a specific inning.</p>
          <div className="inning-adjustment-table">
            <span>Inning</span>
            <span>{homeTeamName}</span>
            <span>{awayTeamName}</span>
            {inningRows.map((inningNumber) => (
              <div className="inning-adjustment-row" key={inningNumber}>
                <strong>{inningNumber}</strong>
                <input type="number" value={scoreAdjustments[inningNumber]?.home ?? 0} onChange={(event) => updateInningAdjustment(inningNumber, 'home', Number(event.target.value) || 0)} />
                <input type="number" value={scoreAdjustments[inningNumber]?.away ?? 0} onChange={(event) => updateInningAdjustment(inningNumber, 'away', Number(event.target.value) || 0)} />
              </div>
            ))}
          </div>
        </div>

        <div className="score-editor-section">
          <h3>Modifications</h3>
          <p>Use these for final score corrections that are not tied to an inning.</p>
          <div className="score-editor-grid">
            <label>
              {homeTeamName}
              <input type="number" value={scoreModification.home} onChange={(event) => onScoreModificationChange({ ...scoreModification, home: Number(event.target.value) || 0 })} />
            </label>
            <label>
              {awayTeamName}
              <input type="number" value={scoreModification.away} onChange={(event) => onScoreModificationChange({ ...scoreModification, away: Number(event.target.value) || 0 })} />
            </label>
          </div>
        </div>
        <div className="score-editor-actions">
          <button type="button" onClick={onClose}>
            Confirm
          </button>
        </div>
      </section>
    </div>
  )
}

type BaseOccupancyProps = {
  bases: Bases
  currentBatter: Runner
  draggedRunnerSource: RunnerSource | null
  onDragEnd: () => void
  onDragStart: (source: RunnerSource) => void
  onManageBattingOrder: () => void
  onMoveBaseRunner: (source: BaseKey, direction: -1 | 1) => void
  onMoveRunner: (source: RunnerSource, target: RunnerSource) => void
}

function BaseOccupancy({
  bases,
  currentBatter,
  draggedRunnerSource,
  onDragEnd,
  onDragStart,
  onManageBattingOrder,
  onMoveBaseRunner,
  onMoveRunner,
}: BaseOccupancyProps) {
  return (
    <div className="base-area">
      <section className="base-occupancy-card" aria-label="Base runners">
        <BaseSlot baseKey="third" className="base-slot-3b" label="3B" runner={bases.third} draggedRunnerSource={draggedRunnerSource} onDragEnd={onDragEnd} onDragStart={onDragStart} onMoveBaseRunner={onMoveBaseRunner} onMoveRunner={onMoveRunner} />
        <BaseSlot baseKey="second" className="base-slot-2b" label="2B" runner={bases.second} draggedRunnerSource={draggedRunnerSource} onDragEnd={onDragEnd} onDragStart={onDragStart} onMoveBaseRunner={onMoveBaseRunner} onMoveRunner={onMoveRunner} />
        <BaseSlot baseKey="first" className="base-slot-1b" label="1B" runner={bases.first} draggedRunnerSource={draggedRunnerSource} onDragEnd={onDragEnd} onDragStart={onDragStart} onMoveBaseRunner={onMoveBaseRunner} onMoveRunner={onMoveRunner} />
        <BaseSlot baseKey="atBat" className="base-slot-home" label="Home" draggedRunnerSource={draggedRunnerSource} onDragEnd={onDragEnd} onDragStart={onDragStart} onMoveRunner={onMoveRunner} />
      </section>
      <section
        className="at-bat-card"
        aria-label="Current batter"
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => {
          if (draggedRunnerSource) {
            onMoveRunner(draggedRunnerSource, 'atBat')
          }
        }}
      >
        <span>At Bat</span>
        <RunnerTile runner={currentBatter} source="atBat" />
      </section>
      <button className="manage-batting-order-button" type="button" onClick={onManageBattingOrder}>
        Batting Order
      </button>
    </div>
  )
}

type BaseSlotProps = {
  baseKey: RunnerSource
  className: string
  draggedRunnerSource: RunnerSource | null
  label: string
  onDragEnd: () => void
  onDragStart: (source: RunnerSource) => void
  onMoveBaseRunner?: (source: BaseKey, direction: -1 | 1) => void
  onMoveRunner: (source: RunnerSource, target: RunnerSource) => void
  runner?: Runner | null
}

function BaseSlot({ baseKey, className, draggedRunnerSource, label, onDragEnd, onDragStart, onMoveBaseRunner, onMoveRunner, runner }: BaseSlotProps) {
  return (
    <div
      className={`base-slot ${className}${runner ? ' has-runner' : ''}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => {
        if (draggedRunnerSource) {
          onMoveRunner(draggedRunnerSource, baseKey)
        }
      }}
    >
      <span className="base-slot-label">{label}</span>
      {runner && (
        <RunnerTile
          runner={runner}
          source={baseKey}
          onDragEnd={onDragEnd}
          onDragStart={onDragStart}
          onMoveBaseRunner={onMoveBaseRunner}
        />
      )}
    </div>
  )
}

type RunnerTileProps = {
  onDragEnd?: () => void
  onDragStart?: (source: RunnerSource) => void
  onMoveBaseRunner?: (source: BaseKey, direction: -1 | 1) => void
  runner: Runner
  source: RunnerSource
}

function RunnerTile({ onDragEnd, onDragStart, onMoveBaseRunner, runner, source }: RunnerTileProps) {
  const isBaseRunner = source !== 'atBat'

  return (
    <div
      className={isBaseRunner ? 'score-runner-tile' : 'score-runner-tile at-bat-runner-tile'}
      draggable={isBaseRunner}
      onDragEnd={onDragEnd}
      onDragStart={() => onDragStart?.(source)}
    >
      {isBaseRunner && (
        <button type="button" aria-label={`Move ${runner.name} back`} onClick={() => onMoveBaseRunner?.(source, -1)}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="m10 4-4 4 4 4" />
          </svg>
        </button>
      )}
      <span>{runner.name}</span>
      {isBaseRunner && (
        <button type="button" aria-label={`Move ${runner.name} forward`} onClick={() => onMoveBaseRunner?.(source, 1)}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="m6 4 4 4-4 4" />
          </svg>
        </button>
      )}
    </div>
  )
}

type ScoringActionsProps = {
  onHit: (baseCount: number) => void
  onOut: () => void
}

function ScoringActions({ onHit, onOut }: ScoringActionsProps) {
  return (
    <nav className="scoring-actions" aria-label="Score play">
      <button type="button" onClick={() => onHit(1)}>Single</button>
      <button type="button" onClick={() => onHit(2)}>Double</button>
      <button type="button" onClick={() => onHit(3)}>Triple</button>
      <button type="button" onClick={() => onHit(4)}>HR</button>
      <button type="button" onClick={onOut}>Out</button>
    </nav>
  )
}

function baseNumberToKey(baseNumber: number): BaseKey {
  if (baseNumber === 1) {
    return 'first'
  }

  if (baseNumber === 2) {
    return 'second'
  }

  return 'third'
}

function baseKeyToNumber(baseKey: BaseKey) {
  if (baseKey === 'first') {
    return 1
  }

  if (baseKey === 'second') {
    return 2
  }

  return 3
}

function formatInning(inning: number) {
  const suffix = inning === 1 ? 'st' : inning === 2 ? 'nd' : inning === 3 ? 'rd' : 'th'
  return `${inning}${suffix}`
}

type BattingOrderModalProps = {
  onClose: () => void
  onTeamOnePlayersChange: (players: string[]) => void
  onTeamTwoPlayersChange: (players: string[]) => void
  teamOneName: string
  teamOnePlayers: string[]
  teamTwoName: string
  teamTwoPlayers: string[]
}

function BattingOrderModal({
  onClose,
  onTeamOnePlayersChange,
  onTeamTwoPlayersChange,
  teamOneName,
  teamOnePlayers,
  teamTwoName,
  teamTwoPlayers,
}: BattingOrderModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="batting-order-modal" role="dialog" aria-modal="true" aria-labelledby="batting-order-title">
        <button className="modal-close-button" type="button" aria-label="Close batting order" onClick={onClose}>
          <span aria-hidden="true" />
        </button>
        <span className="modal-eyebrow">Lineups</span>
        <h2 id="batting-order-title">Batting order</h2>
        <div className="batting-order-grid">
          <BattingOrderEditor teamName={teamOneName} players={teamOnePlayers} onPlayersChange={onTeamOnePlayersChange} />
          <BattingOrderEditor teamName={teamTwoName} players={teamTwoPlayers} onPlayersChange={onTeamTwoPlayersChange} />
        </div>
      </section>
    </div>
  )
}

type BattingOrderEditorProps = {
  onPlayersChange: (players: string[]) => void
  players: string[]
  teamName: string
}

function BattingOrderEditor({ onPlayersChange, players, teamName }: BattingOrderEditorProps) {
  const [draftPlayer, setDraftPlayer] = useState('')

  function addPlayer() {
    const playerName = draftPlayer.trim()
    if (!playerName) {
      return
    }

    onPlayersChange([...players, playerName])
    setDraftPlayer('')
  }

  function movePlayer(index: number, direction: -1 | 1) {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= players.length) {
      return
    }

    const nextPlayers = [...players]
    const movedPlayer = nextPlayers[index]
    nextPlayers[index] = nextPlayers[nextIndex]
    nextPlayers[nextIndex] = movedPlayer
    onPlayersChange(nextPlayers)
  }

  return (
    <div className="batting-order-editor">
      <strong>{teamName}</strong>
      <div className="batting-order-list">
        {players.map((player, index) => (
          <div className="batting-order-row" key={index}>
            <span>{index + 1}</span>
            <input
              aria-label={`${teamName} batter ${index + 1}`}
              maxLength={PLAYER_NAME_MAX_LENGTH}
              value={player}
              onChange={(event) => onPlayersChange(players.map((currentPlayer, playerIndex) => (playerIndex === index ? event.target.value : currentPlayer)))}
            />
            <button type="button" aria-label="Move batter up" onClick={() => movePlayer(index, -1)}>
              ↑
            </button>
            <button type="button" aria-label="Move batter down" onClick={() => movePlayer(index, 1)}>
              ↓
            </button>
            <button type="button" aria-label={`Remove ${player || `batter ${index + 1}`}`} onClick={() => onPlayersChange(players.filter((_, playerIndex) => playerIndex !== index))}>
              ×
            </button>
          </div>
        ))}
        <form
          className="batting-order-add-row"
          onSubmit={(event) => {
            event.preventDefault()
            addPlayer()
          }}
        >
          <input
            maxLength={PLAYER_NAME_MAX_LENGTH}
            placeholder="Add batter"
            value={draftPlayer}
            onChange={(event) => setDraftPlayer(event.target.value)}
          />
          <button type="submit">Add</button>
        </form>
      </div>
    </div>
  )
}
