# Generated manually for the initial waitlist signup table.

import django.db.models.functions.text
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="WaitlistSignup",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("email", models.EmailField(max_length=254)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="waitlistsignup",
            constraint=models.UniqueConstraint(
                django.db.models.functions.text.Lower("email"),
                name="unique_waitlist_email_ci",
            ),
        ),
    ]
