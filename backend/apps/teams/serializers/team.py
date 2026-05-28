from rest_framework import serializers

from apps.teams.models import Team


class TeamSerializer(serializers.ModelSerializer):
    owner_email = serializers.EmailField(source="owner.email", read_only=True)
    is_archived = serializers.BooleanField(read_only=True)
    active_player_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Team
        fields = (
            "id",
            "name",
            "city",
            "notes",
            "owner",
            "owner_email",
            "is_archived",
            "archived_at",
            "active_player_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "owner",
            "owner_email",
            "is_archived",
            "archived_at",
            "active_player_count",
            "created_at",
            "updated_at",
        )
