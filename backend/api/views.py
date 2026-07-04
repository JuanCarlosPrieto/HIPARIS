from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
import logging

from django.conf import settings

from .services.plan_ai import PlanAIError, analyze_plan_image


logger = logging.getLogger(__name__)

MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024

ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}


class HealthView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response(
            {
                "status": "ok",
                "service": "hiparis-ai",
            }
        )


class AnalyzePlanView(APIView):
    authentication_classes = []
    permission_classes = []
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        image = request.FILES.get("image")

        if image is None:
            return Response(
                {
                    "status": "error",
                    "error": "Missing image file. Expected form field: image.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if image.size > MAX_IMAGE_SIZE_BYTES:
            return Response(
                {
                    "status": "error",
                    "error": "Image is too large. Maximum size is 8 MB.",
                },
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )

        mime_type = image.content_type

        if mime_type not in ALLOWED_IMAGE_TYPES:
            return Response(
                {
                    "status": "error",
                    "error": f"Unsupported image type: {mime_type}. Use jpeg, png or webp.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        floor_id = request.data.get("floor_id") or None
        real_width_meters = _optional_float(request.data.get("real_width_meters"))
        real_height_meters = _optional_float(request.data.get("real_height_meters"))

        try:
            proposal = analyze_plan_image(
                image_bytes=image.read(),
                mime_type=mime_type,
                floor_id=floor_id,
                real_width_meters=real_width_meters,
                real_height_meters=real_height_meters,
            )
        except PlanAIError as exc:
            return Response(
                {
                    "status": "error",
                    "error": str(exc),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as exc:
            logger.exception("Unexpected error while analyzing the plan.")

            return Response(
                {
                    "status": "error",
                    "error": str(exc) if settings.DEBUG else "Unexpected error while analyzing the plan.",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return Response(
            {
                "status": "ok",
                "proposal": proposal,
                "metadata": {
                    "source": "ai",
                    "validated": False,
                    "floor_id": floor_id,
                    "real_width_meters": real_width_meters,
                    "real_height_meters": real_height_meters,
                },
            }
        )


def _optional_float(value):
    if value in (None, "", "null", "undefined"):
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None