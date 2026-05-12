from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

class Game(models.Model):
    class Status(models.TextChoices):
        SETUP = "setup", "Setup"
        LIVE = "live", "Live"
        FINAL = "final", "Final"

    class HalfInning(models.TextChoices):
        TOP = "top", "Top"
        BOTTOM = "bottom", "Bottom"

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SETUP,
    )

    scheduled_innings = models.PositiveIntegerField(
        default=7,
        validators=[
            MinValueValidator(1),
            MaxValueValidator(20),
        ],
    )

    inning = models.PositiveSmallIntegerField(default=1)

    half_inning = models.CharField(
        max_length=10,
        choices=HalfInning.choices,
        default=HalfInning.TOP,
    )

    outs = models.PositiveSmallIntegerField(default=0)

    home_score = models.PositiveIntegerField(default=0)
    away_score = models.PositiveIntegerField(default=0)

    current_home_batter_index = models.PositiveIntegerField(default=0)
    current_away_batter_index = models.PositiveIntegerField(default=0)

    runner_on_first = models.ForeignKey(
        "games.GamePlayer",
        null=True,
        blank=True,
        related_name="games_as_runner_on_first",
        on_delete=models.SET_NULL,
    )

    runner_on_second = models.ForeignKey(
        "games.GamePlayer",
        null=True,
        blank=True,
        related_name="games_as_runner_on_second",
        on_delete=models.SET_NULL,
    )

    runner_on_third = models.ForeignKey(
        "games.GamePlayer",
        null=True,
        blank=True,
        related_name="games_as_runner_on_third",
        on_delete=models.SET_NULL,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def batting_side(self):
        if self.half_inning == self.HalfInning.TOP:
            return "away"

        return "home"

    def __str__(self):
        return f"Game #{self.id}"