from django.db import IntegrityError
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.waitlist.models import WaitlistSignup
from apps.waitlist.serializers import WaitlistSignupSerializer


class WaitlistSignupView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = WaitlistSignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]

        if WaitlistSignup.objects.filter(email__iexact=email).exists():
            return Response(
                {"detail": "You're on the waitlist."},
                status=status.HTTP_200_OK,
            )

        try:
            WaitlistSignup.objects.create(email=email)
            response_status = status.HTTP_201_CREATED
        except IntegrityError:
            response_status = status.HTTP_200_OK

        return Response(
            {"detail": "You're on the waitlist."},
            status=response_status,
        )
