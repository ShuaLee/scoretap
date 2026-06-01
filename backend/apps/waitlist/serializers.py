from rest_framework import serializers

from apps.waitlist.models import WaitlistSignup


class WaitlistSignupSerializer(serializers.ModelSerializer):
    class Meta:
        model = WaitlistSignup
        fields = ("email",)

    def validate_email(self, value):
        return value.lower().strip()
