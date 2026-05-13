from rest_framework import serializers

from games.models import Game, GameEvent, GamePlayer, GameTeam
from games.services.scoring import create_game


class GamePlayerSerializer(serializers.ModelSerializer):
    class Meta:
        model = GamePlayer
        fields = [
            "id",
            "name",
            "batting_category",
            "lineup_position",
            "is_active",
        ]


class GameTeamSerializer(serializers.ModelSerializer):
    players = GamePlayerSerializer(many=True, read_only=True)

    class Meta:
        model = GameTeam
        fields = [
            "id",
            "side",
            "name",
            "batting_order_mode",
            "lineup_rule_config",
            "players",
        ]


class GameEventSerializer(serializers.ModelSerializer):
    team_name = serializers.CharField(source="team.name", read_only=True)
    batter_name = serializers.CharField(source="batter.name", read_only=True)

    class Meta:
        model = GameEvent
        fields = [
            "id",
            "sequence_number",
            "event_type",
            "plate_appearance_result",
            "team",
            "team_name",
            "batter",
            "batter_name",
            "inning",
            "half_inning",
            "outs_before",
            "outs_after",
            "runs_scored",
            "payload",
            "is_undone",
            "created_at",
        ]


class GameSerializer(serializers.ModelSerializer):
    teams = GameTeamSerializer(many=True, read_only=True)
    batting_side = serializers.CharField(read_only=True)
    runner_on_first_name = serializers.CharField(
        source="runner_on_first.name",
        read_only=True,
    )
    runner_on_second_name = serializers.CharField(
        source="runner_on_second.name",
        read_only=True,
    )
    runner_on_third_name = serializers.CharField(
        source="runner_on_third.name",
        read_only=True,
    )
    current_batter = serializers.SerializerMethodField()

    class Meta:
        model = Game
        fields = [
            "id",
            "status",
            "scheduled_innings",
            "inning",
            "half_inning",
            "outs",
            "home_score",
            "away_score",
            "current_home_batter_index",
            "current_away_batter_index",
            "runner_on_first",
            "runner_on_first_name",
            "runner_on_second",
            "runner_on_second_name",
            "runner_on_third",
            "runner_on_third_name",
            "batting_side",
            "current_batter",
            "teams",
            "created_at",
            "updated_at",
        ]

    def get_current_batter(self, game):
        try:
            batting_team = game.teams.get(side=game.batting_side)
        except GameTeam.DoesNotExist:
            return None

        players = list(batting_team.players.filter(is_active=True))
        if not players:
            return None

        if batting_team.side == GameTeam.Side.HOME:
            index = game.current_home_batter_index
        else:
            index = game.current_away_batter_index

        return GamePlayerSerializer(players[index % len(players)]).data


class LineupPlayerInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    batting_category = serializers.ChoiceField(
        choices=GamePlayer.BattingCategory.choices,
        default=GamePlayer.BattingCategory.UNSPECIFIED,
        required=False,
    )


class CreateGameSerializer(serializers.Serializer):
    home_team_name = serializers.CharField(
        max_length=120,
        default="Home",
        required=False,
    )
    away_team_name = serializers.CharField(
        max_length=120,
        default="Away",
        required=False,
    )
    scheduled_innings = serializers.IntegerField(
        min_value=1,
        max_value=20,
        default=7,
        required=False,
    )
    home_lineup = LineupPlayerInputSerializer(
        many=True,
        required=False,
        default=list,
    )
    away_lineup = LineupPlayerInputSerializer(
        many=True,
        required=False,
        default=list,
    )

    def create(self, validated_data):
        return create_game(**validated_data)


class PlateAppearanceSerializer(serializers.Serializer):
    result = serializers.ChoiceField(choices=GameEvent.PlateAppearanceResult.choices)
