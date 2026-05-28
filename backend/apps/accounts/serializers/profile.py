from rest_framework import serializers

from apps.accounts.models import UserProfile


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = (
            "display_name",
            "timezone",
            "locale",
            "avatar_url",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")
