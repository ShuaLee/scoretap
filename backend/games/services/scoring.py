from django.db import transaction
from django.db.models import Max
from rest_framework.exceptions import ValidationError

from games.models import Game, GameEvent, GamePlayer, GameTeam


HIT_BASES = {
    GameEvent.PlateAppearanceResult.SINGLE: 1,
    GameEvent.PlateAppearanceResult.DOUBLE: 2,
    GameEvent.PlateAppearanceResult.TRIPLE: 3,
    GameEvent.PlateAppearanceResult.HOME_RUN: 4,
    GameEvent.PlateAppearanceResult.ERROR: 1,
}

OUT_RESULTS = {
    GameEvent.PlateAppearanceResult.STRIKEOUT,
    GameEvent.PlateAppearanceResult.GROUND_OUT,
    GameEvent.PlateAppearanceResult.FLY_OUT,
    GameEvent.PlateAppearanceResult.FIELDERS_CHOICE,
}


@transaction.atomic
def create_game(
    home_team_name="Home",
    away_team_name="Away",
    scheduled_innings=7,
    home_lineup=None,
    away_lineup=None,
):
    game = Game.objects.create(
        status=Game.Status.LIVE,
        scheduled_innings=scheduled_innings,
    )

    home_team = GameTeam.objects.create(
        game=game,
        side=GameTeam.Side.HOME,
        name=home_team_name,
    )
    away_team = GameTeam.objects.create(
        game=game,
        side=GameTeam.Side.AWAY,
        name=away_team_name,
    )

    _create_lineup(home_team, home_lineup or [])
    _create_lineup(away_team, away_lineup or [])

    GameEvent.objects.create(
        game=game,
        sequence_number=1,
        event_type=GameEvent.EventType.GAME_STARTED,
        inning=game.inning,
        half_inning=game.half_inning,
        outs_before=game.outs,
        outs_after=game.outs,
        state_before={},
        state_after=_snapshot(game),
    )

    return game


@transaction.atomic
def record_plate_appearance(game, result):
    game = Game.objects.select_for_update().get(pk=game.pk)

    if game.status != Game.Status.LIVE:
        raise ValidationError("Only live games can be scored.")

    batting_team = _batting_team(game)
    batter = _current_batter(game, batting_team)
    state_before = _snapshot(game)
    outs_before = game.outs

    runs_scored = _apply_plate_appearance(game, result, batter)

    _advance_batter(game, batting_team)
    _advance_inning_if_needed(game)

    game.save()

    event = GameEvent.objects.create(
        game=game,
        team=batting_team,
        batter=batter,
        sequence_number=_next_sequence_number(game),
        event_type=GameEvent.EventType.PLATE_APPEARANCE,
        plate_appearance_result=result,
        inning=state_before["inning"],
        half_inning=state_before["half_inning"],
        outs_before=outs_before,
        outs_after=game.outs,
        runs_scored=runs_scored,
        state_before=state_before,
        state_after=_snapshot(game),
    )

    return event


@transaction.atomic
def undo_last_event(game):
    game = Game.objects.select_for_update().get(pk=game.pk)
    event = (
        game.events.filter(
            is_undone=False,
            event_type=GameEvent.EventType.PLATE_APPEARANCE,
        )
        .order_by("-sequence_number")
        .first()
    )

    if event is None:
        raise ValidationError("There is no scoring event to undo.")

    _restore_snapshot(game, event.state_before)
    game.save()

    event.is_undone = True
    event.save(update_fields=["is_undone"])

    return game


@transaction.atomic
def finalize_game(game):
    game = Game.objects.select_for_update().get(pk=game.pk)

    if game.status == Game.Status.FINAL:
        return game

    state_before = _snapshot(game)
    game.status = Game.Status.FINAL
    game.save(update_fields=["status", "updated_at"])

    GameEvent.objects.create(
        game=game,
        sequence_number=_next_sequence_number(game),
        event_type=GameEvent.EventType.GAME_FINALIZED,
        inning=game.inning,
        half_inning=game.half_inning,
        outs_before=game.outs,
        outs_after=game.outs,
        state_before=state_before,
        state_after=_snapshot(game),
    )

    return game


def _create_lineup(team, lineup):
    for index, player in enumerate(lineup):
        if isinstance(player, str):
            player = {"name": player}

        GamePlayer.objects.create(
            game_team=team,
            name=player["name"],
            batting_category=player.get(
                "batting_category",
                GamePlayer.BattingCategory.UNSPECIFIED,
            ),
            lineup_position=index,
        )


def _apply_plate_appearance(game, result, batter):
    if result == GameEvent.PlateAppearanceResult.WALK:
        return _advance_for_walk(game, batter)

    if result in HIT_BASES:
        return _advance_runners(game, HIT_BASES[result], batter)

    if result in OUT_RESULTS:
        game.outs += 1

        if (
            result == GameEvent.PlateAppearanceResult.FIELDERS_CHOICE
            and game.outs < 3
        ):
            game.runner_on_first = batter

        return 0

    raise ValidationError("Unsupported plate appearance result.")


def _advance_runners(game, bases, batter):
    runners = [
        (game.runner_on_third, 3),
        (game.runner_on_second, 2),
        (game.runner_on_first, 1),
        (batter, 0),
    ]
    runs = 0
    new_bases = {1: None, 2: None, 3: None}

    for runner, starting_base in runners:
        if runner is None:
            continue

        destination = starting_base + bases

        if destination >= 4:
            runs += 1
        else:
            new_bases[destination] = runner

    game.runner_on_first = new_bases[1]
    game.runner_on_second = new_bases[2]
    game.runner_on_third = new_bases[3]

    _add_runs(game, runs)

    return runs


def _advance_for_walk(game, batter):
    runs = 0

    if game.runner_on_first and game.runner_on_second and game.runner_on_third:
        runs = 1

    if game.runner_on_first and game.runner_on_second:
        game.runner_on_third = game.runner_on_second

    if game.runner_on_first:
        game.runner_on_second = game.runner_on_first

    game.runner_on_first = batter

    _add_runs(game, runs)

    return runs


def _advance_inning_if_needed(game):
    if game.outs < 3:
        return

    game.outs = 0
    game.runner_on_first = None
    game.runner_on_second = None
    game.runner_on_third = None

    if game.half_inning == Game.HalfInning.TOP:
        game.half_inning = Game.HalfInning.BOTTOM
        return

    if game.inning >= game.scheduled_innings:
        game.status = Game.Status.FINAL
        return

    game.inning += 1
    game.half_inning = Game.HalfInning.TOP


def _advance_batter(game, team):
    lineup_count = team.players.filter(is_active=True).count()

    if lineup_count == 0:
        return

    if team.side == GameTeam.Side.HOME:
        game.current_home_batter_index += 1
        game.current_home_batter_index %= lineup_count
    else:
        game.current_away_batter_index += 1
        game.current_away_batter_index %= lineup_count


def _batting_team(game):
    return game.teams.get(side=game.batting_side)


def _current_batter(game, team):
    players = list(team.players.filter(is_active=True))

    if not players:
        return None

    if team.side == GameTeam.Side.HOME:
        index = game.current_home_batter_index
    else:
        index = game.current_away_batter_index

    return players[index % len(players)]


def _add_runs(game, runs):
    if game.batting_side == GameTeam.Side.HOME:
        game.home_score += runs
    else:
        game.away_score += runs


def _next_sequence_number(game):
    result = game.events.aggregate(max_sequence=Max("sequence_number"))
    return (result["max_sequence"] or 0) + 1


def _snapshot(game):
    return {
        "status": game.status,
        "inning": game.inning,
        "half_inning": game.half_inning,
        "outs": game.outs,
        "home_score": game.home_score,
        "away_score": game.away_score,
        "current_home_batter_index": game.current_home_batter_index,
        "current_away_batter_index": game.current_away_batter_index,
        "runner_on_first_id": game.runner_on_first_id,
        "runner_on_second_id": game.runner_on_second_id,
        "runner_on_third_id": game.runner_on_third_id,
    }


def _restore_snapshot(game, snapshot):
    game.status = snapshot["status"]
    game.inning = snapshot["inning"]
    game.half_inning = snapshot["half_inning"]
    game.outs = snapshot["outs"]
    game.home_score = snapshot["home_score"]
    game.away_score = snapshot["away_score"]
    game.current_home_batter_index = snapshot["current_home_batter_index"]
    game.current_away_batter_index = snapshot["current_away_batter_index"]
    game.runner_on_first_id = snapshot["runner_on_first_id"]
    game.runner_on_second_id = snapshot["runner_on_second_id"]
    game.runner_on_third_id = snapshot["runner_on_third_id"]
