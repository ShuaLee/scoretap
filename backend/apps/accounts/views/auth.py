from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import HttpResponse
from django.middleware.csrf import CsrfViewMiddleware, get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.auth import clear_auth_cookies, set_auth_cookies
from apps.accounts.models import AuthEvent, User
from apps.accounts.serializers import (
    ChangePasswordSerializer,
    DeleteAccountSerializer,
    EmailChangeConfirmSerializer,
    EmailChangeRequestSerializer,
    LoginSerializer,
    LogoutSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    ResendVerificationSerializer,
    UserSerializer,
    VerifyEmailSerializer,
)
from apps.accounts.services import AuthEventService, AuthService, PasswordResetService


class _CSRFCheck(CsrfViewMiddleware):
    def _reject(self, request, reason):
        return reason


def enforce_csrf(request):
    check = _CSRFCheck(lambda _request: HttpResponse())
    check.process_request(request)
    reason = check.process_view(request, None, (), {})
    if reason:
        raise ValidationError("CSRF token missing or incorrect.")


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfTokenView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({"csrfToken": get_token(request)})


class RegisterView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "auth_register"

    def post(self, request):
        enforce_csrf(request)
        serializer = RegisterSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            user = AuthService.register_user(
                email=data["email"],
                password=data["password"],
                display_name=data["display_name"],
                timezone_name=data.get("timezone") or "UTC",
                locale=data.get("locale") or "en-US",
                request=request,
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages) from exc

        refresh = RefreshToken.for_user(user)
        response = Response(
            {
                "detail": "Registration successful.",
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )
        return set_auth_cookies(response, refresh.access_token, refresh)


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "auth_login"

    def post(self, request):
        enforce_csrf(request)
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            user, access, refresh = AuthService.login_user(
                email=data["email"],
                password=data["password"],
                request=request,
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages) from exc

        response = Response(
            {"detail": "Login successful.", "user": UserSerializer(user).data},
            status=status.HTTP_200_OK,
        )
        return set_auth_cookies(response, access, refresh)


class RefreshSessionView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "auth_refresh"

    def post(self, request):
        enforce_csrf(request)
        refresh_cookie_name = settings.SIMPLE_JWT.get("AUTH_COOKIE_REFRESH", "refresh")
        refresh_token = request.COOKIES.get(refresh_cookie_name)
        if not refresh_token:
            raise AuthenticationFailed("Refresh token missing.")

        serializer = TokenRefreshSerializer(data={"refresh": refresh_token})
        serializer.is_valid(raise_exception=True)
        access_token = serializer.validated_data["access"]
        rotated_refresh_token = serializer.validated_data.get("refresh", refresh_token)

        response = Response({"detail": "Session refreshed."})
        return set_auth_cookies(response, access_token, rotated_refresh_token)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = LogoutSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        refresh_cookie_name = settings.SIMPLE_JWT.get("AUTH_COOKIE_REFRESH", "refresh")
        refresh_token = serializer.validated_data.get("refresh") or request.COOKIES.get(
            refresh_cookie_name,
        )
        AuthService.logout_user(user=request.user, refresh_token=refresh_token, request=request)
        response = Response({"detail": "Logout successful."})
        return clear_auth_cookies(response)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"user": UserSerializer(request.user).data})


class VerifyEmailView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "auth_verify_email"

    def post(self, request):
        enforce_csrf(request)
        serializer = VerifyEmailSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            user = AuthService.verify_email(
                email=data["email"],
                code=data["code"],
                request=request,
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages) from exc

        refresh = RefreshToken.for_user(user)
        response = Response(
            {"detail": "Email verified.", "user": UserSerializer(user).data},
        )
        return set_auth_cookies(response, refresh.access_token, refresh)


class ResendVerificationView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "auth_resend_verification"

    def post(self, request):
        enforce_csrf(request)
        serializer = ResendVerificationSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        try:
            AuthService.resend_verification(
                email=serializer.validated_data["email"],
                request=request,
            )
        except DjangoValidationError:
            pass
        return Response({"detail": "If the account exists, a verification code was sent."})


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "auth_password_reset"

    def post(self, request):
        enforce_csrf(request)
        serializer = PasswordResetRequestSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        user = User.objects.filter(email__iexact=email, deleted_at__isnull=True).first()
        if user:
            try:
                PasswordResetService.request_for_user(user=user)
                AuthEventService.log_event(
                    user=user,
                    event_type=AuthEvent.EventType.PASSWORD_RESET_REQUESTED,
                    ip_address=AuthService.client_ip(request=request),
                    user_agent=AuthService.user_agent(request=request),
                )
            except DjangoValidationError:
                pass
        return Response({"detail": "If the account exists, a password reset email was sent."})


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "auth_password_reset_confirm"

    def post(self, request):
        enforce_csrf(request)
        serializer = PasswordResetConfirmSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        try:
            user = PasswordResetService.reset_with_token(
                raw_token=serializer.validated_data["token"],
                new_password=serializer.validated_data["new_password"],
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages) from exc

        AuthEventService.log_event(
            user=user,
            event_type=AuthEvent.EventType.PASSWORD_RESET_COMPLETED,
            ip_address=AuthService.client_ip(request=request),
            user_agent=AuthService.user_agent(request=request),
        )
        return Response({"detail": "Password reset successful."})


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "auth_password_change"

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        try:
            AuthService.change_password(
                user=request.user,
                current_password=serializer.validated_data["current_password"],
                new_password=serializer.validated_data["new_password"],
                request=request,
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages) from exc
        return Response({"detail": "Password updated."})


class EmailChangeRequestView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "auth_email_change"

    def post(self, request):
        serializer = EmailChangeRequestSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        try:
            target_email = AuthService.request_email_change(
                user=request.user,
                new_email=serializer.validated_data["new_email"],
                current_password=serializer.validated_data["current_password"],
                request=request,
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages) from exc
        return Response({"detail": "Email change code sent.", "target_email": target_email})


class EmailChangeConfirmView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "auth_email_change"

    def post(self, request):
        serializer = EmailChangeConfirmSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        try:
            user = AuthService.confirm_email_change(
                user=request.user,
                new_email=serializer.validated_data["new_email"],
                code=serializer.validated_data["code"],
                request=request,
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages) from exc
        return Response({"detail": "Email changed.", "user": UserSerializer(user).data})


class DeleteAccountView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "auth_delete_account"

    def post(self, request):
        serializer = DeleteAccountSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        try:
            deleted_email = AuthService.delete_account(
                user=request.user,
                current_password=serializer.validated_data["current_password"],
                request=request,
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages) from exc
        response = Response({"detail": "Account deleted.", "email": deleted_email})
        return clear_auth_cookies(response)
