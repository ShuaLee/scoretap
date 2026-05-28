import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.utils import timezone

from apps.accounts.models import EmailVerificationToken, User


class EmailVerificationService:
    CODE_LENGTH = 6
    CODE_TTL_MINUTES = getattr(settings, "AUTH_EMAIL_VERIFICATION_TTL_MINUTES", 10)
    RESEND_COOLDOWN_SECONDS = getattr(
        settings,
        "AUTH_RESEND_VERIFICATION_COOLDOWN_SECONDS",
        60,
    )
    VERIFY_MAX_ATTEMPTS = getattr(settings, "AUTH_VERIFY_EMAIL_MAX_ATTEMPTS", 10)
    VERIFY_ATTEMPT_WINDOW_SECONDS = getattr(
        settings,
        "AUTH_VERIFY_EMAIL_ATTEMPT_WINDOW_SECONDS",
        600,
    )

    @staticmethod
    def issue_code(*, user, purpose=None, target_email: str = ""):
        purpose = purpose or EmailVerificationToken.Purpose.VERIFY_EMAIL
        cutoff = timezone.now() - timedelta(
            seconds=EmailVerificationService.RESEND_COOLDOWN_SECONDS,
        )
        recent = EmailVerificationToken.objects.filter(
            user=user,
            purpose=purpose,
            consumed_at__isnull=True,
            created_at__gte=cutoff,
        ).exists()
        if recent:
            raise ValidationError("Please wait before requesting another code.")

        EmailVerificationToken.objects.filter(
            user=user,
            purpose=purpose,
            consumed_at__isnull=True,
        ).update(consumed_at=timezone.now())

        code = EmailVerificationService._generate_code()
        token = EmailVerificationToken.objects.create(
            user=user,
            purpose=purpose,
            target_email=target_email,
            token_hash=EmailVerificationService._hash_code(code),
            expires_at=timezone.now()
            + timedelta(minutes=EmailVerificationService.CODE_TTL_MINUTES),
        )
        return code, token

    @staticmethod
    def send_verification_email(*, user, code: str, target_email: str | None = None):
        recipient = target_email or user.email
        send_mail(
            subject="Your Scoretap verification code",
            message=(
                "Use this code to verify your Scoretap account:\n\n"
                f"{code}\n\n"
                f"This code expires in {EmailVerificationService.CODE_TTL_MINUTES} minutes."
            ),
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@scoretap.local"),
            recipient_list=[recipient],
            fail_silently=False,
        )

    @staticmethod
    def verify_email_code(*, email: str, code: str):
        normalized_email = User.objects.normalize_email(email)
        EmailVerificationService._assert_not_rate_limited(email=normalized_email)

        user = User.objects.filter(
            email__iexact=normalized_email,
            deleted_at__isnull=True,
        ).first()
        if user is None:
            EmailVerificationService._record_failed_attempt(email=normalized_email)
            raise ValidationError("Invalid verification code.")

        token = EmailVerificationService._find_matching_token(
            user=user,
            code=code,
            purpose=EmailVerificationToken.Purpose.VERIFY_EMAIL,
        )
        if token is None:
            EmailVerificationService._record_failed_attempt(email=normalized_email)
            raise ValidationError("Invalid verification code.")

        now = timezone.now()
        user.email_verified_at = now
        user.save(update_fields=["email_verified_at"])
        token.consumed_at = now
        token.save(update_fields=["consumed_at"])
        EmailVerificationService._clear_failed_attempts(email=normalized_email)
        return user

    @staticmethod
    def verify_email_change_code(*, user, new_email: str, code: str):
        normalized_email = User.objects.normalize_email(new_email)
        token = EmailVerificationService._find_matching_token(
            user=user,
            code=code,
            purpose=EmailVerificationToken.Purpose.EMAIL_CHANGE,
            target_email=normalized_email,
        )
        if token is None:
            raise ValidationError("Invalid verification code.")

        now = timezone.now()
        user.email = normalized_email
        user.email_verified_at = now
        user.email_changed_at = now
        user.save(update_fields=["email", "email_verified_at", "email_changed_at"])
        token.consumed_at = now
        token.save(update_fields=["consumed_at"])
        return user

    @staticmethod
    def _find_matching_token(*, user, code: str, purpose, target_email: str = ""):
        tokens = EmailVerificationToken.objects.filter(
            user=user,
            purpose=purpose,
            consumed_at__isnull=True,
            target_email=target_email,
        ).order_by("-created_at")

        for token in tokens:
            if token.is_expired:
                continue
            if EmailVerificationService._is_code_match(code=code, stored_hash=token.token_hash):
                return token
        return None

    @staticmethod
    def _generate_code() -> str:
        upper_bound = 10**EmailVerificationService.CODE_LENGTH
        return f"{secrets.randbelow(upper_bound):0{EmailVerificationService.CODE_LENGTH}d}"

    @staticmethod
    def _hash_code(code: str) -> str:
        salt = secrets.token_hex(8)
        digest = hashlib.sha256(f"{salt}:{code}".encode("utf-8")).hexdigest()
        return f"{salt}${digest}"

    @staticmethod
    def _is_code_match(*, code: str, stored_hash: str) -> bool:
        salt, _, digest = stored_hash.partition("$")
        if not salt or not digest:
            return False
        expected = hashlib.sha256(f"{salt}:{code}".encode("utf-8")).hexdigest()
        return secrets.compare_digest(digest, expected)

    @staticmethod
    def _attempt_cache_key(*, email: str) -> str:
        email_hash = hashlib.sha256(email.encode("utf-8")).hexdigest()
        return f"accounts:verify_email_attempts:{email_hash}"

    @staticmethod
    def _assert_not_rate_limited(*, email: str):
        attempts = cache.get(EmailVerificationService._attempt_cache_key(email=email), 0)
        if attempts >= EmailVerificationService.VERIFY_MAX_ATTEMPTS:
            raise ValidationError("Too many attempts. Please wait and try again.")

    @staticmethod
    def _record_failed_attempt(*, email: str):
        key = EmailVerificationService._attempt_cache_key(email=email)
        cache.set(
            key,
            cache.get(key, 0) + 1,
            timeout=EmailVerificationService.VERIFY_ATTEMPT_WINDOW_SECONDS,
        )

    @staticmethod
    def _clear_failed_attempts(*, email: str):
        cache.delete(EmailVerificationService._attempt_cache_key(email=email))
