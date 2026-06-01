from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.waitlist.models import WaitlistSignup


TEST_REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "apps.accounts.auth.JWTFromCookieAuthentication",
    ),
    "EXCEPTION_HANDLER": "apps.accounts.exceptions.accounts_exception_handler",
}


@override_settings(REST_FRAMEWORK=TEST_REST_FRAMEWORK)
class WaitlistSignupApiTests(TestCase):
    def test_public_signup_creates_waitlist_entry(self):
        client = APIClient()

        response = client.post(
            "/api/waitlist/signups/",
            {"email": "PLAYER@example.com"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(WaitlistSignup.objects.get().email, "player@example.com")

    def test_duplicate_signup_is_idempotent(self):
        client = APIClient()
        WaitlistSignup.objects.create(email="player@example.com")

        response = client.post(
            "/api/waitlist/signups/",
            {"email": "PLAYER@example.com"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(WaitlistSignup.objects.count(), 1)
