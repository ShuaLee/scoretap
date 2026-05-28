from django.conf import settings
from django.db import models
from django.db.models import Q


class TeamPlayer(models.Model):
    team = models.ForeignKey(
        "teams.Team",
        on_delete=models.CASCADE,
        related_name="players",
    )
    linked_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="team_player_profiles",
        null=True,
        blank=True,
    )
    display_name = models.CharField(max_length=150)
    jersey_number = models.CharField(max_length=10, blank=True)
    is_active = models.BooleanField(default=True)
    joined_at = models.DateTimeField(null=True, blank=True)
    removed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_active", "display_name", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["team", "linked_user"],
                condition=Q(linked_user__isnull=False, is_active=True),
                name="unique_active_team_linked_user",
            )
        ]
        indexes = [
            models.Index(fields=["team", "is_active", "display_name"]),
            models.Index(fields=["linked_user", "is_active"]),
        ]

    def __str__(self):
        return f"{self.display_name} ({self.team})"

    @property
    def is_assigned(self):
        return self.linked_user_id is not None
