from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.games.models import Game
from apps.games.serializers import GameSerializer
from apps.teams.permissions import can_manage_team, can_view_team


class StartGameView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        game = get_object_or_404(Game.objects.select_related("team", "created_by"), pk=pk)
        if not can_view_team(request.user, game.team):
            raise PermissionDenied("You do not have access to this game.")
        if not can_manage_team(request.user, game.team):
            raise PermissionDenied("You do not have permission to start this game.")
        if game.status != Game.Status.SCHEDULED:
            raise ValidationError("Only scheduled games can be started.")

        game.start()
        return Response(GameSerializer(game).data, status=status.HTTP_200_OK)
