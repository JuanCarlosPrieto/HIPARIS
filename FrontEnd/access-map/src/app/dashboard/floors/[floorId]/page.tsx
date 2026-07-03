"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Accessibility,
  ArrowLeft,
  CheckCircle2,
  DoorOpen,
  ArrowUpDown,
  Flag,
  GitBranch,
  Layers,
  Link2,
  Loader2,
  MapPin,
  Plus,
  Ruler,
  Save,
  ShieldAlert,
  Trash2,
  Triangle,
  Waypoints,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type FloorStatus = "uploaded" | "processing" | "needs_review" | "published";

type Floor = {
  id: string;
  building_id: string;
  level: number;
  name: string;
  plan_image_path: string | null;
  plan_image_width: number | null;
  plan_image_height: number | null;
  plan_image_size_bytes: number | null;
  plan_image_mime_type: string | null;
  plan_original_name: string | null;
  plan_uploaded_at: string | null;

  real_width_meters: number | null;
  real_height_meters: number | null;
  meters_per_pixel_x: number | null;
  meters_per_pixel_y: number | null;
  plan_rotation_degrees: number | null;
  plan_crop_json: Record<string, unknown> | null;

  status: FloorStatus;
  created_at: string;
};

type ElementType =
  | "entrance"
  | "elevator"
  | "ramp"
  | "stairs"
  | "door"
  | "room"
  | "obstacle"
  | "toilet";

type AccessibleElement = {
  id: string;
  floor_id: string;
  type: ElementType;
  label: string | null;
  x: number;
  y: number;
  metadata: Record<string, unknown>;
  created_at: string;
};

type RouteEdge = {
  id: string;
  floor_id: string;
  from_element_id: string;
  to_element_id: string;
  distance_meters: number;
  wheelchair_accessible: boolean;
  crutches_accessible: boolean;
  is_bidirectional: boolean;
  notes: string | null;
  created_at: string;
};

const ELEMENT_TYPES: {
  value: ElementType;
  label: string;
  description: string;
}[] = [
  {
    value: "entrance",
    label: "Entrée",
    description: "Point d'entrée accessible du bâtiment.",
  },
  {
    value: "elevator",
    label: "Ascenseur",
    description: "Connexion verticale entre plusieurs étages.",
  },
  {
    value: "ramp",
    label: "Rampe",
    description: "Passage incliné accessible.",
  },
  {
    value: "stairs",
    label: "Escalier",
    description: "Zone à éviter pour fauteuil roulant.",
  },
  {
    value: "door",
    label: "Porte",
    description: "Porte ou seuil important.",
  },
  {
    value: "room",
    label: "Salle",
    description: "Destination possible.",
  },
  {
    value: "obstacle",
    label: "Obstacle",
    description: "Zone difficile ou impossible à traverser.",
  },
  {
    value: "toilet",
    label: "Toilettes PMR",
    description: "Toilettes accessibles.",
  },
];

const labelByType: Record<ElementType, string> = {
  entrance: "Entrée",
  elevator: "Ascenseur",
  ramp: "Rampe",
  stairs: "Escalier",
  door: "Porte",
  room: "Salle",
  obstacle: "Obstacle",
  toilet: "Toilettes PMR",
};

export default function FloorReviewPage() {
  const params = useParams<{ floorId: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const floorId = params.floorId;

  const [floor, setFloor] = useState<Floor | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  const [elements, setElements] = useState<AccessibleElement[]>([]);
  const [edges, setEdges] = useState<RouteEdge[]>([]);

  const [selectedType, setSelectedType] = useState<ElementType>("entrance");
  const [label, setLabel] = useState("");

  const [fromElementId, setFromElementId] = useState("");
  const [toElementId, setToElementId] = useState("");
  const [distanceMeters, setDistanceMeters] = useState("5");
  const [wheelchairAccessible, setWheelchairAccessible] = useState(true);
  const [crutchesAccessible, setCrutchesAccessible] = useState(true);
  const [isBidirectional, setIsBidirectional] = useState(true);
  const [edgeNotes, setEdgeNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingElement, setSavingElement] = useState(false);
  const [savingEdge, setSavingEdge] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [deletingElementId, setDeletingElementId] = useState<string | null>(
    null
  );
  const [deletingEdgeId, setDeletingEdgeId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const estimatedDistanceMeters = useMemo(() => {
    if (!floor) return null;
    if (!fromElementId || !toElementId) return null;
    if (fromElementId === toElementId) return null;

    const from = elements.find((element) => element.id === fromElementId);
    const to = elements.find((element) => element.id === toElementId);

    if (!from || !to) return null;

    return estimateRealDistanceMeters({
      floor,
      from,
      to,
    });
  }, [floor, elements, fromElementId, toElementId]);

  useEffect(() => {
    async function initialize() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth");
        return;
      }

      await Promise.all([loadFloor(), loadElements(), loadEdges()]);
      setLoading(false);
    }

    initialize();
  }, [floorId, router, supabase]);

  useEffect(() => {
    if (elements.length === 0) {
      setFromElementId("");
      setToElementId("");
      return;
    }

    if (!fromElementId || !elements.some((element) => element.id === fromElementId)) {
      setFromElementId(elements[0].id);
    }

    if (
      elements.length > 1 &&
      (!toElementId || !elements.some((element) => element.id === toElementId))
    ) {
      setToElementId(elements[1].id);
    }
  }, [elements, fromElementId, toElementId]);

  useEffect(() => {
    if (estimatedDistanceMeters === null) return;

    setDistanceMeters(estimatedDistanceMeters.toFixed(1));
  }, [estimatedDistanceMeters]);

  async function loadFloor() {
    setErrorMessage(null);

    const { data, error } = await supabase
      .from("floors")
      .select("*")
      .eq("id", floorId)
      .single();

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setFloor(data);

    if (!data.plan_image_path) {
      setSignedUrl(null);
      return;
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from("plan-images")
      .createSignedUrl(data.plan_image_path, 60 * 60);

    if (signedError) {
      setErrorMessage(signedError.message);
      return;
    }

    setSignedUrl(signedData.signedUrl);
  }

  async function loadElements() {
    const { data, error } = await supabase
      .from("accessible_elements")
      .select("*")
      .eq("floor_id", floorId)
      .order("created_at", { ascending: true });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setElements((data ?? []) as AccessibleElement[]);
  }

  async function loadEdges() {
    const { data, error } = await supabase
      .from("route_edges")
      .select("*")
      .eq("floor_id", floorId)
      .order("created_at", { ascending: true });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setEdges((data ?? []) as RouteEdge[]);
  }

  function getElementLabel(elementId: string) {
    const element = elements.find((item) => item.id === elementId);

    if (!element) return "Élément supprimé";

    return element.label || labelByType[element.type];
  }

  function getElementById(elementId: string) {
    return elements.find((element) => element.id === elementId) ?? null;
  }

  async function handleImageClick(event: React.MouseEvent<HTMLImageElement>) {
    if (!floor) return;

    setSavingElement(true);
    setErrorMessage(null);
    setInfoMessage(null);

    const rect = event.currentTarget.getBoundingClientRect();

    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    const cleanX = Math.min(1, Math.max(0, x));
    const cleanY = Math.min(1, Math.max(0, y));

    const fallbackLabel = labelByType[selectedType];
    const finalLabel = label.trim() || fallbackLabel;

    const { data, error } = await supabase
      .from("accessible_elements")
      .insert({
        floor_id: floor.id,
        type: selectedType,
        label: finalLabel,
        x: cleanX,
        y: cleanY,
        metadata: {
          source: "manual",
          wheelchair_relevant: true,
          created_in: "floor_review_page",
        },
      })
      .select("*")
      .single();

    setSavingElement(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setElements((current) => [...current, data as AccessibleElement]);
    setLabel("");
    setInfoMessage("Élément ajouté au plan.");
  }

  async function handleDeleteElement(elementId: string) {
    setDeletingElementId(elementId);
    setErrorMessage(null);
    setInfoMessage(null);

    const { error } = await supabase
      .from("accessible_elements")
      .delete()
      .eq("id", elementId);

    setDeletingElementId(null);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setElements((current) =>
      current.filter((element) => element.id !== elementId)
    );

    setEdges((current) =>
      current.filter(
        (edge) =>
          edge.from_element_id !== elementId && edge.to_element_id !== elementId
      )
    );

    setInfoMessage("Élément supprimé.");
  }

  async function handleCreateEdge(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!floor) return;

    setSavingEdge(true);
    setErrorMessage(null);
    setInfoMessage(null);

    if (!fromElementId || !toElementId) {
      setSavingEdge(false);
      setErrorMessage("Sélectionnez deux éléments à connecter.");
      return;
    }

    if (fromElementId === toElementId) {
      setSavingEdge(false);
      setErrorMessage("Un élément ne peut pas être connecté à lui-même.");
      return;
    }

    const distance = Number.parseFloat(distanceMeters);

    if (Number.isNaN(distance) || distance <= 0) {
      setSavingEdge(false);
      setErrorMessage("La distance doit être un nombre positif.");
      return;
    }

    const alreadyExists = edges.some((edge) => {
      const sameDirection =
        edge.from_element_id === fromElementId && edge.to_element_id === toElementId;

      const oppositeDirection =
        edge.from_element_id === toElementId && edge.to_element_id === fromElementId;

      return sameDirection || oppositeDirection;
    });

    if (alreadyExists) {
      setSavingEdge(false);
      setErrorMessage("Cette connexion existe déjà.");
      return;
    }

    const { data, error } = await supabase
      .from("route_edges")
      .insert({
        floor_id: floor.id,
        from_element_id: fromElementId,
        to_element_id: toElementId,
        distance_meters: distance,
        wheelchair_accessible: wheelchairAccessible,
        crutches_accessible: crutchesAccessible,
        is_bidirectional: isBidirectional,
        notes: edgeNotes.trim() || null,
      })
      .select("*")
      .single();

    setSavingEdge(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setEdges((current) => [...current, data as RouteEdge]);
    setEdgeNotes("");
    setInfoMessage("Connexion ajoutée au graphe.");
  }

  async function handleDeleteEdge(edgeId: string) {
    setDeletingEdgeId(edgeId);
    setErrorMessage(null);
    setInfoMessage(null);

    const { error } = await supabase.from("route_edges").delete().eq("id", edgeId);

    setDeletingEdgeId(null);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setEdges((current) => current.filter((edge) => edge.id !== edgeId));
    setInfoMessage("Connexion supprimée.");
  }

  async function handlePublishFloor() {
    if (!floor) return;

    setPublishing(true);
    setErrorMessage(null);
    setInfoMessage(null);

    const { data, error } = await supabase
      .from("floors")
      .update({
        status: "published",
      })
      .eq("id", floor.id)
      .select("*")
      .single();

    setPublishing(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setFloor(data);
    setInfoMessage("Étage publié.");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex items-center gap-3 text-slate-300">
          <Loader2 className="animate-spin" size={20} />
          Chargement du plan...
        </div>
      </main>
    );
  }

  if (!floor) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center">
          <ShieldAlert className="mx-auto mb-4 text-red-300" size={38} />
          <h1 className="text-2xl font-semibold">Plan introuvable</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Ce plan n'existe pas ou vous n'avez pas les droits nécessaires.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="mt-6 rounded-2xl bg-cyan-400 px-5 py-3 font-medium text-slate-950"
          >
            Retour au dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400 text-slate-950">
              <Accessibility size={25} />
            </div>

            <div>
              <h1 className="text-xl font-bold">Validation du plan</h1>
              <p className="text-sm text-slate-400">
                {floor.name} · Niveau {floor.level}
              </p>
              {floor.real_width_meters && floor.real_height_meters && (
                <p className="mt-1 text-xs text-cyan-200">
                  Dimensions réelles : {floor.real_width_meters} m ×{" "}
                  {floor.real_height_meters} m
                </p>
              )}
            </div>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/10"
          >
            <ArrowLeft size={16} />
            Retour
          </button>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[0.75fr_1.45fr_0.9fr]">
        <aside className="space-y-6">
          <Panel title="1. Ajouter un point" subtitle="Choisissez le type puis cliquez sur le plan.">
            <div className="grid gap-3">
              {ELEMENT_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setSelectedType(type.value)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    selectedType === type.value
                      ? "border-cyan-300 bg-cyan-400/10"
                      : "border-white/10 bg-slate-900 hover:border-white/25"
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <ElementIcon type={type.value} />
                    <p className="font-medium">{type.label}</p>
                  </div>
                  <p className="text-xs leading-5 text-slate-400">
                    {type.description}
                  </p>
                </button>
              ))}
            </div>

            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-cyan-300"
              placeholder="Libellé: Ascenseur A, Salle 104..."
            />
          </Panel>

          <Panel title="2. Créer une connexion" subtitle="Déclarez qu'un chemin existe entre deux points.">
            <form onSubmit={handleCreateEdge} className="space-y-3">
              <SelectElement
                label="Depuis"
                value={fromElementId}
                onChange={setFromElementId}
                elements={elements}
              />

              <SelectElement
                label="Vers"
                value={toElementId}
                onChange={setToElementId}
                elements={elements}
              />

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Distance approximative en mètres
                </label>

                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 focus-within:border-cyan-300">
                  <Ruler size={17} className="text-slate-400" />
                  <input
                    value={distanceMeters}
                    onChange={(event) => setDistanceMeters(event.target.value)}
                    type="number"
                    min="0.1"
                    step="0.1"
                    className="w-full bg-transparent text-sm outline-none"
                  />
              </div>

              {estimatedDistanceMeters !== null ? (
                <p className="mt-2 text-xs leading-5 text-cyan-200">
                  Distance estimée automatiquement à partir des dimensions du plan :{" "}
                  {estimatedDistanceMeters.toFixed(1)} m.
                </p>
              ) : (
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Ajoutez les dimensions réelles du plan pour estimer automatiquement la
                  distance.
                </p>
              )}
            </div>

              <label className="flex items-center gap-3 rounded-2xl bg-slate-900 p-3 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={wheelchairAccessible}
                  onChange={(event) => setWheelchairAccessible(event.target.checked)}
                />
                Accessible fauteuil roulant
              </label>

              <label className="flex items-center gap-3 rounded-2xl bg-slate-900 p-3 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={crutchesAccessible}
                  onChange={(event) => setCrutchesAccessible(event.target.checked)}
                />
                Accessible avec béquilles
              </label>

              <label className="flex items-center gap-3 rounded-2xl bg-slate-900 p-3 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={isBidirectional}
                  onChange={(event) => setIsBidirectional(event.target.checked)}
                />
                Connexion bidirectionnelle
              </label>

              <textarea
                value={edgeNotes}
                onChange={(event) => setEdgeNotes(event.target.value)}
                className="min-h-20 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-cyan-300"
                placeholder="Note optionnelle: rampe douce, porte lourde, couloir étroit..."
              />

              <button
                disabled={savingEdge || elements.length < 2}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-4 py-3 font-medium text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingEdge ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Plus size={18} />
                )}
                Ajouter connexion
              </button>
            </form>
          </Panel>
        </aside>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">Plan interactif</h2>
              <p className="mt-1 text-sm text-slate-400">
                Les points et les connexions forment le graphe de navigation.
              </p>
            </div>

            <StatusBadge status={floor.status} />
          </div>

          {errorMessage && (
            <div className="mb-4 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
              {errorMessage}
            </div>
          )}

          {infoMessage && (
            <div className="mb-4 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-4 text-sm text-cyan-200">
              {infoMessage}
            </div>
          )}

          {!signedUrl ? (
            <div className="flex min-h-[520px] items-center justify-center rounded-3xl border border-dashed border-white/15 bg-slate-900 p-8 text-center">
              <div>
                <Layers className="mx-auto mb-4 text-slate-500" size={42} />
                <h3 className="text-xl font-semibold">Aucune image</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
                  Este piso no tiene imagen asociada. Vuelve al dashboard y sube
                  un plano primero.
                </p>
              </div>
            </div>
          ) : (
            <div className="relative flex min-h-[520px] items-center justify-center overflow-auto rounded-3xl bg-slate-900 p-4">
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={signedUrl}
                  alt={`Plan ${floor.name}`}
                  onClick={handleImageClick}
                  className="block max-h-[70vh] max-w-full cursor-crosshair rounded-2xl border border-white/10"
                />

                <svg
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  {edges.map((edge) => {
                    const from = getElementById(edge.from_element_id);
                    const to = getElementById(edge.to_element_id);

                    if (!from || !to) return null;

                    return (
                      <line
                        key={edge.id}
                        x1={from.x * 100}
                        y1={from.y * 100}
                        x2={to.x * 100}
                        y2={to.y * 100}
                        stroke={edge.wheelchair_accessible ? "#22d3ee" : "#f87171"}
                        strokeWidth="0.7"
                        strokeLinecap="round"
                        strokeDasharray={edge.wheelchair_accessible ? "0" : "2 1.4"}
                      />
                    );
                  })}
                </svg>

                <div className="pointer-events-none absolute inset-0">
                  {elements.map((element, index) => (
                    <MapMarker
                      key={element.id}
                      element={element}
                      index={index + 1}
                    />
                  ))}
                </div>

                {savingElement && (
                  <div className="absolute left-4 top-4 flex items-center gap-2 rounded-2xl bg-slate-950/85 px-4 py-3 text-sm text-slate-200 backdrop-blur">
                    <Loader2 className="animate-spin" size={17} />
                    Sauvegarde...
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <Panel title="Points du plan" subtitle="Éléments accessibles et obstacles.">
            {elements.length === 0 ? (
              <EmptyState
                icon={<MapPin size={30} />}
                text="Aucun élément placé pour l'instant."
              />
            ) : (
              <div className="max-h-80 space-y-3 overflow-auto pr-1">
                {elements.map((element, index) => (
                  <div
                    key={element.id}
                    className="rounded-2xl border border-white/10 bg-slate-900 p-4"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-cyan-200">#{index + 1}</p>
                        <p className="font-medium">
                          {element.label || labelByType[element.type]}
                        </p>
                        <p className="text-xs text-slate-500">
                          {labelByType[element.type]} · x={element.x.toFixed(3)}, y=
                          {element.y.toFixed(3)}
                        </p>
                      </div>

                      <ElementIcon type={element.type} />
                    </div>

                    <button
                      onClick={() => handleDeleteElement(element.id)}
                      disabled={deletingElementId === element.id}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-200 hover:bg-red-400/15 disabled:opacity-60"
                    >
                      {deletingElementId === element.id ? (
                        <Loader2 className="animate-spin" size={14} />
                      ) : (
                        <Trash2 size={14} />
                      )}
                      Supprimer
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Connexions" subtitle="Arêtes du graphe de navigation.">
            {edges.length === 0 ? (
              <EmptyState
                icon={<GitBranch size={30} />}
                text="Aucune connexion créée pour l'instant."
              />
            ) : (
              <div className="max-h-80 space-y-3 overflow-auto pr-1">
                {edges.map((edge) => (
                  <div
                    key={edge.id}
                    className="rounded-2xl border border-white/10 bg-slate-900 p-4"
                  >
                    <div className="mb-3 flex items-start gap-3">
                      <Link2 className="mt-1 shrink-0 text-cyan-300" size={18} />

                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {getElementLabel(edge.from_element_id)}
                        </p>
                        <p className="text-xs text-slate-500">vers</p>
                        <p className="text-sm font-medium">
                          {getElementLabel(edge.to_element_id)}
                        </p>
                      </div>
                    </div>

                    <div className="mb-3 rounded-xl bg-white/[0.04] p-3 text-xs leading-5 text-slate-400">
                      <p>
                        Distance :{" "}
                        <span className="text-slate-200">
                          {edge.distance_meters} m
                        </span>
                      </p>
                      <p>
                        Fauteuil :{" "}
                        <span className="text-slate-200">
                          {edge.wheelchair_accessible ? "oui" : "non"}
                        </span>
                      </p>
                      <p>
                        Béquilles :{" "}
                        <span className="text-slate-200">
                          {edge.crutches_accessible ? "oui" : "non"}
                        </span>
                      </p>
                      <p>
                        Sens :{" "}
                        <span className="text-slate-200">
                          {edge.is_bidirectional ? "bidirectionnel" : "sens unique"}
                        </span>
                      </p>
                    </div>

                    <button
                      onClick={() => handleDeleteEdge(edge.id)}
                      disabled={deletingEdgeId === edge.id}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-200 hover:bg-red-400/15 disabled:opacity-60"
                    >
                      {deletingEdgeId === edge.id ? (
                        <Loader2 className="animate-spin" size={14} />
                      ) : (
                        <Trash2 size={14} />
                      )}
                      Supprimer connexion
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Publication" subtitle="Rendre ce piso utilisable.">
            <div className="rounded-2xl bg-white/[0.04] p-4 text-sm leading-6 text-slate-400">
              Pour publier proprement, il faut au moins quelques points et
              connexions. Ensuite l'utilisateur final pourra demander un chemin.
            </div>

            <button
              onClick={handlePublishFloor}
              disabled={publishing || elements.length === 0 || edges.length === 0}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-4 py-3 font-medium text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {publishing ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <Save size={18} />
              )}
              Marquer comme publié
            </button>
          </Panel>
        </aside>
      </section>
    </main>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-5">
        <h3 className="text-xl font-semibold">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">{subtitle}</p>
      </div>

      {children}
    </section>
  );
}

function SelectElement({
  label,
  value,
  onChange,
  elements,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  elements: AccessibleElement[];
}) {
  return (
    <div>
      <label className="mb-2 block text-sm text-slate-300">{label}</label>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={elements.length === 0}
        className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-cyan-300 disabled:opacity-50"
      >
        {elements.length === 0 ? (
          <option value="">Aucun élément</option>
        ) : (
          elements.map((element, index) => (
            <option key={element.id} value={element.id}>
              #{index + 1} · {element.label || labelByType[element.type]}
            </option>
          ))
        )}
      </select>
    </div>
  );
}

function MapMarker({
  element,
  index,
}: {
  element: AccessibleElement;
  index: number;
}) {
  return (
    <div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2"
      style={{
        left: `${element.x * 100}%`,
        top: `${element.y * 100}%`,
      }}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400 text-xs font-bold text-slate-950 shadow-lg shadow-cyan-950/40 ring-4 ring-slate-950/70">
        {index}
      </div>

      <div className="hidden rounded-full bg-slate-950/85 px-3 py-1 text-xs text-white backdrop-blur md:block">
        {element.label || labelByType[element.type]}
      </div>
    </div>
  );
}

function ElementIcon({ type }: { type: ElementType }) {
  const className = "text-cyan-300";

  if (type === "entrance") return <Flag className={className} size={18} />;
  if (type === "elevator") return <ArrowUpDown className={className} size={18} />;
  if (type === "ramp") return <Triangle className={className} size={18} />;
  if (type === "stairs") return <Waypoints className={className} size={18} />;
  if (type === "door") return <DoorOpen className={className} size={18} />;
  if (type === "room") return <MapPin className={className} size={18} />;
  if (type === "obstacle") return <ShieldAlert className="text-red-300" size={18} />;

  return <CheckCircle2 className={className} size={18} />;
}

function StatusBadge({ status }: { status: FloorStatus }) {
  const labelByStatus: Record<FloorStatus, string> = {
    uploaded: "Créé",
    processing: "Analyse",
    needs_review: "À valider",
    published: "Publié",
  };

  const classByStatus: Record<FloorStatus, string> = {
    uploaded: "bg-white/10 text-slate-300",
    processing: "bg-amber-300/10 text-amber-200",
    needs_review: "bg-cyan-400/10 text-cyan-200",
    published: "bg-emerald-400/10 text-emerald-200",
  };

  return (
    <span className={`rounded-full px-3 py-1 text-xs ${classByStatus[status]}`}>
      {labelByStatus[status]}
    </span>
  );
}

function estimateRealDistanceMeters({
  floor,
  from,
  to,
}: {
  floor: Floor;
  from: AccessibleElement;
  to: AccessibleElement;
}) {
  if (!floor.real_width_meters || !floor.real_height_meters) {
    return null;
  }

  const dxMeters = Math.abs(to.x - from.x) * floor.real_width_meters;
  const dyMeters = Math.abs(to.y - from.y) * floor.real_height_meters;

  return Math.sqrt(dxMeters ** 2 + dyMeters ** 2);
}

function EmptyState({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-slate-900 p-5 text-center">
      <div className="mx-auto mb-3 flex justify-center text-slate-500">{icon}</div>
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  );
}