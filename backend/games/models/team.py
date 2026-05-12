from django.db import models

class GameTeam(models.Model):
    class Side(models.TextChoices):
        HOME = "home", "Home"
        AWAY = "away", "Away"

    class BattingOrderMode(models.TextChoices):
        MANUAL = "manual", "Manual"
        RANDOM = "random", "Random"
        RULE_BASED = "rule_based", "Rule Based"

    game = models.ForeignKey(
        "games.Game",
        related_name="teams",
        on_delete=models.CASCADE,
    )

    side = models.CharField(
        max_length=10,
        choices=Side.choices,
    )

    name = models.CharField(max_length=120)

    batting_order_mode = models.CharField(
        max_length=20,
        choices=BattingOrderMode.choices,
        default=BattingOrderMode.MANUAL,
    )

    lineup_rule_config = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["game", "side"],
                name="unique_team_side_per_game",
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.side})"