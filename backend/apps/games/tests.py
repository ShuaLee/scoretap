from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.games.models import Game, GamePlayer, GameTeam
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
class GameScheduleApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.owner = User.objects.create_user(
            email="owner@example.com",
            password="Strong-pass-123!",
            email_verified_at=timezone.now(),
        )
        self.player_user = User.objects.create_user(
            email="player@example.com",
            password="Strong-pass-123!",
            email_verified_at=timezone.now(),
        )
        self.other_user = User.objects.create_user(
            email="other@example.com",
            password="Strong-pass-123!",
            email_verified_at=timezone.now(),
        )
        self.team = Team.objects.create(owner=self.owner, name="Tap Masters")
        TeamPlayer.objects.create(
            team=self.team,
            linked_user=self.player_user,
            display_name="Casey",
        )
        self.client = APIClient()
        self._csrf_token(self.client)
        self._login(self.client, "owner@example.com")

    def test_owner_can_schedule_game_for_team_calendar(self):
        response = self.client.post(
            f"/api/teams/{self.team.id}/games/",
            {
                "opponent_name": "Rattlesnakes",
                "game_date": "2027-05-07",
                "start_time": "19:30:00",
                "location": "Diamond 3",
            },
            format="json",
            HTTP_X_CSRFTOKEN=self.client.cookies["csrftoken"].value,
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["matchup_label"], "vs. Rattlesnakes")
        self.assertEqual(response.data["game_type"], Game.GameType.TEAM)
        self.assertEqual(response.data["status"], Game.Status.SCHEDULED)

    def test_user_can_create_quick_game_without_team(self):
        response = self.client.post(
            "/api/games/",
            {
                "opponent_name": "Pickup Crew",
                "game_date": "2027-05-07",
                "tracking_mode": Game.TrackingMode.BOTH_TEAMS,
                "number_of_innings": 5,
            },
            format="json",
            HTTP_X_CSRFTOKEN=self.client.cookies["csrftoken"].value,
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["game_type"], Game.GameType.QUICK)
        self.assertEqual(response.data["tracking_mode"], Game.TrackingMode.BOTH_TEAMS)
        self.assertEqual(response.data["number_of_innings"], 5)
        self.assertIsNone(response.data["team"])

        game = Game.objects.get(pk=response.data["id"])
        self.assertEqual(game.created_by, self.owner)
        self.assertIsNone(game.team)

    def test_owner_can_configure_quick_game_teams_and_lineup(self):
        game = Game.objects.create(
            created_by=self.owner,
            opponent_name="Pickup Crew",
            game_date="2027-05-07",
            tracking_mode=Game.TrackingMode.BOTH_TEAMS,
        )

        home_response = self.client.post(
            f"/api/games/{game.id}/teams/",
            {
                "side": GameTeam.Side.HOME,
                "display_name": "My Team",
                "is_tracked": True,
            },
            format="json",
            HTTP_X_CSRFTOKEN=self.client.cookies["csrftoken"].value,
        )
        self.assertEqual(home_response.status_code, 201)

        away_response = self.client.post(
            f"/api/games/{game.id}/teams/",
            {
                "side": GameTeam.Side.AWAY,
                "display_name": "Pickup Crew",
                "is_tracked": True,
            },
            format="json",
            HTTP_X_CSRFTOKEN=self.client.cookies["csrftoken"].value,
        )
        self.assertEqual(away_response.status_code, 201)

        player_response = self.client.post(
            f"/api/games/{game.id}/teams/{home_response.data['id']}/players/",
            {
                "display_name": "Jake",
                "batting_order": 1,
            },
            format="json",
            HTTP_X_CSRFTOKEN=self.client.cookies["csrftoken"].value,
        )
        self.assertEqual(player_response.status_code, 201)
        self.assertEqual(player_response.data["display_name"], "Jake")
        self.assertEqual(player_response.data["batting_order"], 1)

        self.assertEqual(GameTeam.objects.filter(game=game).count(), 2)
        self.assertEqual(GamePlayer.objects.filter(game_team_id=home_response.data["id"]).count(), 1)

    def test_unrelated_user_cannot_configure_quick_game(self):
        game = Game.objects.create(
            created_by=self.owner,
            opponent_name="Pickup Crew",
            game_date="2027-05-07",
        )
        other_client = APIClient()
        self._csrf_token(other_client)
        self._login(other_client, "other@example.com")

        response = other_client.post(
            f"/api/games/{game.id}/teams/",
            {"side": GameTeam.Side.HOME, "display_name": "Other Team"},
            format="json",
            HTTP_X_CSRFTOKEN=other_client.cookies["csrftoken"].value,
        )

        self.assertEqual(response.status_code, 403)

    def test_owner_can_change_scheduled_game_date(self):
        game = Game.objects.create(
            team=self.team,
            game_type=Game.GameType.TEAM,
            created_by=self.owner,
            opponent_name="Rattlesnakes",
            game_date="2027-05-07",
        )

        response = self.client.patch(
            f"/api/games/{game.id}/",
            {"game_date": "2027-05-14"},
            format="json",
            HTTP_X_CSRFTOKEN=self.client.cookies["csrftoken"].value,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["game_date"], "2027-05-14")

    def test_owner_can_start_scheduled_game(self):
        game = Game.objects.create(
            team=self.team,
            game_type=Game.GameType.TEAM,
            created_by=self.owner,
            opponent_name="Rattlesnakes",
            game_date="2027-05-07",
        )

        response = self.client.post(
            f"/api/games/{game.id}/start/",
            {},
            format="json",
            HTTP_X_CSRFTOKEN=self.client.cookies["csrftoken"].value,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], Game.Status.ACTIVE)
        game.refresh_from_db()
        self.assertIsNotNone(game.started_at)

    def test_delete_cancels_scheduled_game_and_hides_by_default(self):
        game = Game.objects.create(
            team=self.team,
            game_type=Game.GameType.TEAM,
            created_by=self.owner,
            opponent_name="Rattlesnakes",
            game_date="2027-05-07",
        )

        response = self.client.delete(
            f"/api/games/{game.id}/",
            HTTP_X_CSRFTOKEN=self.client.cookies["csrftoken"].value,
        )
        self.assertEqual(response.status_code, 204)

        game.refresh_from_db()
        self.assertEqual(game.status, Game.Status.CANCELLED)
        self.assertIsNotNone(game.cancelled_at)

        list_response = self.client.get(f"/api/teams/{self.team.id}/games/")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.data, [])

        history_response = self.client.get(
            f"/api/teams/{self.team.id}/games/?include_cancelled=true",
        )
        self.assertEqual(history_response.status_code, 200)
        self.assertEqual(len(history_response.data), 1)

    def test_linked_player_can_view_but_not_schedule_or_start_game(self):
        game = Game.objects.create(
            team=self.team,
            game_type=Game.GameType.TEAM,
            created_by=self.owner,
            opponent_name="Rattlesnakes",
            game_date="2027-05-07",
        )
        player_client = APIClient()
        self._csrf_token(player_client)
        self._login(player_client, "player@example.com")

        view_response = player_client.get(f"/api/teams/{self.team.id}/games/")
        self.assertEqual(view_response.status_code, 200)
        self.assertEqual(len(view_response.data), 1)

        schedule_response = player_client.post(
            f"/api/teams/{self.team.id}/games/",
            {"opponent_name": "Comets", "game_date": "2027-05-21"},
            format="json",
            HTTP_X_CSRFTOKEN=player_client.cookies["csrftoken"].value,
        )
        self.assertEqual(schedule_response.status_code, 403)

        start_response = player_client.post(
            f"/api/games/{game.id}/start/",
            {},
            format="json",
            HTTP_X_CSRFTOKEN=player_client.cookies["csrftoken"].value,
        )
        self.assertEqual(start_response.status_code, 403)

    def test_unrelated_user_cannot_view_game(self):
        game = Game.objects.create(
            team=self.team,
            game_type=Game.GameType.TEAM,
            created_by=self.owner,
            opponent_name="Rattlesnakes",
            game_date="2027-05-07",
        )
        other_client = APIClient()
        self._csrf_token(other_client)
        self._login(other_client, "other@example.com")

        response = other_client.get(f"/api/games/{game.id}/")
        self.assertEqual(response.status_code, 403)

    def _csrf_token(self, client):
        response = client.get("/api/accounts/auth/csrf/")
        self.assertEqual(response.status_code, 200)
        return response.data["csrfToken"]

    def _login(self, client, email):
        response = client.post(
            "/api/accounts/auth/login/",
            {"email": email, "password": "Strong-pass-123!"},
            format="json",
            HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
        )
        self.assertEqual(response.status_code, 200)
