from django.contrib import admin
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
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
        approved_count = 0
        skipped_count = 0

        for recovery_request in queryset.select_related("user"):
            if not recovery_request.user_id:
                skipped_count += 1
                continue

            try:
                with transaction.atomic():
                    user = recovery_request.user
                    user.email = recovery_request.requested_email
                    user.email_verified_at = timezone.now()
                    user.email_changed_at = timezone.now()
                    user.save(
                        update_fields=[
                            "email",
                            "email_verified_at",
                            "email_changed_at",
                        ]
                    )

                    recovery_request.status = AccountRecoveryRequest.Status.APPROVED
                    recovery_request.reviewed_by = request.user
                    recovery_request.reviewed_at = timezone.now()
                    recovery_request.save(
                        update_fields=[
                            "status",
                            "reviewed_by",
                            "reviewed_at",
                            "updated_at",
                        ]
                    )
                    approved_count += 1
            except (IntegrityError, ValidationError):
                skipped_count += 1

        self.message_user(
            request,
            f"Approved {approved_count} recovery request(s); skipped {skipped_count}.",
        )

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
