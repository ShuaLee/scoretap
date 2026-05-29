from django.contrib import admin

from apps.teams.models import Team, TeamPlayer


class TeamPlayerInline(admin.TabularInline):
    model = TeamPlayer
    extra = 0
    fields = (
        "display_name",
        "linked_user",
        "is_active",
        "removed_at",
    )


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ("name", "owner_email", "is_archived", "created_at")
    list_filter = ("archived_at", "created_at")
    search_fields = ("name", "owner__email")
    readonly_fields = ("created_at", "updated_at")
    inlines = (TeamPlayerInline,)

    @admin.display(description="Owner", ordering="owner__email")
    def owner_email(self, obj):
        return obj.owner.email

    @admin.display(boolean=True, description="Archived")
    def is_archived(self, obj):
        return obj.is_archived
