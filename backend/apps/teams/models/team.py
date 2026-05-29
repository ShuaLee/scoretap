from django.conf import settings
from django.db import models


class Team(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="owned_teams",
    )
    name = models.CharField(max_length=150)
    notes = models.TextField(blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name", "id"]
        indexes = [
            models.Index(fields=["owner", "archived_at", "name"]),
            models.Index(fields=["archived_at", "name"]),
        ]

    def __str__(self):
        return self.name

    @property
    def is_archived(self):
        return self.archived_at is not None
