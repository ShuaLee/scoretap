from django.urls import path

from apps.games.views import (
    GameDetailView,
    GameListView,
    StartGameView,
)

app_name = "games"

urlpatterns = [
    path("", GameListView.as_view(), name="game-list"),
    path("<int:pk>/", GameDetailView.as_view(), name="game-detail"),
    path("<int:pk>/start/", StartGameView.as_view(), name="game-start"),
]
