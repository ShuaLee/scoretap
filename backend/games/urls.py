from django.urls import include, path
from rest_framework.routers import DefaultRouter

from games.views import GameViewSet

router = DefaultRouter()
router.register("games", GameViewSet, basename="game")

urlpatterns = [
    path("", include(router.urls)),
]
