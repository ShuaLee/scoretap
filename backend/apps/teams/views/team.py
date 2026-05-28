from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import IsAuthenticated

from apps.teams.models import Team
from apps.teams.permissions import can_manage_team, can_view_team
from apps.teams.serializers import TeamSerializer


class TeamListCreateView(ListCreateAPIView):
    serializer_class = TeamSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return (
            Team.objects.filter(
                Q(owner=user)
                | Q(players__linked_user=user, players__is_active=True),
                archived_at__isnull=True,
            )
            .annotate(active_player_count=Count("players", filter=Q(players__is_active=True)))
            .distinct()
            .select_related("owner")
        )

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class TeamDetailView(RetrieveUpdateDestroyAPIView):
    serializer_class = TeamSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return (
            Team.objects.all()
            .annotate(active_player_count=Count("players", filter=Q(players__is_active=True)))
            .select_related("owner")
        )

    def get_object(self):
        team = super().get_object()
        if not can_view_team(self.request.user, team):
            raise PermissionDenied("You do not have access to this team.")
        return team

    def perform_update(self, serializer):
        if not can_manage_team(self.request.user, self.get_object()):
            raise PermissionDenied("You do not have permission to manage this team.")
        serializer.save()

    def perform_destroy(self, instance):
        if not can_manage_team(self.request.user, instance):
            raise PermissionDenied("You do not have permission to manage this team.")
        instance.archived_at = timezone.now()
        instance.save(update_fields=["archived_at", "updated_at"])
