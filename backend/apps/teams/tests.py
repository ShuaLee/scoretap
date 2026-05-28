from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.teams.models import Team, TeamPlayer


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


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    AUTH_REQUIRE_EMAIL_VERIFICATION=False,
    REST_FRAMEWORK=TEST_REST_FRAMEWORK,
)
class TeamApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.owner = User.objects.create_user(
            email="owner@example.com",
            password="strong-pass-123",
            email_verified_at=timezone.now(),
        )
        self.player_user = User.objects.create_user(
            email="player@example.com",
            password="strong-pass-123",
            email_verified_at=timezone.now(),
        )
        self.other_user = User.objects.create_user(
            email="other@example.com",
            password="strong-pass-123",
            email_verified_at=timezone.now(),
        )
        self.client = APIClient()
        self.csrf_token = self._csrf_token(self.client)
        self._login(self.client, "owner@example.com")

    def test_owner_can_create_team_and_unassigned_player(self):
        team_response = self.client.post(
            "/api/teams/",
            {"name": "Tap Masters", "city": "Toronto"},
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )
        self.assertEqual(team_response.status_code, 201)

        player_response = self.client.post(
            f"/api/teams/{team_response.data['id']}/players/",
            {"display_name": "Spare Mike"},
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )

        self.assertEqual(player_response.status_code, 201)
        self.assertFalse(player_response.data["is_assigned"])
        self.assertIsNone(player_response.data["linked_user_id"])

    def test_player_can_be_assigned_and_unassigned_without_deleting_roster_identity(self):
        team = Team.objects.create(owner=self.owner, name="Tap Masters")
        player = TeamPlayer.objects.create(team=team, display_name="Spare Mike")

        assign_response = self.client.patch(
            f"/api/teams/{team.id}/players/{player.id}/",
            {"linked_user_id": self.player_user.id},
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )
        self.assertEqual(assign_response.status_code, 200)
        self.assertTrue(assign_response.data["is_assigned"])
        self.assertEqual(assign_response.data["linked_user_email"], "player@example.com")

        unassign_response = self.client.patch(
            f"/api/teams/{team.id}/players/{player.id}/",
            {"linked_user_id": None},
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )

        self.assertEqual(unassign_response.status_code, 200)
        self.assertFalse(unassign_response.data["is_assigned"])
        player.refresh_from_db()
        self.assertIsNone(player.linked_user)
        self.assertEqual(player.display_name, "Spare Mike")

    def test_removed_player_is_soft_removed_and_visible_when_requested(self):
        team = Team.objects.create(owner=self.owner, name="Tap Masters")
        player = TeamPlayer.objects.create(
            team=team,
            linked_user=self.player_user,
            display_name="Casey",
        )

        delete_response = self.client.delete(
            f"/api/teams/{team.id}/players/{player.id}/",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )
        self.assertEqual(delete_response.status_code, 204)

        player.refresh_from_db()
        self.assertFalse(player.is_active)
        self.assertIsNotNone(player.removed_at)
        self.assertEqual(player.linked_user, self.player_user)

        active_response = self.client.get(f"/api/teams/{team.id}/players/")
        self.assertEqual(active_response.status_code, 200)
        self.assertEqual(active_response.data, [])

        history_response = self.client.get(f"/api/teams/{team.id}/players/?include_removed=true")
        self.assertEqual(history_response.status_code, 200)
        self.assertEqual(len(history_response.data), 1)
        self.assertFalse(history_response.data[0]["is_active"])

    def test_linked_player_can_view_team_but_cannot_manage_roster(self):
        team = Team.objects.create(owner=self.owner, name="Tap Masters")
        TeamPlayer.objects.create(
            team=team,
            linked_user=self.player_user,
            display_name="Casey",
        )
        player_client = APIClient()
        player_csrf = self._csrf_token(player_client)
        self._login(player_client, "player@example.com")

        view_response = player_client.get(f"/api/teams/{team.id}/")
        self.assertEqual(view_response.status_code, 200)

        response = player_client.post(
            f"/api/teams/{team.id}/players/",
            {"display_name": "New Spare"},
            format="json",
            HTTP_X_CSRFTOKEN=player_csrf,
        )

        self.assertEqual(response.status_code, 403)

    def test_unrelated_user_cannot_view_team(self):
        team = Team.objects.create(owner=self.owner, name="Tap Masters")
        other_client = APIClient()
        self._csrf_token(other_client)
        self._login(other_client, "other@example.com")

        response = other_client.get(f"/api/teams/{team.id}/")
        self.assertEqual(response.status_code, 403)

    def _csrf_token(self, client):
        response = client.get("/api/accounts/auth/csrf/")
        self.assertEqual(response.status_code, 200)
        return response.data["csrfToken"]

    def _login(self, client, email):
        response = client.post(
            "/api/accounts/auth/login/",
            {"email": email, "password": "strong-pass-123"},
            format="json",
            HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
        )
        self.assertEqual(response.status_code, 200)
