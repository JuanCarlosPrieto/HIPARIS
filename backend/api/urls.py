from django.urls import path
from .views import image_plan
urlpatterns = [
    path('transforimage/', image_plan),
]