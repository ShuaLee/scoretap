from django.urls import path

from apps.games.views import (
    GameDetailView,
    GameListView,
    GamePlayerDetailView,
    GamePlayerListCreateView,
    GameTeamDetailView,
    GameTeamListCreateView,
    StartGameView,
)

app_name = "games"

urlpatterns = [
    path("", GameListView.as_view(), name="game-list"),
    path("<int:pk>/", GameDetailView.as_view(), name="game-detail"),
    path("<int:pk>/start/", StartGameView.as_view(), name="game-start"),
    path("<int:game_id>/teams/", GameTeamListCreateView.as_view(), name="game-team-list"),
    path("<int:game_id>/teams/<int:pk>/", GameTeamDetailView.as_view(), name="game-team-detail"),
    path(
        "<int:game_id>/teams/<int:game_team_id>/players/",
        GamePlayerListCreateView.as_view(),
        name="game-player-list",
    ),
    path(
        "<int:game_id>/teams/<int:game_team_id>/players/<int:pk>/",
        GamePlayerDetailView.as_view(),
        name="game-player-detail",
    ),
]
