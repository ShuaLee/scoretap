import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { Scoreboard } from '../components/Scoreboard'
import { MIN_TRACKED_LINEUP_PLAYERS, PLAYER_NAME_MAX_LENGTH, type GameConfig, type TeamKey } from './GameSetupPage'

type ScoreGamePageProps = {
  gameConfig: GameConfig
  initialState?: PersistedGameState
  isScoreEditorOpen: boolean
  onEndGame: () => void
  onGameConfigChange: (config: GameConfig) => void
  onGameStateChange: (state: PersistedGameState) => void
  onScoreEditorOpenChange: (open: boolean) => void
}

type TeamSide = 'home' | 'away'
type BaseKey = 'first' | 'second' | 'third'
type RunnerSource = BaseKey | 'home' | 'atBat' | 'holding'

type Runner = {
  id: number
  name: string
  returnBase?: BaseKey
  scoredInning?: number
  team: TeamSide
  teamKey?: TeamKey
}

type Bases = Record<BaseKey, Runner | null>
type HitDepth = 'single' | 'double' | 'triple' | 'homeRun'
type PlayerStatLine = {
  atBats: number
  doubles: number
  hits: number
  homeRuns: number
  runs: number
  singles: number
  triples: number
}
type PlayerStats = Record<TeamKey, Record<string, PlayerStatLine>>
type TrackedBattingTeams = Record<TeamKey, boolean>
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
  heldRunners?: Runner[]
  homeBatterIndex: number
  homeScore: number
  inningRuns: InningRuns
  inning: number
  outs: number
  pendingScorers: Runner[]
  playerStats: PlayerStats
}

export type PersistedGameState = {
  awayBatterIndex: number
  awayScore: number
  bases: Bases
  halfInning: 'top' | 'bottom'
  heldRunner?: Runner | null
  heldRunners?: Runner[]
  homeBatterIndex: number
  homeScore: number
  inningRuns?: InningRuns
  inning: number
  outs: number
  pendingScorers: Runner[]
  playerStats?: PlayerStats
  scoreAdjustments: ScoreAdjustments
  scoreModification: ScoreModification
  teamOnePlayers: string[]
  teamTwoPlayers: string[]
  trackedBattingTeams?: TrackedBattingTeams
  undoStack?: GameSnapshot[]
}

const emptyBases: Bases = {
  first: null,
  second: null,
  third: null,
}

const emptyPlayerStats: PlayerStats = {
  teamOne: {},
  teamTwo: {},
}

function createEmptyPlayerStatLine(): PlayerStatLine {
  return {
    atBats: 0,
    doubles: 0,
    hits: 0,
    homeRuns: 0,
    runs: 0,
    singles: 0,
    triples: 0,
  }
}

function formatHitDepthSummary(line: PlayerStatLine) {
  const depthParts = [
    line.singles ? '1B' : '',
    line.doubles ? '2B' : '',
    line.triples ? '3B' : '',
    line.homeRuns ? 'HR' : '',
  ].filter(Boolean)

  return depthParts.length ? depthParts.join(' / ') : '-'
}

export function ScoreGamePage({ gameConfig, initialState, isScoreEditorOpen, onEndGame, onGameConfigChange, onGameStateChange, onScoreEditorOpenChange }: ScoreGamePageProps) {
  const [isEndGameConfirmOpen, setIsEndGameConfirmOpen] = useState(false)
  const [isFinalScoreOpen, setIsFinalScoreOpen] = useState(false)
  const [isRosterSettingsOpen, setIsRosterSettingsOpen] = useState(false)
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
  const [heldRunners, setHeldRunners] = useState<Runner[]>(
    initialState?.heldRunners ?? (initialState?.heldRunner ? [initialState.heldRunner] : []),
  )
  const [pendingScorers, setPendingScorers] = useState<Runner[]>(initialState?.pendingScorers ?? [])
  const [draggedRunnerSource, setDraggedRunnerSource] = useState<RunnerSource | null>(null)
  const [playerStats, setPlayerStats] = useState<PlayerStats>(initialState?.playerStats ?? emptyPlayerStats)
  const [scoreAdjustments, setScoreAdjustments] = useState<ScoreAdjustments>(initialState?.scoreAdjustments ?? {})
  const [scoreModification, setScoreModification] = useState<ScoreModification>(initialState?.scoreModification ?? { home: 0, away: 0 })
  const [trackedBattingTeams, setTrackedBattingTeams] = useState<TrackedBattingTeams>(
    initialState?.trackedBattingTeams ?? {
      teamOne: gameConfig.teamOneTracksBatting,
      teamTwo: gameConfig.teamTwoTracksBatting,
    },
  )
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
  const currentBatter: Runner = {
    id: Number(`${battingTeam === 'home' ? 1 : 2}${inning}${batterIndex}`),
    name: currentBatterName,
    team: battingTeam,
    teamKey: battingTeamKey,
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
    // Pin the batter index to its in-lineup position before the roster changes,
    // so adding players to the end never shifts who is currently at bat.
    const previousLength = getTeamPlayers(teamKey).length
    const setBatterIndex = teamKey === homeTeamKey ? setHomeBatterIndex : setAwayBatterIndex
    setBatterIndex((index) => index % Math.max(previousLength, 1))

    if (teamKey === 'teamOne') {
      setTeamOnePlayers(players)
      onGameConfigChange({ ...gameConfig, teamOnePlayers: players })
      return
    }

    setTeamTwoPlayers(players)
    onGameConfigChange({ ...gameConfig, teamTwoPlayers: players })
  }

  function activateTeamBattingTracking(teamKey: TeamKey) {
    setTrackedBattingTeams((current) => ({
      ...current,
      [teamKey]: true,
    }))
    onGameConfigChange({
      ...gameConfig,
      teamOneTracksBatting: teamKey === 'teamOne' ? true : gameConfig.teamOneTracksBatting,
      teamTwoTracksBatting: teamKey === 'teamTwo' ? true : gameConfig.teamTwoTracksBatting,
    })
  }

  function setTeamBattingTracking(teamKey: TeamKey, shouldTrackBatting: boolean) {
    if (shouldTrackBatting) {
      setTrackedBattingTeams((current) => ({
        ...current,
        [teamKey]: true,
      }))
    }

    onGameConfigChange({
      ...gameConfig,
      teamOneTracksBatting: teamKey === 'teamOne' ? shouldTrackBatting : gameConfig.teamOneTracksBatting,
      teamTwoTracksBatting: teamKey === 'teamTwo' ? shouldTrackBatting : gameConfig.teamTwoTracksBatting,
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
      heldRunners,
      homeBatterIndex,
      homeScore,
      inningRuns,
      inning,
      outs,
      pendingScorers,
      playerStats,
      scoreAdjustments,
      scoreModification,
      teamOnePlayers,
      teamTwoPlayers,
      trackedBattingTeams,
      undoStack,
    })
  }, [
    awayBatterIndex,
    awayScore,
    bases,
    halfInning,
    heldRunners,
    homeBatterIndex,
    homeScore,
    inningRuns,
    inning,
    onGameStateChange,
    outs,
    pendingScorers,
    playerStats,
    scoreAdjustments,
    scoreModification,
    teamOnePlayers,
    teamTwoPlayers,
    trackedBattingTeams,
    undoStack,
  ])

  function createGameSnapshot(): GameSnapshot {
    return {
      awayBatterIndex,
      awayScore,
      bases,
      halfInning,
      heldRunners,
      homeBatterIndex,
      homeScore,
      inningRuns,
      inning,
      outs,
      pendingScorers,
      playerStats,
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
      setHeldRunners(snapshot.heldRunners ?? [])
      setHomeBatterIndex(snapshot.homeBatterIndex)
      setHomeScore(snapshot.homeScore)
      setInningRuns(snapshot.inningRuns ?? {})
      setInning(snapshot.inning)
      setOuts(snapshot.outs)
      setPendingScorers(snapshot.pendingScorers)
      setPlayerStats(snapshot.playerStats)

      return snapshots.slice(0, -1)
    })
  }

  function scoreRunner(runner: Runner) {
    const scoringInning = runner.scoredInning ?? inning
    const scoringTeamKey = runner.teamKey ?? getTeamKeyForSide(runner.team)
    updatePlayerStat(scoringTeamKey, runner.name, (line) => ({
      ...line,
      runs: line.runs + 1,
    }))

    if (runner.team === 'home') {
      setHomeScore((score) => score + 1)
      incrementInningRuns('home', scoringInning)
      return
    }

    setAwayScore((score) => score + 1)
    incrementInningRuns('away', scoringInning)
  }

  function getTeamKeyForSide(teamSide: TeamSide) {
    return teamSide === 'home' ? homeTeamKey : awayTeamKey
  }

  function updatePlayerStat(teamKey: TeamKey, playerName: string, updater: (line: PlayerStatLine) => PlayerStatLine) {
    const cleanPlayerName = playerName.trim()
    if (!cleanPlayerName) {
      return
    }

    setPlayerStats((currentStats) => {
      const teamStats = currentStats[teamKey] ?? {}
      const currentLine = teamStats[cleanPlayerName] ?? createEmptyPlayerStatLine()

      return {
        ...currentStats,
        [teamKey]: {
          ...teamStats,
          [cleanPlayerName]: updater(currentLine),
        },
      }
    })
  }

  function recordPlateAppearanceStat(teamKey: TeamKey, playerName: string, hitDepth?: HitDepth) {
    updatePlayerStat(teamKey, playerName, (line) => ({
      ...line,
      atBats: line.atBats + 1,
      doubles: line.doubles + (hitDepth === 'double' ? 1 : 0),
      hits: line.hits + (hitDepth ? 1 : 0),
      homeRuns: line.homeRuns + (hitDepth === 'homeRun' ? 1 : 0),
      singles: line.singles + (hitDepth === 'single' ? 1 : 0),
      triples: line.triples + (hitDepth === 'triple' ? 1 : 0),
    }))
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

  function advanceBatter() {
    if (battingTeam === 'home') {
      setHomeBatterIndex((index) => index + 1)
      return
    }

    setAwayBatterIndex((index) => index + 1)
  }

  function switchHalfInning() {
    setBases(emptyBases)
    setHeldRunners([])
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
    recordPlateAppearanceStat(battingTeamKey, currentBatterName)
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

  function recordHeldRunnerOut() {
    if (heldRunners.length === 0) {
      return
    }

    saveUndoSnapshot()
    setHeldRunners((runners) => runners.slice(1))

    const nextOuts = outs + 1
    if (nextOuts >= 3) {
      switchHalfInning()
      return
    }

    setOuts(nextOuts)
  }

  function recordPendingScorerOut() {
    if (pendingScorers.length === 0) {
      return
    }

    saveUndoSnapshot()
    setPendingScorers((runners) => runners.slice(1))

    const nextOuts = outs + 1
    if (nextOuts >= 3) {
      switchHalfInning()
      return
    }

    setOuts(nextOuts)
  }

  function recordHit(baseCount: number) {
    saveUndoSnapshot()
    recordPlateAppearanceStat(battingTeamKey, currentBatterName, getHitDepth(baseCount))
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

  function recordWalk() {
    saveUndoSnapshot()
    const nextBases = { ...bases }
    const scoringRunners: Runner[] = []

    function forceRunner(runner: Runner, baseNumber: number) {
      if (baseNumber > 3) {
        scoringRunners.push(markRunnerScored(runner))
        return
      }

      const base = baseNumberToKey(baseNumber)
      const displacedRunner = nextBases[base]
      nextBases[base] = runner

      if (displacedRunner) {
        forceRunner(displacedRunner, baseNumber + 1)
      }
    }

    forceRunner(currentBatter, 1)
    setBases(nextBases)
    setPendingScorers((runners) => [...runners, ...scoringRunners])
    advanceBatter()
  }

  function addRunsOnlyRun() {
    saveUndoSnapshot()
    scoreRunner({
      id: Date.now(),
      name: battingTeamName,
      scoredInning: inning,
      team: battingTeam,
      teamKey: battingTeamKey,
    })
  }

  function addRunsOnlyOut() {
    saveUndoSnapshot()
    const nextOuts = outs + 1
    if (nextOuts >= 3) {
      switchHalfInning()
      return
    }
    setOuts(nextOuts)
  }

  function getHitDepth(baseCount: number): HitDepth {
    if (baseCount === 1) {
      return 'single'
    }

    if (baseCount === 2) {
      return 'double'
    }

    if (baseCount === 3) {
      return 'triple'
    }

    return 'homeRun'
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

    if (source === 'home') {
      setPendingScorers((runners) => runners.slice(1))
    }

    if (source === 'holding') {
      setHeldRunners((runners) => runners.slice(1))
    }

    if (preview.scoringRunner) {
      const scoringRunner = markRunnerScored(preview.scoringRunner)
      setPendingScorers((runners) => [...runners, scoringRunner])
    }
  }

  function holdRunner(source: BaseKey) {
    const runner = bases[source]
    if (!runner) {
      return
    }

    setHeldRunners((runners) => [...runners, { ...runner, returnBase: source }])
    setBases((currentBases) => ({
      ...currentBases,
      [source]: null,
    }))
  }

  function holdPendingScorer() {
    const runner = pendingScorers[0]
    if (!runner) {
      return
    }

    setHeldRunners((runners) => [...runners, runner])
    setPendingScorers((runners) => runners.slice(1))
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

    // The holding area accepts runners through its own drop handler, not as a move target.
    if (target === 'holding') {
      return { bases, blocked: true, scoringRunner: null }
    }

    const sourceRunner = source === 'atBat'
      ? currentBatter
      : source === 'home'
        ? pendingScorers[0]
        : source === 'holding'
          ? heldRunners[0] ?? null
          : bases[source]
    if (!sourceRunner) {
      return { bases, blocked: true, scoringRunner: null }
    }

    // Runners can only move to open bases — never bump another runner off their spot.
    if (target !== 'home' && bases[target]) {
      return { bases, blocked: true, scoringRunner: null }
    }

    const nextBases = { ...bases }

    if (target === 'home') {
      if (source === 'atBat' || source === 'home') {
        return { bases, blocked: true, scoringRunner: null }
      }

      if (source === 'holding') {
        return {
          bases: nextBases,
          blocked: false,
          scoringRunner: { ...sourceRunner },
        }
      }

      nextBases[source] = null
      return {
        bases: nextBases,
        blocked: false,
        scoringRunner: {
          ...sourceRunner,
          returnBase: source,
        },
      }
    }

    if (source !== 'atBat' && source !== 'home' && source !== 'holding') {
      nextBases[source] = null
    }

    nextBases[target] = sourceRunner
    return { bases: nextBases, blocked: false, scoringRunner: null }
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
      />
      <BaseOccupancy
        bases={bases}
        canUndo={undoStack.length > 0}
        draggedRunnerSource={draggedRunnerSource}
        onDragEnd={() => setDraggedRunnerSource(null)}
        onDragStart={setDraggedRunnerSource}
        onGetMovePreview={getMovePreview}
        onMoveRunner={moveRunner}
        heldRunner={heldRunners[0] ?? null}
        heldRunnerCount={heldRunners.length}
        onHeldRunnerOut={recordHeldRunnerOut}
        onHoldPendingScorer={holdPendingScorer}
        onHoldRunner={holdRunner}
        onPendingScorerOut={recordPendingScorerOut}
        onRequestRunnerOut={(_, source) => recordBaseRunnerOut(source)}
        pendingScorer={pendingScorers[0] ?? null}
        pendingScorerCount={pendingScorers.length}
        onConfirmRun={confirmScoredRunner}
        onUndo={undoLastScoringAction}
      />
      <GameActionPanel
        activeTeamKey={battingTeamKey}
        bases={bases}
        getBatterIndex={getTeamBatterIndex}
        getLineup={getTeamPlayers}
        getTeamTracksBatting={getTeamTracksBatting}
        isHoldingRunner={heldRunners.length > 0}
        onActivateBattingTracking={() => activateTeamBattingTracking(battingTeamKey)}
        onAddRunsOnlyOut={addRunsOnlyOut}
        onAddRunsOnlyRun={addRunsOnlyRun}
        onHit={recordHit}
        onOpenRosterSettings={() => setIsRosterSettingsOpen(true)}
        onOut={recordOut}
        onReorderLineup={updateTeamPlayers}
        onWalk={recordWalk}
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
          playerStats={playerStats}
          outs={outs}
          awayScore={awayScore}
          scoreAdjustments={scoreAdjustments}
          scoreModification={scoreModification}
          teamOneName={gameConfig.teamOneName}
          teamOnePlayers={teamOnePlayers}
          teamOneTracksBatting={gameConfig.teamOneTracksBatting}
          teamTwoName={gameConfig.teamTwoName}
          teamTwoPlayers={teamTwoPlayers}
          teamTwoTracksBatting={gameConfig.teamTwoTracksBatting}
          trackedBattingTeams={trackedBattingTeams}
          onClose={() => onScoreEditorOpenChange(false)}
          onEndGame={handleEndGame}
          onHalfInningChange={setHalfInning}
          onInningChange={setInning}
          onOutsChange={setOuts}
          onScheduledInningsChange={(innings) => onGameConfigChange({ ...gameConfig, innings })}
          onScoreAdjustmentsChange={setScoreAdjustments}
          onScoreModificationChange={setScoreModification}
          onSetBattingTracking={setTeamBattingTracking}
          onTeamPlayersChange={updateTeamPlayers}
        />
      )}
      {isRosterSettingsOpen && (
        <RosterSettingsModal
          bases={bases}
          getBatterIndex={getTeamBatterIndex}
          getLineup={getTeamPlayers}
          getTeamTracksBatting={getTeamTracksBatting}
          initialTeamKey={battingTeamKey}
          onActivateBattingTracking={activateTeamBattingTracking}
          onClose={() => setIsRosterSettingsOpen(false)}
          onSetBattingTracking={setTeamBattingTracking}
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
  onSetBattingTracking: (teamKey: TeamKey, shouldTrackBatting: boolean) => void
  onTeamPlayersChange: (teamKey: TeamKey, players: string[]) => void
  outs: number
  playerStats: PlayerStats
  scheduledInnings: number
  scoreAdjustments: ScoreAdjustments
  scoreModification: ScoreModification
  teamOneName: string
  teamOnePlayers: string[]
  teamOneTracksBatting: boolean
  teamTwoName: string
  teamTwoPlayers: string[]
  teamTwoTracksBatting: boolean
  trackedBattingTeams: TrackedBattingTeams
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
  onSetBattingTracking,
  onTeamPlayersChange,
  outs,
  playerStats,
  scheduledInnings,
  scoreAdjustments,
  scoreModification,
  teamOneName,
  teamOnePlayers,
  teamOneTracksBatting,
  teamTwoName,
  teamTwoPlayers,
  teamTwoTracksBatting,
  trackedBattingTeams,
}: ScoreEditorModalProps) {
  const [activeTab, setActiveTab] = useState<'scorebook' | 'teams'>('scorebook')
  const [hasAttemptedClose, setHasAttemptedClose] = useState(false)
  const [activeAdjustmentTeam, setActiveAdjustmentTeam] = useState<'home' | 'away'>('home')
  const [activeBreakdownTeam, setActiveBreakdownTeam] = useState<'teamOne' | 'teamTwo'>('teamOne')
  const [activeTeamSettingsKey, setActiveTeamSettingsKey] = useState<'teamOne' | 'teamTwo'>('teamOne')
  const [isEditingTeamSettings, setIsEditingTeamSettings] = useState(false)
  const [isEditingPosition, setIsEditingPosition] = useState(false)
  const [draftInning, setDraftInning] = useState(inning)
  const [draftHalfInning, setDraftHalfInning] = useState<'top' | 'bottom'>(halfInning)
  const [draftOuts, setDraftOuts] = useState(outs)
  const [draftScheduledInnings, setDraftScheduledInnings] = useState(scheduledInnings)

  function startEditingPosition() {
    setDraftInning(inning)
    setDraftHalfInning(halfInning)
    setDraftOuts(outs)
    setDraftScheduledInnings(scheduledInnings)
    setIsEditingPosition(true)
  }

  function cancelEditingPosition() {
    setIsEditingPosition(false)
  }

  function confirmPosition() {
    onInningChange(draftInning)
    onHalfInningChange(draftHalfInning)
    onOutsChange(draftOuts)
    onScheduledInningsChange(draftScheduledInnings)
    setIsEditingPosition(false)
  }
  const inningRows = Array.from({ length: Math.max(scheduledInnings, inning) }, (_, index) => index + 1)
  const teamSettings = [
    {
      key: 'teamOne' as const,
      name: teamOneName,
      players: teamOnePlayers,
      tracksBatting: teamOneTracksBatting,
    },
    {
      key: 'teamTwo' as const,
      name: teamTwoName,
      players: teamTwoPlayers,
      tracksBatting: teamTwoTracksBatting,
    },
  ]
  const hasInvalidTrackedLineup = teamSettings.some((team) => (
    team.tracksBatting && team.players.filter((player) => player.trim()).length < MIN_TRACKED_LINEUP_PLAYERS
  ))
  const inningAdjustmentTotals = Object.values(scoreAdjustments).reduce(
    (totals, adjustment) => ({
      away: totals.away + adjustment.away,
      home: totals.home + adjustment.home,
    }),
    { away: 0, home: 0 },
  )
  const displayedHomeScore = homeScore + inningAdjustmentTotals.home + scoreModification.home
  const displayedAwayScore = awayScore + inningAdjustmentTotals.away + scoreModification.away
  const adjustmentTeamToggle = (
    <div className="half-toggle team-toggle">
      <button type="button" className={activeAdjustmentTeam === 'home' ? 'active' : ''} onClick={() => setActiveAdjustmentTeam('home')}>{homeTeamName}</button>
      <button type="button" className={activeAdjustmentTeam === 'away' ? 'active' : ''} onClick={() => setActiveAdjustmentTeam('away')}>{awayTeamName}</button>
    </div>
  )
  const breakdownTeamToggle = (
    <div className="half-toggle team-toggle">
      <button type="button" className={activeBreakdownTeam === 'teamOne' ? 'active' : ''} onClick={() => setActiveBreakdownTeam('teamOne')}>{teamOneName}</button>
      <button type="button" className={activeBreakdownTeam === 'teamTwo' ? 'active' : ''} onClick={() => setActiveBreakdownTeam('teamTwo')}>{teamTwoName}</button>
    </div>
  )

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

  function requestClose() {
    if (hasInvalidTrackedLineup) {
      setHasAttemptedClose(true)
      setActiveTab('teams')
      return
    }

    onClose()
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={requestClose}>
      <section className="score-editor-modal" role="dialog" aria-modal="true" aria-labelledby="score-editor-title" onClick={(event) => event.stopPropagation()}>
        <div className="score-editor-top-actions">
          <div className="score-editor-tab-nav" aria-label="Settings sections">
            <button className={activeTab === 'scorebook' ? 'active' : ''} type="button" onClick={() => setActiveTab('scorebook')}>
              Scorebook and rules
            </button>
            <button className={activeTab === 'teams' ? 'active' : ''} type="button" onClick={() => setActiveTab('teams')}>
              Team settings
            </button>
          </div>
          <div className="score-editor-action-buttons">
            <button className="score-editor-icon-button" type="button" aria-label="Close settings" onClick={requestClose}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
        </div>
        {hasAttemptedClose && hasInvalidTrackedLineup && (
          <p className="score-editor-tab-notice">
            Teams tracking at-bats need at least {MIN_TRACKED_LINEUP_PLAYERS} batters. Add batters or switch that team to Runs Only.
          </p>
        )}

        {activeTab === 'scorebook' && (
          <>
            <div className="score-editor-section">
              <div className="score-editor-section-heading">
                <h3>Game Settings</h3>
                {!isEditingPosition ? (
                  <button className="section-edit-button" type="button" onClick={startEditingPosition}>Edit</button>
                ) : (
                  <div className="section-edit-actions">
                    <button className="section-confirm-button" type="button" onClick={confirmPosition}>Confirm</button>
                    <button className="section-cancel-button" type="button" aria-label="Cancel changes" onClick={cancelEditingPosition}>
                      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                    </button>
                  </div>
                )}
              </div>
              <div className="game-settings-rows">
                <div className="game-setting-row">
                  <span className="game-setting-label">Set number of innings:</span>
                  <div className="game-setting-controls">
                    {isEditingPosition ? (
                      <NumberStepper ariaLabel="Scheduled innings" max={20} min={1} value={draftScheduledInnings} onChange={setDraftScheduledInnings} />
                    ) : (
                      <span className="game-setting-value">{scheduledInnings}</span>
                    )}
                  </div>
                </div>
                <div className="game-setting-row">
                  <span className="game-setting-label">Current inning:</span>
                  <div className="game-setting-controls">
                    {isEditingPosition ? (
                      <>
                        <NumberStepper ariaLabel="Current inning" min={1} value={draftInning} onChange={setDraftInning} />
                        <div className="half-toggle">
                          <button type="button" className={draftHalfInning === 'top' ? 'active' : ''} onClick={() => setDraftHalfInning('top')}>Top</button>
                          <button type="button" className={draftHalfInning === 'bottom' ? 'active' : ''} onClick={() => setDraftHalfInning('bottom')}>Bottom</button>
                        </div>
                      </>
                    ) : (
                      <span className="game-setting-value">{halfInning === 'top' ? 'Top' : 'Bottom'} of {inning}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="score-editor-section">
              <h3>Inning Adjustments</h3>
              {activeAdjustmentTeam === 'home' ? (
                <InningAdjustmentTable
                  extraRuns={scoreModification.home}
                  header={adjustmentTeamToggle}
                  inningRows={inningRows}
                  inningRuns={inningRuns}
                  onExtraRunsChange={(runs) => onScoreModificationChange({ ...scoreModification, home: runs })}
                  onUpdateInningAdjustment={updateInningAdjustment}
                  scoreAdjustments={scoreAdjustments}
                  team="home"
                  teamName={homeTeamName}
                />
              ) : (
                <InningAdjustmentTable
                  extraRuns={scoreModification.away}
                  header={adjustmentTeamToggle}
                  inningRows={inningRows}
                  inningRuns={inningRuns}
                  onExtraRunsChange={(runs) => onScoreModificationChange({ ...scoreModification, away: runs })}
                  onUpdateInningAdjustment={updateInningAdjustment}
                  scoreAdjustments={scoreAdjustments}
                  team="away"
                  teamName={awayTeamName}
                />
              )}
            </div>

            <div className="score-editor-section">
              <h3>Score Breakdown</h3>
              {activeBreakdownTeam === 'teamOne' && (
                <TeamScoreBreakdown
                  header={breakdownTeamToggle}
                  players={teamOnePlayers}
                  playerStats={playerStats.teamOne}
                  shouldShow={teamOneTracksBatting || Object.values(playerStats.teamOne ?? {}).some((s) => s.atBats > 0)}
                  teamName={teamOneName}
                />
              )}
              {activeBreakdownTeam === 'teamTwo' && (
                <TeamScoreBreakdown
                  header={breakdownTeamToggle}
                  players={teamTwoPlayers}
                  playerStats={playerStats.teamTwo}
                  shouldShow={teamTwoTracksBatting || Object.values(playerStats.teamTwo ?? {}).some((s) => s.atBats > 0)}
                  teamName={teamTwoName}
                />
              )}
            </div>

            <div className="score-editor-section score-editor-end-game-section">
              <button className="score-editor-end-game-button" type="button" onClick={onEndGame}>
                End Game
              </button>
            </div>
          </>
        )}

        {activeTab === 'teams' && (
          <div className="score-editor-section">
            <div className="score-editor-section-heading">
              <h3>Team Settings</h3>
              {isEditingTeamSettings ? (
                <div className="section-edit-actions">
                  <button className="section-confirm-button" type="button" onClick={() => setIsEditingTeamSettings(false)}>Confirm</button>
                  <button className="section-cancel-button" type="button" aria-label="Close editing" onClick={() => setIsEditingTeamSettings(false)}>
                    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                  </button>
                </div>
              ) : (
                <button className="section-edit-button" type="button" onClick={() => setIsEditingTeamSettings(true)}>Edit</button>
              )}
            </div>
            {teamSettings.filter((t) => t.key === activeTeamSettingsKey).map((team) => (
              <RosterTeamEditor
                key={team.key}
                header={
                  <div className="half-toggle team-toggle">
                    <button type="button" className={activeTeamSettingsKey === 'teamOne' ? 'active' : ''} onClick={() => setActiveTeamSettingsKey('teamOne')}>{teamOneName}</button>
                    <button type="button" className={activeTeamSettingsKey === 'teamTwo' ? 'active' : ''} onClick={() => setActiveTeamSettingsKey('teamTwo')}>{teamTwoName}</button>
                  </div>
                }
                isEditing={isEditingTeamSettings}
                onActivate={() => onSetBattingTracking(team.key, true)}
                onDeactivate={() => onSetBattingTracking(team.key, false)}
                onPlayersChange={(players) => onTeamPlayersChange(team.key, players)}
                players={team.players}
                showNotice={false}
                teamName={team.name}
                tracksBatting={team.tracksBatting}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

type TeamScoreBreakdownProps = {
  header: ReactNode
  players: string[]
  playerStats: Record<string, PlayerStatLine>
  shouldShow: boolean
  teamName: string
}

function TeamScoreBreakdown({ header, players, playerStats, shouldShow, teamName }: TeamScoreBreakdownProps) {
  if (!shouldShow) {
    return null
  }

  const playerNames = Array.from(
    new Set([
      ...players.map((player) => player.trim()).filter(Boolean),
      ...Object.keys(playerStats),
    ]),
  )

  return (
    <div className="score-breakdown-card">
      {header}
      <div className="score-breakdown-table">
        <span>Player</span>
        <span>H</span>
        <span>AB</span>
        <span>R</span>
        <span>Hit</span>
        {playerNames.map((playerName) => {
          const line = playerStats[playerName] ?? createEmptyPlayerStatLine()
          const hitSummary = formatHitDepthSummary(line)

          return (
            <div className="score-breakdown-row" key={playerName}>
              <strong>{playerName}</strong>
              <span>{line.hits}</span>
              <span>{line.atBats}</span>
              <span>{line.runs}</span>
              <em title={hitSummary}>{hitSummary}</em>
            </div>
          )
        })}
        {playerNames.length === 0 && (
          <div className="score-breakdown-empty">No tracked batters yet.</div>
        )}
      </div>
    </div>
  )
}

type InningAdjustmentTableProps = {
  extraRuns: number
  header: ReactNode
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
  header,
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
      <div className="inning-adjustment-team-name">{header}</div>
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
  disabled?: boolean
  max?: number
  min?: number
  onChange: (value: number) => void
  value: number
}

function NumberStepper({ ariaLabel, disabled, max, min, onChange, value }: NumberStepperProps) {
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
    <div className={disabled ? 'number-stepper disabled' : 'number-stepper'}>
      <button type="button" aria-label={`Decrease ${ariaLabel}`} disabled={disabled} onClick={() => updateValue(value - 1)}>
        -
      </button>
      <input
        aria-label={ariaLabel}
        inputMode="numeric"
        readOnly={disabled}
        type="text"
        value={value}
        onChange={(event) => updateValue(Number(event.target.value))}
      />
      <button type="button" aria-label={`Increase ${ariaLabel}`} disabled={disabled} onClick={() => updateValue(value + 1)}>
        +
      </button>
    </div>
  )
}

type BaseOccupancyProps = {
  bases: Bases
  canUndo: boolean
  draggedRunnerSource: RunnerSource | null
  heldRunner: Runner | null
  heldRunnerCount: number
  onConfirmRun: () => void
  onDragEnd: () => void
  onGetMovePreview: (source: RunnerSource, target: RunnerSource) => MovePreview
  onDragStart: (source: RunnerSource) => void
  onHeldRunnerOut: () => void
  onHoldPendingScorer: () => void
  onHoldRunner: (source: BaseKey) => void
  onMoveRunner: (source: RunnerSource, target: RunnerSource) => void
  onPendingScorerOut: () => void
  onRequestRunnerOut: (runner: Runner, source: BaseKey) => void
  onUndo: () => void
  pendingScorer: Runner | null
  pendingScorerCount: number
}

function BaseOccupancy({
  bases,
  canUndo,
  draggedRunnerSource,
  heldRunner,
  heldRunnerCount,
  onConfirmRun,
  onDragEnd,
  onGetMovePreview,
  onDragStart,
  onHeldRunnerOut,
  onHoldPendingScorer,
  onHoldRunner,
  onMoveRunner,
  onPendingScorerOut,
  onRequestRunnerOut,
  onUndo,
  pendingScorer,
  pendingScorerCount,
}: BaseOccupancyProps) {
  const [dragPreviewTarget, setDragPreviewTarget] = useState<RunnerSource | null>(null)
  const [isOutZoneTargeted, setIsOutZoneTargeted] = useState(false)
  const [isHoldZoneTargeted, setIsHoldZoneTargeted] = useState(false)
  const [isInfoOpen, setIsInfoOpen] = useState(false)
  const movePreview = draggedRunnerSource && dragPreviewTarget ? onGetMovePreview(draggedRunnerSource, dragPreviewTarget) : null
  const previewBases = bases
  const draggedBaseKey = draggedRunnerSource === 'first' || draggedRunnerSource === 'second' || draggedRunnerSource === 'third'
    ? draggedRunnerSource
    : null
  const isDraggingPendingScorer = draggedRunnerSource === 'home'
  const canDropOut = Boolean(draggedBaseKey) || isDraggingPendingScorer || draggedRunnerSource === 'holding'
  const canDropOnHold = Boolean(draggedBaseKey) || isDraggingPendingScorer

  function handleDragEnd() {
    setDragPreviewTarget(null)
    setIsOutZoneTargeted(false)
    setIsHoldZoneTargeted(false)
    onDragEnd()
  }

  function handleHoldingDragStart(event: DragEvent<HTMLButtonElement>, runner: Runner) {
    const holdingTile = event.currentTarget.closest('.drag-hold-zone')
    if (holdingTile instanceof HTMLElement) {
      const tileRect = holdingTile.getBoundingClientRect()
      const handleRect = event.currentTarget.getBoundingClientRect()
      const offsetX = handleRect.left - tileRect.left + handleRect.width / 2
      const offsetY = handleRect.top - tileRect.top + handleRect.height / 2

      event.dataTransfer.setDragImage(holdingTile, offsetX, offsetY)
    }

    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', runner.name)
    onDragStart('holding')
  }

  function handleMoveRunner(source: RunnerSource, target: RunnerSource) {
    setDragPreviewTarget(null)
    onMoveRunner(source, target)
  }

  return (
    <div className="base-area">
      <section className="base-occupancy-card" aria-label="Base runners">
        <button className="field-info-button" type="button" aria-label="How scoring works" onClick={() => setIsInfoOpen(true)}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="10" cy="10" r="7.25" />
            <path d="M10 9.25v4.25" />
            <circle cx="10" cy="6.6" r="0.9" fill="currentColor" stroke="none" />
          </svg>
        </button>
        <div className="field-control-stack">
          <div className="field-control-row">
            <button className="field-undo-button" type="button" aria-label="Undo last scoring action" disabled={!canUndo} onClick={onUndo}>
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M7.25 6.25H4.5v-2.75" />
                <path d="M4.75 6.25A6.25 6.25 0 1 1 4.4 14" />
              </svg>
            </button>
          </div>
        </div>
        <BaseSlot baseKey="third" className="base-slot-3b" dragPreviewTarget={dragPreviewTarget} isPreviewBlocked={Boolean(movePreview?.blocked && dragPreviewTarget === 'third')} label="3B" runner={previewBases.third} draggedRunnerSource={draggedRunnerSource} onDragEnd={handleDragEnd} onDragStart={onDragStart} onMoveRunner={handleMoveRunner} onPreviewTargetChange={setDragPreviewTarget} onRequestRunnerOut={onRequestRunnerOut} />
        <BaseSlot baseKey="second" className="base-slot-2b" dragPreviewTarget={dragPreviewTarget} isPreviewBlocked={Boolean(movePreview?.blocked && dragPreviewTarget === 'second')} label="2B" runner={previewBases.second} draggedRunnerSource={draggedRunnerSource} onDragEnd={handleDragEnd} onDragStart={onDragStart} onMoveRunner={handleMoveRunner} onPreviewTargetChange={setDragPreviewTarget} onRequestRunnerOut={onRequestRunnerOut} />
        <BaseSlot baseKey="first" className="base-slot-1b" dragPreviewTarget={dragPreviewTarget} isPreviewBlocked={Boolean(movePreview?.blocked && dragPreviewTarget === 'first')} label="1B" runner={previewBases.first} draggedRunnerSource={draggedRunnerSource} onDragEnd={handleDragEnd} onDragStart={onDragStart} onMoveRunner={handleMoveRunner} onPreviewTargetChange={setDragPreviewTarget} onRequestRunnerOut={onRequestRunnerOut} />
        <HomeScoringSlot
          dragPreviewTarget={dragPreviewTarget}
          draggedRunnerSource={draggedRunnerSource}
          isPreviewBlocked={Boolean(movePreview?.blocked && dragPreviewTarget === 'home')}
          pendingScorer={pendingScorer}
          pendingScorerCount={pendingScorerCount}
          onConfirmRun={onConfirmRun}
          onDragEnd={handleDragEnd}
          onDragStart={onDragStart}
          onMoveRunner={handleMoveRunner}
          onPreviewTargetChange={setDragPreviewTarget}
        />
        <div
          className={[
            'drag-out-zone',
            canDropOut ? '' : 'idle',
            isOutZoneTargeted && canDropOut ? 'targeted' : '',
          ].filter(Boolean).join(' ')}
          aria-label="Drop runner here to record an out"
          onDragEnter={() => {
            if (canDropOut) {
              setIsOutZoneTargeted(true)
            }
          }}
          onDragOver={(event) => {
            if (canDropOut) {
              event.preventDefault()
            }
          }}
          onDragLeave={() => setIsOutZoneTargeted(false)}
          onDrop={() => {
            if (draggedBaseKey) {
              const runner = bases[draggedBaseKey]
              if (runner) {
                onRequestRunnerOut(runner, draggedBaseKey)
              }
            } else if (isDraggingPendingScorer) {
              onPendingScorerOut()
            } else if (draggedRunnerSource === 'holding') {
              onHeldRunnerOut()
            }
            handleDragEnd()
          }}
        >
          <span>Out</span>
        </div>
        {!heldRunner && (
          <div
            className={[
              'drag-hold-zone',
              canDropOnHold ? '' : 'idle',
              isHoldZoneTargeted && canDropOnHold ? 'targeted' : '',
            ].filter(Boolean).join(' ')}
            aria-label="Drop runner here to hold while reorganizing bases"
            onDragEnter={() => {
              if (canDropOnHold) {
                setIsHoldZoneTargeted(true)
              }
            }}
            onDragOver={(event) => {
              if (canDropOnHold) {
                event.preventDefault()
              }
            }}
            onDragLeave={() => setIsHoldZoneTargeted(false)}
            onDrop={() => {
              if (draggedBaseKey) {
                onHoldRunner(draggedBaseKey)
              } else if (isDraggingPendingScorer) {
                onHoldPendingScorer()
              }
              handleDragEnd()
            }}
          >
            <span>Hold</span>
          </div>
        )}
        {heldRunner && (
          <div
            className={isHoldZoneTargeted && canDropOnHold ? 'drag-hold-zone occupied targeted' : 'drag-hold-zone occupied'}
            onDragEnter={() => {
              if (canDropOnHold) {
                setIsHoldZoneTargeted(true)
              }
            }}
            onDragOver={(event) => {
              if (canDropOnHold) {
                event.preventDefault()
              }
            }}
            onDragLeave={() => setIsHoldZoneTargeted(false)}
            onDrop={() => {
              if (draggedBaseKey) {
                onHoldRunner(draggedBaseKey)
              } else if (isDraggingPendingScorer) {
                onHoldPendingScorer()
              }
              handleDragEnd()
            }}
          >
            <button
              className="runner-drag-handle"
              type="button"
              aria-label={`Drag ${heldRunner.name} back to a base or home`}
              draggable
              onDragEnd={handleDragEnd}
              onDragStart={(event) => handleHoldingDragStart(event, heldRunner)}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="5.5" cy="4" r="1" />
                <circle cx="10.5" cy="4" r="1" />
                <circle cx="5.5" cy="8" r="1" />
                <circle cx="10.5" cy="8" r="1" />
                <circle cx="5.5" cy="12" r="1" />
                <circle cx="10.5" cy="12" r="1" />
              </svg>
            </button>
            <div className="drag-hold-zone-main">
              <span>Holding</span>
              <strong>{heldRunner.name}</strong>
            </div>
            {heldRunnerCount > 1 && <span className="home-score-queue">+{heldRunnerCount - 1}</span>}
          </div>
        )}
      </section>
      {isInfoOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsInfoOpen(false)}>
          <section className="field-info-modal" role="dialog" aria-modal="true" aria-labelledby="field-info-title" onClick={(event) => event.stopPropagation()}>
            <div className="field-info-header">
              <h2 id="field-info-title">How scoring works</h2>
              <button className="score-editor-icon-button" type="button" aria-label="Close info" onClick={() => setIsInfoOpen(false)}>
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
            <dl className="field-info-list">
              <div>
                <dt>Batting</dt>
                <dd>Tap Single, Double, Triple, Home Run, Walk, or Out for the current batter. Runners on base advance automatically.</dd>
              </div>
              <div>
                <dt>Moving runners</dt>
                <dd>Drag a runner by the dotted handle to any open base to correct where they are.</dd>
              </div>
              <div>
                <dt>Scoring runs</dt>
                <dd>When a runner reaches Home, tap Scored to count the run. If they didn't actually score, tap the X and drag them to where they are.</dd>
              </div>
              <div>
                <dt>Hold</dt>
                <dd>Drop a runner on Hold to set them aside while you reorganize the bases, then drag them back to a base, Home, or Out.</dd>
              </div>
              <div>
                <dt>Outs</dt>
                <dd>Drop a runner on Out, or tap the X on their tile, to record an out.</dd>
              </div>
              <div>
                <dt>Undo</dt>
                <dd>The arrow at the top right reverses the last play.</dd>
              </div>
            </dl>
          </section>
        </div>
      )}
    </div>
  )
}

type FieldAtBatCardProps = ScoringActionsProps & {
  canActivateBattingTracking: boolean
  currentBatterName: string
  isBattingTracked: boolean
  onActivateBattingTracking: () => void
}

function FieldAtBatCard({ canActivateBattingTracking, currentBatterName, isBattingTracked, onActivateBattingTracking, onHit, onOut, onWalk }: FieldAtBatCardProps) {
  return (
    <section className={isBattingTracked ? 'field-at-bat-card' : 'field-at-bat-card tracking-disabled'} aria-label={`${currentBatterName} at bat`}>
      <div className="field-at-bat-row">
        <div className="field-at-bat-copy">
          <div className="field-at-bat-player">
            <span>Now Batting</span>
            <strong>{isBattingTracked ? currentBatterName : canActivateBattingTracking ? 'Tracking off' : 'Need 4 batters'}</strong>
          </div>
          {isBattingTracked && <BatterActionControls onHit={onHit} onOut={onOut} onWalk={onWalk} />}
        </div>
        {!isBattingTracked && canActivateBattingTracking && (
          <button className="activate-batting-button" type="button" onClick={onActivateBattingTracking}>
            Activate
          </button>
        )}
      </div>
    </section>
  )
}

type HomeScoringSlotProps = {
  dragPreviewTarget: RunnerSource | null
  draggedRunnerSource: RunnerSource | null
  isPreviewBlocked: boolean
  onDragEnd: () => void
  onDragStart: (source: RunnerSource) => void
  onMoveRunner: (source: RunnerSource, target: RunnerSource) => void
  onPreviewTargetChange: (target: RunnerSource | null) => void
  onConfirmRun: () => void
  pendingScorer: Runner | null
  pendingScorerCount: number
}

function HomeScoringSlot({
  dragPreviewTarget,
  draggedRunnerSource,
  isPreviewBlocked,
  onConfirmRun,
  onDragEnd,
  onDragStart,
  onMoveRunner,
  onPreviewTargetChange,
  pendingScorer,
  pendingScorerCount,
}: HomeScoringSlotProps) {
  const [isRelocating, setIsRelocating] = useState(false)
  const pendingScorerId = pendingScorer?.id

  useEffect(() => {
    setIsRelocating(false)
  }, [pendingScorerId])

  const isPreviewTarget = dragPreviewTarget === 'home' && draggedRunnerSource !== 'home'
  const previewClass = [
    isPreviewTarget ? 'preview-target' : '',
    isPreviewBlocked ? 'preview-blocked' : '',
  ]
    .filter(Boolean)
    .join(' ')

  function handleDragStart(event: DragEvent<HTMLButtonElement>) {
    const runnerTile = event.currentTarget.closest('.home-score-card')
    if (runnerTile instanceof HTMLElement) {
      const tileRect = runnerTile.getBoundingClientRect()
      const handleRect = event.currentTarget.getBoundingClientRect()
      const offsetX = handleRect.left - tileRect.left + handleRect.width / 2
      const offsetY = handleRect.top - tileRect.top + handleRect.height / 2

      event.dataTransfer.setDragImage(runnerTile, offsetX, offsetY)
    }

    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', pendingScorer?.name ?? '')
    onDragStart('home')
  }

  return (
    <div
      className={`base-slot base-slot-home${pendingScorer ? ' has-runner' : ''}${previewClass ? ` ${previewClass}` : ''}`}
      onDragEnter={() => {
        if (draggedRunnerSource && draggedRunnerSource !== 'home') {
          onPreviewTargetChange('home')
        }
      }}
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        if (draggedRunnerSource && draggedRunnerSource !== 'home') {
          onPreviewTargetChange('home')
        }
      }}
      onDragLeave={() => onPreviewTargetChange(null)}
      onDrop={() => {
        if (draggedRunnerSource) {
          onMoveRunner(draggedRunnerSource, 'home')
        }
      }}
    >
      {!pendingScorer && (
        <div className="base-slot-empty">
          <span className="base-slot-label">Home</span>
        </div>
      )}
      {pendingScorer && (
        <div className="home-score-card">
          <button className="runner-drag-handle" type="button" aria-label={`Drag ${pendingScorer.name}`} draggable onDragEnd={onDragEnd} onDragStart={handleDragStart}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="5.5" cy="4" r="1" />
              <circle cx="10.5" cy="4" r="1" />
              <circle cx="5.5" cy="8" r="1" />
              <circle cx="10.5" cy="8" r="1" />
              <circle cx="5.5" cy="12" r="1" />
              <circle cx="10.5" cy="12" r="1" />
            </svg>
          </button>
          {isRelocating ? (
            <>
              <div className="home-score-card-main">
                <span className="relocate-hint">Drag <strong>{pendingScorer.name}</strong> to where they are</span>
              </div>
              <button className="relocate-back-button" type="button" aria-label={`Back, ${pendingScorer.name} scored`} onClick={() => setIsRelocating(false)}>
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M10 3.5 5.5 8 10 12.5" />
                </svg>
                Back
              </button>
            </>
          ) : (
            <>
              <div className="home-score-card-main">
                <strong>{pendingScorer.name}</strong>
              </div>
              <div className="home-score-actions">
                <button className="deny-score-button" type="button" aria-label={`${pendingScorer.name} did not score`} onClick={() => setIsRelocating(true)}>
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
                <button className="confirm-score-button" type="button" aria-label={`Confirm ${pendingScorer.name} scored`} onClick={onConfirmRun}>
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="m4 8.25 2.25 2.25L12 5" />
                  </svg>
                  Scored
                </button>
              </div>
            </>
          )}
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
        event.dataTransfer.dropEffect = 'move'
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
    event.dataTransfer.setData('text/plain', runner.name)
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
        <span className="modal-eyebrow">End Game</span>
        <h2 id="end-game-title">Confirm end game?</h2>
        <ScoreSummary awayScore={awayScore} awayTeamName={awayTeamName} homeScore={homeScore} homeTeamName={homeTeamName} />
        <div className="game-decision-actions">
          <button className="secondary" type="button" onClick={onCancel}>
            Continue Game
          </button>
          <button className="primary" type="button" onClick={onConfirm}>
            Confirm End
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
      <div className="team-score">
        <span>{homeTeamName}</span>
        <strong>{homeScore}</strong>
      </div>
      <div className="team-score">
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
  onWalk: () => void
}

type GameActionPanelProps = {
  activeTeamKey: TeamKey
  bases: Bases
  getBatterIndex: (teamKey: TeamKey) => number
  getLineup: (teamKey: TeamKey) => string[]
  getTeamTracksBatting: (teamKey: TeamKey) => boolean
  isHoldingRunner: boolean
  onActivateBattingTracking: () => void
  onAddRunsOnlyOut: () => void
  onAddRunsOnlyRun: () => void
  onHit: (baseCount: number) => void
  onOpenRosterSettings: () => void
  onOut: () => void
  onReorderLineup: (teamKey: TeamKey, players: string[]) => void
  onWalk: () => void
  teams: Array<{ key: TeamKey; name: string }>
}

function GameActionPanel({
  activeTeamKey,
  bases,
  getBatterIndex,
  getLineup,
  getTeamTracksBatting,
  isHoldingRunner,
  onActivateBattingTracking: _onActivateBattingTracking,
  onAddRunsOnlyOut,
  onAddRunsOnlyRun,
  onHit,
  onOpenRosterSettings,
  onOut,
  onReorderLineup: _onReorderLineup,
  onWalk,
  teams,
}: GameActionPanelProps) {
  const activeTeam = teams.find((team) => team.key === activeTeamKey) ?? teams[0]
  const lineup = getLineup(activeTeam.key)
  const tracksBatting = getTeamTracksBatting(activeTeam.key)
  const hasMinimumTrackedLineup = lineup.filter((player) => player.trim()).length >= MIN_TRACKED_LINEUP_PLAYERS
  const canRecordAtBats = tracksBatting && hasMinimumTrackedLineup
  const batterIndex = getBatterIndex(activeTeam.key)
  const activeLineupIndex = batterIndex % Math.max(lineup.length, 1)
  const currentBatter = lineup[activeLineupIndex] || `${activeTeam.name} Batter`
  const baseByPlayerName = new Map(
    Object.entries(bases)
      .filter((entry): entry is [BaseKey, Runner] => Boolean(entry[1]))
      .map(([baseKey, runner]) => [runner.name, formatBaseLabel(baseKey)]),
  )

  const namedPlayers = lineup.filter((p) => p.trim())

  const currentBatterNamedIndex = namedPlayers.indexOf(currentBatter)
  const rotatedLineup = canRecordAtBats && currentBatterNamedIndex >= 0
    ? [...namedPlayers.slice(currentBatterNamedIndex), ...namedPlayers.slice(0, currentBatterNamedIndex)]
    : namedPlayers

  const orderScrollRef = useRef<HTMLDivElement>(null)
  const [hasMoreBelow, setHasMoreBelow] = useState(false)

  useEffect(() => {
    const scrollElement = orderScrollRef.current
    if (!scrollElement) {
      setHasMoreBelow(false)
      return
    }

    function updateScrollHint() {
      if (!scrollElement) {
        return
      }

      setHasMoreBelow(scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight > 4)
    }

    updateScrollHint()
    scrollElement.addEventListener('scroll', updateScrollHint)
    window.addEventListener('resize', updateScrollHint)
    return () => {
      scrollElement.removeEventListener('scroll', updateScrollHint)
      window.removeEventListener('resize', updateScrollHint)
    }
  }, [tracksBatting, canRecordAtBats, rotatedLineup.length])

  if (!tracksBatting) {
    return (
      <section className="game-action-panel" aria-label="Scoring controls">
        <div className="runs-only-actions-row">
          <button className="runs-only-action-button" type="button" onClick={onAddRunsOnlyRun}>
            Add a run
          </button>
          <button className="runs-only-action-button" type="button" onClick={onAddRunsOnlyOut}>
            Add an out
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="game-action-panel" aria-label="Batting controls and lineup">
      <div className="combined-batting-tile">
        <div className="batting-panel-header">
          <p className="batting-panel-title">
            Now batting: <strong>{activeTeam.name}</strong>
          </p>
          {canRecordAtBats && (
            <button
              aria-label="Edit batting order"
              className="batting-order-edit-button"
              type="button"
              onClick={onOpenRosterSettings}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="3" cy="4.25" r="1" fill="currentColor" stroke="none" />
                <circle cx="3" cy="8" r="1" fill="currentColor" stroke="none" />
                <circle cx="3" cy="11.75" r="1" fill="currentColor" stroke="none" />
                <path d="M6.5 4.25H14M6.5 8H14M6.5 11.75H14" />
              </svg>
            </button>
          )}
        </div>

        <div className="combined-batting-body">
          <div className="batting-lineup-column">
            {canRecordAtBats && (
              <div className="current-batter-callout">
                <span>At bat</span>
                <strong>{currentBatter}</strong>
              </div>
            )}
            {canRecordAtBats && rotatedLineup.length > 1 && (
              <div className="up-next-callout">
                <span>Up next</span>
                <strong>{rotatedLineup[1]}</strong>
                {baseByPlayerName.has(rotatedLineup[1]) && <em>{baseByPlayerName.get(rotatedLineup[1])}</em>}
              </div>
            )}
            <div className="batter-order-scroll-wrap">
              <div className="batter-order-scroll" ref={orderScrollRef}>
                {canRecordAtBats && rotatedLineup.slice(2).map((player, index) => {
                  const orderPosition = namedPlayers.indexOf(player) + 1
                  return (
                    <div key={`${player}-${index}`}>
                      <span>{orderPosition}</span>
                      <strong>{player}</strong>
                      {baseByPlayerName.has(player) && <em>{baseByPlayerName.get(player)}</em>}
                    </div>
                  )
                })}
                {!hasMinimumTrackedLineup && (
                  <div className="empty-order-row">
                    <span>—</span>
                    <strong>No lineup yet</strong>
                  </div>
                )}
              </div>
              {hasMoreBelow && (
                <div className="scroll-more-hint" aria-hidden="true">
                  <svg viewBox="0 0 16 16">
                    <path d="m4 6 4 4 4-4" />
                  </svg>
                </div>
              )}
            </div>
          </div>

          {canRecordAtBats ? (
            <div className="batting-actions-column">
              {isHoldingRunner && (
                <p className="holding-actions-notice">
                  Adjust the runner(s) in holding before advancing.
                </p>
              )}
              <div className="batting-actions-grid">
                <button className="hit-action" type="button" disabled={isHoldingRunner} onClick={() => onHit(1)}>Single</button>
                <button className="hit-action" type="button" disabled={isHoldingRunner} onClick={() => onHit(2)}>Double</button>
                <button className="hit-action" type="button" disabled={isHoldingRunner} onClick={() => onHit(3)}>Triple</button>
                <button className="hit-action" type="button" disabled={isHoldingRunner} onClick={() => onHit(4)}>Home Run</button>
                <button className="walk-action" type="button" disabled={isHoldingRunner} onClick={onWalk}>Walk</button>
                <button className="out-action" type="button" disabled={isHoldingRunner} onClick={onOut}>Out</button>
              </div>
            </div>
          ) : (
            <div className="batting-actions-empty">
              <p>Add at least {MIN_TRACKED_LINEUP_PLAYERS} batters to start scoring at-bats.</p>
              <button type="button" onClick={onOpenRosterSettings}>Set up lineup</button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function BatterActionControls({ disabled = false, onHit, onOut, onWalk }: ScoringActionsProps) {
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
            <button type="button" onClick={() => recordHit(4)}>Home run</button>
          </div>
        )}
      </div>
      <button type="button" disabled={disabled} onClick={onWalk}>Walk</button>
      <button type="button" disabled={disabled} onClick={onOut}>Out</button>
    </div>
  )
}

type RosterSettingsModalProps = {
  bases: Bases
  getBatterIndex: (teamKey: TeamKey) => number
  getLineup: (teamKey: TeamKey) => string[]
  getTeamTracksBatting: (teamKey: TeamKey) => boolean
  initialTeamKey: TeamKey
  onActivateBattingTracking: (teamKey: TeamKey) => void
  onClose: () => void
  onSetBattingTracking: (teamKey: TeamKey, shouldTrackBatting: boolean) => void
  onTeamPlayersChange: (teamKey: TeamKey, players: string[]) => void
  teams: Array<{ key: TeamKey; name: string }>
}

function RosterSettingsModal({
  bases,
  getBatterIndex,
  getLineup,
  getTeamTracksBatting,
  initialTeamKey,
  onActivateBattingTracking,
  onClose,
  onSetBattingTracking,
  onTeamPlayersChange,
  teams,
}: RosterSettingsModalProps) {
  const [activeTeamKey, setActiveTeamKey] = useState<TeamKey>(initialTeamKey)
  const [isEditing, setIsEditing] = useState(() => {
    if (!getTeamTracksBatting(initialTeamKey)) {
      return false
    }

    return getLineup(initialTeamKey).filter((player) => player.trim()).length < MIN_TRACKED_LINEUP_PLAYERS
  })
  const hasInvalidTrackedLineup = teams.some((team) => {
    if (!getTeamTracksBatting(team.key)) {
      return false
    }

    return getLineup(team.key).filter((player) => player.trim()).length < MIN_TRACKED_LINEUP_PLAYERS
  })
  const activeTeam = teams.find((team) => team.key === activeTeamKey) ?? teams[0]
  const baseLabelByPlayer = new Map(
    Object.entries(bases)
      .filter((entry): entry is [BaseKey, Runner] => Boolean(entry[1]))
      .filter(([, runner]) => runner.teamKey === activeTeam.key)
      .map(([baseKey, runner]) => [runner.name, formatBaseLabel(baseKey)]),
  )

  function requestClose() {
    if (hasInvalidTrackedLineup) {
      return
    }

    onClose()
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          requestClose()
        }
      }}
    >
      <section className="roster-settings-modal" role="dialog" aria-modal="true" aria-labelledby="roster-settings-title">
        <div className="score-editor-top-actions">
          <h2 className="roster-settings-title" id="roster-settings-title">Batting Order</h2>
          <div className="score-editor-action-buttons">
            <button className="score-editor-icon-button" type="button" aria-label="Close batting order" disabled={hasInvalidTrackedLineup} onClick={requestClose}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
        </div>
        {hasInvalidTrackedLineup && (
          <p className="roster-modal-notice">
            Teams tracking at-bats need at least {MIN_TRACKED_LINEUP_PLAYERS} batters. Add batters or switch that team to Runs Only.
          </p>
        )}
        <div className="roster-settings-body">
          <RosterTeamEditor
            key={activeTeam.key}
            baseLabelByPlayer={baseLabelByPlayer}
            currentBatterIndex={getBatterIndex(activeTeam.key)}
            header={
              <div className="roster-toggle-row">
                <div className="half-toggle team-toggle">
                  {teams.map((team) => (
                    <button
                      key={team.key}
                      type="button"
                      className={activeTeamKey === team.key ? 'active' : ''}
                      onClick={() => setActiveTeamKey(team.key)}
                    >
                      {team.name}
                    </button>
                  ))}
                </div>
                {getTeamTracksBatting(activeTeam.key) && (
                  isEditing ? (
                    <div className="section-edit-actions">
                      <button className="section-confirm-button" type="button" onClick={() => setIsEditing(false)}>Confirm</button>
                      <button className="section-cancel-button" type="button" aria-label="Close editing" onClick={() => setIsEditing(false)}>
                        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                      </button>
                    </div>
                  ) : (
                    <button className="section-edit-button" type="button" onClick={() => setIsEditing(true)}>Edit</button>
                  )
                )}
              </div>
            }
            isEditing={isEditing}
            onActivate={() => onActivateBattingTracking(activeTeam.key)}
            onDeactivate={() => onSetBattingTracking(activeTeam.key, false)}
            onPlayersChange={(players) => onTeamPlayersChange(activeTeam.key, players)}
            players={getLineup(activeTeam.key)}
            showTrackingControl={false}
            teamName={activeTeam.name}
            tracksBatting={getTeamTracksBatting(activeTeam.key)}
          />
        </div>
      </section>
    </div>
  )
}

type RosterTeamEditorProps = {
  baseLabelByPlayer?: Map<string, string>
  currentBatterIndex?: number
  header?: ReactNode
  isEditing?: boolean
  onActivate: () => void
  onDeactivate: () => void
  onPlayersChange: (players: string[]) => void
  players: string[]
  showNotice?: boolean
  showTrackingControl?: boolean
  teamName: string
  tracksBatting: boolean
}

function RosterTeamEditor({ baseLabelByPlayer, currentBatterIndex, header, isEditing = true, onActivate, onDeactivate, onPlayersChange, players, showNotice = true, showTrackingControl = true, teamName, tracksBatting }: RosterTeamEditorProps) {
  const [draftPlayer, setDraftPlayer] = useState('')
  const [selectedForSwap, setSelectedForSwap] = useState<number[]>([])
  const [isScoringDropdownOpen, setIsScoringDropdownOpen] = useState(false)
  const scoringDropdownRef = useRef<HTMLDivElement>(null)
  const isLocked = !!header && !isEditing

  useEffect(() => {
    if (isLocked) {
      setSelectedForSwap([])
    }
  }, [isLocked])

  useEffect(() => {
    if (!isScoringDropdownOpen) return
    function handleClickOutside(event: MouseEvent) {
      if (scoringDropdownRef.current && !scoringDropdownRef.current.contains(event.target as Node)) {
        setIsScoringDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isScoringDropdownOpen])
  const namedPlayerCount = players.filter((player) => player.trim()).length
  const needsMorePlayers = tracksBatting && namedPlayerCount < MIN_TRACKED_LINEUP_PLAYERS
  const showsBattingPositions = currentBatterIndex !== undefined && tracksBatting
  const rotation = showsBattingPositions && players.length > 0 ? currentBatterIndex % players.length : 0
  const orderedRows = players.map((player, index) => ({ player, sourceIndex: index }))

  if (rotation > 0) {
    orderedRows.push(...orderedRows.splice(0, rotation))
  }

  const canSwapSelection = selectedForSwap.length === 2
  const atBatSourceIndex = showsBattingPositions && players.length > 0 ? rotation : null

  let swapBlockedMessage: string | null = null
  if (canSwapSelection && atBatSourceIndex !== null && baseLabelByPlayer) {
    const [firstSelected, secondSelected] = selectedForSwap
    const incomingAtBatIndex = firstSelected === atBatSourceIndex
      ? secondSelected
      : secondSelected === atBatSourceIndex
        ? firstSelected
        : null

    if (incomingAtBatIndex !== null && baseLabelByPlayer.has(players[incomingAtBatIndex])) {
      swapBlockedMessage = `${players[incomingAtBatIndex]} is on base and can't move to at bat.`
    }
  }

  const canPerformSwap = canSwapSelection && !swapBlockedMessage

  function renderOrderStatusLabel(displayIndex: number) {
    if (!showsBattingPositions) {
      return null
    }

    if (displayIndex === 0) {
      return <em className="order-status-label">At bat</em>
    }

    if (displayIndex === 1) {
      return <em className="order-status-label">Next</em>
    }

    return null
  }

  function addPlayer() {
    const playerName = draftPlayer.trim()
    if (!playerName) {
      return
    }

    onPlayersChange([...players, playerName])
    setDraftPlayer('')
  }

  function movePlayer(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) {
      return
    }

    const nextPlayers = [...players]
    const movedPlayer = nextPlayers[fromIndex]
    nextPlayers[fromIndex] = nextPlayers[toIndex]
    nextPlayers[toIndex] = movedPlayer
    onPlayersChange(nextPlayers)
  }

  function toggleSwapSelection(sourceIndex: number) {
    setSelectedForSwap((selected) => (
      selected.includes(sourceIndex)
        ? selected.filter((selectedIndex) => selectedIndex !== sourceIndex)
        : [...selected, sourceIndex]
    ))
  }

  function swapSelectedPlayers() {
    if (!canPerformSwap) {
      return
    }

    movePlayer(selectedForSwap[0], selectedForSwap[1])
    setSelectedForSwap([])
  }

  return (
    <section className={tracksBatting ? 'roster-team-editor' : 'roster-team-editor tracking-off'} aria-label={`${teamName} roster`}>
      {header && <div className="roster-team-toggle">{header}</div>}
      {showTrackingControl && <div className="roster-team-heading">
        {!header ? (
          <>
            <div>
              <span>Tracking</span>
              <strong>{teamName}</strong>
            </div>
            <div className="scoring-type-wrap" ref={scoringDropdownRef}>
              <button className="scoring-type-button" type="button" onClick={() => setIsScoringDropdownOpen((o) => !o)}>
                {tracksBatting ? 'At-Bats & Runs' : 'Runs Only'}
                <svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" /></svg>
              </button>
              {isScoringDropdownOpen && (
                <div className="scoring-type-dropdown" role="menu">
                  <button type="button" role="menuitem" className={tracksBatting ? 'active' : ''} onClick={() => { onActivate(); setIsScoringDropdownOpen(false) }}>
                    Track At-Bats
                    {tracksBatting && <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6l3 3 5-5" /></svg>}
                  </button>
                  <button type="button" role="menuitem" className={!tracksBatting ? 'active' : ''} onClick={() => { onDeactivate(); setIsScoringDropdownOpen(false) }}>
                    Runs Only
                    {!tracksBatting && <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6l3 3 5-5" /></svg>}
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="roster-tracking-row">
            <span className="roster-tracking-label">Tracking:</span>
            <div className="scoring-type-wrap" ref={scoringDropdownRef}>
              <button className="scoring-type-button" type="button" disabled={isLocked} onClick={() => setIsScoringDropdownOpen((o) => !o)}>
                {tracksBatting ? 'At-Bats & Runs' : 'Runs Only'}
                <svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" /></svg>
              </button>
              {isScoringDropdownOpen && (
                <div className="scoring-type-dropdown" role="menu">
                  <button type="button" role="menuitem" className={tracksBatting ? 'active' : ''} onClick={() => { onActivate(); setIsScoringDropdownOpen(false) }}>
                    Track At-Bats
                    {tracksBatting && <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6l3 3 5-5" /></svg>}
                  </button>
                  <button type="button" role="menuitem" className={!tracksBatting ? 'active' : ''} onClick={() => { onDeactivate(); setIsScoringDropdownOpen(false) }}>
                    Runs Only
                    {!tracksBatting && <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6l3 3 5-5" /></svg>}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>}
      {tracksBatting && (
        <>
          <div className="roster-player-list">
            {showNotice && needsMorePlayers && (
              <div className="roster-lineup-notice">
                Add at least {MIN_TRACKED_LINEUP_PLAYERS} batters to record at-bats for this team.
              </div>
            )}
            {orderedRows.map(({ player, sourceIndex }, index) => {
              const cannotRemovePlayer = tracksBatting && namedPlayerCount <= MIN_TRACKED_LINEUP_PLAYERS && Boolean(player.trim())
              const isAtBatRow = showsBattingPositions && index === 0
              const isNextRow = showsBattingPositions && index === 1
              const isSelectedForSwap = selectedForSwap.includes(sourceIndex)
              const baseLabel = baseLabelByPlayer?.get(player)

              if (isLocked) {
                return (
                  <div
                    className={[
                      'roster-player-row',
                      'locked',
                      isAtBatRow ? 'at-bat-row' : '',
                      isNextRow ? 'next-row' : '',
                    ].filter(Boolean).join(' ')}
                    key={index}
                  >
                    <span>{sourceIndex + 1}</span>
                    <span className="roster-player-name-text">
                      {player || '—'}
                      {renderOrderStatusLabel(index)}
                      {baseLabel && <em className="on-base-label">{baseLabel}</em>}
                    </span>
                  </div>
                )
              }

              return (
              <div
                className={[
                  'roster-player-row',
                  isAtBatRow ? 'at-bat-row' : '',
                  isNextRow ? 'next-row' : '',
                  isSelectedForSwap ? 'swap-selected' : '',
                ].filter(Boolean).join(' ')}
                key={index}
              >
                <button
                  className={isSelectedForSwap ? 'swap-select-button selected' : 'swap-select-button'}
                  type="button"
                  aria-pressed={isSelectedForSwap}
                  aria-label={`Select ${player || `player ${index + 1}`} to swap`}
                  onClick={() => toggleSwapSelection(sourceIndex)}
                >
                  <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6l3 3 5-5" /></svg>
                </button>
                <span>{sourceIndex + 1}</span>
                <div className="roster-name-cell">
                  <input
                    aria-label={`${teamName} batter ${index + 1}`}
                    maxLength={PLAYER_NAME_MAX_LENGTH}
                    value={player}
                    onChange={(event) => onPlayersChange(players.map((currentPlayer, playerIndex) => (playerIndex === sourceIndex ? event.target.value : currentPlayer)))}
                  />
                  {renderOrderStatusLabel(index)}
                  {baseLabel && <em className="on-base-label">{baseLabel}</em>}
                </div>
                <button
                  className="remove-player-button"
                  type="button"
                  aria-label={`Remove ${player || `player ${index + 1}`}`}
                  disabled={cannotRemovePlayer}
                  title={cannotRemovePlayer ? `At-bat tracking needs at least ${MIN_TRACKED_LINEUP_PLAYERS} batters. Switch to Runs Only to remove more.` : undefined}
                  onClick={() => {
                    setSelectedForSwap([])
                    onPlayersChange(players.filter((_, playerIndex) => playerIndex !== sourceIndex))
                  }}
                >
                  <span aria-hidden="true" />
                </button>
              </div>
              )
            })}
            {players.length === 0 && (
              <div className="roster-empty-row">
                Add the first batter below.
              </div>
            )}
          </div>
          {!isLocked && players.length > 1 && (
            <div className="swap-actions-row">
              <span className="swap-hint">
                {swapBlockedMessage
                  ? swapBlockedMessage
                  : canSwapSelection
                    ? 'Swap the two selected batters.'
                    : selectedForSwap.length > 2
                      ? 'Select only two batters to swap.'
                      : 'Select two batters to swap positions.'}
              </span>
              <button className="swap-positions-button" type="button" disabled={!canPerformSwap} onClick={swapSelectedPlayers}>
                Swap
              </button>
            </div>
          )}
          {!isLocked && <form
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
            <button className="add-inline-player-button" type="submit" aria-label="Add player">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M8 3.5v9M3.5 8h9" />
              </svg>
            </button>
          </form>}
        </>
      )}
      {!tracksBatting && (
        <p>
          {showTrackingControl
            ? 'Batting order is not active for this team.'
            : 'Batting order tracking is off for this team. Go to Settings → Team settings to activate it.'}
        </p>
      )}
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

function formatBaseLabel(baseKey: BaseKey) {
  if (baseKey === 'first') {
    return 'on 1B'
  }

  if (baseKey === 'second') {
    return 'on 2B'
  }

  return 'on 3B'
}

function formatInning(inning: number) {
  const suffix = inning === 1 ? 'st' : inning === 2 ? 'nd' : inning === 3 ? 'rd' : 'th'
  return `${inning}${suffix}`
}
