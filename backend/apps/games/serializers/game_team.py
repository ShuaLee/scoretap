from rest_framework import serializers

from apps.games.models import GameTeam


class GameTeamSerializer(serializers.ModelSerializer):
    linked_team_name = serializers.CharField(source="linked_team.name", read_only=True)

    class Meta:
        model = GameTeam
        fields = (
            "id",
            "game",
            "side",
            "linked_team",
            "linked_team_name",
            "display_name",
            "is_tracked",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "game",
            "linked_team_name",
            "created_at",
            "updated_at",
        )

    def validate_display_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Team name is required.")
        return value
