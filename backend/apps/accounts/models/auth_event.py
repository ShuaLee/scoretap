
from django.conf import settings
from django.db import models


class AuthEvent(models.Model):
    class EventType(models.TextChoices):
        REGISTERED = "registered", "Registered"
        LOGIN_SUCCEEDED = "login_succeeded", "Login Succeeded"
        LOGIN_FAILED = "login_failed", "Login Failed"
        ACCOUNT_LOCKED = "account_locked", "Account Locked"
        LOGOUT = "logout", "Logout"
        PASSWORD_CHANGED = "password_changed", "Password Changed"
        PASSWORD_RESET_REQUESTED = "password_reset_requested", "Password Reset Requested"
        PASSWORD_RESET_COMPLETED = "password_reset_completed", "Password Reset Completed"
        EMAIL_VERIFICATION_SENT = "email_verification_sent", "Email Verification Sent"
        EMAIL_VERIFIED = "email_verified", "Email Verified"
        EMAIL_CHANGE_REQUESTED = "email_change_requested", "Email Change Requested"
        EMAIL_CHANGED = "email_changed", "Email Changed"
        ACCOUNT_RECOVERY_REQUESTED = (
            "account_recovery_requested",
            "Account Recovery Requested",
        )
        ACCOUNT_RECOVERY_APPROVED = (
            "account_recovery_approved",
            "Account Recovery Approved",
        )
        ACCOUNT_RECOVERY_REJECTED = (
            "account_recovery_rejected",
            "Account Recovery Rejected",
        )
        ACCOUNT_DEACTIVATED = "account_deactivated", "Account Deactivated"
        ACCOUNT_DELETED = "account_deleted", "Account Deleted"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="auth_events",
        null=True,
        blank=True,
    )
    event_type = models.CharField(max_length=60, choices=EventType.choices)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "event_type", "created_at"]),
            models.Index(fields=["event_type", "created_at"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        user_identifier = self.user.email if self.user_id else "anonymous"
        return f"{user_identifier}:{self.event_type}:{self.created_at}"
