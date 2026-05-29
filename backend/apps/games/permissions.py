from apps.teams.permissions import can_manage_team, can_view_team


def can_view_game(user, game):
    if not user or not user.is_authenticated:
        return False
    if game.is_quick_game:
        return game.created_by_id == user.id
    return game.team_id is not None and can_view_team(user, game.team)


def can_manage_game(user, game):
    if not user or not user.is_authenticated:
        return False
    if game.is_quick_game:
        return game.created_by_id == user.id
    return game.team_id is not None and can_manage_team(user, game.team)
