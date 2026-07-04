"""
llm_providers.py — Détection d'éléments + connexions via un LLM de vision.

Trois fournisseurs, clé API fournie par l'utilisateur (interface HTML) :
  * openai     -> ChatGPT (gpt-4o…)      SDK : openai
  * anthropic  -> Claude (claude-opus-4-8…) SDK : anthropic
  * gemini     -> Gemini (gemini-2.5-flash…) SDK : google-genai

Principe :
  * l'image est réduite avant l'envoi (moins de tokens, moins cher) ;
  * on demande au modèle des coordonnées NORMALISÉES dans [0, 1], reconverties
    ensuite en pixels de l'image d'origine (les LLM sont peu fiables en pixels
    absolus, surtout sur de grandes images) ;
  * le modèle renvoie aussi des connexions entre éléments (relations).

Sortie : (points, edges, largeur, hauteur) au format interne de l'annotateur.

⚠️ Ce module dépend de SDK et de clés API externes ; il n'est pas testable hors
ligne. Chaque import est protégé et chaque erreur est remontée telle quelle.
"""

from __future__ import annotations

import base64
import io
import json
import math

# Modèles par défaut selon le fournisseur.
DEFAULT_MODELS = {
    "openai": "gpt-4o",
    "anthropic": "claude-opus-4-8",
    "gemini": "gemini-2.5-flash",
}

# Couleurs d'arêtes (mêmes teintes que le HTML) + repli sur une palette.
EDGE_PALETTE = ["#2c7fb8", "#31a354", "#e6550d", "#756bb1", "#c51b8a",
                "#1c9099", "#d95f0e", "#5254a3", "#8c6d31", "#843c39"]
KNOWN_EDGE_COLORS = {
    "accès": "#2c7fb8", "acces": "#2c7fb8", "circulation": "#31a354",
    "évacuation": "#e6550d", "evacuation": "#e6550d", "adjacent": "#756bb1",
}

MAX_DIM = 1536          # côté max de l'image envoyée au LLM


# ============================================================================= #
#  Prompt commun
# ============================================================================= #
def _build_prompt(categories: dict, want_connections: bool) -> str:
    lignes = []
    for nom, cfg in categories.items():
        indices = ", ".join(cfg.get("prompts", [])) or nom
        lignes.append(f'- "{nom}" (indices : {indices})')
    cats = "\n".join(lignes)

    connex = ""
    if want_connections:
        connex = (
            'Propose aussi des connexions plausibles entre éléments (relations '
            "d'accès, d'adjacence, de circulation ou d'évacuation), en référant "
            'les éléments par leur "id". Types suggérés : "accès", "circulation", '
            '"évacuation", "adjacent".\n'
        )

    return (
        "Tu es un assistant d'annotation d'images (photos de plans ou de lieux).\n"
        "Repère chaque élément VISIBLE appartenant strictement aux catégories "
        "autorisées ci-dessous. N'invente rien ; n'utilise aucune autre catégorie.\n"
        "Pour chaque élément, donne le centre en coordonnées NORMALISÉES x et y "
        "dans l'intervalle [0, 1] (origine en haut à gauche, x vers la droite, "
        "y vers le bas).\n"
        + connex +
        "Réponds UNIQUEMENT par un objet JSON valide, sans texte autour, au format :\n"
        '{"elements":[{"id":1,"categorie":"porte","x":0.52,"y":0.34}],'
        '"connexions":[{"source":1,"cible":2,"type":"accès"}]}\n\n'
        "Catégories autorisées :\n" + cats
    )


# ============================================================================= #
#  Appels par fournisseur -> texte brut du modèle
# ============================================================================= #
def _call_openai(api_key: str, model: str, data_url: str, prompt: str) -> str:
    try:
        from openai import OpenAI
    except ImportError:
        raise RuntimeError("SDK manquant : pip install openai")
    client = OpenAI(api_key=api_key)
    resp = client.chat.completions.create(
        model=model,
        max_tokens=4000,
        response_format={"type": "json_object"},
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": data_url}},
            ],
        }],
    )
    return resp.choices[0].message.content


def _call_anthropic(api_key: str, model: str, b64_png: str, prompt: str) -> str:
    try:
        import anthropic
    except ImportError:
        raise RuntimeError("SDK manquant : pip install anthropic")
    client = anthropic.Anthropic(api_key=api_key)
    schema = {
        "type": "object",
        "properties": {
            "elements": {"type": "array", "items": {
                "type": "object",
                "properties": {"id": {"type": "integer"}, "categorie": {"type": "string"},
                               "x": {"type": "number"}, "y": {"type": "number"}},
                "required": ["id", "categorie", "x", "y"], "additionalProperties": False}},
            "connexions": {"type": "array", "items": {
                "type": "object",
                "properties": {"source": {"type": "integer"}, "cible": {"type": "integer"},
                               "type": {"type": "string"}},
                "required": ["source", "cible", "type"], "additionalProperties": False}},
        },
        "required": ["elements", "connexions"], "additionalProperties": False,
    }
    msg = client.messages.create(
        model=model,
        max_tokens=8000,
        output_config={"format": {"type": "json_schema", "schema": schema}},
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64",
                 "media_type": "image/png", "data": b64_png}},
                {"type": "text", "text": prompt},
            ],
        }],
    )
    return next((b.text for b in msg.content if b.type == "text"), "")


def _call_gemini(api_key: str, model: str, png_bytes: bytes, prompt: str) -> str:
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise RuntimeError("SDK manquant : pip install google-genai")
    client = genai.Client(api_key=api_key)
    resp = client.models.generate_content(
        model=model,
        contents=[types.Part.from_bytes(data=png_bytes, mime_type="image/png"), prompt],
        config=types.GenerateContentConfig(response_mime_type="application/json"),
    )
    return resp.text


# ============================================================================= #
#  Parsing robuste du JSON renvoyé
# ============================================================================= #
def _parse_json(text: str) -> dict:
    text = (text or "").strip()
    try:
        return json.loads(text)
    except Exception:
        # Récupère le premier objet {...} même s'il y a du texte autour.
        a, b = text.find("{"), text.rfind("}")
        if a != -1 and b != -1 and b > a:
            return json.loads(text[a:b + 1])
        raise RuntimeError("Réponse du LLM non parsable en JSON")


# ============================================================================= #
#  Point d'entrée
# ============================================================================= #
def detect_llm(provider: str, api_key: str, model: str, image,
               categories: dict, want_connections: bool = True):
    """Détecte via un LLM. Renvoie (points, edges, largeur, hauteur, types_connexion).

    points : {id, nom, x, y, couleur}  (x, y en pixels de l'image d'origine)
    edges  : {id, source, cible, type, couleur, distance}
    """
    if not api_key:
        raise RuntimeError("Clé API manquante pour le fournisseur " + provider)
    model = model or DEFAULT_MODELS.get(provider, "")

    # Image réduite pour l'envoi ; on garde les dimensions d'origine pour l'échelle.
    orig_w, orig_h = image.size
    small = image.convert("RGB").copy()
    small.thumbnail((MAX_DIM, MAX_DIM))
    buf = io.BytesIO()
    small.save(buf, format="PNG")
    png_bytes = buf.getvalue()
    b64 = base64.b64encode(png_bytes).decode()
    data_url = "data:image/png;base64," + b64

    prompt = _build_prompt(categories, want_connections)

    if provider == "openai":
        text = _call_openai(api_key, model, data_url, prompt)
    elif provider == "anthropic":
        text = _call_anthropic(api_key, model, b64, prompt)
    elif provider == "gemini":
        text = _call_gemini(api_key, model, png_bytes, prompt)
    else:
        raise RuntimeError("Fournisseur inconnu : " + provider)

    data = _parse_json(text)

    # --- Points : normalisé [0,1] -> pixels d'origine ---
    points, id_map = [], {}
    for i, el in enumerate(data.get("elements", []), start=1):
        nom = str(el.get("categorie", "")).strip().lower()
        if nom not in categories:
            continue                                   # ignore les hors-catégorie
        x = _clamp(float(el.get("x", 0)), 0.0, 1.0)
        y = _clamp(float(el.get("y", 0)), 0.0, 1.0)
        pid = len(points) + 1
        id_map[el.get("id")] = pid                     # id du LLM -> id séquentiel
        points.append({"id": pid, "nom": nom,
                       "x": round(x * orig_w), "y": round(y * orig_h),
                       "couleur": categories[nom]["couleur"]})

    # --- Connexions : remappe les ids, couleur par type ---
    coords = {p["id"]: (p["x"], p["y"]) for p in points}
    type_colors, edges = {}, []
    for c in data.get("connexions", []):
        s = id_map.get(c.get("source"))
        t = id_map.get(c.get("cible"))
        if s is None or t is None or s == t:
            continue
        typ = str(c.get("type", "lien")).strip().lower() or "lien"
        couleur = _color_for_type(typ, type_colors)
        dist = round(math.hypot(coords[s][0] - coords[t][0], coords[s][1] - coords[t][1]))
        edges.append({"id": len(edges) + 1, "source": s, "cible": t,
                      "type": typ, "couleur": couleur, "distance": dist})

    return points, edges, orig_w, orig_h, type_colors


def _clamp(v, lo, hi):
    return max(lo, min(hi, v))


def _color_for_type(typ: str, assigned: dict) -> str:
    if typ in assigned:
        return assigned[typ]
    couleur = KNOWN_EDGE_COLORS.get(typ) or EDGE_PALETTE[len(assigned) % len(EDGE_PALETTE)]
    assigned[typ] = couleur
    return couleur
