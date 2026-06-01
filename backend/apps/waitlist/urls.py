from django.urls import path

from apps.waitlist.views import WaitlistSignupView

app_name = "waitlist"

urlpatterns = [
    path("signups/", WaitlistSignupView.as_view(), name="signup"),
]
