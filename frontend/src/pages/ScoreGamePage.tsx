import { useEffect, useRef, useState, type DragEvent } from 'react'
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
type MovePreview = {
  bases: Bases
  blocked: boolean
  scoringRunner: Runner | null
}

type GameSnapshot = {
  awayBatterIndex: number
  awayScore: number
  bases: Bases
  halfInning: 'top' | 'bottom'
  homeBatterIndex: number
  homeScore: number
  inning: number
  outs: number
  pendingScorers: Runner[]
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
  undoStack?: GameSnapshot[]
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
  const [undoStack, setUndoStack] = useState<GameSnapshot[]>(initialState?.undoStack ?? [])

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
      undoStack,
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
    undoStack,
  ])

  function createGameSnapshot(): GameSnapshot {
    return {
      awayBatterIndex,
      awayScore,
      bases,
      halfInning,
      homeBatterIndex,
      homeScore,
      inning,
      outs,
      pendingScorers,
    }
  }

  function saveUndoSnapshot() {
    const snapshot = createGameSnapshot()
    setUndoStack((snapshots) => [...snapshots, snapshot].slice(-25))
  }

  function undoLastScoringAction() {
    setUndoStack((snapshots) => {
      const snapshot = snapshots[snapshots.length - 1]

      if (!snapshot) {
        return snapshots
      }

      setAwayBatterIndex(snapshot.awayBatterIndex)
      setAwayScore(snapshot.awayScore)
      setBases(snapshot.bases)
      setHalfInning(snapshot.halfInning)
      setHomeBatterIndex(snapshot.homeBatterIndex)
      setHomeScore(snapshot.homeScore)
      setInning(snapshot.inning)
      setOuts(snapshot.outs)
      setPendingScorers(snapshot.pendingScorers)

      return snapshots.slice(0, -1)
    })
  }

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

  function returnPendingScorerToThird() {
    const [runner, ...remainingRunners] = pendingScorers
    if (!runner) {
      return
    }

    setBases((currentBases) => {
      const displacedRunner = currentBases.third
      setPendingScorers(displacedRunner ? [displacedRunner, ...remainingRunners] : remainingRunners)

      return {
        ...currentBases,
        third: runner,
      }
    })
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
    saveUndoSnapshot()
    const nextOuts = outs + 1
    advanceBatter()

    if (nextOuts >= 3) {
      switchHalfInning()
      return
    }

    setOuts(nextOuts)
  }

  function recordBaseRunnerOut(source: BaseKey) {
    const runner = bases[source]
    if (!runner) {
      return
    }

    saveUndoSnapshot()
    setBases((currentBases) => ({
      ...currentBases,
      [source]: null,
    }))

    const nextOuts = outs + 1
    if (nextOuts >= 3) {
      switchHalfInning()
      return
    }

    setOuts(nextOuts)
  }

  function recordHit(baseCount: number) {
    saveUndoSnapshot()
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

    const preview = getMovePreview(source, target)
    if (preview.blocked) {
      return
    }

    setBases(preview.bases)

    if (preview.scoringRunner) {
      const scoringRunner = preview.scoringRunner
      setPendingScorers((runners) => [...runners, scoringRunner])
    }
  }

  function getMovePreview(source: RunnerSource, target: RunnerSource): MovePreview {
    if (source === target || target === 'atBat') {
      return { bases, blocked: false, scoringRunner: null }
    }

    const sourceRunner = source === 'atBat' ? currentBatter : bases[source]
    if (!sourceRunner) {
      return { bases, blocked: true, scoringRunner: null }
    }

    const direction = source === 'atBat' ? 1 : baseKeyToNumber(source) > baseKeyToNumber(target) ? -1 : 1
    const nextBases = { ...bases }
    let scoringRunner: Runner | null = null

    if (source !== 'atBat') {
      nextBases[source] = null
    }

    function placeRunner(runner: Runner, baseNumber: number): boolean {
      if (baseNumber < 1) {
        return false
      }

      if (baseNumber > 3) {
        scoringRunner = runner
        return true
      }

      const base = baseNumberToKey(baseNumber)
      const displacedRunner = nextBases[base]
      nextBases[base] = runner

      if (!displacedRunner) {
        return true
      }

      return placeRunner(displacedRunner, baseNumber + direction)
    }

    const isValidMove = placeRunner(sourceRunner, baseKeyToNumber(target))
    if (!isValidMove) {
      return { bases, blocked: true, scoringRunner: null }
    }

    return { bases: nextBases, blocked: false, scoringRunner }
  }

  return (
    <section className="score-game-page" aria-label="Score game">
      <Scoreboard
        activeBattingTeam={battingTeam}
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
        canUndo={undoStack.length > 0}
        draggedRunnerSource={draggedRunnerSource}
        onDragEnd={() => setDraggedRunnerSource(null)}
        onDragStart={setDraggedRunnerSource}
        onGetMovePreview={getMovePreview}
        onMoveRunner={moveRunner}
        onRequestRunnerOut={(_, source) => recordBaseRunnerOut(source)}
        onReturnRunnerToThird={returnPendingScorerToThird}
        pendingScorer={pendingScorers[0] ?? null}
        pendingScorerCount={pendingScorers.length}
        onConfirmRun={confirmScoredRunner}
        onUndo={undoLastScoringAction}
      />
      <GameActionPanel
        batterIndex={batterIndex}
        lineup={battingLineup}
        onHit={recordHit}
        onManageBattingOrder={() => setIsBattingOrderOpen(true)}
        onOut={recordOut}
        teamName={battingTeamName}
      />
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
  canUndo: boolean
  draggedRunnerSource: RunnerSource | null
  onConfirmRun: () => void
  onDragEnd: () => void
  onGetMovePreview: (source: RunnerSource, target: RunnerSource) => MovePreview
  onDragStart: (source: RunnerSource) => void
  onMoveRunner: (source: RunnerSource, target: RunnerSource) => void
  onRequestRunnerOut: (runner: Runner, source: BaseKey) => void
  onReturnRunnerToThird: () => void
  onUndo: () => void
  pendingScorer: Runner | null
  pendingScorerCount: number
}

function BaseOccupancy({
  bases,
  canUndo,
  draggedRunnerSource,
  onConfirmRun,
  onDragEnd,
  onGetMovePreview,
  onDragStart,
  onMoveRunner,
  onRequestRunnerOut,
  onReturnRunnerToThird,
  onUndo,
  pendingScorer,
  pendingScorerCount,
}: BaseOccupancyProps) {
  const [dragPreviewTarget, setDragPreviewTarget] = useState<RunnerSource | null>(null)
  const movePreview = draggedRunnerSource && dragPreviewTarget ? onGetMovePreview(draggedRunnerSource, dragPreviewTarget) : null
  const previewBases = bases

  function handleDragEnd() {
    setDragPreviewTarget(null)
    onDragEnd()
  }

  function handleMoveRunner(source: RunnerSource, target: RunnerSource) {
    setDragPreviewTarget(null)
    onMoveRunner(source, target)
  }

  return (
    <div className="base-area">
      <section className="base-occupancy-card" aria-label="Base runners">
        <button className="field-undo-button" type="button" aria-label="Undo last scoring action" disabled={!canUndo} onClick={onUndo}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M7.25 6.25H4.5v-2.75" />
            <path d="M4.75 6.25A6.25 6.25 0 1 1 4.4 14" />
          </svg>
        </button>
        <BaseSlot baseKey="third" className="base-slot-3b" dragPreviewTarget={dragPreviewTarget} isPreviewBlocked={Boolean(movePreview?.blocked && dragPreviewTarget === 'third')} label="3B" runner={previewBases.third} draggedRunnerSource={draggedRunnerSource} onDragEnd={handleDragEnd} onDragStart={onDragStart} onMoveRunner={handleMoveRunner} onPreviewTargetChange={setDragPreviewTarget} onRequestRunnerOut={onRequestRunnerOut} />
        <BaseSlot baseKey="second" className="base-slot-2b" dragPreviewTarget={dragPreviewTarget} isPreviewBlocked={Boolean(movePreview?.blocked && dragPreviewTarget === 'second')} label="2B" runner={previewBases.second} draggedRunnerSource={draggedRunnerSource} onDragEnd={handleDragEnd} onDragStart={onDragStart} onMoveRunner={handleMoveRunner} onPreviewTargetChange={setDragPreviewTarget} onRequestRunnerOut={onRequestRunnerOut} />
        <BaseSlot baseKey="first" className="base-slot-1b" dragPreviewTarget={dragPreviewTarget} isPreviewBlocked={Boolean(movePreview?.blocked && dragPreviewTarget === 'first')} label="1B" runner={previewBases.first} draggedRunnerSource={draggedRunnerSource} onDragEnd={handleDragEnd} onDragStart={onDragStart} onMoveRunner={handleMoveRunner} onPreviewTargetChange={setDragPreviewTarget} onRequestRunnerOut={onRequestRunnerOut} />
        <HomeScoringSlot pendingScorer={pendingScorer} pendingScorerCount={pendingScorerCount} onConfirmRun={onConfirmRun} onReturnRunnerToThird={onReturnRunnerToThird} />
      </section>
    </div>
  )
}

type HomeScoringSlotProps = {
  onConfirmRun: () => void
  onReturnRunnerToThird: () => void
  pendingScorer: Runner | null
  pendingScorerCount: number
}

function HomeScoringSlot({ onConfirmRun, onReturnRunnerToThird, pendingScorer, pendingScorerCount }: HomeScoringSlotProps) {
  return (
    <div className={`base-slot base-slot-home${pendingScorer ? ' has-runner' : ''}`}>
      {!pendingScorer && (
        <div className="base-slot-empty">
          <span className="base-slot-label">Home</span>
        </div>
      )}
      {pendingScorer && (
        <div className="home-score-card">
          <div className="home-score-card-main">
            <strong>{pendingScorer.name}</strong>
            <em>Scored?</em>
          </div>
          <div className="home-score-actions">
            <button className="home-score-action secondary" type="button" aria-label={`Send ${pendingScorer.name} back to third`} onClick={onReturnRunnerToThird}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="m10 4-4 4 4 4" />
              </svg>
            </button>
            <button className="home-score-action primary" type="button" aria-label={`Confirm ${pendingScorer.name} scored`} onClick={onConfirmRun}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="m4 8.25 2.25 2.25L12 5" />
              </svg>
            </button>
          </div>
          {pendingScorerCount > 1 && <span className="home-score-queue">+{pendingScorerCount - 1}</span>}
        </div>
      )}
    </div>
  )
}

type BaseSlotProps = {
  baseKey: RunnerSource
  className: string
  dragPreviewTarget: RunnerSource | null
  draggedRunnerSource: RunnerSource | null
  isPreviewBlocked: boolean
  label: string
  onDragEnd: () => void
  onDragStart: (source: RunnerSource) => void
  onMoveRunner: (source: RunnerSource, target: RunnerSource) => void
  onPreviewTargetChange: (target: RunnerSource | null) => void
  onRequestRunnerOut: (runner: Runner, source: BaseKey) => void
  runner?: Runner | null
}

function BaseSlot({ baseKey, className, dragPreviewTarget, draggedRunnerSource, isPreviewBlocked, label, onDragEnd, onDragStart, onMoveRunner, onPreviewTargetChange, onRequestRunnerOut, runner }: BaseSlotProps) {
  const isPreviewTarget = dragPreviewTarget === baseKey && draggedRunnerSource !== baseKey
  const isDragOrigin = draggedRunnerSource === baseKey
  const previewClass = [
    isDragOrigin ? 'drag-origin' : '',
    isPreviewTarget ? 'preview-target' : '',
    isPreviewBlocked ? 'preview-blocked' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={`base-slot ${className}${runner ? ' has-runner' : ''}${previewClass ? ` ${previewClass}` : ''}`}
      onDragEnter={() => {
        if (draggedRunnerSource && draggedRunnerSource !== baseKey) {
          onPreviewTargetChange(baseKey)
        }
      }}
      onDragOver={(event) => {
        event.preventDefault()
        if (draggedRunnerSource && draggedRunnerSource !== baseKey) {
          onPreviewTargetChange(baseKey)
        }
      }}
      onDragLeave={() => onPreviewTargetChange(null)}
      onDrop={() => {
        if (draggedRunnerSource) {
          onMoveRunner(draggedRunnerSource, baseKey)
        }
      }}
    >
      {!runner && (
        <div className="base-slot-empty">
          <span className="base-slot-label">{label}</span>
        </div>
      )}
      {runner && (
        <RunnerTile
          baseLabel={label}
          runner={runner}
          source={baseKey}
          onDragEnd={onDragEnd}
          onDragStart={onDragStart}
          onRequestRunnerOut={onRequestRunnerOut}
        />
      )}
    </div>
  )
}

type RunnerTileProps = {
  baseLabel?: string
  onDragEnd?: () => void
  onDragStart?: (source: RunnerSource) => void
  onRequestRunnerOut?: (runner: Runner, source: BaseKey) => void
  runner: Runner
  source: RunnerSource
}

function RunnerTile({ baseLabel, onDragEnd, onDragStart, onRequestRunnerOut, runner, source }: RunnerTileProps) {
  const isBaseRunner = source !== 'atBat'
  const [isConfirmingOut, setIsConfirmingOut] = useState(false)

  function handleDragStart(event: DragEvent<HTMLButtonElement>) {
    const runnerTile = event.currentTarget.closest('.score-runner-tile')
    if (runnerTile instanceof HTMLElement) {
      const tileRect = runnerTile.getBoundingClientRect()
      const handleRect = event.currentTarget.getBoundingClientRect()
      const offsetX = handleRect.left - tileRect.left + handleRect.width / 2
      const offsetY = handleRect.top - tileRect.top + handleRect.height / 2

      event.dataTransfer.setDragImage(runnerTile, offsetX, offsetY)
    }

    event.dataTransfer.effectAllowed = 'move'
    onDragStart?.(source)
  }

  return (
    <div
      className={isBaseRunner ? `score-runner-tile${isConfirmingOut ? ' confirming-out' : ''}` : 'score-runner-tile at-bat-runner-tile'}
    >
      {isBaseRunner && isConfirmingOut && (
        <div className="runner-out-confirm">
          <span>Is this runner out?</span>
          <div>
            <button type="button" aria-label="Cancel runner out" onClick={() => setIsConfirmingOut(false)}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
              </svg>
            </button>
            <button type="button" aria-label="Confirm runner out" onClick={() => onRequestRunnerOut?.(runner, source as BaseKey)}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="m4 8.25 2.25 2.25L12 5" />
              </svg>
            </button>
          </div>
        </div>
      )}
      {isBaseRunner && baseLabel && !isConfirmingOut && (
        <>
          <button className="runner-drag-handle" type="button" aria-label={`Drag ${runner.name}`} draggable onDragEnd={onDragEnd} onDragStart={handleDragStart}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="5.5" cy="4" r="1" />
              <circle cx="10.5" cy="4" r="1" />
              <circle cx="5.5" cy="8" r="1" />
              <circle cx="10.5" cy="8" r="1" />
              <circle cx="5.5" cy="12" r="1" />
              <circle cx="10.5" cy="12" r="1" />
            </svg>
          </button>
          <span className="runner-base-label">{baseLabel}</span>
          <span className="runner-name">{runner.name}</span>
          <button className="runner-out-button" type="button" aria-label={`Mark ${runner.name} out`} onClick={() => setIsConfirmingOut(true)}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
            </svg>
          </button>
        </>
      )}
      {!isBaseRunner && <span className="runner-name">{runner.name}</span>}
    </div>
  )
}

type ScoringActionsProps = {
  onHit: (baseCount: number) => void
  onOut: () => void
}

type GameActionPanelProps = ScoringActionsProps & {
  batterIndex: number
  lineup: string[]
  onManageBattingOrder: () => void
  teamName: string
}

function GameActionPanel({ batterIndex, lineup, onHit, onManageBattingOrder, onOut, teamName }: GameActionPanelProps) {
  const activeLineupIndex = batterIndex % Math.max(lineup.length, 1)

  return (
    <section className="game-action-panel" aria-label="Batting controls and lineup">
      <section className="live-lineup-card" aria-label={`${teamName} batting order`}>
        <div className="live-lineup-heading">
          <div>
            <span>Batting Order</span>
            <strong>{teamName}</strong>
          </div>
          <button type="button" aria-label="Manage batting order" onClick={onManageBattingOrder}>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M4 6h8.25M15.25 6H16" />
              <path d="M4 10h1.25M8.75 10H16" />
              <path d="M4 14h6.25M13.75 14H16" />
              <circle cx="13.75" cy="6" r="1.5" />
              <circle cx="7.25" cy="10" r="1.5" />
              <circle cx="12.25" cy="14" r="1.5" />
            </svg>
          </button>
        </div>
        <div className="live-lineup-list">
          {lineup.map((player, index) => (
            <div className={index === activeLineupIndex ? 'live-lineup-row active' : 'live-lineup-row'} key={`${player}-${index}`}>
              <span>{index + 1}</span>
              <strong>{player}</strong>
              {index === activeLineupIndex && <em>Now Batting</em>}
            </div>
          ))}
        </div>
      </section>
      <ScoringActions onHit={onHit} onOut={onOut} />
    </section>
  )
}

function ScoringActions({ onHit, onOut }: ScoringActionsProps) {
  const [isHitMenuOpen, setIsHitMenuOpen] = useState(false)
  const hitMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isHitMenuOpen) {
      return
    }

    function closeOnOutsideClick(event: PointerEvent) {
      if (hitMenuRef.current?.contains(event.target as Node)) {
        return
      }

      setIsHitMenuOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [isHitMenuOpen])

  function recordHit(baseCount: number) {
    onHit(baseCount)
    setIsHitMenuOpen(false)
  }

  return (
    <nav className="scoring-actions" aria-label="Score play">
      <div className="hit-menu-wrap" ref={hitMenuRef}>
        <button className="hit-toggle-button" type="button" aria-expanded={isHitMenuOpen} onClick={() => setIsHitMenuOpen((isOpen) => !isOpen)}>
          <span>Hit</span>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="m4 6 4 4 4-4" />
          </svg>
        </button>
        {isHitMenuOpen && (
          <div className="hit-menu">
            <button type="button" onClick={() => recordHit(1)}>Single</button>
            <button type="button" onClick={() => recordHit(2)}>Double</button>
            <button type="button" onClick={() => recordHit(3)}>Triple</button>
            <button type="button" onClick={() => recordHit(4)}>HR</button>
          </div>
        )}
      </div>
      <button type="button" onClick={() => onHit(1)}>Walk</button>
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
