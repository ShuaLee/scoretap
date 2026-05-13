from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from games.models import Game, GameEvent, GamePlayer, GameTeam
from games.services.scoring import (
    create_game,
    finalize_game,
    record_plate_appearance,
    undo_last_event,
)
from games.services.summary import build_game_summary


class ScoringServiceTests(TestCase):
    def test_create_game_creates_live_game_teams_lineups_and_start_event(self):
        game = create_game(
            home_team_name="Bats",
            away_team_name="Sharks",
            scheduled_innings=7,
            home_lineup=["Maya", "Jess"],
            away_lineup=["Mike", "Sam"],
        )

        self.assertEqual(game.status, Game.Status.LIVE)
        self.assertEqual(game.scheduled_innings, 7)
        self.assertEqual(game.teams.count(), 2)

        home_team = game.teams.get(side=GameTeam.Side.HOME)
        away_team = game.teams.get(side=GameTeam.Side.AWAY)

        self.assertEqual(home_team.name, "Bats")
        self.assertEqual(away_team.name, "Sharks")
        self.assertEqual(list(home_team.players.values_list("name", flat=True)), ["Maya", "Jess"])
        self.assertEqual(list(away_team.players.values_list("name", flat=True)), ["Mike", "Sam"])

        event = game.events.get()
        self.assertEqual(event.event_type, GameEvent.EventType.GAME_STARTED)
        self.assertEqual(event.sequence_number, 1)

    def test_single_moves_batter_to_first_and_advances_batting_order(self):
        game = create_game(
            home_team_name="Bats",
            away_team_name="Sharks",
            away_lineup=["Mike", "Sam"],
        )

        event = record_plate_appearance(
            game,
            GameEvent.PlateAppearanceResult.SINGLE,
        )
        game.refresh_from_db()

        runner = GamePlayer.objects.get(name="Mike")
        self.assertEqual(game.away_score, 0)
        self.assertEqual(game.runner_on_first, runner)
        self.assertIsNone(game.runner_on_second)
        self.assertIsNone(game.runner_on_third)
        self.assertEqual(game.current_away_batter_index, 1)
        self.assertEqual(event.batter, runner)
        self.assertEqual(event.runs_scored, 0)

    def test_home_run_scores_existing_runners_and_batter(self):
        game = create_game(
            home_team_name="Bats",
            away_team_name="Sharks",
            away_lineup=["Mike", "Sam", "Leo"],
        )

        record_plate_appearance(game, GameEvent.PlateAppearanceResult.SINGLE)
        record_plate_appearance(game, GameEvent.PlateAppearanceResult.SINGLE)
        event = record_plate_appearance(game, GameEvent.PlateAppearanceResult.HOME_RUN)
        game.refresh_from_db()

        self.assertEqual(game.away_score, 3)
        self.assertIsNone(game.runner_on_first)
        self.assertIsNone(game.runner_on_second)
        self.assertIsNone(game.runner_on_third)
        self.assertEqual(event.runs_scored, 3)

    def test_walk_forces_in_run_when_bases_are_loaded(self):
        game = create_game(
            home_team_name="Bats",
            away_team_name="Sharks",
            away_lineup=["Mike", "Sam", "Leo", "Nina"],
        )

        record_plate_appearance(game, GameEvent.PlateAppearanceResult.SINGLE)
        record_plate_appearance(game, GameEvent.PlateAppearanceResult.SINGLE)
        record_plate_appearance(game, GameEvent.PlateAppearanceResult.SINGLE)
        event = record_plate_appearance(game, GameEvent.PlateAppearanceResult.WALK)
        game.refresh_from_db()

        self.assertEqual(game.away_score, 1)
        self.assertEqual(event.runs_scored, 1)
        self.assertEqual(game.runner_on_first.name, "Nina")
        self.assertEqual(game.runner_on_second.name, "Leo")
        self.assertEqual(game.runner_on_third.name, "Sam")

    def test_three_outs_switches_from_top_to_bottom_of_inning(self):
        game = create_game(
            home_team_name="Bats",
            away_team_name="Sharks",
            away_lineup=["Mike", "Sam", "Leo"],
        )

        record_plate_appearance(game, GameEvent.PlateAppearanceResult.STRIKEOUT)
        record_plate_appearance(game, GameEvent.PlateAppearanceResult.GROUND_OUT)
        record_plate_appearance(game, GameEvent.PlateAppearanceResult.FLY_OUT)
        game.refresh_from_db()

        self.assertEqual(game.inning, 1)
        self.assertEqual(game.half_inning, Game.HalfInning.BOTTOM)
        self.assertEqual(game.outs, 0)

    def test_undo_restores_previous_score_runners_outs_and_batter_index(self):
        game = create_game(
            home_team_name="Bats",
            away_team_name="Sharks",
            away_lineup=["Mike", "Sam"],
        )

        record_plate_appearance(game, GameEvent.PlateAppearanceResult.SINGLE)
        record_plate_appearance(game, GameEvent.PlateAppearanceResult.HOME_RUN)
        game.refresh_from_db()

        self.assertEqual(game.away_score, 2)
        self.assertEqual(game.current_away_batter_index, 0)

        undo_last_event(game)
        game.refresh_from_db()

        self.assertEqual(game.away_score, 0)
        self.assertEqual(game.current_away_batter_index, 1)
        self.assertEqual(game.runner_on_first.name, "Mike")
        self.assertEqual(game.events.filter(is_undone=True).count(), 1)

    def test_finalize_game_marks_game_final_and_records_event(self):
        game = create_game(home_team_name="Bats", away_team_name="Sharks")

        finalize_game(game)
        game.refresh_from_db()

        self.assertEqual(game.status, Game.Status.FINAL)
        self.assertTrue(
            game.events.filter(event_type=GameEvent.EventType.GAME_FINALIZED).exists()
        )


class GameSummaryServiceTests(TestCase):
    def test_build_game_summary_counts_active_events_and_runs(self):
        game = create_game(
            home_team_name="Bats",
            away_team_name="Sharks",
            away_lineup=["Mike", "Sam"],
        )

        record_plate_appearance(game, GameEvent.PlateAppearanceResult.SINGLE)
        record_plate_appearance(game, GameEvent.PlateAppearanceResult.HOME_RUN)
        undo_last_event(game)
        game.refresh_from_db()

        summary = build_game_summary(game)

        self.assertEqual(summary["game_id"], game.id)
        self.assertEqual(summary["status"], Game.Status.LIVE)
        self.assertEqual(summary["home_team"]["name"], "Bats")
        self.assertEqual(summary["away_team"]["name"], "Sharks")
        self.assertEqual(summary["plate_appearances"], 1)
        self.assertEqual(summary["runs_scored"], 0)
        self.assertEqual(summary["winner"], None)


class GameApiTests(APITestCase):
    def test_create_game_endpoint_returns_live_game_state(self):
        response = self.client.post(
            "/api/games/",
            {
                "home_team_name": "Bats",
                "away_team_name": "Sharks",
                "home_lineup": [{"name": "Maya"}],
                "away_lineup": [{"name": "Mike"}, {"name": "Sam"}],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], Game.Status.LIVE)
        self.assertEqual(response.data["home_score"], 0)
        self.assertEqual(response.data["away_score"], 0)
        self.assertEqual(response.data["current_batter"]["name"], "Mike")
        self.assertEqual(len(response.data["teams"]), 2)

    def test_retrieve_game_endpoint_returns_current_game_state(self):
        game = create_game(
            home_team_name="Bats",
            away_team_name="Sharks",
            away_lineup=["Mike"],
        )

        response = self.client.get(f"/api/games/{game.id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], game.id)
        self.assertEqual(response.data["batting_side"], GameTeam.Side.AWAY)
        self.assertEqual(response.data["current_batter"]["name"], "Mike")

    def test_plate_appearance_endpoint_scores_game(self):
        game = create_game(
            home_team_name="Bats",
            away_team_name="Sharks",
            away_lineup=["Mike", "Sam"],
        )

        response = self.client.post(
            f"/api/games/{game.id}/plate-appearances/",
            {"result": GameEvent.PlateAppearanceResult.SINGLE},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["game"]["runner_on_first_name"], "Mike")
        self.assertEqual(response.data["game"]["current_batter"]["name"], "Sam")
        self.assertIsNotNone(response.data["event_id"])

    def test_undo_endpoint_restores_last_scoring_state(self):
        game = create_game(
            home_team_name="Bats",
            away_team_name="Sharks",
            away_lineup=["Mike", "Sam"],
        )
        record_plate_appearance(game, GameEvent.PlateAppearanceResult.SINGLE)
        record_plate_appearance(game, GameEvent.PlateAppearanceResult.HOME_RUN)

        response = self.client.post(f"/api/games/{game.id}/undo/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["away_score"], 0)
        self.assertEqual(response.data["runner_on_first_name"], "Mike")
        self.assertEqual(response.data["current_batter"]["name"], "Sam")

    def test_finalize_endpoint_marks_game_final(self):
        game = create_game(home_team_name="Bats", away_team_name="Sharks")

        response = self.client.post(f"/api/games/{game.id}/finalize/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], Game.Status.FINAL)

    def test_events_endpoint_returns_play_by_play_history(self):
        game = create_game(
            home_team_name="Bats",
            away_team_name="Sharks",
            away_lineup=["Mike"],
        )
        record_plate_appearance(game, GameEvent.PlateAppearanceResult.SINGLE)

        response = self.client.get(f"/api/games/{game.id}/events/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        self.assertEqual(response.data[0]["event_type"], GameEvent.EventType.GAME_STARTED)
        self.assertEqual(response.data[1]["batter_name"], "Mike")
        self.assertEqual(
            response.data[1]["plate_appearance_result"],
            GameEvent.PlateAppearanceResult.SINGLE,
        )

    def test_summary_endpoint_returns_computed_game_summary(self):
        game = create_game(
            home_team_name="Bats",
            away_team_name="Sharks",
            away_lineup=["Mike", "Sam"],
        )
        record_plate_appearance(game, GameEvent.PlateAppearanceResult.SINGLE)
        record_plate_appearance(game, GameEvent.PlateAppearanceResult.HOME_RUN)

        response = self.client.get(f"/api/games/{game.id}/summary/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["game_id"], game.id)
        self.assertEqual(response.data["away_score"], 2)
        self.assertEqual(response.data["winner"], GameTeam.Side.AWAY)
        self.assertEqual(response.data["plate_appearances"], 2)
        self.assertEqual(response.data["runs_scored"], 2)

    def test_plate_appearance_endpoint_rejects_invalid_result(self):
        game = create_game(home_team_name="Bats", away_team_name="Sharks")

        response = self.client.post(
            f"/api/games/{game.id}/plate-appearances/",
            {"result": "banana"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("result", response.data)

    def test_plate_appearance_endpoint_rejects_finalized_game(self):
        game = create_game(home_team_name="Bats", away_team_name="Sharks")
        finalize_game(game)

        response = self.client.post(
            f"/api/games/{game.id}/plate-appearances/",
            {"result": GameEvent.PlateAppearanceResult.SINGLE},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_undo_endpoint_rejects_game_without_scoring_events(self):
        game = create_game(home_team_name="Bats", away_team_name="Sharks")

        response = self.client.post(f"/api/games/{game.id}/undo/")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_missing_game_returns_not_found(self):
        response = self.client.get("/api/games/999/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
