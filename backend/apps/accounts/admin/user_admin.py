from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from apps.accounts.models import User, UserProfile


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    extra = 0
    readonly_fields = ("created_at", "updated_at")


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    inlines = (UserProfileInline,)
    ordering = ["-date_joined"]
    list_display = (
        "email",
        "is_email_verified",
        "is_active",
        "is_staff",
        "failed_login_count",
        "locked_until",
        "deactivated_at",
        "deleted_at",
        "date_joined",
    )
    list_filter = (
        "is_active",
        "is_staff",
        "is_superuser",
        "email_verified_at",
        "deactivated_at",
        "deleted_at",
        "date_joined",
    )
    search_fields = ("email",)
    readonly_fields = ("last_login", "date_joined")
    filter_horizontal = ("groups", "user_permissions")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (
            "Verification",
            {"fields": ("email_verified_at", "email_changed_at")},
        ),
        (
            "Security",
            {
                "fields": (
                    "failed_login_count",
                    "locked_until",
                    "last_login",
                    "last_login_ip",
                    "password_changed_at",
                )
            },
        ),
        (
            "Lifecycle",
            {"fields": ("is_active", "deactivated_at", "deleted_at")},
        ),
        (
            "Permissions",
            {
                "fields": (
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        ("Timestamps", {"fields": ("date_joined",)}),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "password1", "password2", "is_active", "is_staff"),
            },
        ),
    )

    @admin.display(boolean=True, description="Email Verified")
    def is_email_verified(self, obj):
        return obj.is_email_verified
