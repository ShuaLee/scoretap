from django.contrib.admin.sites import AdminSite
from django.contrib.messages.storage.fallback import FallbackStorage
from django.contrib.sessions.middleware import SessionMiddleware
from django.core.cache import cache
from django.test import RequestFactory, TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken

from apps.accounts.admin.account_recovery_request_admin import (
    AccountRecoveryRequestAdmin,
)
from apps.accounts.models import AccountRecoveryRequest, User, UserProfile
from apps.accounts.throttles import AuthRateThrottle


TEST_REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "apps.accounts.auth.JWTFromCookieAuthentication",
    ),
    "DEFAULT_THROTTLE_CLASSES": (
        "apps.accounts.throttles.AuthRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "auth_register": "100/minute",
        "auth_login": "100/minute",
        "auth_refresh": "100/minute",
        "auth_resend_verification": "100/minute",
        "auth_verify_email": "100/minute",
        "auth_password_reset": "100/minute",
        "auth_password_reset_confirm": "100/minute",
        "auth_password_change": "100/minute",
        "auth_email_change": "100/minute",
        "auth_delete_account": "100/minute",
    },
    "EXCEPTION_HANDLER": "apps.accounts.exceptions.accounts_exception_handler",
}


class UserModelTests(TestCase):
    def test_user_email_is_normalized_and_profile_is_created(self):
        user = User.objects.create_user(email="  TEST@Example.COM  ", password="Secret-123!")

        self.assertEqual(user.email, "test@example.com")
        self.assertTrue(UserProfile.objects.filter(user=user).exists())

    def test_soft_deleted_email_can_be_reused(self):
        deleted_user = User.objects.create_user(
            email="player@example.com",
            password="Secret-123!",
            deleted_at=timezone.now(),
        )
        active_user = User.objects.create_user(
            email="PLAYER@example.com",
            password="Secret-123!",
        )

        self.assertNotEqual(deleted_user.id, active_user.id)
        self.assertEqual(active_user.email, "player@example.com")

    def test_active_email_is_unique_case_insensitively(self):
        User.objects.create_user(email="player@example.com", password="Secret-123!")

        with self.assertRaises(Exception):
            User.objects.create_user(email="PLAYER@example.com", password="Secret-123!")


class AccountRecoveryRequestAdminTests(TestCase):
    def test_mark_approved_updates_user_email(self):
        admin_user = User.objects.create_superuser(
            email="admin@example.com",
            password="Secret-123!",
        )
        user = User.objects.create_user(email="old@example.com", password="Secret-123!")
        recovery_request = AccountRecoveryRequest.objects.create(
            user=user,
            current_email="old@example.com",
            requested_email="new@example.com",
        )
        request = self._admin_request(admin_user)
        model_admin = AccountRecoveryRequestAdmin(AccountRecoveryRequest, AdminSite())

        model_admin.mark_approved(
            request,
            AccountRecoveryRequest.objects.filter(pk=recovery_request.pk),
        )

        user.refresh_from_db()
        recovery_request.refresh_from_db()
        self.assertEqual(user.email, "new@example.com")
        self.assertIsNotNone(user.email_verified_at)
        self.assertEqual(recovery_request.status, AccountRecoveryRequest.Status.APPROVED)
        self.assertEqual(recovery_request.reviewed_by, admin_user)

    def _admin_request(self, user):
        request = RequestFactory().get("/admin/")
        request.user = user
        SessionMiddleware(lambda request: None).process_request(request)
        request.session.save()
        setattr(request, "_messages", FallbackStorage(request))
        return request


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    AUTH_REQUIRE_EMAIL_VERIFICATION=False,
    REST_FRAMEWORK=TEST_REST_FRAMEWORK,
)
class AccountApiTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_register_login_me_and_profile_update(self):
        client = APIClient()
        csrf_token = self._csrf_token(client)

        register_response = client.post(
            "/api/accounts/auth/register/",
            {
                "email": "CASEY@example.com",
                "password": "Strong-pass-123!",
                "display_name": "Casey",
                "timezone": "America/Toronto",
                "locale": "en-CA",
            },
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(register_response.status_code, 201)
        self.assertEqual(register_response.data["user"]["email"], "casey@example.com")
        self.assertIn("scoretap_access", client.cookies)
        self.assertIn("scoretap_refresh", client.cookies)

        login_response = client.post(
            "/api/accounts/auth/login/",
            {"email": "casey@example.com", "password": "Strong-pass-123!"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(login_response.status_code, 200)
        self.assertIn("scoretap_access", client.cookies)

        me_response = client.get("/api/accounts/auth/me/")
        self.assertEqual(me_response.status_code, 200)
        self.assertEqual(me_response.data["user"]["profile"]["display_name"], "Casey")

        profile_response = client.patch(
            "/api/accounts/profile/",
            {"display_name": "Casey Bats"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(profile_response.status_code, 200)
        self.assertEqual(profile_response.data["display_name"], "Casey Bats")

    def test_duplicate_registration_returns_consistent_error_shape(self):
        client = APIClient()
        csrf_token = self._csrf_token(client)
        payload = {
            "email": "dup@example.com",
            "password": "Strong-pass-123!",
            "display_name": "Duplicate",
        }

        self.assertEqual(
            client.post(
                "/api/accounts/auth/register/",
                payload,
                format="json",
                HTTP_X_CSRFTOKEN=csrf_token,
            ).status_code,
            201,
        )
        response = client.post(
            "/api/accounts/auth/register/",
            payload,
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"]["code"], "invalid")
        self.assertEqual(
            response.data["error"]["message"],
            "Please check the submitted values.",
        )
        self.assertEqual(
            response.data["error"]["fields"],
            {"email": ["Email is already registered."]},
        )

    def test_registration_requires_complex_password(self):
        client = APIClient()
        csrf_token = self._csrf_token(client)

        response = client.post(
            "/api/accounts/auth/register/",
            {
                "email": "weak@example.com",
                "password": "weakpass",
                "display_name": "Weak Password",
            },
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("uppercase", response.data["error"]["fields"]["password"][0])

    def test_register_without_csrf_fails_with_consistent_error_shape(self):
        client = APIClient(enforce_csrf_checks=True)
        response = client.post(
            "/api/accounts/auth/register/",
            {"email": "csrf@example.com", "password": "Strong-pass-123!"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"]["code"], "invalid")
        self.assertEqual(
            response.data["error"]["message"],
            "CSRF token missing or incorrect.",
        )

    @override_settings(AUTH_MAX_FAILED_LOGIN_ATTEMPTS=2, AUTH_LOCKOUT_MINUTES=10)
    def test_wrong_password_locks_account_after_configured_attempts(self):
        client = APIClient()
        csrf_token = self._csrf_token(client)
        User.objects.create_user(
            email="locked@example.com",
            password="Strong-pass-123!",
            email_verified_at=timezone.now(),
        )

        for _ in range(2):
            response = client.post(
                "/api/accounts/auth/login/",
                {"email": "locked@example.com", "password": "wrong-pass"},
                format="json",
                HTTP_X_CSRFTOKEN=csrf_token,
            )
            self.assertEqual(response.status_code, 400)

        user = User.objects.get(email="locked@example.com")
        self.assertTrue(user.is_locked)

    def test_soft_deleted_user_cannot_login(self):
        client = APIClient()
        csrf_token = self._csrf_token(client)
        User.objects.create_user(
            email="deleted@example.com",
            password="Strong-pass-123!",
            email_verified_at=timezone.now(),
            is_active=False,
            deleted_at=timezone.now(),
        )

        response = client.post(
            "/api/accounts/auth/login/",
            {"email": "deleted@example.com", "password": "Strong-pass-123!"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"]["message"], "Invalid credentials.")

    def test_invalid_email_verification_code_returns_consistent_error_shape(self):
        client = APIClient()
        csrf_token = self._csrf_token(client)
        User.objects.create_user(email="verify@example.com", password="Strong-pass-123!")

        response = client.post(
            "/api/accounts/auth/email/verify/",
            {"email": "verify@example.com", "code": "123456"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"]["message"], "Invalid verification code.")

    def test_invalid_password_reset_token_returns_consistent_error_shape(self):
        client = APIClient()
        csrf_token = self._csrf_token(client)

        response = client.post(
            "/api/accounts/auth/password/reset/confirm/",
            {"token": "not-real", "new_password": "new-Strong-pass-123!"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"]["message"], "Invalid password reset token.")

    def test_refresh_and_logout_blacklist_refresh_token(self):
        client = APIClient()
        csrf_token = self._csrf_token(client)
        User.objects.create_user(
            email="session@example.com",
            password="Strong-pass-123!",
            email_verified_at=timezone.now(),
        )

        login_response = client.post(
            "/api/accounts/auth/login/",
            {"email": "session@example.com", "password": "Strong-pass-123!"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(login_response.status_code, 200)

        first_refresh = client.cookies["scoretap_refresh"].value
        refresh_response = client.post(
            "/api/accounts/auth/refresh/",
            {},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(refresh_response.status_code, 200)
        self.assertIn("scoretap_access", client.cookies)

        logout_refresh = client.cookies["scoretap_refresh"].value
        logout_response = client.post(
            "/api/accounts/auth/logout/",
            {},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(logout_response.status_code, 200)
        self.assertTrue(
            BlacklistedToken.objects.filter(token__token=first_refresh).exists()
        )
        self.assertTrue(
            BlacklistedToken.objects.filter(token__token=logout_refresh).exists()
        )

    @override_settings(
        REST_FRAMEWORK={
            **TEST_REST_FRAMEWORK,
            "DEFAULT_THROTTLE_RATES": {
                **TEST_REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"],
                "auth_login": "1/minute",
            },
        }
    )
    def test_login_endpoint_is_throttled(self):
        cache.clear()
        original_rates = AuthRateThrottle.THROTTLE_RATES
        AuthRateThrottle.THROTTLE_RATES = {
            **original_rates,
            "auth_login": "1/minute",
        }
        client = APIClient()
        try:
            csrf_token = self._csrf_token(client)
            User.objects.create_user(
                email="throttle@example.com",
                password="Strong-pass-123!",
                email_verified_at=timezone.now(),
            )

            first_response = client.post(
                "/api/accounts/auth/login/",
                {"email": "throttle@example.com", "password": "wrong-pass"},
                format="json",
                HTTP_X_CSRFTOKEN=csrf_token,
                REMOTE_ADDR="203.0.113.10",
            )
            second_response = client.post(
                "/api/accounts/auth/login/",
                {"email": "throttle@example.com", "password": "wrong-pass"},
                format="json",
                HTTP_X_CSRFTOKEN=csrf_token,
                REMOTE_ADDR="203.0.113.10",
            )

            self.assertEqual(first_response.status_code, 400)
            self.assertEqual(second_response.status_code, 429)
            self.assertEqual(second_response.data["error"]["code"], "throttled")
        finally:
            AuthRateThrottle.THROTTLE_RATES = original_rates

    def _csrf_token(self, client):
        response = client.get("/api/accounts/auth/csrf/")
        self.assertEqual(response.status_code, 200)
        return response.data["csrfToken"]
