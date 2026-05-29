from rest_framework import serializers

from apps.games.models import Game


class GameSerializer(serializers.ModelSerializer):
    team_name = serializers.CharField(source="team.name", read_only=True)
    matchup_label = serializers.CharField(read_only=True)
    is_quick_game = serializers.BooleanField(read_only=True)
    is_team_game = serializers.BooleanField(read_only=True)
    tracks_both_teams = serializers.BooleanField(read_only=True)

    class Meta:
        model = Game
        fields = (
            "id",
            "game_type",
            "tracking_mode",
            "team",
            "team_name",
            "opponent_name",
            "number_of_innings",
            "matchup_label",
            "is_quick_game",
            "is_team_game",
            "tracks_both_teams",
            "game_date",
            "start_time",
            "location",
            "notes",
            "status",
            "started_at",
            "completed_at",
            "cancelled_at",
            "created_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "game_type",
            "team",
            "team_name",
            "matchup_label",
            "is_quick_game",
            "is_team_game",
            "tracks_both_teams",
            "status",
            "started_at",
            "completed_at",
            "cancelled_at",
            "created_by",
            "created_at",
            "updated_at",
        )

    def validate_opponent_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Opponent name is required.")
        return value

    def validate_number_of_innings(self, value):
        if value < 1 or value > 20:
            raise serializers.ValidationError("Number of innings must be between 1 and 20.")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        game_type = attrs.get("game_type", getattr(self.instance, "game_type", Game.GameType.QUICK))
        if (
            self.instance is None
            and game_type == Game.GameType.TEAM
            and self.context.get("team") is None
        ):
            raise serializers.ValidationError(
                {"game_type": "Create team games from a team schedule."}
            )
        return attrs
