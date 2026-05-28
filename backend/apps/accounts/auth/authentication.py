from django.conf import settings
from django.http import HttpResponse
from django.middleware.csrf import CsrfViewMiddleware
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication


class _CSRFCheck(CsrfViewMiddleware):
    def _reject(self, request, reason):
        return reason


class JWTFromCookieAuthentication(JWTAuthentication):
    SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}

    def authenticate(self, request):
        cookie_name = settings.SIMPLE_JWT.get("AUTH_COOKIE", "access")
        raw_token = request.COOKIES.get(cookie_name)

        if raw_token is None:
            return None

        try:
            validated_token = self.get_validated_token(raw_token)
            user = self.get_user(validated_token)
        except Exception as exc:
            raise AuthenticationFailed("Invalid token in cookie.") from exc

        if request.method not in self.SAFE_METHODS:
            self._enforce_csrf(request)

        return user, validated_token

    def _enforce_csrf(self, request):
        check = _CSRFCheck(lambda _request: HttpResponse())
        check.process_request(request)
        reason = check.process_view(request, None, (), {})
        if reason:
            raise AuthenticationFailed("CSRF token missing or incorrect.")
