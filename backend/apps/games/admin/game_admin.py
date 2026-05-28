from django.contrib import admin

from apps.games.models import Game


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = (
        "team",
        "matchup_label",
        "game_date",
        "start_time",
        "status",
        "location",
        "created_by_email",
    )
    list_filter = ("status", "game_date", "created_at")
    search_fields = ("team__name", "opponent_name", "location", "created_by__email")
    readonly_fields = (
        "started_at",
        "completed_at",
        "cancelled_at",
        "created_at",
        "updated_at",
    )

    @admin.display(description="Created By", ordering="created_by__email")
    def created_by_email(self, obj):
        return obj.created_by.email
