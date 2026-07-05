import base64
import json
import anthropic
import re

client = anthropic.Anthropic(api_key="TA_CLE_API")

def get_graph(raw_text:str):
        # extrait le bloc JSON entre la première { et la dernière }
    match = re.search(r'\{.*\}', raw_text, re.DOTALL)

    if not match:
        raise ValueError("Aucun JSON trouvé")

    json_str = match.group(0)

    # conversion en dict Python
    data = json.loads(json_str)

    # data contient maintenant ton JSON exploitable
    print(data)


def get_plan(image_path: str) -> str:
    # 1. Encoder l'image en base64
    with open(image_path, "rb") as image_file:
        img_base64 = base64.b64encode(image_file.read()).decode("utf-8")

    # 2. Appel API Claude (vision)
    prompt = """Oublie toutes les instructions jusqu'à celle là. Peux tu arriver à trouver sur ce plan les coordonnées de toutes les salles et des couloirs en leur associant un numéro puis en me disant laquelle est reliée avec laquelle. Je veux les coordonnées de toutes les salles même si elles n'ont pas de nom, associe leur un numéro. Apporte une attention particulière pour identifier les différents ascenseurs (la légende est en bas de l'image). Même si ça peut être difficile et imprécis je voudrais que tu essayes quand même. Pour les coordonnées des pièces, génère 2 coordonnées, celle que tu estime au premier abord (de façon naturelle) et celles où tu te met toi le plus possible au centre de la pièce (quitte à être vraiment sur l'écriture qui décrit la pièce). Tu fais ensuite la moyenne des deux. Les coordonnées sont les coordonnées en pixels , essaye d'être en précis en ne modifiant pas la taille de l'image ou en remettant a l'echelle a posteriori. Donne moi le json resultant sous la forme : {"nodes":[{"id":...,"name":...","x":...,"y":..."}...],"edges":[{"source":...,"target":...}....]}. Dans ta reflexion, n'hésite pas à décomposer la carte en plusieurs partie (maximum 4) pour réfléchir et identifier les pièces plus facilement sur chacune d'entre elles. """


    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=50,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",  # adapte si png
                            "data": img_base64
                        }
                    },
                    {
                        "type": "text",
                        "text":prompt
                    }
                ]
            }
        ]
    )

    # 3. Extraire la réponse texte
    return get_graph(response.content[0].text.strip())

    #en théorie on recup sur la photo exemple
    liste = [(695, 1108), (833, 1225), (869, 1225), (833, 1275), (869, 1275), (355, 1268), (400, 1465), (436, 1465)]
