from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from games.models import Game
from games.serializers import (
    CreateGameSerializer,
    GameEventSerializer,
    GameSerializer,
    PlateAppearanceSerializer,
)
from games.services.scoring import (
    finalize_game,
    record_plate_appearance,
    undo_last_event,
)
from games.services.summary import build_game_summary


class GameViewSet(ModelViewSet):
    queryset = Game.objects.prefetch_related("teams__players", "events").all()
    serializer_class = GameSerializer
    http_method_names = ["get", "post"]

    def get_serializer_class(self):
        if self.action == "create":
            return CreateGameSerializer

        return GameSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        game = serializer.save()

        return Response(
            GameSerializer(game, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="plate-appearances")
    def plate_appearances(self, request, pk=None):
        game = self.get_object()
        serializer = PlateAppearanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        event = record_plate_appearance(
            game=game,
            result=serializer.validated_data["result"],
        )

        return Response(
            {
                "game": GameSerializer(
                    event.game,
                    context=self.get_serializer_context(),
                ).data,
                "event_id": event.id,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def undo(self, request, pk=None):
        game = undo_last_event(self.get_object())
        return Response(GameSerializer(game, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"])
    def finalize(self, request, pk=None):
        game = finalize_game(self.get_object())
        return Response(GameSerializer(game, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["get"])
    def events(self, request, pk=None):
        game = self.get_object()
        events = game.events.select_related("team", "batter")
        serializer = GameEventSerializer(
            events,
            many=True,
            context=self.get_serializer_context(),
        )
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def summary(self, request, pk=None):
        return Response(build_game_summary(self.get_object()))
