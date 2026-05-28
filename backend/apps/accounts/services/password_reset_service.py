import hashlib
import secrets
from datetime import timedelta
from urllib.parse import quote

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.utils import timezone

from apps.accounts.models import PasswordResetToken


class PasswordResetService:
    TOKEN_TTL_HOURS = getattr(settings, "AUTH_PASSWORD_RESET_TTL_HOURS", 1)
    TOKEN_BYTES = getattr(settings, "AUTH_PASSWORD_RESET_TOKEN_BYTES", 32)
    RESEND_COOLDOWN_SECONDS = getattr(
        settings,
        "AUTH_PASSWORD_RESET_COOLDOWN_SECONDS",
        60,
    )

    @staticmethod
    def request_for_user(*, user):
        raw_token, _ = PasswordResetService.issue_token(user=user)
        PasswordResetService.send_reset_email(user=user, raw_token=raw_token)
        return True

    @staticmethod
    def issue_token(*, user):
        cutoff = timezone.now() - timedelta(
            seconds=PasswordResetService.RESEND_COOLDOWN_SECONDS,
        )
        recent = PasswordResetToken.objects.filter(
            user=user,
            consumed_at__isnull=True,
            created_at__gte=cutoff,
        ).exists()
        if recent:
            raise ValidationError("Please wait before requesting another reset email.")

        PasswordResetToken.objects.filter(
            user=user,
            consumed_at__isnull=True,
        ).update(consumed_at=timezone.now())

        raw_token = secrets.token_urlsafe(PasswordResetService.TOKEN_BYTES)
        token = PasswordResetToken.objects.create(
            user=user,
            token_hash=PasswordResetService._hash_token(raw_token),
            expires_at=timezone.now() + timedelta(hours=PasswordResetService.TOKEN_TTL_HOURS),
        )
        return raw_token, token

    @staticmethod
    def send_reset_email(*, user, raw_token: str):
        frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
        reset_url = f"{frontend_url}/reset-password?token={quote(raw_token, safe='')}"
        send_mail(
            subject="Reset your Scoretap password",
            message=(
                "Use this link to reset your Scoretap password:\n\n"
                f"{reset_url}\n\n"
                "This link expires soon."
            ),
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@scoretap.local"),
            recipient_list=[user.email],
            fail_silently=False,
        )

    @staticmethod
    def reset_with_token(*, raw_token: str, new_password: str):
        normalized_token = PasswordResetService._normalize_token(raw_token)
        if not normalized_token:
            raise ValidationError("Invalid password reset token.")

        token = PasswordResetToken.objects.select_related("user").filter(
            token_hash=PasswordResetService._hash_token(normalized_token),
        ).first()
        if token is None or token.is_consumed or token.is_expired:
            raise ValidationError("Invalid password reset token.")

        user = token.user
        validate_password(new_password, user=user)
        user.set_password(new_password)
        user.failed_login_count = 0
        user.locked_until = None
        user.password_changed_at = timezone.now()
        user.save(
            update_fields=[
                "password",
                "failed_login_count",
                "locked_until",
                "password_changed_at",
            ]
        )

        token.consumed_at = timezone.now()
        token.save(update_fields=["consumed_at"])
        return user

    @staticmethod
    def _hash_token(raw_token: str) -> str:
        return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    @staticmethod
    def _normalize_token(raw_token: str) -> str:
        return (raw_token or "").strip().replace("\r", "").replace("\n", "")
