from django.conf import settings
from django.db import models
from django.utils import timezone


class Game(models.Model):
    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Scheduled"
        ACTIVE = "active", "Active"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    team = models.ForeignKey(
        "teams.Team",
        on_delete=models.PROTECT,
        related_name="games",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_games",
    )
    opponent_name = models.CharField(max_length=150)
    game_date = models.DateField()
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
            models.Index(fields=["team", "status", "game_date"]),
            models.Index(fields=["game_date", "status"]),
            models.Index(fields=["created_by", "created_at"]),
        ]

    def __str__(self):
        return f"{self.team} vs. {self.opponent_name} on {self.game_date}"

    @property
    def matchup_label(self):
        return f"vs. {self.opponent_name}"

    @property
    def is_scheduled(self):
        return self.status == self.Status.SCHEDULED

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
