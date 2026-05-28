from apps.teams.models import TeamPlayer


def can_view_team(user, team):
    if not user or not user.is_authenticated:
        return False
    if team.owner_id == user.id:
        return True
    return TeamPlayer.objects.filter(
        team=team,
        linked_user=user,
        is_active=True,
    ).exists()


def can_manage_team(user, team):
    if not user or not user.is_authenticated:
        return False
    return team.owner_id == user.id
