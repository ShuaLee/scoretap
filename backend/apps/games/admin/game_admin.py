from django.contrib import admin

from apps.games.models import Game, GamePlayer, GameTeam


class GameTeamInline(admin.TabularInline):
    model = GameTeam
    extra = 0
    fields = ("side", "linked_team", "display_name", "is_tracked")


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = (
        "game_type",
        "tracking_mode",
        "team",
        "matchup_label",
        "number_of_innings",
        "game_date",
        "start_time",
        "status",
        "location",
        "created_by_email",
    )
    list_filter = ("game_type", "tracking_mode", "status", "game_date", "created_at")
    search_fields = ("team__name", "opponent_name", "location", "created_by__email")
    readonly_fields = (
        "started_at",
        "completed_at",
        "cancelled_at",
        "created_at",
        "updated_at",
    )
    inlines = (GameTeamInline,)

    @admin.display(description="Created By", ordering="created_by__email")
    def created_by_email(self, obj):
        return obj.created_by.email


@admin.register(GameTeam)
class GameTeamAdmin(admin.ModelAdmin):
    list_display = (
        "display_name",
        "game",
        "side",
        "linked_team",
        "is_tracked",
        "created_at",
    )
    list_filter = ("side", "is_tracked", "created_at")
    search_fields = ("display_name", "game__opponent_name", "linked_team__name")
    readonly_fields = ("created_at", "updated_at")


@admin.register(GamePlayer)
class GamePlayerAdmin(admin.ModelAdmin):
    list_display = (
        "display_name",
        "game_team",
        "batting_order",
        "linked_team_player",
        "is_active",
        "created_at",
    )
    list_filter = ("is_active", "created_at")
    search_fields = (
        "display_name",
        "game_team__display_name",
        "linked_team_player__display_name",
    )
    readonly_fields = ("created_at", "updated_at")
