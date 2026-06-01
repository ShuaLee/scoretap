from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


class Game(models.Model):
    class GameType(models.TextChoices):
        QUICK = "quick", "Quick Game"
        TEAM = "team", "Team Game"
        LEAGUE = "league", "League Game"

    class TrackingMode(models.TextChoices):
        OWN_TEAM = "own_team", "Own Team"
        BOTH_TEAMS = "both_teams", "Both Teams"

    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Scheduled"
        ACTIVE = "active", "Active"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    team = models.ForeignKey(
        "teams.Team",
        on_delete=models.PROTECT,
        related_name="games",
        null=True,
        blank=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_games",
    )
    game_type = models.CharField(
        max_length=20,
        choices=GameType.choices,
        default=GameType.QUICK,
    )
    tracking_mode = models.CharField(
        max_length=20,
        choices=TrackingMode.choices,
        default=TrackingMode.OWN_TEAM,
    )
    opponent_name = models.CharField(max_length=150)
    number_of_innings = models.PositiveSmallIntegerField(
        default=7,
        validators=[MinValueValidator(1), MaxValueValidator(20)],
    )
    game_date = models.DateField(default=timezone.localdate)
    start_time = models.TimeField(null=True, blank=True)
    location = models.CharField(max_length=150, blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SCHEDULED,
    )
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["game_date", "start_time", "id"]
        indexes = [
            models.Index(fields=["team", "status", "game_date"], name="game_team_status_date_idx"),
            models.Index(fields=["game_type", "status", "game_date"], name="game_type_status_date_idx"),
            models.Index(fields=["game_date", "status"], name="game_date_status_idx"),
            models.Index(fields=["created_by", "created_at"], name="game_creator_created_idx"),
        ]

    def __str__(self):
        if self.team_id:
            return f"{self.team} vs. {self.opponent_name} on {self.game_date}"
        return f"Quick game vs. {self.opponent_name} on {self.game_date}"

    @property
    def matchup_label(self):
        return f"vs. {self.opponent_name}"

    @property
    def is_quick_game(self):
        return self.game_type == self.GameType.QUICK

    @property
    def is_team_game(self):
        return self.game_type == self.GameType.TEAM

    @property
    def tracks_both_teams(self):
        return self.tracking_mode == self.TrackingMode.BOTH_TEAMS

    @property
    def is_scheduled(self):
        return self.status == self.Status.SCHEDULED

    def clean(self):
        super().clean()
        if self.game_type == self.GameType.TEAM and self.team_id is None:
            raise ValidationError({"team": "Team games must be linked to a team."})
        if self.game_type == self.GameType.QUICK and self.team_id is not None:
            raise ValidationError({"team": "Quick games cannot be linked to a team."})

    def start(self):
        if self.status != self.Status.SCHEDULED:
            return
        self.status = self.Status.ACTIVE
        self.started_at = timezone.now()
        self.save(update_fields=["status", "started_at", "updated_at"])

    def cancel(self):
        if self.status == self.Status.CANCELLED:
            return
        self.status = self.Status.CANCELLED
        self.cancelled_at = timezone.now()
        self.save(update_fields=["status", "cancelled_at", "updated_at"])
