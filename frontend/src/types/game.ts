export type GameStatus = 'setup' | 'live' | 'final'
export type HalfInning = 'top' | 'bottom'
export type TeamSide = 'home' | 'away'

export type PlateAppearanceResult =
  | 'single'
  | 'double'
  | 'triple'
  | 'home_run'
  | 'walk'
  | 'strikeout'
  | 'ground_out'
  | 'fly_out'
  | 'error'
  | 'fielders_choice'

export type GamePlayer = {
  id: number
  name: string
  batting_category: string
  lineup_position: number | null
  is_active: boolean
}

export type GameTeam = {
  id: number
  side: TeamSide
  name: string
  batting_order_mode: string
  lineup_rule_config: Record<string, unknown>
  players: GamePlayer[]
}

export type Game = {
  id: number
  status: GameStatus
  scheduled_innings: number
  inning: number
  half_inning: HalfInning
  outs: number
  home_score: number
  away_score: number
  current_home_batter_index: number
  current_away_batter_index: number
  runner_on_first: number | null
  runner_on_first_name?: string
  runner_on_second: number | null
  runner_on_second_name?: string
  runner_on_third: number | null
  runner_on_third_name?: string
  batting_side: TeamSide
  current_batter: GamePlayer | null
  teams: GameTeam[]
  created_at: string
  updated_at: string
}

export type CreateGameInput = {
  home_team_name: string
  away_team_name: string
  scheduled_innings: number
  home_lineup: Array<{ name: string }>
  away_lineup: Array<{ name: string }>
}

export type PlateAppearanceResponse = {
  game: Game
  event_id: number
}
