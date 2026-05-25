
from django.conf import settings
from django.db import models
from django.utils import timezone


class TrustedDeviceToken(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="trusted_device_tokens",
    )
    token_hash = models.CharField(max_length=128, unique=True)
    name = models.CharField(max_length=150, blank=True)
    user_agent = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    expires_at = models.DateTimeField()
    last_used_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "expires_at"]),
            models.Index(fields=["user", "revoked_at", "expires_at"]),
            models.Index(fields=["expires_at"]),
        ]

    def __str__(self):
        device_name = self.name or "trusted device"
        return f"{self.user.email}:{device_name}:{self.created_at}"

    @property
    def is_revoked(self):
        return self.revoked_at is not None

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

    @property
    def is_valid(self):
        return not self.is_revoked and not self.is_expired
