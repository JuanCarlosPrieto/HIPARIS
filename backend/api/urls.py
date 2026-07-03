from django.urls import path
from .views import hello_api, musee_liste,get_musee,get_batiment_from_musee,create_musee,create_batiment,upload_image,get_image,update_plan,list_images

urlpatterns = [
    path('hello/', hello_api),#fonction de test
    path('musees/', musee_liste),#donne la liste de tous les musées
    path('musee/<str:id>/', get_musee),#donne la liste du batiment d'un musée donné
    path('musee/<str:id_musee>/<str:id_batiment>/', get_batiment_from_musee),#donne le plan d'un batiment donné, attention, ne charge pas les images, juste le plan
    path('musees/addmusee/', create_musee),#crée un musée, prend en paramètre un json avec le nom du musée et l'id de l'utilisateur qui le crée
    path('musees/<str:id_musee>/addbatiment/', create_batiment),#crée un batiment, prend en paramètre un json avec le nom du batiment et l'id de l'utilisateur qui le crée
    path('musees/<str:id_musee>/<str:id_batiment>/image/', upload_image),#crée une image, prend en paramètre un json avec l'image encodée en base64 et l'id de l'utilisateur qui la crée
    path('musees/<str:id_musee>/<str:id_batiment>/image/<str:image_id>/', get_image),#donne l'image encodée en base64, prend en paramètre l'id de l'image
    path('musees/<str:id_musee>/<str:id_batiment>/upload_plan', update_plan),#crée un plan, prend en paramètre un json avec le plan encodé en base64 et l'id de l'utilisateur qui le crée
    path('musees/<str:id_musee>/<str:id_batiment>/getimagelist', list_images),#donne le plan d'un batiment donné, attention, ne charge pas les images, juste le plan
]