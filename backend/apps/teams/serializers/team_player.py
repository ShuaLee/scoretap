from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.teams.models import TeamPlayer


class TeamPlayerSerializer(serializers.ModelSerializer):
    linked_user_id = serializers.PrimaryKeyRelatedField(
        source="linked_user",
        queryset=get_user_model().objects.filter(deleted_at__isnull=True),
        required=False,
        allow_null=True,
    )
    linked_user_email = serializers.EmailField(source="linked_user.email", read_only=True)
    is_assigned = serializers.BooleanField(read_only=True)

    class Meta:
        model = TeamPlayer
        fields = (
            "id",
            "team",
            "display_name",
            "linked_user_id",
            "linked_user_email",
            "is_assigned",
            "jersey_number",
            "is_active",
            "joined_at",
            "removed_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "team",
            "linked_user_email",
            "is_assigned",
            "is_active",
            "removed_at",
            "created_at",
            "updated_at",
        )

    def validate_display_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Display name is required.")
        return value
