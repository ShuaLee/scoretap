from django.urls import path

from apps.games.views import TeamGameListCreateView
from apps.teams.views import (
    TeamDetailView,
    TeamListCreateView,
    TeamPlayerDetailView,
    TeamPlayerListCreateView,
)

app_name = "teams"

urlpatterns = [
    path("", TeamListCreateView.as_view(), name="team-list"),
    path("<int:pk>/", TeamDetailView.as_view(), name="team-detail"),
    path("<int:team_id>/games/", TeamGameListCreateView.as_view(), name="team-game-list"),
    path("<int:team_id>/players/", TeamPlayerListCreateView.as_view(), name="team-player-list"),
    path(
        "<int:team_id>/players/<int:pk>/",
        TeamPlayerDetailView.as_view(),
        name="team-player-detail",
    ),
]
