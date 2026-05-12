from django.db import models

class GamePlayer(models.Model):
    class BattingCategory(models.TextChoices):
        UNSPECIFIED = "unspecified", "Unspecified"
        MALE = "male", "Male"
        FEMALE = "female", "Female"
        OTHER = "other", "Other"

    game_team = models.ForeignKey(
        "games.GameTeam",
        related_name="players",
        on_delete=models.CASCADE,
    )

    name = models.CharField(max_length=120)

    batting_category = models.CharField(
        max_length=20,
        choices=BattingCategory.choices,
        default=BattingCategory.UNSPECIFIED,
    )

    lineup_position = models.PositiveIntegerField(
        null=True,
        blank=True,
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["lineup_position", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["game_team", "lineup_position"],
                name="unique_lineup_position_per_team",
            )
        ]

    def __str__(self):
        return self.name