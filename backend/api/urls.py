from django.urls import path
from .views import hello_api, musee_liste,get_musee,get_batiment_from_musee,create_musee,create_batiment,upload_image

urlpatterns = [
    path('hello/', hello_api),
    path('musees/', musee_liste),
    path('musee/<str:id>/', get_musee),
    path('musee/<str:id_musee>/<str:id_batiment>/', get_batiment_from_musee),
    path('musees/addmusee/', create_musee),
    path('musees/<str:id_musee>/addbatiment/', create_batiment),
    path('musee/<str:id_musee>/batiment/<str:id_batiment>/image/', upload_image),

]