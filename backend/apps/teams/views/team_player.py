from django.db import IntegrityError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import IsAuthenticated

from apps.teams.models import Team, TeamPlayer
from apps.teams.permissions import can_manage_team, can_view_team
from apps.teams.serializers import TeamPlayerSerializer


class TeamPlayerMixin:
    def get_team(self):
        team = get_object_or_404(Team, pk=self.kwargs["team_id"])
        if not can_view_team(self.request.user, team):
            raise PermissionDenied("You do not have access to this team.")
        return team

    def assert_can_manage_team(self, team):
        if not can_manage_team(self.request.user, team):
            raise PermissionDenied("You do not have permission to manage this roster.")


class TeamPlayerListCreateView(TeamPlayerMixin, ListCreateAPIView):
    serializer_class = TeamPlayerSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        team = self.get_team()
        include_removed = self.request.query_params.get("include_removed") == "true"
        queryset = TeamPlayer.objects.filter(team=team).select_related("team", "linked_user")
        if not include_removed:
            queryset = queryset.filter(is_active=True)
        return queryset

    def perform_create(self, serializer):
        team = self.get_team()
        self.assert_can_manage_team(team)
        try:
            serializer.save(team=team, joined_at=timezone.now())
        except IntegrityError as exc:
            raise ValidationError("This user is already assigned to an active player on this team.") from exc


class TeamPlayerDetailView(TeamPlayerMixin, RetrieveUpdateDestroyAPIView):
    serializer_class = TeamPlayerSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_queryset(self):
        team = self.get_team()
        return TeamPlayer.objects.filter(team=team).select_related("team", "linked_user")

    def perform_update(self, serializer):
        team = self.get_team()
        self.assert_can_manage_team(team)
        try:
            serializer.save()
        except IntegrityError as exc:
            raise ValidationError("This user is already assigned to an active player on this team.") from exc

    def perform_destroy(self, instance):
        self.assert_can_manage_team(instance.team)
        instance.is_active = False
        instance.removed_at = timezone.now()
        instance.save(update_fields=["is_active", "removed_at", "updated_at"])
