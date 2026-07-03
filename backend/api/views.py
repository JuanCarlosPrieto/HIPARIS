from django.shortcuts import render

# Create your views here.
from rest_framework.response import Response
from rest_framework.decorators import api_view
import uuid
from pathlib import Path
import json
from django.http import FileResponse


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
    file_path = Path("bdd") / id_musee / id_bat / "plan.txt"

    # 1. si fichier n'existe pas
    if not file_path.exists():
        return Response({
            "message": "No plan found",
            "plan": {}
        })

    # 2. lire et parser JSON
    with open(file_path, "r", encoding="utf-8") as f:
        try:
            plan = json.load(f)
        except json.JSONDecodeError:
            return Response({
                "error": "Corrupted plan file"
            }, status=500)

    # 3. retourner proprement
    return Response(plan)



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
    image_name = request.FILES.get('image')
    data = request.data
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
    file.write("file_path"+";;"+data.get("size_x")+data.get("size_y")+"\n")
    file.close()

    # sauvegarde fichier
    with open(file_path, "wb+") as f:
        for chunk in image_name.chunks():
            f.write(chunk)

    return Response({
        "message": "Image uploaded",
        "path": str(file_path)
    })


@api_view(['GET'])
def get_image(request, id_musee, id_batiment, image_id):
    image_path = Path("bdd") / id_musee / id_batiment / image_id

    if not image_path.exists():
        return Response({"error": "Image not found"}, status=404)

    return FileResponse(open(image_path, "rb"), content_type="image/jpeg")


#Exemple update plan :
# {
#   "liste": ["img1", "img2"],
#   "img1": {
#     "etage": 1,
#     "x": 10,
#     "y": 20,
#     "size_x": 100,
#     "size_y": 200
#   }
# }
@api_view(['POST'])
def update_plan(request, musee_id, batiment_id):
    data = request.data

    # dossier cible
    folder = Path("bdd") / musee_id / batiment_id
    folder.mkdir(parents=True, exist_ok=True)

    file_path = folder / "plan.txt"

    # 1. Charger ancien plan si existe
    if file_path.exists():
        with open(file_path, "r", encoding="utf-8") as f:
            try:
                existing_plan = json.load(f)
            except json.JSONDecodeError:
                existing_plan = {}
    else:
        existing_plan = {}
    existing_plan = {}
    # 2. Fusion intelligente
    # (on remplace les clés reçues)
    for key, value in data.items():
        existing_plan[key] = value


    #INTEGRER ICI LA TRANSFORMATION EN GRAPHE



    # 3. Sauvegarde propre (JSON formaté)
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(existing_plan, f, indent=4, ensure_ascii=False)

    return Response({
        "message": "Plan updated",
        "plan": existing_plan
    })


@api_view(['GET'])
def list_images(request, id_musee, id_batiment):
    folder = Path("bdd") / id_musee / id_batiment

    if not folder.exists():
        return Response({"images": []})

    # 2. lire metadata si existe
    meta_file = folder / "plans_batiments.txt"

    metadata = {}
    if meta_file.exists():
        with open(meta_file, "r", encoding="utf-8") as f:
            for line in f.readlines():
                parts = line.strip().split(";;")
                if len(parts) >= 3:
                    image_id, size_x, size_y = parts[:3]
                    metadata[image_id] = {
                        "size_x": size_x,
                        "size_y": size_y
                    }

    return Response({metadata})


@api_view(['POST'])
def delete_image(request, id_musee, id_batiment):
    image_id = request.data.get("image_id")
    if not file:
        return Response({"error": "No image provided"}, status=400)

    # chemin cible
    folder = Path("bdd") / id_musee / id_batiment
    folder.mkdir(parents=True, exist_ok=True)
    file_path = folder / "plans_batiments.txt"
    # 2. créer fichier si besoin
    if not file_path.exists():
        file_path.write_text("")  # fichier vide
    file = open('bdd/'+id_musee+"/"+id_batiment+"/plans_batiments.txt", 'r', encoding='utf-8').readlines()
    file.close()
    f2 = open('bdd/'+id_musee+"/"+id_batiment+"/plans_batiments.txt", 'w', encoding='utf-8')
    for e in file:
        if e.split(";;")[0] != image_id:
            f2.write(e)
    f2.close()


    return Response({
        "message": "Image deleted",
        "path": str(file_path)
    })



@api_view(['GET'])
def hello_api(request):
    return Response({"message": "Hello depuis Django API 🚀"})