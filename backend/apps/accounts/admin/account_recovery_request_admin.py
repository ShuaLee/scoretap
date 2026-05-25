from django.contrib import admin
from django.utils import timezone

from apps.accounts.models import AccountRecoveryRequest


@admin.register(AccountRecoveryRequest)
class AccountRecoveryRequestAdmin(admin.ModelAdmin):
    list_display = (
        "current_email",
        "requested_email",
        "status",
        "reviewed_by_email",
        "reviewed_at",
        "created_at",
    )
    list_filter = ("status", "reviewed_at", "created_at")
    search_fields = (
        "user__email",
        "current_email",
        "requested_email",
        "message",
        "review_note",
    )
    readonly_fields = ("created_at", "updated_at")
    actions = ("mark_approved", "mark_rejected", "mark_cancelled")

    @admin.display(description="Reviewed By", ordering="reviewed_by__email")
    def reviewed_by_email(self, obj):
        return obj.reviewed_by.email if obj.reviewed_by_id else ""

    @admin.action(description="Mark selected requests approved")
    def mark_approved(self, request, queryset):
        count = queryset.update(
            status=AccountRecoveryRequest.Status.APPROVED,
            reviewed_by=request.user,
            reviewed_at=timezone.now(),
        )
        self.message_user(request, f"Approved {count} recovery request(s).")

    @admin.action(description="Mark selected requests rejected")
    def mark_rejected(self, request, queryset):
        count = queryset.update(
            status=AccountRecoveryRequest.Status.REJECTED,
            reviewed_by=request.user,
            reviewed_at=timezone.now(),
        )
        self.message_user(request, f"Rejected {count} recovery request(s).")

    @admin.action(description="Mark selected requests cancelled")
    def mark_cancelled(self, request, queryset):
        count = queryset.update(
            status=AccountRecoveryRequest.Status.CANCELLED,
            reviewed_by=request.user,
            reviewed_at=timezone.now(),
        )
        self.message_user(request, f"Cancelled {count} recovery request(s).")
