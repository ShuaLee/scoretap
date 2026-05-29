from django.db import models


class GameTeam(models.Model):
    class Side(models.TextChoices):
        HOME = "home", "Home"
        AWAY = "away", "Away"

    game = models.ForeignKey(
        "games.Game",
        on_delete=models.CASCADE,
        related_name="game_teams",
    )
    side = models.CharField(max_length=10, choices=Side.choices)
    linked_team = models.ForeignKey(
        "teams.Team",
        on_delete=models.SET_NULL,
        related_name="game_team_snapshots",
        null=True,
        blank=True,
    )
    display_name = models.CharField(max_length=150)
    is_tracked = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["game_id", "side", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["game", "side"],
                name="unique_game_side",
            )
        ]
        indexes = [
            models.Index(fields=["game", "side"]),
            models.Index(fields=["linked_team", "created_at"]),
        ]

    def __str__(self):
        return f"{self.display_name} ({self.side})"
