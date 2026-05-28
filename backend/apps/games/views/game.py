from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import ListAPIView, ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import IsAuthenticated

from apps.games.models import Game
from apps.games.serializers import GameSerializer
from apps.teams.models import Team
from apps.teams.permissions import can_manage_team, can_view_team


class GameQuerysetMixin:
    def visible_games(self):
        user = self.request.user
        queryset = Game.objects.select_related("team", "created_by").filter(
            team__archived_at__isnull=True,
        )
        if self.request.query_params.get("include_cancelled") != "true":
            queryset = queryset.exclude(status=Game.Status.CANCELLED)
        return queryset.filter(
            team__owner=user,
        ) | queryset.filter(
            team__players__linked_user=user,
            team__players__is_active=True,
        )


class GameListView(GameQuerysetMixin, ListAPIView):
    serializer_class = GameSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = self.visible_games().distinct()
        team_id = self.request.query_params.get("team")
        if team_id:
            queryset = queryset.filter(team_id=team_id)
        return queryset


class TeamGameListCreateView(ListCreateAPIView):
    serializer_class = GameSerializer
    permission_classes = [IsAuthenticated]

    def get_team(self):
        team = get_object_or_404(Team, pk=self.kwargs["team_id"])
        if not can_view_team(self.request.user, team):
            raise PermissionDenied("You do not have access to this team.")
        return team

    def get_queryset(self):
        team = self.get_team()
        queryset = Game.objects.filter(team=team).select_related("team", "created_by")
        if self.request.query_params.get("include_cancelled") != "true":
            queryset = queryset.exclude(status=Game.Status.CANCELLED)
        return queryset

    def perform_create(self, serializer):
        team = self.get_team()
        if not can_manage_team(self.request.user, team):
            raise PermissionDenied("You do not have permission to schedule games for this team.")
        serializer.save(team=team, created_by=self.request.user)


class GameDetailView(RetrieveUpdateDestroyAPIView):
    serializer_class = GameSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return Game.objects.select_related("team", "created_by")

    def get_object(self):
        game = super().get_object()
        if not can_view_team(self.request.user, game.team):
            raise PermissionDenied("You do not have access to this game.")
        return game

    def perform_update(self, serializer):
        game = self.get_object()
        if not can_manage_team(self.request.user, game.team):
            raise PermissionDenied("You do not have permission to edit this game.")
        serializer.save()

    def perform_destroy(self, instance):
        if not can_manage_team(self.request.user, instance.team):
            raise PermissionDenied("You do not have permission to delete this game.")
        instance.cancel()
