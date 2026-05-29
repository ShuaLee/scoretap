from django.db import models
from django.db.models import Q


class GamePlayer(models.Model):
    game_team = models.ForeignKey(
        "games.GameTeam",
        on_delete=models.CASCADE,
        related_name="players",
    )
    linked_team_player = models.ForeignKey(
        "teams.TeamPlayer",
        on_delete=models.SET_NULL,
        related_name="game_player_snapshots",
        null=True,
        blank=True,
    )
    display_name = models.CharField(max_length=150)
    batting_order = models.PositiveSmallIntegerField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["game_team_id", "batting_order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["game_team", "batting_order"],
                condition=Q(is_active=True),
                name="uniq_active_game_order",
            )
        ]
        indexes = [
            models.Index(fields=["game_team", "is_active", "batting_order"]),
            models.Index(fields=["linked_team_player", "created_at"]),
        ]

    def __str__(self):
        return f"{self.display_name} #{self.batting_order}"
