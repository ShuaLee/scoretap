from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.accounts.models import User
from apps.accounts.serializers.profile import UserProfileSerializer


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "is_email_verified",
            "date_joined",
            "profile",
        )
        read_only_fields = fields


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False, min_length=8)
    display_name = serializers.CharField(max_length=150)
    timezone = serializers.CharField(required=False, allow_blank=True, max_length=64)
    locale = serializers.CharField(required=False, allow_blank=True, max_length=16)

    def validate_email(self, value):
        email = User.objects.normalize_email(value)
        if User.objects.filter(email__iexact=email, deleted_at__isnull=True).exists():
            raise serializers.ValidationError("Email is already registered.")
        return email

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate_display_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Display name is required.")
        return value


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_email(self, value):
        return User.objects.normalize_email(value)


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField(required=False, allow_blank=True)


class VerifyEmailSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=6, trim_whitespace=True)

    def validate_email(self, value):
        return User.objects.normalize_email(value)

    def validate_code(self, value):
        return value.strip()


class ResendVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return User.objects.normalize_email(value)


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return User.objects.normalize_email(value)


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField(trim_whitespace=True)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False, min_length=8)

    def validate_new_password(self, value):
        validate_password(value)
        return value


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False, min_length=8)

    def validate_new_password(self, value):
        request = self.context.get("request")
        user = request.user if request else None
        validate_password(value, user=user)
        return value


class EmailChangeRequestSerializer(serializers.Serializer):
    new_email = serializers.EmailField()
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_new_email(self, value):
        return User.objects.normalize_email(value)


class EmailChangeConfirmSerializer(serializers.Serializer):
    new_email = serializers.EmailField()
    code = serializers.CharField(max_length=6, trim_whitespace=True)

    def validate_new_email(self, value):
        return User.objects.normalize_email(value)

    def validate_code(self, value):
        return value.strip()


class DeleteAccountSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    confirmation = serializers.CharField(trim_whitespace=True)

    def validate_confirmation(self, value):
        if value.strip().upper() != "DELETE":
            raise serializers.ValidationError('Type "DELETE" to confirm account deletion.')
        return value
