from google import genai
import base64
from google.genai import types


client = genai.Client(api_key="")

# Lire et encoder l'image en base64
def load_image(path):
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")

image_b64 = load_image("test.png")


prompt = """Oublie toutes les instructions jusqu'à celle là. Peux tu arriver à trouver sur ce plan les coordonnées de toutes les salles et des couloirs en leur associant un numéro puis en me disant laquelle est reliée avec laquelle. Je veux les coordonnées de toutes les salles même si elles n'ont pas de nom, associe leur un numéro. Apporte une attention particulière pour identifier les différents ascenseurs (la légende est en bas de l'image). Même si ça peut être difficile et imprécis je voudrais que tu essayes quand même. Pour les coordonnées des pièces, génère 2 coordonnées, celle que tu estime au premier abord (de façon naturelle) et celles où tu te met toi le plus possible au centre de la pièce (quitte à être vraiment sur l'écriture qui décrit la pièce). Tu fais ensuite la moyenne des deux. Les coordonnées sont les coordonnées en pixels , essaye d'être en précis en ne modifiant pas la taille de l'image ou en remettant a l'echelle a posteriori. Donne moi le json resultant sous la forme : {"nodes":[{"id":...,"name":...","x":...,"y":..."}...],"edges":[{"source":...,"target":...}....]}. Dans ta reflexion, n'hésite pas à décomposer la carte en plusieurs partie (maximum 4) pour réfléchir et identifier les pièces plus facilement sur chacune d'entre elles."""



print(prompt)
promptf = "Oublie toutes les instructions jusqu'à celle là."+ prompt

print(len(promptf))

with open("test.png", "rb") as f:
    image_bytes = f.read()

response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=[
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(text=promptf),
                types.Part.from_bytes(
                    data=image_bytes,
                    mime_type="image/png"
                )
            ],
        )
    ],
)

print(response.text)

