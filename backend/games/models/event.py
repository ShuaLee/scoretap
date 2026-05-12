from django.db import models


class GameEvent(models.Model):
    class EventType(models.TextChoices):
        GAME_STARTED = "game_started", "Game Started"
        PLATE_APPEARANCE = "plate_appearance", "Plate Appearance"
        SCORE_REVISION = "score_revision", "Score Revision"
        INNING_LIMIT_REVISION = "inning_limit_revision", "Inning Limit Revision"
        RUNNER_REVISION = "runner_revision", "Runner Revision"
        GAME_FINALIZED = "game_finalized", "Game Finalized"

    class PlateAppearanceResult(models.TextChoices):
        SINGLE = "single", "Single"
        DOUBLE = "double", "Double"
        TRIPLE = "triple", "Triple"
        HOME_RUN = "home_run", "Home Run"
        WALK = "walk", "Walk"
        STRIKEOUT = "strikeout", "Strikeout"
        GROUND_OUT = "ground_out", "Ground Out"
        FLY_OUT = "fly_out", "Fly Out"
        ERROR = "error", "Error"
        FIELDERS_CHOICE = "fielders_choice", "Fielder's Choice"

    game = models.ForeignKey(
        "games.Game",
        related_name="events",
        on_delete=models.CASCADE,
    )

    team = models.ForeignKey(
        "games.GameTeam",
        related_name="events",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )

    batter = models.ForeignKey(
        "games.GamePlayer",
        related_name="events_as_batter",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )

    sequence_number = models.PositiveIntegerField()

    event_type = models.CharField(
        max_length=40,
        choices=EventType.choices,
    )

    plate_appearance_result = models.CharField(
        max_length=40,
        choices=PlateAppearanceResult.choices,
        null=True,
        blank=True,
    )

    inning = models.PositiveSmallIntegerField()
    half_inning = models.CharField(max_length=10)

    outs_before = models.PositiveSmallIntegerField()
    outs_after = models.PositiveSmallIntegerField()

    runs_scored = models.PositiveSmallIntegerField(default=0)

    payload = models.JSONField(default=dict, blank=True)

    state_before = models.JSONField(default=dict)
    state_after = models.JSONField(default=dict)

    is_undone = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sequence_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["game", "sequence_number"],
                name="unique_game_event_sequence_per_game",
            )
        ]

    def __str__(self):
        return f"Game {self.game_id} Event #{self.sequence_number}: {self.event_type}"
