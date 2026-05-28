from apps.accounts.models import AuthEvent


class AuthEventService:
    @staticmethod
    def log_event(
        *,
        user=None,
        event_type: str,
        ip_address: str | None = None,
        user_agent: str = "",
        metadata: dict | None = None,
    ) -> AuthEvent:
        return AuthEvent.objects.create(
            user=user,
            event_type=event_type,
            ip_address=ip_address,
            user_agent=user_agent,
            metadata=metadata or {},
        )
