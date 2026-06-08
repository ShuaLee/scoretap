import { useEffect, useRef, useState, type DragEvent } from 'react'
import { Scoreboard } from '../components/Scoreboard'
import { PLAYER_NAME_MAX_LENGTH, type GameConfig, type TeamKey } from './GameSetupPage'

type ScoreGamePageProps = {
  gameConfig: GameConfig
  initialState?: PersistedGameState
  onEndGame: () => void
  onGameConfigChange: (config: GameConfig) => void
  onGameStateChange: (state: PersistedGameState) => void
}

type TeamSide = 'home' | 'away'
type BaseKey = 'first' | 'second' | 'third'
type RunnerSource = BaseKey | 'atBat'

type Runner = {
  id: number
  name: string
  scoredInning?: number
  team: TeamSide
}

type Bases = Record<BaseKey, Runner | null>
type ScoreAdjustments = Record<number, { home: number; away: number }>
type ScoreModification = {
  home: number
  away: number
}
type InningRuns = Record<number, { home: number; away: number }>
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
  inningRuns: InningRuns
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
  inningRuns?: InningRuns
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

export function ScoreGamePage({ gameConfig, initialState, onEndGame, onGameConfigChange, onGameStateChange }: ScoreGamePageProps) {
  const [isEndGameConfirmOpen, setIsEndGameConfirmOpen] = useState(false)
  const [isFinalScoreOpen, setIsFinalScoreOpen] = useState(false)
  const [isRosterSettingsOpen, setIsRosterSettingsOpen] = useState(false)
  const [isScoreEditorOpen, setIsScoreEditorOpen] = useState(false)
  const [teamOnePlayers, setTeamOnePlayers] = useState(initialState?.teamOnePlayers ?? gameConfig.teamOnePlayers)
  const [teamTwoPlayers, setTeamTwoPlayers] = useState(initialState?.teamTwoPlayers ?? gameConfig.teamTwoPlayers)
  const [halfInning, setHalfInning] = useState<'top' | 'bottom'>(initialState?.halfInning ?? 'top')
  const [inning, setInning] = useState(initialState?.inning ?? 1)
  const [outs, setOuts] = useState(initialState?.outs ?? 0)
  const [homeScore, setHomeScore] = useState(initialState?.homeScore ?? 0)
  const [awayScore, setAwayScore] = useState(initialState?.awayScore ?? 0)
  const [inningRuns, setInningRuns] = useState<InningRuns>(initialState?.inningRuns ?? {})
  const [homeBatterIndex, setHomeBatterIndex] = useState(initialState?.homeBatterIndex ?? 0)
  const [awayBatterIndex, setAwayBatterIndex] = useState(initialState?.awayBatterIndex ?? 0)
  const [bases, setBases] = useState<Bases>(initialState?.bases ?? emptyBases)
  const [pendingScorers, setPendingScorers] = useState<Runner[]>(initialState?.pendingScorers ?? [])
  const [draggedRunnerSource, setDraggedRunnerSource] = useState<RunnerSource | null>(null)
  const [scoreAdjustments, setScoreAdjustments] = useState<ScoreAdjustments>(initialState?.scoreAdjustments ?? {})
  const [scoreModification, setScoreModification] = useState<ScoreModification>(initialState?.scoreModification ?? { home: 0, away: 0 })
  const [undoStack, setUndoStack] = useState<GameSnapshot[]>(initialState?.undoStack ?? [])

  const homeTeamKey = gameConfig.homeTeam
  const awayTeamKey: TeamKey = homeTeamKey === 'teamOne' ? 'teamTwo' : 'teamOne'
  const battingTeam: TeamSide = halfInning === 'top' ? 'away' : 'home'
  const battingTeamKey = battingTeam === 'home' ? homeTeamKey : awayTeamKey
  const homeTeamName = getTeamName(homeTeamKey)
  const awayTeamName = getTeamName(awayTeamKey)
  const battingTeamName = battingTeam === 'home' ? homeTeamName : awayTeamName
  const battingLineup = battingTeam === 'home' ? getTeamPlayers(homeTeamKey) : getTeamPlayers(awayTeamKey)
  const batterIndex = battingTeam === 'home' ? homeBatterIndex : awayBatterIndex
  const currentBatterLineupIndex = batterIndex % Math.max(battingLineup.length, 1)
  const currentBatterName = battingLineup[currentBatterLineupIndex] || `${battingTeamName} Batter`
  const currentBatterOrderNumber = battingLineup.length ? currentBatterLineupIndex + 1 : null
  const currentBatter: Runner = {
    id: Number(`${battingTeam === 'home' ? 1 : 2}${inning}${batterIndex}`),
    name: currentBatterName,
    team: battingTeam,
  }
  const inningLabel = `${halfInning === 'top' ? 'Top' : 'Bottom'} ${formatInning(inning)}`
  const adjustedHomeScore = homeScore + scoreModification.home + Object.values(scoreAdjustments).reduce((total, adjustment) => total + adjustment.home, 0)
  const adjustedAwayScore = awayScore + scoreModification.away + Object.values(scoreAdjustments).reduce((total, adjustment) => total + adjustment.away, 0)
  const isModalOpen = isScoreEditorOpen || isRosterSettingsOpen || isEndGameConfirmOpen || isFinalScoreOpen

  function getTeamName(teamKey: TeamKey) {
    return teamKey === 'teamOne' ? gameConfig.teamOneName : gameConfig.teamTwoName
  }

  function getTeamPlayers(teamKey: TeamKey) {
    return teamKey === 'teamOne' ? teamOnePlayers : teamTwoPlayers
  }

  function getTeamTracksBatting(teamKey: TeamKey) {
    return teamKey === 'teamOne' ? gameConfig.teamOneTracksBatting : gameConfig.teamTwoTracksBatting
  }

  function getTeamBatterIndex(teamKey: TeamKey) {
    return teamKey === homeTeamKey ? homeBatterIndex : awayBatterIndex
  }

  function updateTeamPlayers(teamKey: TeamKey, players: string[]) {
    if (teamKey === 'teamOne') {
      setTeamOnePlayers(players)
      onGameConfigChange({ ...gameConfig, teamOnePlayers: players })
      return
    }

    setTeamTwoPlayers(players)
    onGameConfigChange({ ...gameConfig, teamTwoPlayers: players })
  }

  function activateTeamBattingTracking(teamKey: TeamKey) {
    onGameConfigChange({
      ...gameConfig,
      teamOneTracksBatting: teamKey === 'teamOne' ? true : gameConfig.teamOneTracksBatting,
      teamTwoTracksBatting: teamKey === 'teamTwo' ? true : gameConfig.teamTwoTracksBatting,
    })
  }

  function handleEndGame() {
    setIsEndGameConfirmOpen(true)
  }

  function confirmEndGame() {
    setIsEndGameConfirmOpen(false)
    setIsFinalScoreOpen(false)
    onEndGame()
  }

  function extendGame() {
    onGameConfigChange({ ...gameConfig, innings: gameConfig.innings + 1 })
    setHalfInning('top')
    setInning((currentInning) => currentInning + 1)
    setIsFinalScoreOpen(false)
  }

  useEffect(() => {
    if (!isModalOpen) {
      return
    }

    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
    }
  }, [isModalOpen])

  useEffect(() => {
    onGameStateChange({
      awayBatterIndex,
      awayScore,
      bases,
      halfInning,
      homeBatterIndex,
      homeScore,
      inningRuns,
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
    inningRuns,
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
      inningRuns,
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
      setInningRuns(snapshot.inningRuns ?? {})
      setInning(snapshot.inning)
      setOuts(snapshot.outs)
      setPendingScorers(snapshot.pendingScorers)

      return snapshots.slice(0, -1)
    })
  }

  function scoreRunner(runner: Runner) {
    const scoringInning = runner.scoredInning ?? inning

    if (runner.team === 'home') {
      setHomeScore((score) => score + 1)
      incrementInningRuns('home', scoringInning)
      return
    }

    setAwayScore((score) => score + 1)
    incrementInningRuns('away', scoringInning)
  }

  function incrementInningRuns(team: TeamSide, scoringInning: number) {
    setInningRuns((currentRuns) => {
      const currentInningRuns = currentRuns[scoringInning] ?? { home: 0, away: 0 }

      return {
        ...currentRuns,
        [scoringInning]: {
          ...currentInningRuns,
          [team]: currentInningRuns[team] + 1,
        },
      }
    })
  }

  function confirmScoredRunner() {
    const [runner, ...remainingRunners] = pendingScorers
    if (!runner) {
      return
    }

    saveUndoSnapshot()
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

    if (inning >= gameConfig.innings) {
      setIsFinalScoreOpen(true)
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
        scoringRunners.push(markRunnerScored(runner))
        return
      }

      nextBases[baseNumberToKey(targetBase)] = runner
    })

    if (baseCount >= 4) {
      scoringRunners.push(markRunnerScored(currentBatter))
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
      const scoringRunner = markRunnerScored(preview.scoringRunner)
      setPendingScorers((runners) => [...runners, scoringRunner])
    }
  }

  function markRunnerScored(runner: Runner): Runner {
    return {
      ...runner,
      scoredInning: inning,
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
        awayTeamName={awayTeamName}
        awayScore={adjustedAwayScore}
        homeTeamName={homeTeamName}
        homeScore={adjustedHomeScore}
        inningLabel={inningLabel}
        outs={outs}
        onEdit={() => setIsScoreEditorOpen(true)}
      />
      <BaseOccupancy
        activeTeamName={battingTeamName}
        bases={bases}
        canUndo={undoStack.length > 0}
        currentBatterName={currentBatterName}
        currentBatterOrderNumber={currentBatterOrderNumber}
        draggedRunnerSource={draggedRunnerSource}
        isBattingTracked={getTeamTracksBatting(battingTeamKey)}
        onActivateBattingTracking={() => activateTeamBattingTracking(battingTeamKey)}
        onDragEnd={() => setDraggedRunnerSource(null)}
        onDragStart={setDraggedRunnerSource}
        onGetMovePreview={getMovePreview}
        onHit={recordHit}
        onMoveRunner={moveRunner}
        onOut={recordOut}
        onRequestRunnerOut={(_, source) => recordBaseRunnerOut(source)}
        onReturnRunnerToThird={returnPendingScorerToThird}
        pendingScorer={pendingScorers[0] ?? null}
        pendingScorerCount={pendingScorers.length}
        onConfirmRun={confirmScoredRunner}
        onUndo={undoLastScoringAction}
      />
      <GameActionPanel
        activeTeamKey={battingTeamKey}
        getBatterIndex={getTeamBatterIndex}
        getLineup={getTeamPlayers}
        getTeamTracksBatting={getTeamTracksBatting}
        onManageRoster={() => setIsRosterSettingsOpen(true)}
        teams={[
          { key: 'teamOne', name: gameConfig.teamOneName },
          { key: 'teamTwo', name: gameConfig.teamTwoName },
        ]}
      />
      {isScoreEditorOpen && (
        <ScoreEditorModal
          awayTeamName={awayTeamName}
          halfInning={halfInning}
          homeTeamName={homeTeamName}
          homeScore={homeScore}
          inningRuns={inningRuns}
          inning={inning}
          scheduledInnings={gameConfig.innings}
          outs={outs}
          awayScore={awayScore}
          scoreAdjustments={scoreAdjustments}
          scoreModification={scoreModification}
          onClose={() => setIsScoreEditorOpen(false)}
          onEndGame={handleEndGame}
          onHalfInningChange={setHalfInning}
          onInningChange={setInning}
          onOutsChange={setOuts}
          onScheduledInningsChange={(innings) => onGameConfigChange({ ...gameConfig, innings })}
          onScoreAdjustmentsChange={setScoreAdjustments}
          onScoreModificationChange={setScoreModification}
        />
      )}
      {isRosterSettingsOpen && (
        <RosterSettingsModal
          getLineup={getTeamPlayers}
          getTeamTracksBatting={getTeamTracksBatting}
          onActivateBattingTracking={activateTeamBattingTracking}
          onClose={() => setIsRosterSettingsOpen(false)}
          onTeamPlayersChange={updateTeamPlayers}
          teams={[
            { key: 'teamOne', name: gameConfig.teamOneName },
            { key: 'teamTwo', name: gameConfig.teamTwoName },
          ]}
        />
      )}
      {isEndGameConfirmOpen && (
        <EndGameConfirmModal
          awayScore={adjustedAwayScore}
          awayTeamName={awayTeamName}
          homeScore={adjustedHomeScore}
          homeTeamName={homeTeamName}
          onCancel={() => setIsEndGameConfirmOpen(false)}
          onConfirm={confirmEndGame}
        />
      )}
      {isFinalScoreOpen && (
        <FinalScoreModal
          awayScore={adjustedAwayScore}
          awayTeamName={awayTeamName}
          homeScore={adjustedHomeScore}
          homeTeamName={homeTeamName}
          onExit={confirmEndGame}
          onExtend={extendGame}
          onPlayAgain={confirmEndGame}
        />
      )}
    </section>
  )
}

type ScoreEditorModalProps = {
  awayTeamName: string
  awayScore: number
  halfInning: 'top' | 'bottom'
  homeTeamName: string
  homeScore: number
  inningRuns: InningRuns
  inning: number
  onClose: () => void
  onEndGame: () => void
  onHalfInningChange: (halfInning: 'top' | 'bottom') => void
  onInningChange: (inning: number) => void
  onOutsChange: (outs: number) => void
  onScheduledInningsChange: (innings: number) => void
  onScoreAdjustmentsChange: (adjustments: ScoreAdjustments) => void
  onScoreModificationChange: (modification: ScoreModification) => void
  outs: number
  scheduledInnings: number
  scoreAdjustments: ScoreAdjustments
  scoreModification: ScoreModification
}

function ScoreEditorModal({
  awayTeamName,
  awayScore,
  halfInning,
  homeTeamName,
  homeScore,
  inningRuns,
  inning,
  onClose,
  onEndGame,
  onHalfInningChange,
  onInningChange,
  onOutsChange,
  onScheduledInningsChange,
  onScoreAdjustmentsChange,
  onScoreModificationChange,
  outs,
  scheduledInnings,
  scoreAdjustments,
  scoreModification,
}: ScoreEditorModalProps) {
  const inningRows = Array.from({ length: Math.max(scheduledInnings, inning) }, (_, index) => index + 1)
  const inningAdjustmentTotals = Object.values(scoreAdjustments).reduce(
    (totals, adjustment) => ({
      away: totals.away + adjustment.away,
      home: totals.home + adjustment.home,
    }),
    { away: 0, home: 0 },
  )
  const displayedHomeScore = homeScore + inningAdjustmentTotals.home + scoreModification.home
  const displayedAwayScore = awayScore + inningAdjustmentTotals.away + scoreModification.away

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
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="score-editor-modal" role="dialog" aria-modal="true" aria-labelledby="score-editor-title" onClick={(event) => event.stopPropagation()}>
        <div className="score-editor-top-actions">
          <button className="score-editor-game-over-button" type="button" onClick={onEndGame}>
            Game Over
          </button>
          <button className="score-editor-icon-button confirm" type="button" aria-label="Confirm scoreboard changes" onClick={onClose}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="m4 8.25 2.25 2.25L12 5" />
            </svg>
          </button>
        </div>
        <span className="modal-eyebrow">Scorebook</span>
        <h2 id="score-editor-title">Edit scoreboard</h2>

        <div className="score-editor-section">
          <h3>Game Settings</h3>
          <div className="score-editor-grid compact">
            <label>
              Innings
              <NumberStepper
                ariaLabel="Scheduled innings"
                max={20}
                min={1}
                value={scheduledInnings}
                onChange={onScheduledInningsChange}
              />
            </label>
          </div>
        </div>

        <div className="score-editor-section">
          <h3>Game Position</h3>
          <div className="score-editor-grid compact">
            <label>
              Inning
              <NumberStepper ariaLabel="Current inning" min={1} value={inning} onChange={onInningChange} />
            </label>
            <label>
              Half
              <span className="score-editor-select-wrap">
                <select value={halfInning} onChange={(event) => onHalfInningChange(event.target.value as 'top' | 'bottom')}>
                  <option value="top">Top</option>
                  <option value="bottom">Bottom</option>
                </select>
              </span>
            </label>
            <label>
              Outs
              <NumberStepper ariaLabel="Outs" max={2} min={0} value={outs} onChange={onOutsChange} />
            </label>
          </div>
        </div>

        <div className="score-editor-section">
          <h3>Inning Adjustments</h3>
          <div className="score-editor-score-summary" aria-label="Current score">
            <div>
              <span>{homeTeamName}</span>
              <strong>{displayedHomeScore}</strong>
            </div>
            <div>
              <span>{awayTeamName}</span>
              <strong>{displayedAwayScore}</strong>
            </div>
          </div>
          <div className="inning-adjustment-tables">
            <InningAdjustmentTable
              extraRuns={scoreModification.home}
              inningRows={inningRows}
              inningRuns={inningRuns}
              onExtraRunsChange={(runs) => onScoreModificationChange({ ...scoreModification, home: runs })}
              onUpdateInningAdjustment={updateInningAdjustment}
              scoreAdjustments={scoreAdjustments}
              team="home"
              teamName={homeTeamName}
            />
            <InningAdjustmentTable
              extraRuns={scoreModification.away}
              inningRows={inningRows}
              inningRuns={inningRuns}
              onExtraRunsChange={(runs) => onScoreModificationChange({ ...scoreModification, away: runs })}
              onUpdateInningAdjustment={updateInningAdjustment}
              scoreAdjustments={scoreAdjustments}
              team="away"
              teamName={awayTeamName}
            />
          </div>
        </div>
      </section>
    </div>
  )
}

type InningAdjustmentTableProps = {
  extraRuns: number
  inningRows: number[]
  inningRuns: InningRuns
  onExtraRunsChange: (runs: number) => void
  onUpdateInningAdjustment: (inningNumber: number, team: 'home' | 'away', value: number) => void
  scoreAdjustments: ScoreAdjustments
  team: 'home' | 'away'
  teamName: string
}

function InningAdjustmentTable({
  extraRuns,
  inningRows,
  inningRuns,
  onExtraRunsChange,
  onUpdateInningAdjustment,
  scoreAdjustments,
  team,
  teamName,
}: InningAdjustmentTableProps) {
  return (
    <div className="inning-adjustment-table" aria-label={`${teamName} inning adjustments`}>
      <strong className="inning-adjustment-team-name">{teamName}</strong>
      <span>Inning</span>
      <span>Scored</span>
      <span>Adjust</span>
      <span>Total</span>
      {inningRows.map((inningNumber) => {
        const recordedRuns = inningRuns[inningNumber]?.[team] ?? 0
        const modifiedRuns = scoreAdjustments[inningNumber]?.[team] ?? 0

        return (
          <div className="inning-adjustment-row" key={inningNumber}>
            <strong>{inningNumber}</strong>
            <span className="inning-run-value" aria-label={`${teamName} inning ${inningNumber} scored runs`}>
              {recordedRuns}
            </span>
            <NumberStepper
              ariaLabel={`${teamName} inning ${inningNumber} run modifier`}
              value={modifiedRuns}
              onChange={(value) => onUpdateInningAdjustment(inningNumber, team, value)}
            />
            <span className="inning-run-total" aria-label={`${teamName} inning ${inningNumber} total runs`}>
              {recordedRuns + modifiedRuns}
            </span>
          </div>
        )
      })}
      <div className="inning-adjustment-row final-adjustment-row">
        <strong>Other</strong>
        <span className="inning-run-value">0</span>
        <NumberStepper
          ariaLabel={`${teamName} other run modifier`}
          value={extraRuns}
          onChange={onExtraRunsChange}
        />
        <span className="inning-run-total" aria-label={`${teamName} other run total`}>
          {extraRuns}
        </span>
      </div>
    </div>
  )
}

type NumberStepperProps = {
  ariaLabel: string
  max?: number
  min?: number
  onChange: (value: number) => void
  value: number
}

function NumberStepper({ ariaLabel, max, min, onChange, value }: NumberStepperProps) {
  function clampValue(nextValue: number) {
    if (typeof min === 'number' && nextValue < min) {
      return min
    }

    if (typeof max === 'number' && nextValue > max) {
      return max
    }

    return nextValue
  }

  function updateValue(nextValue: number) {
    if (Number.isNaN(nextValue)) {
      return
    }

    onChange(clampValue(nextValue))
  }

  return (
    <div className="number-stepper">
      <button type="button" aria-label={`Decrease ${ariaLabel}`} onClick={() => updateValue(value - 1)}>
        -
      </button>
      <input
        aria-label={ariaLabel}
        inputMode="numeric"
        type="text"
        value={value}
        onChange={(event) => updateValue(Number(event.target.value))}
      />
      <button type="button" aria-label={`Increase ${ariaLabel}`} onClick={() => updateValue(value + 1)}>
        +
      </button>
    </div>
  )
}

type BaseOccupancyProps = {
  activeTeamName: string
  bases: Bases
  canUndo: boolean
  currentBatterName: string
  currentBatterOrderNumber: number | null
  draggedRunnerSource: RunnerSource | null
  isBattingTracked: boolean
  onActivateBattingTracking: () => void
  onConfirmRun: () => void
  onDragEnd: () => void
  onGetMovePreview: (source: RunnerSource, target: RunnerSource) => MovePreview
  onDragStart: (source: RunnerSource) => void
  onHit: (baseCount: number) => void
  onMoveRunner: (source: RunnerSource, target: RunnerSource) => void
  onOut: () => void
  onRequestRunnerOut: (runner: Runner, source: BaseKey) => void
  onReturnRunnerToThird: () => void
  onUndo: () => void
  pendingScorer: Runner | null
  pendingScorerCount: number
}

function BaseOccupancy({
  activeTeamName,
  bases,
  canUndo,
  currentBatterName,
  currentBatterOrderNumber,
  draggedRunnerSource,
  isBattingTracked,
  onActivateBattingTracking,
  onConfirmRun,
  onDragEnd,
  onGetMovePreview,
  onDragStart,
  onHit,
  onMoveRunner,
  onOut,
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
        <FieldAtBatCard
          activeTeamName={activeTeamName}
          currentBatterName={currentBatterName}
          currentBatterOrderNumber={currentBatterOrderNumber}
          isBattingTracked={isBattingTracked}
          onActivateBattingTracking={onActivateBattingTracking}
          onHit={onHit}
          onOut={onOut}
        />
      </section>
    </div>
  )
}

type FieldAtBatCardProps = ScoringActionsProps & {
  activeTeamName: string
  currentBatterName: string
  currentBatterOrderNumber: number | null
  isBattingTracked: boolean
  onActivateBattingTracking: () => void
}

function FieldAtBatCard({ activeTeamName, currentBatterName, currentBatterOrderNumber, isBattingTracked, onActivateBattingTracking, onHit, onOut }: FieldAtBatCardProps) {
  return (
    <section className={isBattingTracked ? 'field-at-bat-card' : 'field-at-bat-card tracking-disabled'} aria-label={`${currentBatterName} at bat`}>
      <div className="field-at-bat-team">
        <span>{activeTeamName} Batting</span>
      </div>
      <div className="field-at-bat-row">
        <div className="field-at-bat-copy">
          {isBattingTracked && currentBatterOrderNumber && <em>{currentBatterOrderNumber}</em>}
          <strong>{isBattingTracked ? currentBatterName : 'Tracking off'}</strong>
        </div>
        {isBattingTracked && <BatterActionControls onHit={onHit} onOut={onOut} />}
        {!isBattingTracked && (
          <button className="activate-batting-button" type="button" onClick={onActivateBattingTracking}>
            Activate
          </button>
        )}
      </div>
    </section>
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

type GameDecisionModalProps = {
  awayScore: number
  awayTeamName: string
  homeScore: number
  homeTeamName: string
}

type EndGameConfirmModalProps = GameDecisionModalProps & {
  onCancel: () => void
  onConfirm: () => void
}

function EndGameConfirmModal({ awayScore, awayTeamName, homeScore, homeTeamName, onCancel, onConfirm }: EndGameConfirmModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <section className="game-decision-modal" role="dialog" aria-modal="true" aria-labelledby="end-game-title" onClick={(event) => event.stopPropagation()}>
        <span className="modal-eyebrow">Game Over</span>
        <h2 id="end-game-title">Confirm game over?</h2>
        <ScoreSummary awayScore={awayScore} awayTeamName={awayTeamName} homeScore={homeScore} homeTeamName={homeTeamName} />
        <div className="game-decision-actions">
          <button className="secondary" type="button" onClick={onCancel}>
            Keep Playing
          </button>
          <button className="secondary" type="button" onClick={onConfirm}>
            Exit Game
          </button>
        </div>
      </section>
    </div>
  )
}

type FinalScoreModalProps = GameDecisionModalProps & {
  onExit: () => void
  onExtend: () => void
  onPlayAgain: () => void
}

function FinalScoreModal({ awayScore, awayTeamName, homeScore, homeTeamName, onExit, onExtend, onPlayAgain }: FinalScoreModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="game-decision-modal" role="dialog" aria-modal="true" aria-labelledby="final-score-title">
        <span className="modal-eyebrow">Final Score</span>
        <h2 id="final-score-title">Game complete</h2>
        <ScoreSummary awayScore={awayScore} awayTeamName={awayTeamName} homeScore={homeScore} homeTeamName={homeTeamName} />
        <div className="game-decision-actions stacked">
          <button className="primary" type="button" onClick={onExtend}>
            Extend Innings
          </button>
          <button className="secondary" type="button" onClick={onPlayAgain}>
            Play Again
          </button>
          <button className="secondary" type="button" onClick={onExit}>
            Exit to Main Menu
          </button>
        </div>
      </section>
    </div>
  )
}

function ScoreSummary({ awayScore, awayTeamName, homeScore, homeTeamName }: GameDecisionModalProps) {
  return (
    <div className="game-decision-score" aria-label="Score">
      <div>
        <span>{homeTeamName}</span>
        <strong>{homeScore}</strong>
      </div>
      <div>
        <span>{awayTeamName}</span>
        <strong>{awayScore}</strong>
      </div>
    </div>
  )
}

type ScoringActionsProps = {
  disabled?: boolean
  onHit: (baseCount: number) => void
  onOut: () => void
}

type GameActionPanelProps = {
  activeTeamKey: TeamKey
  getBatterIndex: (teamKey: TeamKey) => number
  getLineup: (teamKey: TeamKey) => string[]
  getTeamTracksBatting: (teamKey: TeamKey) => boolean
  onManageRoster: () => void
  teams: Array<{ key: TeamKey; name: string }>
}

function GameActionPanel({
  activeTeamKey,
  getBatterIndex,
  getLineup,
  getTeamTracksBatting,
  onManageRoster,
  teams,
}: GameActionPanelProps) {
  const activeTeam = teams.find((team) => team.key === activeTeamKey) ?? teams[0]
  const lineup = getLineup(activeTeam.key)
  const tracksBatting = getTeamTracksBatting(activeTeam.key)
  const batterIndex = getBatterIndex(activeTeam.key)
  const activeLineupIndex = batterIndex % Math.max(lineup.length, 1)
  const currentBatter = lineup[activeLineupIndex] || `${activeTeam.name} Batter`
  const upcomingLineup = lineup.length
    ? [...lineup.slice(activeLineupIndex + 1), ...lineup.slice(0, activeLineupIndex)].map((player, visibleIndex) => ({
        originalIndex: (activeLineupIndex + 1 + visibleIndex) % lineup.length,
        player,
      }))
    : []

  return (
    <section className="game-action-panel" aria-label="Batting controls and lineup">
      <section className={tracksBatting ? 'floating-batter-card' : 'floating-batter-card tracking-disabled'} aria-label={`${currentBatter} at bat`}>
        <div className="batter-card-main">
          <div className="batter-order-panel">
            <div className="batter-order-heading">
              <div>
                <strong>Batting Order</strong>
              </div>
              <button className="roster-settings-button" type="button" aria-label="Manage rosters" onClick={onManageRoster}>
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M10 7.25a2.75 2.75 0 1 1 0 5.5 2.75 2.75 0 0 1 0-5.5Z" />
                  <path d="M16.25 10a6.5 6.5 0 0 0-.08-1.02l1.37-1.05-1.5-2.6-1.6.64a6.36 6.36 0 0 0-1.78-1.03L12.42 3h-3l-.24 1.94c-.64.24-1.24.59-1.77 1.03l-1.61-.64-1.5 2.6 1.37 1.05a6.72 6.72 0 0 0 0 2.04L4.3 12.07l1.5 2.6 1.61-.64c.53.44 1.13.79 1.77 1.03l.24 1.94h3l.24-1.94c.65-.24 1.25-.59 1.78-1.03l1.6.64 1.5-2.6-1.37-1.05c.05-.33.08-.67.08-1.02Z" />
                </svg>
              </button>
            </div>
            <div className="batter-order-list">
              {tracksBatting && upcomingLineup.map(({ originalIndex, player }, visibleIndex) => (
                <div className={visibleIndex === 0 ? 'up-next' : ''} key={`${player}-${originalIndex}`}>
                  <span>{visibleIndex === 0 ? 'Next' : originalIndex + 1}</span>
                  <strong>{player}</strong>
                </div>
              ))}
              {tracksBatting && upcomingLineup.length === 0 && (
                <div className="empty-order-row">
                  <span>Next</span>
                  <strong>Add players in settings</strong>
                </div>
              )}
              {!tracksBatting && (
                <div className="empty-order-row">
                  <span>Off</span>
                  <strong>Turn on tracking in settings</strong>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </section>
  )
}

function BatterActionControls({ disabled = false, onHit, onOut }: ScoringActionsProps) {
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
    if (disabled) {
      return
    }

    onHit(baseCount)
    setIsHitMenuOpen(false)
  }

  return (
    <div className="active-batter-actions" aria-label="Score play">
      <div className="hit-menu-wrap" ref={hitMenuRef}>
        <button className="hit-toggle-button" type="button" aria-expanded={isHitMenuOpen} disabled={disabled} onClick={() => setIsHitMenuOpen((isOpen) => !isOpen)}>
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
      <button type="button" disabled={disabled} onClick={() => onHit(1)}>Walk</button>
      <button type="button" disabled={disabled} onClick={onOut}>Out</button>
    </div>
  )
}

type RosterSettingsModalProps = {
  getLineup: (teamKey: TeamKey) => string[]
  getTeamTracksBatting: (teamKey: TeamKey) => boolean
  onActivateBattingTracking: (teamKey: TeamKey) => void
  onClose: () => void
  onTeamPlayersChange: (teamKey: TeamKey, players: string[]) => void
  teams: Array<{ key: TeamKey; name: string }>
}

function RosterSettingsModal({
  getLineup,
  getTeamTracksBatting,
  onActivateBattingTracking,
  onClose,
  onTeamPlayersChange,
  teams,
}: RosterSettingsModalProps) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section className="roster-settings-modal" role="dialog" aria-modal="true" aria-labelledby="roster-settings-title">
        <div className="roster-settings-header">
          <div>
            <span className="modal-eyebrow">Batting</span>
            <h2 id="roster-settings-title">Roster Settings</h2>
          </div>
          <button className="modal-close-button" type="button" aria-label="Close roster settings" onClick={onClose}>
            <span aria-hidden="true" />
          </button>
        </div>
        <div className="roster-settings-grid">
          {teams.map((team) => (
            <RosterTeamEditor
              key={team.key}
              onActivate={() => onActivateBattingTracking(team.key)}
              onPlayersChange={(players) => onTeamPlayersChange(team.key, players)}
              players={getLineup(team.key)}
              teamName={team.name}
              tracksBatting={getTeamTracksBatting(team.key)}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

type RosterTeamEditorProps = {
  onActivate: () => void
  onPlayersChange: (players: string[]) => void
  players: string[]
  teamName: string
  tracksBatting: boolean
}

function RosterTeamEditor({ onActivate, onPlayersChange, players, teamName, tracksBatting }: RosterTeamEditorProps) {
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
    <section className={tracksBatting ? 'roster-team-editor' : 'roster-team-editor tracking-off'} aria-label={`${teamName} roster`}>
      <div className="roster-team-heading">
        <div>
          <span>{tracksBatting ? 'Tracking On' : 'Tracking Off'}</span>
          <strong>{teamName}</strong>
        </div>
        {!tracksBatting && (
          <button type="button" onClick={onActivate}>
            Turn On
          </button>
        )}
      </div>
      {tracksBatting && (
        <>
          <div className="roster-player-list">
            {players.map((player, index) => (
              <div className="roster-player-row" key={`${player}-${index}`}>
                <span>{index + 1}</span>
                <input
                  aria-label={`${teamName} batter ${index + 1}`}
                  maxLength={PLAYER_NAME_MAX_LENGTH}
                  value={player}
                  onChange={(event) => onPlayersChange(players.map((currentPlayer, playerIndex) => (playerIndex === index ? event.target.value : currentPlayer)))}
                />
                <button type="button" disabled={index === 0} onClick={() => movePlayer(index, -1)}>
                  Up
                </button>
                <button type="button" disabled={index === players.length - 1} onClick={() => movePlayer(index, 1)}>
                  Down
                </button>
                <button type="button" onClick={() => onPlayersChange(players.filter((_, playerIndex) => playerIndex !== index))}>
                  Remove
                </button>
              </div>
            ))}
            {players.length === 0 && (
              <div className="roster-empty-row">
                Add the first batter below.
              </div>
            )}
          </div>
          <form
            className="roster-add-row"
            onSubmit={(event) => {
              event.preventDefault()
              addPlayer()
            }}
          >
            <input
              maxLength={PLAYER_NAME_MAX_LENGTH}
              placeholder="Add player"
              value={draftPlayer}
              onChange={(event) => setDraftPlayer(event.target.value)}
            />
            <button type="submit">Add</button>
          </form>
        </>
      )}
      {!tracksBatting && <p>Batting order is not active for this team.</p>}
    </section>
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
