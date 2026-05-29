from django.db import IntegrityError
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import IsAuthenticated

from apps.games.models import Game, GamePlayer, GameTeam
from apps.games.permissions import can_manage_game, can_view_game
from apps.games.serializers import GamePlayerSerializer, GameTeamSerializer
from apps.teams.permissions import can_view_team


class GameSetupMixin:
    def get_game(self):
        game = get_object_or_404(
            Game.objects.select_related("team", "created_by"),
            pk=self.kwargs["game_id"],
        )
        if not can_view_game(self.request.user, game):
            raise PermissionDenied("You do not have access to this game.")
        return game

    def assert_can_manage_game(self, game):
        if not can_manage_game(self.request.user, game):
            raise PermissionDenied("You do not have permission to configure this game.")

    def validate_linked_team_access(self, linked_team):
        if linked_team is not None and not can_view_team(self.request.user, linked_team):
            raise ValidationError("You do not have access to that linked team.")

    def validate_linked_team_player_access(self, linked_team_player):
        if (
            linked_team_player is not None
            and not can_view_team(self.request.user, linked_team_player.team)
        ):
            raise ValidationError("You do not have access to that linked team player.")


class GameTeamListCreateView(GameSetupMixin, ListCreateAPIView):
    serializer_class = GameTeamSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        game = self.get_game()
        return GameTeam.objects.filter(game=game).select_related("game", "linked_team")

    def perform_create(self, serializer):
        game = self.get_game()
        self.assert_can_manage_game(game)
        self.validate_linked_team_access(serializer.validated_data.get("linked_team"))
        try:
            serializer.save(game=game)
        except IntegrityError as exc:
            raise ValidationError("This game already has a team for that side.") from exc


class GameTeamDetailView(GameSetupMixin, RetrieveUpdateDestroyAPIView):
    serializer_class = GameTeamSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_queryset(self):
        game = self.get_game()
        return GameTeam.objects.filter(game=game).select_related("game", "linked_team")

    def perform_update(self, serializer):
        game = self.get_game()
        self.assert_can_manage_game(game)
        self.validate_linked_team_access(serializer.validated_data.get("linked_team"))
        try:
            serializer.save()
        except IntegrityError as exc:
            raise ValidationError("This game already has a team for that side.") from exc

    def perform_destroy(self, instance):
        self.assert_can_manage_game(instance.game)
        instance.delete()


class GamePlayerListCreateView(GameSetupMixin, ListCreateAPIView):
    serializer_class = GamePlayerSerializer
    permission_classes = [IsAuthenticated]

    def get_game_team(self):
        game = self.get_game()
        return get_object_or_404(GameTeam.objects.filter(game=game), pk=self.kwargs["game_team_id"])

    def get_queryset(self):
        game_team = self.get_game_team()
        include_removed = self.request.query_params.get("include_removed") == "true"
        queryset = GamePlayer.objects.filter(game_team=game_team).select_related(
            "game_team",
            "linked_team_player",
        )
        if not include_removed:
            queryset = queryset.filter(is_active=True)
        return queryset

    def perform_create(self, serializer):
        game_team = self.get_game_team()
        self.assert_can_manage_game(game_team.game)
        self.validate_linked_team_player_access(
            serializer.validated_data.get("linked_team_player")
        )
        try:
            serializer.save(game_team=game_team)
        except IntegrityError as exc:
            raise ValidationError("This batting order slot is already used.") from exc


class GamePlayerDetailView(GameSetupMixin, RetrieveUpdateDestroyAPIView):
    serializer_class = GamePlayerSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_game_team(self):
        game = self.get_game()
        return get_object_or_404(GameTeam.objects.filter(game=game), pk=self.kwargs["game_team_id"])

    def get_queryset(self):
        game_team = self.get_game_team()
        return GamePlayer.objects.filter(game_team=game_team).select_related(
            "game_team",
            "linked_team_player",
        )

    def perform_update(self, serializer):
        game_team = self.get_game_team()
        self.assert_can_manage_game(game_team.game)
        self.validate_linked_team_player_access(
            serializer.validated_data.get("linked_team_player")
        )
        try:
            serializer.save()
        except IntegrityError as exc:
            raise ValidationError("This batting order slot is already used.") from exc

    def perform_destroy(self, instance):
        self.assert_can_manage_game(instance.game_team.game)
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])
