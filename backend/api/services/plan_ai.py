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


def _normalize_graph(data: dict[str, Any]) -> dict[str, Any]:
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

        element = {
            "temp_id": temp_id,
            "type": element_type,
            "name": str(item.get("name") or ""),
            "x": _clamp_float(item.get("x")),
            "y": _clamp_float(item.get("y")),
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
                    "type": "entrance",
                    "name": "Entrée principale",
                    "x": 0.15,
                    "y": 0.75,
                    "confidence": 0.95,
                    "notes": "Point de démonstration généré en mode mock.",
                },
                {
                    "temp_id": "e_2",
                    "type": "elevator",
                    "name": "Ascenseur",
                    "x": 0.55,
                    "y": 0.45,
                    "confidence": 0.9,
                    "notes": "Point de démonstration généré en mode mock.",
                },
                {
                    "temp_id": "e_3",
                    "type": "room",
                    "name": "Salle cible",
                    "x": 0.82,
                    "y": 0.25,
                    "confidence": 0.85,
                    "notes": "Point de démonstration généré en mode mock.",
                },
            ],
            "edges": [
                {
                    "from_temp_id": "e_1",
                    "to_temp_id": "e_2",
                    "edge_type": "corridor",
                    "confidence": 0.9,
                    "wheelchair_accessible": True,
                    "crutches_accessible": True,
                    "notes": "Connexion de démonstration.",
                },
                {
                    "from_temp_id": "e_2",
                    "to_temp_id": "e_3",
                    "edge_type": "corridor",
                    "confidence": 0.85,
                    "wheelchair_accessible": True,
                    "crutches_accessible": True,
                    "notes": "Connexion de démonstration.",
                },
            ],
            "warnings": [
                "Mode mock activé : aucune vraie analyse IA n'a été effectuée."
            ],
        }

    if not image_bytes:
        raise PlanAIError("Image is empty.")

    if mime_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise PlanAIError(f"Unsupported image type: {mime_type}")

    model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    client = _get_client()

    prompt = f"""
You are helping build an indoor accessibility navigation graph from a building floor plan.

Return ONLY valid JSON. No markdown. No explanation outside JSON.

The image is a floor plan. Detect useful navigation elements:
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

Use normalized coordinates:
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