from django.contrib import admin

from apps.teams.models import TeamPlayer


@admin.register(TeamPlayer)
class TeamPlayerAdmin(admin.ModelAdmin):
    list_display = (
        "display_name",
        "team",
        "linked_user_email",
        "is_assigned",
        "is_active",
    )
    list_filter = (
        "is_active",
        "created_at",
    )
    search_fields = ("display_name", "team__name", "linked_user__email")
    readonly_fields = ("created_at", "updated_at")

    @admin.display(description="Linked User", ordering="linked_user__email")
    def linked_user_email(self, obj):
        return obj.linked_user.email if obj.linked_user_id else ""

    @admin.display(boolean=True, description="Assigned")
    def is_assigned(self, obj):
        return obj.is_assigned
