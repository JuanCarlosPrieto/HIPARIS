"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  analyzePlanWithAI,
  type AIElementProposal,
  type AIEdgeProposal,
  type AIPlanProposal,
} from "@/lib/ai/analyzePlanWithAI";

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

type EdgeType =
  | "corridor"
  | "door"
  | "ramp"
  | "elevator"
  | "stairs"
  | "threshold"
  | "manual";

type SurfaceType =
  | "normal"
  | "slippery"
  | "carpet"
  | "irregular"
  | "gravel"
  | "unknown";

type DoorType =
  | "automatic"
  | "manual_light"
  | "manual_heavy"
  | "push"
  | "pull"
  | "unknown";

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

  edge_type: EdgeType;
  slope_percent: number | null;
  width_cm: number | null;
  step_height_cm: number | null;
  surface_type: SurfaceType | null;
  door_type: DoorType | null;
  assistance_required: boolean;
  accessibility_notes: string | null;
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

  const [aiProposal, setAiProposal] = useState<AIPlanProposal | null>(null);
  const [ignoredAIElementIds, setIgnoredAIElementIds] = useState<Set<string>>(
    () => new Set()
  );
  const [ignoredAIEdgeIds, setIgnoredAIEdgeIds] = useState<Set<string>>(
    () => new Set()
  );
  const [analyzingPlan, setAnalyzingPlan] = useState(false);
  const [savingAIProposal, setSavingAIProposal] = useState(false);

  const [fromElementId, setFromElementId] = useState("");
  const [toElementId, setToElementId] = useState("");
  const [distanceMeters, setDistanceMeters] = useState("5");
  const [wheelchairAccessible, setWheelchairAccessible] = useState(true);
  const [crutchesAccessible, setCrutchesAccessible] = useState(true);
  const [isBidirectional, setIsBidirectional] = useState(true);
  const [edgeNotes, setEdgeNotes] = useState("");

  const [edgeType, setEdgeType] = useState<EdgeType>("corridor");
  const [slopePercent, setSlopePercent] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [stepHeightCm, setStepHeightCm] = useState("");
  const [surfaceType, setSurfaceType] = useState<SurfaceType>("normal");
  const [doorType, setDoorType] = useState<DoorType>("unknown");
  const [assistanceRequired, setAssistanceRequired] = useState(false);
  const [accessibilityNotes, setAccessibilityNotes] = useState("");

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

  const acceptedAIElements = useMemo(() => {
    if (!aiProposal) return [];

    return aiProposal.elements.filter(
      (element) => !ignoredAIElementIds.has(element.temp_id)
    );
  }, [aiProposal, ignoredAIElementIds]);

  const acceptedAIEdges = useMemo(() => {
    if (!aiProposal) return [];

    return aiProposal.edges.filter((edge, index) => {
      const edgeId = getAIEdgeId(edge, index);

      const edgeWasIgnored = ignoredAIEdgeIds.has(edgeId);
      const fromWasIgnored = ignoredAIElementIds.has(edge.from_temp_id);
      const toWasIgnored = ignoredAIElementIds.has(edge.to_temp_id);

      return !edgeWasIgnored && !fromWasIgnored && !toWasIgnored;
    });
  }, [aiProposal, ignoredAIElementIds, ignoredAIEdgeIds]);

  function getAIEdgeId(edge: AIEdgeProposal, index: number) {
    return `${edge.from_temp_id}-${edge.to_temp_id}-${edge.edge_type}-${index}`;
  }

  function ignoreAIElement(tempId: string) {
    setIgnoredAIElementIds((current) => {
      const next = new Set(current);
      next.add(tempId);
      return next;
    });
  }

  function restoreAIElement(tempId: string) {
    setIgnoredAIElementIds((current) => {
      const next = new Set(current);
      next.delete(tempId);
      return next;
    });
  }

  function ignoreAIEdge(edge: AIEdgeProposal, index: number) {
    const edgeId = getAIEdgeId(edge, index);

    setIgnoredAIEdgeIds((current) => {
      const next = new Set(current);
      next.add(edgeId);
      return next;
    });
  }

  function restoreAIEdge(edge: AIEdgeProposal, index: number) {
    const edgeId = getAIEdgeId(edge, index);

    setIgnoredAIEdgeIds((current) => {
      const next = new Set(current);
      next.delete(edgeId);
      return next;
    });
  }

  function acceptAllAIProposal() {
    setIgnoredAIElementIds(new Set());
    setIgnoredAIEdgeIds(new Set());
  }

  function rejectAllAIProposal() {
    if (!aiProposal) return;

    setIgnoredAIElementIds(
      new Set(aiProposal.elements.map((element) => element.temp_id))
    );

    setIgnoredAIEdgeIds(
      new Set(aiProposal.edges.map((edge, index) => getAIEdgeId(edge, index)))
    );
  }

  function clearAIProposal() {
    setAiProposal(null);
    setIgnoredAIElementIds(new Set());
    setIgnoredAIEdgeIds(new Set());
  }

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

  function handleEdgeTypeChange(nextType: EdgeType) {
    setEdgeType(nextType);

    if (nextType === "stairs") {
      setWheelchairAccessible(false);
      setCrutchesAccessible(true);
      setSurfaceType("normal");
      setDoorType("unknown");
    }

    if (nextType === "elevator") {
      setWheelchairAccessible(true);
      setCrutchesAccessible(true);
      setSlopePercent("");
      setStepHeightCm("");
      setSurfaceType("normal");
      setDoorType("unknown");
    }

    if (nextType === "ramp") {
      setWheelchairAccessible(true);
      setCrutchesAccessible(true);
      setStepHeightCm("");
      setDoorType("unknown");
    }

    if (nextType === "door") {
      setWheelchairAccessible(true);
      setCrutchesAccessible(true);
      setSlopePercent("");
      setStepHeightCm("");
    }

    if (nextType === "threshold") {
      setWheelchairAccessible(false);
      setCrutchesAccessible(true);
      setDoorType("unknown");
    }

    if (nextType === "corridor") {
      setWheelchairAccessible(true);
      setCrutchesAccessible(true);
      setDoorType("unknown");
    }
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

    const slopeValue = slopePercent.trim() ? Number.parseFloat(slopePercent) : null;
    const widthValue = widthCm.trim() ? Number.parseFloat(widthCm) : null;
    const stepHeightValue = stepHeightCm.trim()
      ? Number.parseFloat(stepHeightCm)
      : null;

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

        edge_type: edgeType,
        slope_percent: slopeValue,
        width_cm: widthValue,
        step_height_cm: stepHeightValue,
        surface_type: surfaceType,
        door_type: edgeType === "door" ? doorType : null,
        assistance_required: assistanceRequired,
        accessibility_notes: accessibilityNotes.trim() || null,

        notes: edgeNotes.trim() || null,
      })
      .select("*")
      .single();

    setSavingEdge(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setEdgeNotes("");
    setAccessibilityNotes("");
    setSlopePercent("");
    setWidthCm("");
    setStepHeightCm("");
    setSurfaceType("normal");
    setDoorType("unknown");
    setAssistanceRequired(false);
    setEdgeType("corridor");
    setWheelchairAccessible(true);
    setCrutchesAccessible(true);
    setIsBidirectional(true);
    setEdges((current) => [...current, data as RouteEdge]);
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

  async function handleAnalyzePlanWithAI() {
    if (!floor) return;

    if (!signedUrl) {
      setErrorMessage("Aucune image disponible pour cet étage.");
      return;
    }

    setAnalyzingPlan(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const imageResponse = await fetch(signedUrl);

      if (!imageResponse.ok) {
        throw new Error("Impossible de lire l'image du plan.");
      }

      const imageBlob = await imageResponse.blob();

      const rawProposal = await analyzePlanWithAI({
        image: imageBlob,
        floorId: floor.id,
        realWidthMeters: floor.real_width_meters,
        realHeightMeters: floor.real_height_meters,
      });

      const proposal = filterAIProposalInsideBounds(rawProposal);

      setIgnoredAIElementIds(new Set());
      setIgnoredAIEdgeIds(new Set());

      setAiProposal(proposal);
      setInfoMessage(
        `Analyse IA terminée : ${proposal.elements.length} points et ${proposal.edges.length} connexions proposés.`
      );
    } catch (error) {
      console.error("Erreur analyse IA:", error);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setAnalyzingPlan(false);
    }
  }

  async function handleSaveAIProposal() {
    if (!floor || !aiProposal) return;

    if (acceptedAIElements.length === 0) {
      setErrorMessage("Aucun point IA accepté à sauvegarder.");
      return;
    }

    setSavingAIProposal(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const elementRows = acceptedAIElements.map((element) => ({
        floor_id: floor.id,
        type: mapAIElementTypeToElementType(element.type),
        label: getAIElementLabel(element),
        x: clamp01(element.x),
        y: clamp01(element.y),
        metadata: {
          source: "ai",
          ai_temp_id: element.temp_id,
          ai_original_type: element.type,
          ai_confidence: element.confidence,
          ai_notes: element.notes,
          validation_status: "needs_human_review",
        },
      }));

      const { data: insertedElements, error: elementsError } = await supabase
        .from("accessible_elements")
        .insert(elementRows)
        .select("*");

      if (elementsError) {
        throw elementsError;
      }

      const savedElements = (insertedElements ?? []) as AccessibleElement[];

      const savedByTempId = new Map<string, AccessibleElement>();

      for (const element of savedElements) {
        const metadata = element.metadata as Record<string, unknown> | null;
        const tempId = metadata?.ai_temp_id;

        if (typeof tempId === "string") {
          savedByTempId.set(tempId, element);
        }
      }

      const edgeRows = acceptedAIEdges
            .map((edge) => {
          const from = savedByTempId.get(edge.from_temp_id);
          const to = savedByTempId.get(edge.to_temp_id);

          if (!from || !to) {
            return null;
          }

          const edgeType = mapAIEdgeTypeToEdgeType(edge.edge_type);
          const distance = estimateDistanceFromCoordinates({
            floor,
            fromX: from.x,
            fromY: from.y,
            toX: to.x,
            toY: to.y,
          });

          return {
            floor_id: floor.id,
            from_element_id: from.id,
            to_element_id: to.id,
            distance_meters: distance,
            wheelchair_accessible:
              edge.wheelchair_accessible ?? edgeType !== "stairs",
            crutches_accessible: edge.crutches_accessible ?? true,
            is_bidirectional: true,
            edge_type: edgeType,
            slope_percent: null,
            width_cm: null,
            step_height_cm: null,
            surface_type: "unknown",
            door_type: edgeType === "door" ? "unknown" : null,
            assistance_required: false,
            notes: edge.notes || "Connexion proposée par IA.",
            accessibility_notes:
              edge.confidence < 0.6
                ? "Faible confiance IA : à vérifier manuellement."
                : null,
          };
        })
        .filter((edge): edge is NonNullable<typeof edge> => edge !== null);

      if (edgeRows.length > 0) {
        const { data: insertedEdges, error: edgesError } = await supabase
          .from("route_edges")
          .insert(edgeRows)
          .select("*");

        if (edgesError) {
          throw edgesError;
        }

        setEdges((current) => [
          ...current,
          ...((insertedEdges ?? []) as RouteEdge[]),
        ]);
      }

      setElements((current) => [...current, ...savedElements]);
      clearAIProposal();

      setInfoMessage(
        `Proposition IA validée : ${savedElements.length} points et ${edgeRows.length} connexions ajoutés. Vérifiez les données avant publication.`
      );
    } catch (error) {
      console.error("Erreur sauvegarde proposition IA:", error);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSavingAIProposal(false);
    }
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
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Plan interactif</h2>
              <p className="mt-1 text-sm text-slate-400">
                Les points et les connexions forment le graphe de navigation.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={floor.status} />

              <button
                type="button"
                onClick={handleAnalyzePlanWithAI}
                disabled={analyzingPlan || !signedUrl}
                className="flex items-center gap-2 rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {analyzingPlan ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Accessibility size={16} />
                )}
                {analyzingPlan ? "Analyse IA..." : "Analyser avec IA"}
              </button>
            </div>
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

                  {aiProposal?.floor_plan_bounds && (
                    <rect
                      x={clamp01(aiProposal.floor_plan_bounds.x) * 100}
                      y={clamp01(aiProposal.floor_plan_bounds.y) * 100}
                      width={clamp01(aiProposal.floor_plan_bounds.width) * 100}
                      height={clamp01(aiProposal.floor_plan_bounds.height) * 100}
                      fill="none"
                      stroke="#facc15"
                      strokeWidth="0.4"
                      strokeDasharray="1.5 1"
                      opacity="0.9"
                    />
                  )}

                  {acceptedAIEdges.map((edge, index) => {
                    const from = aiProposal?.elements.find(
                      (element) => element.temp_id === edge.from_temp_id
                    );
                    const to = aiProposal?.elements.find(
                      (element) => element.temp_id === edge.to_temp_id
                    );

                    if (!from || !to) return null;

                    return (
                      <line
                        key={`ai-edge-${index}`}
                        x1={clamp01(from.x) * 100}
                        y1={clamp01(from.y) * 100}
                        x2={clamp01(to.x) * 100}
                        y2={clamp01(to.y) * 100}
                        stroke="#facc15"
                        strokeWidth="0.6"
                        strokeLinecap="round"
                        strokeDasharray="2 1.5"
                        opacity="0.9"
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

                  {acceptedAIElements.map((element, index) => (
                    <AIMapMarker
                      key={element.temp_id}
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
          {aiProposal && (
            <Panel
              title="Proposition IA"
              subtitle="Acceptez uniquement les éléments fiables avant de les sauvegarder."
            >
              <div className="space-y-4">
                {aiProposal.warnings.length > 0 && (
                  <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-xs leading-5 text-amber-100">
                    {aiProposal.warnings.map((warning, index) => (
                      <p key={index}>• {warning}</p>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-white/[0.04] p-4">
                    <p className="text-slate-400">Points acceptés</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-100">
                      {acceptedAIElements.length}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      sur {aiProposal.elements.length} proposés
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white/[0.04] p-4">
                    <p className="text-slate-400">Connexions acceptées</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-100">
                      {acceptedAIEdges.length}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      sur {aiProposal.edges.length} proposées
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={acceptAllAIProposal}
                    disabled={savingAIProposal}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-100 hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <CheckCircle2 size={16} />
                    Tout accepter
                  </button>

                  <button
                    type="button"
                    onClick={rejectAllAIProposal}
                    disabled={savingAIProposal}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-red-300/30 bg-red-400/10 px-4 py-3 text-sm font-medium text-red-100 hover:bg-red-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                    Tout rejeter
                  </button>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                    Points proposés
                  </p>

                  <div className="max-h-64 space-y-2 overflow-auto pr-1">
                    {aiProposal.elements.map((element, index) => {
                      const ignored = ignoredAIElementIds.has(element.temp_id);

                      return (
                        <div
                          key={element.temp_id}
                          className={`rounded-xl border p-3 text-xs ${
                            ignored
                              ? "border-red-300/20 bg-red-400/5 opacity-60"
                              : "border-amber-300/20 bg-amber-300/10"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-amber-100">
                                IA{index + 1} · {getAIElementLabel(element)}
                              </p>

                              <p className="mt-1 text-slate-400">
                                Type : {element.type} · confiance :{" "}
                                {(element.confidence * 100).toFixed(0)}%
                              </p>

                              <p className="mt-1 text-slate-500">
                                x={clamp01(element.x).toFixed(3)}, y=
                                {clamp01(element.y).toFixed(3)}
                              </p>

                              {element.notes && (
                                <p className="mt-1 text-slate-500">{element.notes}</p>
                              )}

                              {ignored && (
                                <p className="mt-2 text-red-200">
                                  Ce point sera ignoré.
                                </p>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                ignored
                                  ? restoreAIElement(element.temp_id)
                                  : ignoreAIElement(element.temp_id)
                              }
                              disabled={savingAIProposal}
                              className={`shrink-0 rounded-xl px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
                                ignored
                                  ? "bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/15"
                                  : "bg-red-400/10 text-red-100 hover:bg-red-400/15"
                              }`}
                            >
                              {ignored ? "Restaurer" : "Rejeter"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {aiProposal.edges.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                      Connexions proposées
                    </p>

                    <div className="max-h-56 space-y-2 overflow-auto pr-1">
                      {aiProposal.edges.map((edge, index) => {
                        const ignored = ignoredAIEdgeIds.has(getAIEdgeId(edge, index));
                        const fromIgnored = ignoredAIElementIds.has(edge.from_temp_id);
                        const toIgnored = ignoredAIElementIds.has(edge.to_temp_id);
                        const disabledByElement = fromIgnored || toIgnored;

                        return (
                          <div
                            key={getAIEdgeId(edge, index)}
                            className={`rounded-xl border p-3 text-xs ${
                              ignored || disabledByElement
                                ? "border-red-300/20 bg-red-400/5 opacity-60"
                                : "border-cyan-300/20 bg-cyan-300/10"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium text-cyan-100">
                                  Connexion IA{index + 1}
                                </p>

                                <p className="mt-1 text-slate-400">
                                  {edge.from_temp_id} → {edge.to_temp_id}
                                </p>

                                <p className="mt-1 text-slate-500">
                                  Type : {edge.edge_type} · confiance :{" "}
                                  {(edge.confidence * 100).toFixed(0)}%
                                </p>

                                {edge.notes && (
                                  <p className="mt-1 text-slate-500">{edge.notes}</p>
                                )}

                                {disabledByElement && (
                                  <p className="mt-2 text-red-200">
                                    Connexion ignorée car un point lié a été rejeté.
                                  </p>
                                )}

                                {ignored && !disabledByElement && (
                                  <p className="mt-2 text-red-200">
                                    Cette connexion sera ignorée.
                                  </p>
                                )}
                              </div>

                              {!disabledByElement && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    ignored
                                      ? restoreAIEdge(edge, index)
                                      : ignoreAIEdge(edge, index)
                                  }
                                  disabled={savingAIProposal}
                                  className={`shrink-0 rounded-xl px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
                                    ignored
                                      ? "bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/15"
                                      : "bg-red-400/10 text-red-100 hover:bg-red-400/15"
                                  }`}
                                >
                                  {ignored ? "Restaurer" : "Rejeter"}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSaveAIProposal}
                  disabled={savingAIProposal || acceptedAIElements.length === 0}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-300 px-4 py-3 font-medium text-slate-950 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingAIProposal ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <Save size={18} />
                  )}
                  Sauvegarder uniquement les éléments acceptés
                </button>

                <button
                  type="button"
                  onClick={clearAIProposal}
                  disabled={savingAIProposal}
                  className="w-full rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Fermer la proposition IA
                </button>
              </div>
            </Panel>
          )}
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
                      <p>
                        Type :{" "}
                        <span className="text-slate-200">
                          {edge.edge_type}
                        </span>
                      </p>

                      {edge.width_cm !== null && edge.width_cm !== undefined && (
                        <p>
                          Largeur :{" "}
                          <span className="text-slate-200">
                            {edge.width_cm} cm
                          </span>
                        </p>
                      )}

                      {edge.slope_percent !== null && edge.slope_percent !== undefined && (
                        <p>
                          Pente :{" "}
                          <span className="text-slate-200">
                            {edge.slope_percent} %
                          </span>
                        </p>
                      )}

                      {edge.step_height_cm !== null && edge.step_height_cm !== undefined && (
                        <p>
                          Hauteur marche :{" "}
                          <span className="text-slate-200">
                            {edge.step_height_cm} cm
                          </span>
                        </p>
                      )}

                      {edge.surface_type && (
                        <p>
                          Surface :{" "}
                          <span className="text-slate-200">
                            {edge.surface_type}
                          </span>
                        </p>
                      )}

                      {edge.door_type && (
                        <p>
                          Porte :{" "}
                          <span className="text-slate-200">
                            {edge.door_type}
                          </span>
                        </p>
                      )}

                      <p>
                        Assistance :{" "}
                        <span className="text-slate-200">
                          {edge.assistance_required ? "oui" : "non"}
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
      className="absolute z-20"
      style={{
        left: `${clamp01(element.x) * 100}%`,
        top: `${clamp01(element.y) * 100}%`,
      }}
    >
      <div className="relative">
        <div className="absolute left-0 top-0 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-cyan-400 text-xs font-bold text-slate-950 shadow-lg shadow-cyan-950/40 ring-4 ring-slate-950/70">
          {index}
        </div>

        <div className="absolute left-5 top-0 hidden -translate-y-1/2 whitespace-nowrap rounded-full bg-slate-950/85 px-3 py-1 text-xs text-white backdrop-blur md:block">
          {element.label || labelByType[element.type]}
        </div>
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

function mapAIElementTypeToElementType(type: AIElementProposal["type"]): ElementType {
  if (type === "entrance") return "entrance";
  if (type === "elevator") return "elevator";
  if (type === "stairs") return "stairs";
  if (type === "ramp") return "ramp";
  if (type === "door") return "door";
  if (type === "toilet") return "toilet";
  if (type === "accessible_toilet") return "toilet";
  if (type === "obstacle") return "obstacle";

  return "room";
}

function mapAIEdgeTypeToEdgeType(type: AIEdgeProposal["edge_type"]): EdgeType {
  if (type === "corridor") return "corridor";
  if (type === "door") return "door";
  if (type === "ramp") return "ramp";
  if (type === "elevator") return "elevator";
  if (type === "stairs") return "stairs";
  if (type === "manual") return "manual";

  return "manual";
}

function getAIElementLabel(element: AIElementProposal) {
  const cleanName = element.name?.trim();

  if (cleanName) {
    return cleanName;
  }

  if (element.type === "corridor") return "Couloir";
  if (element.type === "accessible_toilet") return "Toilettes PMR";
  if (element.type === "unknown") return "Élément proposé";

  return labelByType[mapAIElementTypeToElementType(element.type)];
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function estimateDistanceFromCoordinates({
  floor,
  fromX,
  fromY,
  toX,
  toY,
}: {
  floor: Floor;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}) {
  if (!floor.real_width_meters || !floor.real_height_meters) {
    return 5;
  }

  const dxMeters = Math.abs(toX - fromX) * floor.real_width_meters;
  const dyMeters = Math.abs(toY - fromY) * floor.real_height_meters;
  const distance = Math.sqrt(dxMeters ** 2 + dyMeters ** 2);

  return Number(distance.toFixed(1));
}


function AIMapMarker({
  element,
  index,
}: {
  element: AIElementProposal;
  index: number;
}) {
  return (
    <div
      className="absolute z-30"
      style={{
        left: `${clamp01(element.x) * 100}%`,
        top: `${clamp01(element.y) * 100}%`,
      }}
    >
      <div className="relative">
        <div className="absolute left-0 top-0 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-amber-300 text-xs font-bold text-slate-950 shadow-lg shadow-amber-950/40 ring-4 ring-slate-950/70">
          IA{index}
        </div>

        <div className="absolute left-5 top-0 hidden -translate-y-1/2 whitespace-nowrap rounded-full bg-slate-950/85 px-3 py-1 text-xs text-amber-100 backdrop-blur md:block">
          {getAIElementLabel(element)} · {(element.confidence * 100).toFixed(0)}%
        </div>
      </div>
    </div>
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Erreur inconnue.";
}


function isInsideAIPlanBounds(
  point: { x: number; y: number },
  bounds: { x: number; y: number; width: number; height: number },
  margin = 0.015
) {
  return (
    point.x >= bounds.x - margin &&
    point.x <= bounds.x + bounds.width + margin &&
    point.y >= bounds.y - margin &&
    point.y <= bounds.y + bounds.height + margin
  );
}

function filterAIProposalInsideBounds(proposal: AIPlanProposal): AIPlanProposal {
  const bounds = proposal.floor_plan_bounds;

  if (!bounds) {
    return proposal;
  }

  const validElements = proposal.elements.filter((element) =>
    isInsideAIPlanBounds(element, bounds)
  );

  const validTempIds = new Set(
    validElements.map((element) => element.temp_id)
  );

  const validEdges = proposal.edges.filter(
    (edge) =>
      validTempIds.has(edge.from_temp_id) &&
      validTempIds.has(edge.to_temp_id)
  );

  const removedCount = proposal.elements.length - validElements.length;

  return {
    ...proposal,
    elements: validElements,
    edges: validEdges,
    warnings:
      removedCount > 0
        ? [
            ...proposal.warnings,
            `${removedCount} élément(s) IA supprimé(s), car hors de la zone utile du plan.`,
          ]
        : proposal.warnings,
  };
}