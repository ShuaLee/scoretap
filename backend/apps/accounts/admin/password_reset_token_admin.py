from django.contrib import admin

from apps.accounts.models import PasswordResetToken


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    list_display = (
        "user_email",
        "is_valid",
        "expires_at",
        "consumed_at",
        "created_at",
    )
    list_filter = ("expires_at", "consumed_at", "created_at")
    search_fields = ("user__email",)
    readonly_fields = (
        "user",
        "expires_at",
        "consumed_at",
        "created_at",
        "is_valid",
        "is_expired",
        "is_consumed",
    )

    @admin.display(description="Email", ordering="user__email")
    def user_email(self, obj):
        return obj.user.email

    @admin.display(boolean=True, description="Valid")
    def is_valid(self, obj):
        return obj.is_valid

    @admin.display(boolean=True, description="Expired")
    def is_expired(self, obj):
        return obj.is_expired

    @admin.display(boolean=True, description="Consumed")
    def is_consumed(self, obj):
        return obj.is_consumed

    def has_add_permission(self, request):
        return False
