from django.urls import path

from .views import AnalyzePlanView, HealthView


urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("ai/analyze-plan/", AnalyzePlanView.as_view(), name="ai-analyze-plan"),
]