from django.core.exceptions import ValidationError


class PasswordComplexityValidator:
    message = (
        "Password must include at least one uppercase letter, one lowercase letter, "
        "one number, and one symbol."
    )

    def validate(self, password, user=None):
        checks = (
            any(char.isupper() for char in password),
            any(char.islower() for char in password),
            any(char.isdigit() for char in password),
            any(not char.isalnum() for char in password),
        )
        if not all(checks):
            raise ValidationError(self.message, code="password_complexity")

    def get_help_text(self):
        return self.message
