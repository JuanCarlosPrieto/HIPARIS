from django.shortcuts import render

# Create your views here.
from rest_framework.response import Response
from rest_framework.decorators import api_view
import uuid
from pathlib import Path


@api_view(['GET'])
def musee_liste(request):
    file = open('bdd/listemusees.txt', 'r', encoding='utf-8').readlines()
    dico = {}
    for e in file:
        e = e.replace("\n","").split(";;")
        dico[e[0]] = {"name":e[1],"user_id":e[2]}


    return Response(dico)

@api_view(['GET'])
def get_musee(request, id):
    file = open('bdd/'+id+"/batiments.txt", 'r', encoding='utf-8').readlines()
    dico = {}
    for e in file:
        e = e.replace("\n","").split(";;")
        dico[e[0]] = e[1]
    

    return Response(dico)

@api_view(['GET'])
def get_batiment_from_musee(request, id_musee, id_bat):
    file = open('bdd/'+id_musee+"/"+id_bat+".txt", 'r', encoding='utf-8').readlines()
    dico = {}
    # a completer quand j'ai une idée de la geule du fichier.

    return Response(dico)

@api_view(['POST'])
def create_musee(request):
    data = request.data  # 🔥 JSON automatiquement parsé
    file = open('bdd/listemusees.txt', 'r', encoding='utf-8').readlines()

    for e in file:
        musee_name_stock = e.split(";;")[1]
        if musee_name_stock == data.get('name'):
            return Response({"message": "Musée déjà existant"}, status=400)


    user_id = data.get('user_id')
    name = data.get('name')
    musee_id = str(uuid.uuid4())
    file = open('bdd/listemusees.txt', 'a', encoding='utf-8')
    file.write(musee_id+";;"+name+";;"+user_id+"\n")
    file.close()

    return Response({
        "message": "Musée créé",
        "user_id": user_id,
        "musee_id": musee_id,
        "name": name
    })

@api_view(['POST'])
def create_batiment(request, id_musee):
    data = request.data  # 🔥 JSON automatiquement parsé
    base = Path("bdd")
    musee_folder = base / id_musee
    file_path = musee_folder / "batiments.txt"

    # 1. créer dossier si besoin
    musee_folder.mkdir(parents=True, exist_ok=True)

    # 2. créer fichier si besoin
    if not file_path.exists():
        file_path.write_text("")  # fichier vide

    file = open('bdd/'+id_musee+"/batiments.txt", 'r', encoding='utf-8').readlines()

    for e in file:
        batiment_name_stock = e.replace("\n","").split(";;")[1]
        if batiment_name_stock == data.get('name'):
            return Response({"message": "Batiment déjà existant"}, status=400)


    name = data.get('name')
    batiment_id = str(uuid.uuid4())
    file = open('bdd/'+id_musee+"/batiments.txt", 'a', encoding='utf-8')
    file.write(batiment_id+";;"+name+"\n")
    file.close()

    return Response({
        "message": "Batiment créé",
        "musee_id": id_musee,
        "batiment_id": batiment_id,
        "name": name
    })


@api_view(['POST'])
def upload_image(request, id_musee, id_batiment):
    file = request.FILES.get('image')

    if not file:
        return Response({"error": "No image provided"}, status=400)

    # chemin cible
    folder = Path("bdd") / id_musee / id_batiment
    folder.mkdir(parents=True, exist_ok=True)
    file_path = folder / "plans_batiments.txt"
    # 2. créer fichier si besoin
    if not file_path.exists():
        file_path.write_text("")  # fichier vide
    file_path = str(uuid.uuid4()) + ".jpg"
    file = open('bdd/'+id_musee+"/"+id_batiment+"/plans_batiments.txt", 'a', encoding='utf-8')
    file.write("nom_d_image"+";;"+file_path+"\n")
    file.close()

    # sauvegarde fichier
    with open(file_path, "wb+") as f:
        for chunk in file.chunks():
            f.write(chunk)

    return Response({
        "message": "Image uploaded",
        "path": str(file_path)
    })



@api_view(['GET'])
def hello_api(request):
    return Response({"message": "Hello depuis Django API 🚀"})