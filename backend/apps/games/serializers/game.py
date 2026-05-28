from rest_framework import serializers

from apps.games.models import Game


class GameSerializer(serializers.ModelSerializer):
    team_name = serializers.CharField(source="team.name", read_only=True)
    matchup_label = serializers.CharField(read_only=True)

    class Meta:
        model = Game
        fields = (
            "id",
            "team",
            "team_name",
            "opponent_name",
            "matchup_label",
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
            "team",
            "team_name",
            "matchup_label",
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
