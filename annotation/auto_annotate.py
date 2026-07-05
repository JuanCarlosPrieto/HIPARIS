"""
auto_annotate.py — Pré-annotation automatique (semi-auto) pour l'annotateur HTML.

Deux usages :
  * en ligne de commande (ce fichier) pour traiter une image et écrire un JSON ;
  * comme bibliothèque, importé par `server.py` (bouton « Annotation IA » du HTML).

Détecte des éléments dans une PHOTO via un détecteur open-vocabulary (OWLv2 par
défaut ; YOLO-World en option), convertit chaque détection en point, génère
éventuellement des connexions (Delaunay ou k-NN), puis produit un JSON au format
exact lu par `annotateur_image.html`.

Exemples :
    python auto_annotate.py photo.jpg
    python auto_annotate.py photo.jpg --conf 0.04 --connexions delaunay --max-dist 400
    python auto_annotate.py photo.jpg --backend yoloworld
    python auto_annotate.py --from-json photo_annotations.json --connexions knn --k 3

Dépendances : voir requirements.txt  (transformers, torch, Pillow, scipy).
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import datetime
from functools import lru_cache
from itertools import combinations
from pathlib import Path

# ----------------------------------------------------------------------------- #
#  Configuration par défaut des catégories
#  nom FR (affiché dans l'outil) -> prompts EN + couleur (= couleurs du HTML).
#  NB : 'mur' est volontairement absent — non localisable comme un point.
# ----------------------------------------------------------------------------- #
CATEGORIES: dict[str, dict] = {
    "porte":      {"prompts": ["door"],                        "couleur": "#e6194b"},
    "escalier":   {"prompts": ["staircase", "stairs"],         "couleur": "#3cb44b"},
    "sortie":     {"prompts": ["exit sign", "emergency exit"], "couleur": "#4363d8"},
    "extincteur": {"prompts": ["fire extinguisher"],           "couleur": "#f58231"},
}

# Type de connexion généré automatiquement (candidat à valider).
EDGE_TYPE = "proximité"
EDGE_COLOR = "#1c9099"

# Poids par défaut selon le backend (téléchargés au 1er usage).
DEFAULT_MODELS = {
    "owlv2": "google/owlv2-base-patch16-ensemble",   # plus précis : ...-large-patch14-ensemble
    "yoloworld": "yolov8s-worldv2.pt",               # plus précis : yolov8x-worldv2.pt
}


def _prompt_map(categories: dict) -> tuple[list[str], dict[str, str]]:
    """Liste plate de prompts (EN) + mapping prompt -> catégorie FR."""
    prompts: list[str] = []
    prompt_to_cat: dict[str, str] = {}
    for cat, cfg in categories.items():
        for p in cfg["prompts"]:
            if p not in prompt_to_cat:
                prompts.append(p)
            prompt_to_cat[p] = cat
    return prompts, prompt_to_cat


# ============================================================================= #
#  1. Détection des points
# ============================================================================= #
@lru_cache(maxsize=2)
def _load_owlv2(model_id: str, device: str):
    """Charge (et met en cache) le processeur + le modèle OWLv2."""
    from transformers import Owlv2ForObjectDetection, Owlv2Processor
    processor = Owlv2Processor.from_pretrained(model_id)
    model = Owlv2ForObjectDetection.from_pretrained(model_id).to(device).eval()
    return processor, model


def detect_owlv2_pil(image, categories: dict, conf: float,
                    model_id: str, device: str) -> tuple[list[dict], int, int]:
    """Détection OWLv2 sur une image PIL. Renvoie (raw_points, largeur, hauteur).

    Correction du padding : OWLv2 attend une image carrée. On pré-remplit
    manuellement l'image en carré (origine calée en haut-gauche) pour que les
    boîtes ressortent aux bonnes coordonnées pixel.
    """
    import torch
    from PIL import Image

    processor, model = _load_owlv2(model_id, device)
    prompts, prompt_to_cat = _prompt_map(categories)

    image = image.convert("RGB")
    width, height = image.size
    side = max(width, height)
    padded = Image.new("RGB", (side, side), (0, 0, 0))
    padded.paste(image, (0, 0))                     # image d'origine en haut-gauche

    inputs = processor(text=[prompts], images=padded, return_tensors="pt").to(device)
    with torch.no_grad():
        outputs = model(**inputs)
    target = torch.tensor([[side, side]], device=device)
    # transformers >= 4.51 : renvoie les libellés texte directement.
    result = processor.post_process_grounded_object_detection(
        outputs=outputs, threshold=conf, target_sizes=target, text_labels=[prompts])[0]

    labels = result.get("text_labels")
    if labels is None:                              # repli : indices -> prompts
        labels = [prompts[int(i)] for i in result["labels"].tolist()]

    raw: list[dict] = []
    for box, score, label in zip(result["boxes"].tolist(),
                                 result["scores"].tolist(),
                                 labels):
        cat = prompt_to_cat.get(label)
        if cat is None:
            continue
        x1, y1, x2, y2 = box
        cx, cy = round((x1 + x2) / 2), round((y1 + y2) / 2)
        if cx > width or cy > height:               # centre tombé dans le padding
            continue
        raw.append({"nom": cat, "x": max(0, cx), "y": max(0, cy),
                    "couleur": categories[cat]["couleur"], "confiance": round(float(score), 3)})
    return raw, width, height


def detect_yoloworld_path(image_path: str, categories: dict, conf: float,
                         model_id: str, device: str) -> tuple[list[dict], int, int]:
    """Détection YOLO-World (ultralytics) — backend alternatif."""
    try:
        from ultralytics import YOLOWorld
    except ImportError:
        sys.exit("Erreur : `ultralytics` manquant.  ->  pip install ultralytics")

    prompts, idx_to_cat = [], []
    for cat, cfg in categories.items():
        for p in cfg["prompts"]:
            prompts.append(p)
            idx_to_cat.append(cat)

    model = YOLOWorld(model_id)
    model.set_classes(prompts)
    results = model.predict(image_path, conf=conf, device=device, verbose=False)
    res = results[0]
    height, width = res.orig_shape                  # (h, w)

    raw: list[dict] = []
    for box in res.boxes:
        i = int(box.cls.item())
        cat = idx_to_cat[i] if 0 <= i < len(idx_to_cat) else None
        if cat is None:
            continue
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        raw.append({"nom": cat, "x": round((x1 + x2) / 2), "y": round((y1 + y2) / 2),
                    "couleur": categories[cat]["couleur"], "confiance": round(float(box.conf.item()), 3)})
    return raw, width, height


def finalize_points(raw: list[dict], dedup_px: float) -> list[dict]:
    """Dédoublonne, assigne des ids stables et normalise les champs."""
    kept: list[dict] = []
    for p in sorted(raw, key=lambda d: d["confiance"], reverse=True):
        if any(p["nom"] == q["nom"] and math.hypot(p["x"] - q["x"], p["y"] - q["y"]) < dedup_px
               for q in kept):
            continue
        kept.append(p)
    kept.sort(key=lambda d: (d["y"], d["x"]))       # ordre lecture -> ids intuitifs
    points = []
    for i, p in enumerate(kept, start=1):
        points.append({"id": i, "nom": p["nom"], "x": p["x"], "y": p["y"],
                       "couleur": p["couleur"], "confiance": p["confiance"]})
    return points


def detect_points(image_path: str, backend: str, conf: float, model_id: str,
                  device: str, dedup_px: float,
                  categories: dict | None = None) -> tuple[list[dict], int, int]:
    """Point d'entrée CLI : détecte et renvoie (points finalisés, largeur, hauteur)."""
    categories = categories or CATEGORIES
    if backend == "owlv2":
        from PIL import Image
        raw, width, height = detect_owlv2_pil(Image.open(image_path), categories, conf, model_id, device)
    elif backend == "yoloworld":
        raw, width, height = detect_yoloworld_path(image_path, categories, conf, model_id, device)
    else:
        sys.exit(f"Backend inconnu : {backend}")

    points = finalize_points(raw, dedup_px)
    counts: dict[str, int] = {}
    for p in points:
        counts[p["nom"]] = counts.get(p["nom"], 0) + 1
    resume = ", ".join(f"{k}={v}" for k, v in counts.items()) or "aucun"
    print(f"[détection] {len(points)} point(s) retenu(s) : {resume}")
    return points, width, height


# ============================================================================= #
#  2. Génération des connexions (graphe candidat à valider)
# ============================================================================= #
def build_connections(points: list[dict], method: str, k: int,
                      max_dist: float | None) -> list[dict]:
    """Construit des arêtes non-orientées entre les points.

    - 'delaunay' : triangulation de Delaunay (graphe planaire, sans croisements).
    - 'knn'      : chaque point relié à ses k plus proches voisins.
    Les arêtes plus longues que `max_dist` (px) sont écartées.
    """
    if method == "none" or len(points) < 2:
        return []

    idx = {p["id"]: (p["x"], p["y"]) for p in points}
    ids = list(idx)
    pairs: set[frozenset] = set()

    if method == "delaunay":
        pairs = _delaunay_pairs(points)
    elif method == "knn":
        for i in ids:
            xi, yi = idx[i]
            voisins = sorted((j for j in ids if j != i),
                             key=lambda j: math.hypot(idx[j][0] - xi, idx[j][1] - yi))[:k]
            for j in voisins:
                pairs.add(frozenset((i, j)))

    edges: list[dict] = []
    for pair in sorted(tuple(sorted(p)) for p in pairs):
        s, t = pair
        dist = round(math.hypot(idx[s][0] - idx[t][0], idx[s][1] - idx[t][1]))
        if max_dist is not None and dist > max_dist:
            continue
        edges.append({"id": 0, "source": s, "cible": t, "type": EDGE_TYPE,
                      "couleur": EDGE_COLOR, "distance": dist})
    for eid, e in enumerate(edges, start=1):        # ids après l'élagage
        e["id"] = eid

    print(f"[connexions] {len(edges)} arête(s) générée(s) ({method})")
    return edges


def _delaunay_pairs(points: list[dict]) -> set[frozenset]:
    """Arêtes uniques issues d'une triangulation de Delaunay (fallback paires)."""
    if len(points) < 3:
        return {frozenset((a["id"], b["id"])) for a, b in combinations(points, 2)}
    try:
        import numpy as np
        from scipy.spatial import Delaunay
    except ImportError:
        sys.exit("Erreur : `scipy` manquant pour Delaunay.  ->  pip install -r requirements.txt")

    ids = [p["id"] for p in points]
    coords = np.array([[p["x"], p["y"]] for p in points], dtype=float)
    tri = Delaunay(coords)
    pairs: set[frozenset] = set()
    for simplex in tri.simplices:                   # chaque triangle -> ses 3 côtés
        for a, b in combinations(simplex, 2):
            pairs.add(frozenset((ids[a], ids[b])))
    return pairs


# ============================================================================= #
#  3. Entrées/sorties JSON (format de l'annotateur HTML)
# ============================================================================= #
def build_output(image_name: str, width: int, height: int, points: list[dict],
                 edges: list[dict], categories: dict | None = None,
                 types_connexion: dict | None = None) -> dict:
    """Construit le dict JSON au format lu par `annotateur_image.html`."""
    categories = categories or CATEGORIES
    return {
        "image": {"nom_fichier": image_name, "largeur": width, "hauteur": height},
        "date_export": datetime.now().isoformat(timespec="seconds"),
        "genere_par": "auto_annotate",
        "categories": {cat: cfg["couleur"] for cat, cfg in categories.items()},
        "types_connexion": types_connexion or {EDGE_TYPE: EDGE_COLOR},
        "nb_annotations": len(points),
        "nb_connexions": len(edges),
        "annotations": points,
        "connexions": edges,
    }


def load_points_from_json(path: str) -> tuple[list[dict], int, int, str | None]:
    """Recharge des points existants (ex. annotés à la main) pour (re)générer les liens."""
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    pts = [{"id": a["id"], "nom": a["nom"], "x": a["x"], "y": a["y"],
            "couleur": a.get("couleur", "#a9a9a9")} for a in data.get("annotations", [])]
    img = data.get("image", {})
    return pts, img.get("largeur", 0), img.get("hauteur", 0), img.get("nom_fichier")


# ============================================================================= #
#  CLI
# ============================================================================= #
def resolve_device(device: str) -> str:
    if device != "auto":
        return device
    try:
        import torch
        return "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"


def main() -> None:
    ap = argparse.ArgumentParser(description="Pré-annotation automatique (points + connexions).")
    ap.add_argument("image", nargs="?", help="Chemin de l'image à annoter (photo).")
    ap.add_argument("--from-json", help="Repart de points existants (ignore la détection).")
    ap.add_argument("--out", help="Fichier JSON de sortie (défaut : <image>_annotations.json).")
    ap.add_argument("--backend", choices=["owlv2", "yoloworld"], default="owlv2",
                    help="Détecteur open-vocabulary (défaut : owlv2).")
    ap.add_argument("--model", default=None, help="Poids/checkpoint (défaut selon le backend).")
    ap.add_argument("--conf", type=float, default=0.1, help="Seuil de confiance (bas = plus de rappel).")
    ap.add_argument("--device", default="auto", help="'cuda', 'cpu' ou 'auto'.")
    ap.add_argument("--dedup-px", type=float, default=25.0, help="Fusion des doublons < N px (même catégorie).")
    ap.add_argument("--connexions", choices=["none", "delaunay", "knn"], default="none",
                    help="Génération des arêtes du graphe.")
    ap.add_argument("--k", type=int, default=3, help="Voisins pour --connexions knn.")
    ap.add_argument("--max-dist", type=float, default=None, help="Élague les arêtes > N px.")
    args = ap.parse_args()

    if not args.image and not args.from_json:
        ap.error("Fournis une image, ou --from-json pour (re)générer des connexions.")

    if args.from_json:
        points, width, height, image_name = load_points_from_json(args.from_json)
        print(f"[import] {len(points)} point(s) depuis {args.from_json}")
        default_out = Path(args.from_json)
    else:
        img_path = Path(args.image)
        if not img_path.exists():
            sys.exit(f"Erreur : image introuvable — {img_path}")
        device = resolve_device(args.device)
        model_id = args.model or DEFAULT_MODELS[args.backend]
        print(f"[modèle] {args.backend} {model_id} sur {device}")
        points, width, height = detect_points(str(img_path), args.backend, args.conf,
                                              model_id, device, args.dedup_px)
        image_name = img_path.name
        default_out = img_path.with_name(img_path.stem + "_annotations.json")

    edges = build_connections(points, args.connexions, args.k, args.max_dist)

    out_path = args.out or str(default_out)
    data = build_output(image_name, width, height, points, edges)
    Path(out_path).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[export] {out_path}")
    print("\nÀ faire : ouvre annotateur_image.html, charge la MÊME image, "
          "puis « Charger JSON… » sur ce fichier pour valider/corriger.")


if __name__ == "__main__":
    main()
