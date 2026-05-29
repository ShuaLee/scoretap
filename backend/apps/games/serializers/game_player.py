from rest_framework import serializers

from apps.games.models import GamePlayer


class GamePlayerSerializer(serializers.ModelSerializer):
    linked_team_player_name = serializers.CharField(
        source="linked_team_player.display_name",
        read_only=True,
    )

    class Meta:
        model = GamePlayer
        fields = (
            "id",
            "game_team",
            "linked_team_player",
            "linked_team_player_name",
            "display_name",
            "batting_order",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "game_team",
            "linked_team_player_name",
            "is_active",
            "created_at",
            "updated_at",
        )

    def validate_display_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Player name is required.")
        return value

    def validate_batting_order(self, value):
        if value < 1:
            raise serializers.ValidationError("Batting order must be 1 or greater.")
        return value
