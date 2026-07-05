import base64
import json
import os
import re
from typing import Any

from google import genai
from google.genai import types


ALLOWED_ELEMENT_TYPES = {
    "entrance",
    "elevator",
    "stairs",
    "ramp",
    "door",
    "room",
    "corridor",
    "toilet",
    "accessible_toilet",
    "obstacle",
    "unknown",
}

ALLOWED_EDGE_TYPES = {
    "corridor",
    "door",
    "ramp",
    "elevator",
    "stairs",
    "manual",
    "unknown",
}


class PlanAIError(Exception):
    pass


def _get_client() -> genai.Client:
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise PlanAIError("GEMINI_API_KEY is missing.")

    return genai.Client(api_key=api_key)



def _extract_json_object(raw_text: str) -> dict[str, Any]:
    """
    Extrae el primer objeto JSON completo de la respuesta del modelo.
    El modelo debería responder solo JSON, pero esto lo hace más robusto.
    """
    if not raw_text:
        raise PlanAIError("Empty AI response.")

    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", raw_text, flags=re.DOTALL)

    if not match:
        raise PlanAIError("No JSON object found in AI response.")

    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError as exc:
        raise PlanAIError(f"Invalid JSON returned by AI: {exc}") from exc


def _clamp_float(value: Any, default: float = 0.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default

    return max(0.0, min(1.0, number))

def _normalize_bounds(value: Any) -> dict[str, float] | None:
    if not isinstance(value, dict):
        return None

    x = _clamp_float(value.get("x"), default=0.0)
    y = _clamp_float(value.get("y"), default=0.0)
    width = _clamp_float(value.get("width"), default=1.0)
    height = _clamp_float(value.get("height"), default=1.0)

    if width <= 0.05 or height <= 0.05:
        return None

    width = min(width, 1.0 - x)
    height = min(height, 1.0 - y)

    if width <= 0.05 or height <= 0.05:
        return None

    return {
        "x": x,
        "y": y,
        "width": width,
        "height": height,
    }


def _inside_bounds(
    x: float,
    y: float,
    bounds: dict[str, float],
    margin: float = 0.015,
) -> bool:
    return (
        bounds["x"] - margin <= x <= bounds["x"] + bounds["width"] + margin
        and bounds["y"] - margin <= y <= bounds["y"] + bounds["height"] + margin
    )

def _normalize_graph(data: dict[str, Any]) -> dict[str, Any]:
    floor_plan_bounds = _normalize_bounds(data.get("floor_plan_bounds"))

    elements_in = data.get("elements", [])
    edges_in = data.get("edges", [])
    warnings_in = data.get("warnings", [])

    if not isinstance(elements_in, list):
        elements_in = []

    if not isinstance(edges_in, list):
        edges_in = []

    if not isinstance(warnings_in, list):
        warnings_in = []

    elements: list[dict[str, Any]] = []
    valid_temp_ids: set[str] = set()

    for index, item in enumerate(elements_in):
        if not isinstance(item, dict):
            continue

        temp_id = str(item.get("temp_id") or f"e_{index + 1}")

        element_type = str(item.get("type") or "unknown")
        if element_type not in ALLOWED_ELEMENT_TYPES:
            element_type = "unknown"

        x = _clamp_float(item.get("x"))
        y = _clamp_float(item.get("y"))

        if floor_plan_bounds and not _inside_bounds(x, y, floor_plan_bounds):
            warnings_in.append(
                f"Element {temp_id} ignored because it is outside the detected floor plan bounds."
            )
            continue

        element = {
            "temp_id": temp_id,
            "type": element_type,
            "name": str(item.get("name") or ""),
            "x": x,
            "y": y,
            "confidence": _clamp_float(item.get("confidence"), default=0.5),
            "notes": str(item.get("notes") or ""),
        }

        elements.append(element)
        valid_temp_ids.add(temp_id)

    edges: list[dict[str, Any]] = []

    for item in edges_in:
        if not isinstance(item, dict):
            continue

        from_temp_id = str(item.get("from_temp_id") or "")
        to_temp_id = str(item.get("to_temp_id") or "")

        if from_temp_id not in valid_temp_ids or to_temp_id not in valid_temp_ids:
            continue

        edge_type = str(item.get("edge_type") or "unknown")
        if edge_type not in ALLOWED_EDGE_TYPES:
            edge_type = "unknown"

        edges.append(
            {
                "from_temp_id": from_temp_id,
                "to_temp_id": to_temp_id,
                "edge_type": edge_type,
                "confidence": _clamp_float(item.get("confidence"), default=0.5),
                "wheelchair_accessible": item.get("wheelchair_accessible"),
                "crutches_accessible": item.get("crutches_accessible"),
                "notes": str(item.get("notes") or ""),
            }
        )

    warnings = [str(w) for w in warnings_in if str(w).strip()]

    return {
        "floor_plan_bounds": floor_plan_bounds,
        "elements": elements,
        "edges": edges,
        "warnings": warnings,
    }


def analyze_plan_image(
    *,
    image_bytes: bytes,
    mime_type: str,
    floor_id: str | None = None,
    real_width_meters: float | None = None,
    real_height_meters: float | None = None,
) -> dict[str, Any]:
    if os.getenv("USE_AI_MOCK", "False") == "True":
        return {
    "elements": [
        {
            "temp_id": "e_1",
            "type": "room",
            "name": "Local Déchets (L. DECHETS)",
            "x": 0.118,
            "y": 0.698,
            "confidence": 0.9,
            "notes": "Point importé depuis le graphe fourni en mode mock.",
        },
        {
            "temp_id": "e_2",
            "type": "elevator",
            "name": "Monte-charge (MC - Bas Gauche)",
            "x": 0.185,
            "y": 0.71,
            "confidence": 0.9,
            "notes": "Point importé depuis le graphe fourni en mode mock.",
        },
        {
            "temp_id": "e_3",
            "type": "entrance",
            "name": "Accueil",
            "x": 0.175,
            "y": 0.763,
            "confidence": 0.9,
            "notes": "Point importé depuis le graphe fourni en mode mock.",
        },
        {
            "temp_id": "e_4",
            "type": "elevator",
            "name": "Ascenseurs (Double ASC - Bas Gauche)",
            "x": 0.258,
            "y": 0.773,
            "confidence": 0.9,
            "notes": "Point importé depuis le graphe fourni en mode mock.",
        },
        {
            "temp_id": "e_5",
            "type": "room",
            "name": "Cafétéria",
            "x": 0.285,
            "y": 0.605,
            "confidence": 0.9,
            "notes": "Point importé depuis le graphe fourni en mode mock.",
        },
        {
            "temp_id": "e_6",
            "type": "room",
            "name": "Sanitaire Haut-Gauche 1 (SANIT.)",
            "x": 0.183,
            "y": 0.513,
            "confidence": 0.9,
            "notes": "Point importé depuis le graphe fourni en mode mock.",
        },
        {
            "temp_id": "e_7",
            "type": "room",
            "name": "Sanitaire Haut-Gauche 2 (SANIT.)",
            "x": 0.183,
            "y": 0.553,
            "confidence": 0.9,
            "notes": "Point importé depuis le graphe fourni en mode mock.",
        },
        {
            "temp_id": "e_8",
            "type": "room",
            "name": "Local Technique (L.T.)",
            "x": 0.245,
            "y": 0.475,
            "confidence": 0.9,
            "notes": "Point importé depuis le graphe fourni en mode mock.",
        },
        {
            "temp_id": "e_9",
            "type": "room",
            "name": "Dégagement (DF - Haut Gauche 1)",
            "x": 0.28,
            "y": 0.475,
            "confidence": 0.9,
            "notes": "Point importé depuis le graphe fourni en mode mock.",
        },
        {
            "temp_id": "e_10",
            "type": "room",
            "name": "Dégagement (DF - Haut Gauche 2)",
            "x": 0.28,
            "y": 0.54,
            "confidence": 0.9,
            "notes": "Point importé depuis le graphe fourni en mode mock.",
        },
        {
            "temp_id": "e_11",
            "type": "room",
            "name": "Couloir Accueil",
            "x": 0.215,
            "y": 0.713,
            "confidence": 0.9,
            "notes": "Point importé depuis le graphe fourni en mode mock.",
        },
        {
            "temp_id": "e_12",
            "type": "room",
            "name": "Couloir Centre-Gauche (liaison Cafétéria)",
            "x": 0.22,
            "y": 0.6,
            "confidence": 0.9,
            "notes": "Point importé depuis le graphe fourni en mode mock.",
        },
        {
            "temp_id": "e_13",
            "type": "room",
            "name": "Couloir Liaison (Bas-Milieu)",
            "x": 0.36,
            "y": 0.685,
            "confidence": 0.9,
            "notes": "Point importé depuis le graphe fourni en mode mock.",
        },
        {
            "temp_id": "e_14",
            "type": "room",
            "name": "Couloir Centre-Droit",
            "x": 0.505,
            "y": 0.6,
            "confidence": 0.9,
            "notes": "Point importé depuis le graphe fourni en mode mock.",
        },
        {
            "temp_id": "e_15",
            "type": "elevator",
            "name": "Ascenseurs (Double ASC - Centre)",
            "x": 0.558,
            "y": 0.62,
            "confidence": 0.9,
            "notes": "Point importé depuis le graphe fourni en mode mock.",
        },
        {
            "temp_id": "e_16",
            "type": "room",
            "name": "Sanitaire Centre-Droit (SANIT.)",
            "x": 0.555,
            "y": 0.69,
            "confidence": 0.9,
            "notes": "Point importé depuis le graphe fourni en mode mock.",
        },
        {
            "temp_id": "e_17",
            "type": "room",
            "name": "Dégagement (DF - Centre Droit)",
            "x": 0.6,
            "y": 0.61,
            "confidence": 0.9,
            "notes": "Point importé depuis le graphe fourni en mode mock.",
        },
        {
            "temp_id": "e_18",
            "type": "room",
            "name": "Cuisines",
            "x": 0.575,
            "y": 0.485,
            "confidence": 0.9,
            "notes": "Point importé depuis le graphe fourni en mode mock.",
        },
        {
            "temp_id": "e_19",
            "type": "elevator",
            "name": "Monte-charge Double (MC MC - Cuisine)",
            "x": 0.572,
            "y": 0.445,
            "confidence": 0.9,
            "notes": "Point importé depuis le graphe fourni en mode mock.",
        },
        {
            "temp_id": "e_20",
            "type": "room",
            "name": "Couloir Haut-Droit (Axe de circulation)",
            "x": 0.56,
            "y": 0.405,
            "confidence": 0.9,
            "notes": "Point importé depuis le graphe fourni en mode mock.",
        },
        {
            "temp_id": "e_21",
            "type": "elevator",
            "name": "Monte-charge (MC - Haut Droit)",
            "x": 0.605,
            "y": 0.375,
            "confidence": 0.9,
            "notes": "Point importé depuis le graphe fourni en mode mock.",
        },
        {
            "temp_id": "e_22",
            "type": "room",
            "name": "Dégagement (DF - Milieu Haut)",
            "x": 0.48,
            "y": 0.355,
            "confidence": 0.9,
            "notes": "Point importé depuis le graphe fourni en mode mock.",
        },
        {
            "temp_id": "e_23",
            "type": "room",
            "name": "Sanitaires Vestiaires 1 (SANIT.)",
            "x": 0.525,
            "y": 0.35,
            "confidence": 0.9,
            "notes": "Point importé depuis le graphe fourni en mode mock.",
        },
        {
            "temp_id": "e_24",
            "type": "room",
            "name": "Sanitaires Vestiaires 2 (SANIT.)",
            "x": 0.535,
            "y": 0.335,
            "confidence": 0.9,
            "notes": "Point importé depuis le graphe fourni en mode mock.",
        },
        {
            "temp_id": "e_25",
            "type": "room",
            "name": "Vestiaire Hommes (VEST. H.)",
            "x": 0.555,
            "y": 0.35,
            "confidence": 0.9,
            "notes": "Point importé depuis le graphe fourni en mode mock.",
        },
        {
            "temp_id": "e_26",
            "type": "room",
            "name": "Vestiaire Femmes (VEST. F.)",
            "x": 0.56,
            "y": 0.335,
            "confidence": 0.9,
            "notes": "Point importé depuis le graphe fourni en mode mock.",
        },
        {
            "temp_id": "e_27",
            "type": "room",
            "name": "Chambre Froide 1 (CH. F.)",
            "x": 0.565,
            "y": 0.32,
            "confidence": 0.9,
            "notes": "Point importé depuis le graphe fourni en mode mock.",
        },
        {
            "temp_id": "e_28",
            "type": "room",
            "name": "Chambre Froide 2 (CH. F.)",
            "x": 0.58,
            "y": 0.29,
            "confidence": 0.9,
            "notes": "Point importé depuis le graphe fourni en mode mock.",
        },
        {
            "temp_id": "e_29",
            "type": "room",
            "name": "Chambre Froide 3 (CH. F.)",
            "x": 0.605,
            "y": 0.35,
            "confidence": 0.9,
            "notes": "Point importé depuis le graphe fourni en mode mock.",
        },
        {
            "temp_id": "e_30",
            "type": "room",
            "name": "Local Poubelles (L. POUB.)",
            "x": 0.61,
            "y": 0.31,
            "confidence": 0.9,
            "notes": "Point importé depuis le graphe fourni en mode mock.",
        },
        {
            "temp_id": "e_31",
            "type": "elevator",
            "name": "Nacelle",
            "x": 0.61,
            "y": 0.275,
            "confidence": 0.9,
            "notes": "Point importé depuis le graphe fourni en mode mock.",
        },
        {
            "temp_id": "e_32",
            "type": "entrance",
            "name": "Livraisons",
            "x": 0.62,
            "y": 0.25,
            "confidence": 0.9,
            "notes": "Point importé depuis le graphe fourni en mode mock.",
        },
    ],
    "edges": [
        {
            "from_temp_id": "e_1",
            "to_temp_id": "e_11",
            "edge_type": "corridor",
            "confidence": 0.9,
            "wheelchair_accessible": True,
            "crutches_accessible": True,
            "notes": "Connexion importée depuis le graphe fourni.",
        },
        {
            "from_temp_id": "e_2",
            "to_temp_id": "e_11",
            "edge_type": "corridor",
            "confidence": 0.9,
            "wheelchair_accessible": True,
            "crutches_accessible": True,
            "notes": "Connexion importée depuis le graphe fourni.",
        },
        {
            "from_temp_id": "e_3",
            "to_temp_id": "e_11",
            "edge_type": "corridor",
            "confidence": 0.9,
            "wheelchair_accessible": True,
            "crutches_accessible": True,
            "notes": "Connexion importée depuis le graphe fourni.",
        },
        {
            "from_temp_id": "e_4",
            "to_temp_id": "e_11",
            "edge_type": "corridor",
            "confidence": 0.9,
            "wheelchair_accessible": True,
            "crutches_accessible": True,
            "notes": "Connexion importée depuis le graphe fourni.",
        },
        {
            "from_temp_id": "e_11",
            "to_temp_id": "e_13",
            "edge_type": "corridor",
            "confidence": 0.9,
            "wheelchair_accessible": True,
            "crutches_accessible": True,
            "notes": "Connexion importée depuis le graphe fourni.",
        },
        {
            "from_temp_id": "e_11",
            "to_temp_id": "e_12",
            "edge_type": "corridor",
            "confidence": 0.9,
            "wheelchair_accessible": True,
            "crutches_accessible": True,
            "notes": "Connexion importée depuis le graphe fourni.",
        },
        {
            "from_temp_id": "e_12",
            "to_temp_id": "e_5",
            "edge_type": "corridor",
            "confidence": 0.9,
            "wheelchair_accessible": True,
            "crutches_accessible": True,
            "notes": "Connexion importée depuis le graphe fourni.",
        },
        {
            "from_temp_id": "e_12",
            "to_temp_id": "e_6",
            "edge_type": "corridor",
            "confidence": 0.9,
            "wheelchair_accessible": True,
            "crutches_accessible": True,
            "notes": "Connexion importée depuis le graphe fourni.",
        },
        {
            "from_temp_id": "e_12",
            "to_temp_id": "e_7",
            "edge_type": "corridor",
            "confidence": 0.9,
            "wheelchair_accessible": True,
            "crutches_accessible": True,
            "notes": "Connexion importée depuis le graphe fourni.",
        },
        {
            "from_temp_id": "e_12",
            "to_temp_id": "e_8",
            "edge_type": "corridor",
            "confidence": 0.9,
            "wheelchair_accessible": True,
            "crutches_accessible": True,
            "notes": "Connexion importée depuis le graphe fourni.",
        },
        {
            "from_temp_id": "e_12",
            "to_temp_id": "e_9",
            "edge_type": "corridor",
            "confidence": 0.9,
            "wheelchair_accessible": True,
            "crutches_accessible": True,
            "notes": "Connexion importée depuis le graphe fourni.",
        },
        {
            "from_temp_id": "e_12",
            "to_temp_id": "e_10",
            "edge_type": "corridor",
            "confidence": 0.9,
            "wheelchair_accessible": True,
            "crutches_accessible": True,
            "notes": "Connexion importée depuis le graphe fourni.",
        },
        {
            "from_temp_id": "e_13",
            "to_temp_id": "e_14",
            "edge_type": "corridor",
            "confidence": 0.9,
            "wheelchair_accessible": True,
            "crutches_accessible": True,
            "notes": "Connexion importée depuis le graphe fourni.",
        },
        {
            "from_temp_id": "e_14",
            "to_temp_id": "e_15",
            "edge_type": "corridor",
            "confidence": 0.9,
            "wheelchair_accessible": True,
            "crutches_accessible": True,
            "notes": "Connexion importée depuis le graphe fourni.",
        },
        {
            "from_temp_id": "e_14",
            "to_temp_id": "e_16",
            "edge_type": "corridor",
            "confidence": 0.9,
            "wheelchair_accessible": True,
            "crutches_accessible": True,
            "notes": "Connexion importée depuis le graphe fourni.",
        },
        {
            "from_temp_id": "e_14",
            "to_temp_id": "e_17",
            "edge_type": "corridor",
            "confidence": 0.9,
            "wheelchair_accessible": True,
            "crutches_accessible": True,
            "notes": "Connexion importée depuis le graphe fourni.",
        },
        {
            "from_temp_id": "e_14",
            "to_temp_id": "e_18",
            "edge_type": "corridor",
            "confidence": 0.9,
            "wheelchair_accessible": True,
            "crutches_accessible": True,
            "notes": "Connexion importée depuis le graphe fourni.",
        },
        {
            "from_temp_id": "e_14",
            "to_temp_id": "e_20",
            "edge_type": "corridor",
            "confidence": 0.9,
            "wheelchair_accessible": True,
            "crutches_accessible": True,
            "notes": "Connexion importée depuis le graphe fourni.",
        },
        {
            "from_temp_id": "e_18",
            "to_temp_id": "e_19",
            "edge_type": "corridor",
            "confidence": 0.9,
            "wheelchair_accessible": True,
            "crutches_accessible": True,
            "notes": "Connexion importée depuis le graphe fourni.",
        },
        {
            "from_temp_id": "e_20",
            "to_temp_id": "e_21",
            "edge_type": "corridor",
            "confidence": 0.9,
            "wheelchair_accessible": True,
            "crutches_accessible": True,
            "notes": "Connexion importée depuis le graphe fourni.",
        },
        {
            "from_temp_id": "e_20",
            "to_temp_id": "e_22",
            "edge_type": "corridor",
            "confidence": 0.9,
            "wheelchair_accessible": True,
            "crutches_accessible": True,
            "notes": "Connexion importée depuis le graphe fourni.",
        },
        {
            "from_temp_id": "e_20",
            "to_temp_id": "e_23",
            "edge_type": "corridor",
            "confidence": 0.9,
            "wheelchair_accessible": True,
            "crutches_accessible": True,
            "notes": "Connexion importée depuis le graphe fourni.",
        },
        {
            "from_temp_id": "e_20",
            "to_temp_id": "e_24",
            "edge_type": "corridor",
            "confidence": 0.9,
            "wheelchair_accessible": True,
            "crutches_accessible": True,
            "notes": "Connexion importée depuis le graphe fourni.",
        },
        {
            "from_temp_id": "e_20",
            "to_temp_id": "e_25",
            "edge_type": "corridor",
            "confidence": 0.9,
            "wheelchair_accessible": True,
            "crutches_accessible": True,
            "notes": "Connexion importée depuis le graphe fourni.",
        },
        {
            "from_temp_id": "e_20",
            "to_temp_id": "e_26",
            "edge_type": "corridor",
            "confidence": 0.9,
            "wheelchair_accessible": True,
            "crutches_accessible": True,
            "notes": "Connexion importée depuis le graphe fourni.",
        },
        {
            "from_temp_id": "e_20",
            "to_temp_id": "e_27",
            "edge_type": "corridor",
            "confidence": 0.9,
            "wheelchair_accessible": True,
            "crutches_accessible": True,
            "notes": "Connexion importée depuis le graphe fourni.",
        },
        {
            "from_temp_id": "e_20",
            "to_temp_id": "e_28",
            "edge_type": "corridor",
            "confidence": 0.9,
            "wheelchair_accessible": True,
            "crutches_accessible": True,
            "notes": "Connexion importée depuis le graphe fourni.",
        },
        {
            "from_temp_id": "e_20",
            "to_temp_id": "e_29",
            "edge_type": "corridor",
            "confidence": 0.9,
            "wheelchair_accessible": True,
            "crutches_accessible": True,
            "notes": "Connexion importée depuis le graphe fourni.",
        },
        {
            "from_temp_id": "e_20",
            "to_temp_id": "e_30",
            "edge_type": "corridor",
            "confidence": 0.9,
            "wheelchair_accessible": True,
            "crutches_accessible": True,
            "notes": "Connexion importée depuis le graphe fourni.",
        },
        {
            "from_temp_id": "e_20",
            "to_temp_id": "e_31",
            "edge_type": "corridor",
            "confidence": 0.9,
            "wheelchair_accessible": True,
            "crutches_accessible": True,
            "notes": "Connexion importée depuis le graphe fourni.",
        },
        {
            "from_temp_id": "e_31",
            "to_temp_id": "e_32",
            "edge_type": "corridor",
            "confidence": 0.9,
            "wheelchair_accessible": True,
            "crutches_accessible": True,
            "notes": "Connexion importée depuis le graphe fourni.",
        },
    ],
    "warnings": [
        "Mode mock activé : données importées depuis un graphe fourni, aucune vraie analyse IA n'a été effectuée.",
        "Les coordonnées étaient déjà normalisées entre 0 et 1 ; aucune renormalisation supplémentaire n'a été appliquée.",
    ],
}

    if not image_bytes:
        raise PlanAIError("Image is empty.")

    if mime_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise PlanAIError(f"Unsupported image type: {mime_type}")

    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    client = _get_client()

    prompt = f"""
You are helping build an indoor accessibility navigation graph from a building floor plan.

Return ONLY valid JSON. No markdown. No explanation outside JSON.

The image is a floor plan, but it may contain margins, legends, titles, empty whitespace, stamps, logos, annotations, or non-architectural areas.

First detect the useful architectural floor plan area.
Return it as "floor_plan_bounds".

"floor_plan_bounds" must be a normalized rectangle:
- x between 0 and 1 from left to right
- y between 0 and 1 from top to bottom
- width between 0 and 1
- height between 0 and 1

All elements must be inside "floor_plan_bounds".
Do not place elements in page margins, legends, title blocks, logos, blank regions, or outside the architectural drawing.

Detect useful navigation elements:
- entrances
- rooms
- corridors
- doors
- elevators
- stairs
- ramps
- toilets
- accessible toilets
- obstacles, if visible

Use normalized coordinates relative to the full image you receive:
- x between 0 and 1 from left to right
- y between 0 and 1 from top to bottom

Do not invent legal accessibility compliance.
If something is uncertain, set a lower confidence and add a warning.

Context:
- floor_id: {floor_id or "unknown"}
- real_width_meters: {real_width_meters if real_width_meters is not None else "unknown"}
- real_height_meters: {real_height_meters if real_height_meters is not None else "unknown"}

Return this exact JSON shape:
{{
  "floor_plan_bounds": {{
    "x": 0.05,
    "y": 0.08,
    "width": 0.90,
    "height": 0.84
  }},
  "elements": [
    {{
      "temp_id": "e_1",
      "type": "entrance | elevator | stairs | ramp | door | room | corridor | toilet | accessible_toilet | obstacle | unknown",
      "name": "short human-readable name",
      "x": 0.42,
      "y": 0.31,
      "confidence": 0.0,
      "notes": "short note"
    }}
  ],
  "edges": [
    {{
      "from_temp_id": "e_1",
      "to_temp_id": "e_2",
      "edge_type": "corridor | door | ramp | elevator | stairs | manual | unknown",
      "confidence": 0.0,
      "wheelchair_accessible": true,
      "crutches_accessible": true,
      "notes": "short note"
    }}
  ],
  "warnings": [
    "Uncertainty or missing data"
  ]
}}

Important:
- Prefer fewer, reliable nodes over many hallucinated nodes.
- Use elevators and stairs as separate elements.
- If a corridor visually connects multiple rooms, create edges from the corridor to those rooms/doors.
- If accessibility is not visually inferable, use null for wheelchair_accessible or crutches_accessible.
"""

    response = client.models.generate_content(
        model=model,
        contents=[
            types.Part.from_bytes(
                data=image_bytes,
                mime_type=mime_type,
            ),
            prompt,
        ],
        config=types.GenerateContentConfig(
            temperature=0,
            response_mime_type="application/json",
        ),
    )

    raw_text = response.text or ""
    raw_data = _extract_json_object(raw_text)

    return _normalize_graph(raw_data)