from games.models import GameEvent, GameTeam


def build_game_summary(game):
    active_plate_appearances = game.events.filter(
        event_type=GameEvent.EventType.PLATE_APPEARANCE,
        is_undone=False,
    )
    home_team = game.teams.get(side=GameTeam.Side.HOME)
    away_team = game.teams.get(side=GameTeam.Side.AWAY)

    return {
        "game_id": game.id,
        "status": game.status,
        "inning": game.inning,
        "half_inning": game.half_inning,
        "home_score": game.home_score,
        "away_score": game.away_score,
        "winner": _winner(game),
        "plate_appearances": active_plate_appearances.count(),
        "runs_scored": sum(
            event.runs_scored
            for event in active_plate_appearances
        ),
        "home_team": _team_summary(home_team),
        "away_team": _team_summary(away_team),
    }


def _winner(game):
    if game.home_score > game.away_score:
        return GameTeam.Side.HOME

    if game.away_score > game.home_score:
        return GameTeam.Side.AWAY

    return None


def _team_summary(team):
    return {
        "id": team.id,
        "name": team.name,
        "side": team.side,
    }
