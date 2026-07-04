from django.shortcuts import render

# Create your views here.
from rest_framework.response import Response
from rest_framework.decorators import api_view
import uuid
from pathlib import Path
import json
from django.http import FileResponse



@api_view(['GET'])
def image_plan(request):
    # image = request.FILES.get('image')
    data = request.data
    image_path = data.get("image_path")

    if not image_path:
        return Response({"error": "No image provided"}, status=400)
    return get_plan(image_path)

