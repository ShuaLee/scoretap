from datetime import timedelta

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import AuthEvent, EmailVerificationToken, User
from apps.accounts.services.auth_event_service import AuthEventService
from apps.accounts.services.email_verification_service import EmailVerificationService


class AuthService:
    @staticmethod
    @transaction.atomic
    def register_user(
        *,
        email: str,
        password: str,
        display_name: str = "",
        timezone_name: str = "UTC",
        locale: str = "en-US",
        request=None,
    ):
        normalized_email = User.objects.normalize_email(email)
        if User.objects.filter(email__iexact=normalized_email, deleted_at__isnull=True).exists():
            raise ValidationError("Email is already registered.")

        validate_password(password)
        user = User.objects.create_user(email=normalized_email, password=password)
        profile = user.profile
        profile.display_name = display_name
        profile.timezone = timezone_name
        profile.locale = locale
        profile.save(update_fields=["display_name", "timezone", "locale", "updated_at"])

        code, _ = EmailVerificationService.issue_code(user=user)
        EmailVerificationService.send_verification_email(user=user, code=code)
        AuthEventService.log_event(
            user=user,
            event_type=AuthEvent.EventType.REGISTERED,
            ip_address=AuthService.client_ip(request=request),
            user_agent=AuthService.user_agent(request=request),
        )
        AuthEventService.log_event(
            user=user,
            event_type=AuthEvent.EventType.EMAIL_VERIFICATION_SENT,
            ip_address=AuthService.client_ip(request=request),
            user_agent=AuthService.user_agent(request=request),
        )
        return user

    @staticmethod
    def login_user(*, email: str, password: str, request=None):
        user = AuthService.authenticate_user(email=email, password=password, request=request)
        refresh = RefreshToken.for_user(user)
        access = refresh.access_token

        user.last_login_ip = AuthService.client_ip(request=request)
        user.save(update_fields=["last_login_ip"])
        AuthEventService.log_event(
            user=user,
            event_type=AuthEvent.EventType.LOGIN_SUCCEEDED,
            ip_address=AuthService.client_ip(request=request),
            user_agent=AuthService.user_agent(request=request),
        )
        return user, access, refresh

    @staticmethod
    def authenticate_user(*, email: str, password: str, request=None):
        normalized_email = User.objects.normalize_email(email)
        user = User.objects.filter(
            email__iexact=normalized_email,
            deleted_at__isnull=True,
        ).first()
        if user is None:
            raise ValidationError("Invalid credentials.")

        if user.is_locked:
            raise ValidationError("Account is temporarily locked.")

        if not user.check_password(password):
            AuthService.record_failed_login(user=user, request=request)
            raise ValidationError("Invalid credentials.")

        if not user.is_active:
            raise ValidationError("Invalid credentials.")

        if AuthService.require_email_verification() and not user.is_email_verified:
            raise ValidationError("Please verify your email first.")

        if user.failed_login_count or user.locked_until:
            user.failed_login_count = 0
            user.locked_until = None
            user.save(update_fields=["failed_login_count", "locked_until"])
        return user

    @staticmethod
    def record_failed_login(*, user, request=None):
        user.failed_login_count += 1
        update_fields = ["failed_login_count"]
        if user.failed_login_count >= AuthService.max_failed_login_attempts():
            user.failed_login_count = 0
            user.locked_until = timezone.now() + timedelta(
                minutes=AuthService.lockout_minutes(),
            )
            update_fields.append("locked_until")
            AuthEventService.log_event(
                user=user,
                event_type=AuthEvent.EventType.ACCOUNT_LOCKED,
                ip_address=AuthService.client_ip(request=request),
                user_agent=AuthService.user_agent(request=request),
            )
        user.save(update_fields=update_fields)
        AuthEventService.log_event(
            user=user,
            event_type=AuthEvent.EventType.LOGIN_FAILED,
            ip_address=AuthService.client_ip(request=request),
            user_agent=AuthService.user_agent(request=request),
        )

    @staticmethod
    def logout_user(*, user, refresh_token=None, request=None):
        if refresh_token:
            try:
                RefreshToken(refresh_token).blacklist()
            except Exception:
                pass
        AuthEventService.log_event(
            user=user if getattr(user, "is_authenticated", False) else None,
            event_type=AuthEvent.EventType.LOGOUT,
            ip_address=AuthService.client_ip(request=request),
            user_agent=AuthService.user_agent(request=request),
        )

    @staticmethod
    def verify_email(*, email: str, code: str, request=None):
        user = EmailVerificationService.verify_email_code(email=email, code=code)
        AuthEventService.log_event(
            user=user,
            event_type=AuthEvent.EventType.EMAIL_VERIFIED,
            ip_address=AuthService.client_ip(request=request),
            user_agent=AuthService.user_agent(request=request),
        )
        return user

    @staticmethod
    def resend_verification(*, email: str, request=None):
        user = User.objects.filter(
            email__iexact=User.objects.normalize_email(email),
            deleted_at__isnull=True,
        ).first()
        if user and not user.is_email_verified:
            code, _ = EmailVerificationService.issue_code(user=user)
            EmailVerificationService.send_verification_email(user=user, code=code)
            AuthEventService.log_event(
                user=user,
                event_type=AuthEvent.EventType.EMAIL_VERIFICATION_SENT,
                ip_address=AuthService.client_ip(request=request),
                user_agent=AuthService.user_agent(request=request),
            )

    @staticmethod
    def change_password(*, user, current_password: str, new_password: str, request=None):
        if not user.check_password(current_password):
            raise ValidationError("Current password is incorrect.")
        validate_password(new_password, user=user)
        user.set_password(new_password)
        user.password_changed_at = timezone.now()
        user.save(update_fields=["password", "password_changed_at"])
        AuthEventService.log_event(
            user=user,
            event_type=AuthEvent.EventType.PASSWORD_CHANGED,
            ip_address=AuthService.client_ip(request=request),
            user_agent=AuthService.user_agent(request=request),
        )
        return user

    @staticmethod
    def request_email_change(*, user, new_email: str, current_password: str, request=None):
        if not user.check_password(current_password):
            raise ValidationError("Current password is incorrect.")

        normalized_email = User.objects.normalize_email(new_email)
        if User.objects.filter(
            email__iexact=normalized_email,
            deleted_at__isnull=True,
        ).exclude(pk=user.pk).exists():
            raise ValidationError("Email is already registered.")

        code, _ = EmailVerificationService.issue_code(
            user=user,
            purpose=EmailVerificationToken.Purpose.EMAIL_CHANGE,
            target_email=normalized_email,
        )
        EmailVerificationService.send_verification_email(
            user=user,
            code=code,
            target_email=normalized_email,
        )
        AuthEventService.log_event(
            user=user,
            event_type=AuthEvent.EventType.EMAIL_CHANGE_REQUESTED,
            ip_address=AuthService.client_ip(request=request),
            user_agent=AuthService.user_agent(request=request),
            metadata={"target_email": normalized_email},
        )
        return normalized_email

    @staticmethod
    def confirm_email_change(*, user, new_email: str, code: str, request=None):
        changed_user = EmailVerificationService.verify_email_change_code(
            user=user,
            new_email=new_email,
            code=code,
        )
        AuthEventService.log_event(
            user=user,
            event_type=AuthEvent.EventType.EMAIL_CHANGED,
            ip_address=AuthService.client_ip(request=request),
            user_agent=AuthService.user_agent(request=request),
            metadata={"new_email": changed_user.email},
        )
        return changed_user

    @staticmethod
    @transaction.atomic
    def delete_account(*, user, current_password: str, request=None):
        if not user.check_password(current_password):
            raise ValidationError("Current password is incorrect.")
        now = timezone.now()
        user.is_active = False
        user.deleted_at = now
        user.deactivated_at = now
        user.save(update_fields=["is_active", "deleted_at", "deactivated_at"])
        AuthEventService.log_event(
            user=user,
            event_type=AuthEvent.EventType.ACCOUNT_DELETED,
            ip_address=AuthService.client_ip(request=request),
            user_agent=AuthService.user_agent(request=request),
        )
        return user.email

    @staticmethod
    def client_ip(*, request):
        if request is None:
            return None
        forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR")

    @staticmethod
    def user_agent(*, request):
        if request is None:
            return ""
        return request.META.get("HTTP_USER_AGENT", "")

    @staticmethod
    def max_failed_login_attempts():
        return getattr(settings, "AUTH_MAX_FAILED_LOGIN_ATTEMPTS", 5)

    @staticmethod
    def lockout_minutes():
        return getattr(settings, "AUTH_LOCKOUT_MINUTES", 15)

    @staticmethod
    def require_email_verification():
        return getattr(settings, "AUTH_REQUIRE_EMAIL_VERIFICATION", True)
