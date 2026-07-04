"""
server.py — Pont local entre l'annotateur HTML et le détecteur OWLv2.

Démarre un serveur FastAPI qui :
  * sert la page `annotateur_image.html` sur http://localhost:8000/  (même
    origine que l'API -> aucun souci CORS) ;
  * expose POST /detect : reçoit une image (base64) + des paramètres, lance
    OWLv2 (modèle gardé en mémoire), renvoie le JSON attendu par le bouton
    « Annotation IA » de la page.

Lancement :
    pip install -r requirements.txt
    python server.py
Puis ouvre http://localhost:8000/ dans le navigateur.

La page fonctionne aussi en `file://` (usage manuel) ; seul le bouton IA
nécessite ce serveur (CORS activé pour le cas file://).
"""

from __future__ import annotations

import base64
import io
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from PIL import Image
from pydantic import BaseModel

import auto_annotate as aa
import llm_providers as llm

HTML_PATH = Path(__file__).parent / "annotateur_image.html"

app = FastAPI(title="Annotateur IA")

# file:// envoie Origin=null ; "*" (sans credentials) le couvre aussi.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


class DetectRequest(BaseModel):
    image: str                              # data URL (data:image/...;base64,) ou base64 brut
    nom_fichier: str | None = None
    provider: str = "owlv2"                 # owlv2 | openai | anthropic | gemini
    api_key: str | None = None              # clé API pour les fournisseurs LLM
    conf: float = 0.1
    dedup_px: float = 25.0
    connexions: str = "none"                # none | delaunay | knn (repli pour owlv2/LLM)
    k: int = 3
    max_dist: float | None = None
    model: str | None = None
    device: str = "auto"
    categories: dict | None = None          # {nom: {prompts:[...], couleur:"#.."}}


def _decode_image(data: str) -> Image.Image:
    b64 = data.split(",", 1)[1] if data.startswith("data:") else data
    try:
        return Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")
    except Exception as exc:                       # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Image illisible : {exc}") from exc


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "device": aa.resolve_device("auto")}


@app.get("/")
def index() -> FileResponse:
    if not HTML_PATH.exists():
        raise HTTPException(status_code=404, detail="annotateur_image.html introuvable")
    return FileResponse(HTML_PATH)


@app.post("/detect")
def detect(req: DetectRequest) -> dict:
    categories = req.categories or aa.CATEGORIES
    if not categories:
        raise HTTPException(status_code=400, detail="Aucune catégorie fournie")

    image = _decode_image(req.image)
    name = req.nom_fichier or "image"
    types_connexion = None

    if req.provider == "owlv2":
        # --- Détecteur local OWLv2 ---
        device = aa.resolve_device(req.device)
        model_id = req.model or aa.DEFAULT_MODELS["owlv2"]
        try:
            raw, width, height = aa.detect_owlv2_pil(image, categories, req.conf, model_id, device)
        except Exception as exc:                    # noqa: BLE001
            raise HTTPException(status_code=500, detail=f"Échec de la détection : {exc}") from exc
        points = aa.finalize_points(raw, req.dedup_px)
        edges = aa.build_connections(points, req.connexions, req.k, req.max_dist)
    else:
        # --- Vision-LLM (openai / anthropic / gemini) : points + connexions ---
        try:
            points, edges, width, height, types_connexion = llm.detect_llm(
                req.provider, req.api_key or "", req.model, image, categories,
                want_connections=True)
        except Exception as exc:                    # noqa: BLE001
            raise HTTPException(status_code=502, detail=f"Échec du LLM : {exc}") from exc
        # Repli : si le LLM ne propose aucune arête, on génère un graphe local.
        if not edges and req.connexions != "none":
            edges = aa.build_connections(points, req.connexions, req.k, req.max_dist)

    print(f"[/detect] {req.provider} {name} {width}x{height} -> "
          f"{len(points)} point(s), {len(edges)} arête(s)")
    return aa.build_output(name, width, height, points, edges, categories, types_connexion)


if __name__ == "__main__":
    import uvicorn
    print("Ouvre http://localhost:8000/  (Ctrl+C pour arrêter)")
    uvicorn.run(app, host="127.0.0.1", port=8000)
