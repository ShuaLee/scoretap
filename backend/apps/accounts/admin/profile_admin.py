from django.contrib import admin

from apps.accounts.models import UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = (
        "user_email",
        "display_name",
        "timezone",
        "locale",
        "created_at",
    )
    list_filter = ("timezone", "locale", "created_at")
    search_fields = ("user__email", "display_name")
    readonly_fields = ("created_at", "updated_at")

    @admin.display(description="Email", ordering="user__email")
    def user_email(self, obj):
        return obj.user.email
