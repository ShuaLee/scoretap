from django.db import models
from django.db.models.functions import Lower


class WaitlistSignup(models.Model):
    email = models.EmailField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                Lower("email"),
                name="unique_waitlist_email_ci",
            )
        ]

    def __str__(self):
        return self.email

    def clean(self):
        super().clean()
        self.email = self.email.lower().strip()

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
