"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Accessibility,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  CheckCircle2,
  DoorOpen,
  Flag,
  Loader2,
  MapPin,
  Route,
  ShieldAlert,
  Triangle,
  Waypoints,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type RoutingEdge = RouteEdge & {
  edge_type?: "corridor" | "elevator" | "ramp" | "stairs" | "door" | "virtual";
  synthetic?: boolean;
};

type RouteStep = {
  nodeId: string;
  floorId: string;
  title: string;
  instruction: string;
};

type Organization = {
  id: string;
  owner_id: string;
  name: string;
  type: string | null;
  created_at: string;
};

type Building = {
  id: string;
  organization_id: string;
  name: string;
  address: string | null;
  created_at: string;
};

type Floor = {
  id: string;
  building_id: string;
  level: number;
  name: string;
  plan_image_path: string | null;
  plan_image_width: number | null;
  plan_image_height: number | null;
  status: "uploaded" | "processing" | "needs_review" | "published";
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

type MobilityProfile = "wheelchair" | "crutches" | "reduced_mobility";

type RouteResult = {
  nodeIds: string[];
  edgeIds: string[];
  totalDistance: number;
  steps: RouteStep[];
};

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

const mobilityLabels: Record<MobilityProfile, string> = {
  wheelchair: "Fauteuil roulant",
  crutches: "Béquilles",
  reduced_mobility: "Mobilité réduite",
};

export default function NavigationPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [elements, setElements] = useState<AccessibleElement[]>([]);
  const [edges, setEdges] = useState<RoutingEdge[]>([]);

  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [selectedBuildingId, setSelectedBuildingId] = useState("");
  const [selectedFloorId, setSelectedFloorId] = useState("");
  const [fromElementId, setFromElementId] = useState("");
  const [toElementId, setToElementId] = useState("");
  const [mobilityProfile, setMobilityProfile] =
    useState<MobilityProfile>("wheelchair");

  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);

  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [loadingMap, setLoadingMap] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedOrganization = organizations.find(
    (organization) => organization.id === selectedOrganizationId
  );

  const selectedBuilding = buildings.find(
    (building) => building.id === selectedBuildingId
  );

  const selectedFloor = floors.find((floor) => floor.id === selectedFloorId);

  const selectableElements = elements.filter(
    (element) => element.type !== "obstacle"
  );

  const routeNodeIds = new Set(routeResult?.nodeIds ?? []);
  const routeEdgeIds = new Set(routeResult?.edgeIds ?? []);

  const visibleElements = elements.filter(
    (element) => element.floor_id === selectedFloorId
  );

  const visibleElementIds = new Set(visibleElements.map((element) => element.id));

  const visibleEdges = edges.filter((edge) => {
    const from = getElementById(edge.from_element_id);
    const to = getElementById(edge.to_element_id);

    if (!from || !to) return false;

    return from.floor_id === selectedFloorId && to.floor_id === selectedFloorId;
  });

  useEffect(() => {
    loadOrganizations();
  }, []);

  useEffect(() => {
    setBuildings([]);
    setFloors([]);
    setElements([]);
    setEdges([]);
    setSignedUrl(null);
    setRouteResult(null);
    setSelectedBuildingId("");
    setSelectedFloorId("");
    setFromElementId("");
    setToElementId("");

    if (selectedOrganizationId) {
      loadBuildings(selectedOrganizationId);
    }
  }, [selectedOrganizationId]);

  useEffect(() => {
    setFloors([]);
    setElements([]);
    setEdges([]);
    setSignedUrl(null);
    setRouteResult(null);
    setSelectedFloorId("");
    setFromElementId("");
    setToElementId("");

    if (selectedBuildingId) {
      loadFloors(selectedBuildingId);
    }
  }, [selectedBuildingId]);

  useEffect(() => {
    setSignedUrl(null);

    if (selectedFloorId) {
      loadSignedUrlForFloor(selectedFloorId);
    }
  }, [selectedFloorId]);

  useEffect(() => {
    if (selectableElements.length === 0) {
      setFromElementId("");
      setToElementId("");
      return;
    }

    if (
      !fromElementId ||
      !selectableElements.some((element) => element.id === fromElementId)
    ) {
      setFromElementId(selectableElements[0].id);
    }

    if (
      selectableElements.length > 1 &&
      (!toElementId ||
        !selectableElements.some((element) => element.id === toElementId))
    ) {
      setToElementId(selectableElements[1].id);
    }
  }, [selectableElements, fromElementId, toElementId]);

  async function loadOrganizations() {
    setLoadingOrganizations(true);
    setErrorMessage(null);

    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .order("name", { ascending: true });

    setLoadingOrganizations(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    const rows = (data ?? []) as Organization[];
    setOrganizations(rows);

    if (rows.length > 0) {
      setSelectedOrganizationId(rows[0].id);
    }
  }

  async function loadSignedUrlForFloor(floorId: string) {
  const floor = floors.find((item) => item.id === floorId);

  if (!floor?.plan_image_path) {
    setSignedUrl(null);
    return;
  }

  const { data, error } = await supabase.storage
    .from("plan-images")
    .createSignedUrl(floor.plan_image_path, 60 * 60);

  if (error) {
    setErrorMessage(error.message);
    setSignedUrl(null);
    return;
  }

  setSignedUrl(data.signedUrl);
}

  async function loadBuildings(organizationId: string) {
    setErrorMessage(null);

    const { data, error } = await supabase
      .from("buildings")
      .select("*")
      .eq("organization_id", organizationId)
      .order("name", { ascending: true });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    const rows = (data ?? []) as Building[];
    setBuildings(rows);

    if (rows.length > 0) {
      setSelectedBuildingId(rows[0].id);
    }
  }

  async function loadFloors(buildingId: string) {
    setErrorMessage(null);
    setLoadingMap(true);

    const { data, error } = await supabase
      .from("floors")
      .select("*")
      .eq("building_id", buildingId)
      .eq("status", "published")
      .order("level", { ascending: true });

    if (error) {
      setLoadingMap(false);
      setErrorMessage(error.message);
      return;
    }

    const rows = (data ?? []) as Floor[];

    setFloors(rows);

    if (rows.length === 0) {
      setSelectedFloorId("");
      setElements([]);
      setEdges([]);
      setSignedUrl(null);
      setLoadingMap(false);
      return;
    }

    setSelectedFloorId(rows[0].id);

    await loadBuildingGraph(rows);
  }

  async function loadBuildingGraph(publishedFloors: Floor[]) {
    const floorIds = publishedFloors.map((floor) => floor.id);

    if (floorIds.length === 0) {
      setElements([]);
      setEdges([]);
      setLoadingMap(false);
      return;
    }

    const [
      { data: elementsData, error: elementsError },
      { data: edgesData, error: edgesError },
    ] = await Promise.all([
      supabase
        .from("accessible_elements")
        .select("*")
        .in("floor_id", floorIds)
        .order("created_at", { ascending: true }),

      supabase
        .from("route_edges")
        .select("*")
        .in("floor_id", floorIds)
        .order("created_at", { ascending: true }),
    ]);

    setLoadingMap(false);

    if (elementsError) {
      setErrorMessage(elementsError.message);
      return;
    }

    if (edgesError) {
      setErrorMessage(edgesError.message);
      return;
    }

    const loadedElements = (elementsData ?? []) as AccessibleElement[];
    const loadedEdges = (edgesData ?? []) as RouteEdge[];

    const verticalEdges = buildVirtualVerticalEdges(loadedElements, publishedFloors);

    setElements(loadedElements);
    setEdges([...loadedEdges, ...verticalEdges]);
  }

  async function loadFloorData(floorId: string) {
    setLoadingMap(true);
    setErrorMessage(null);

    const { data: floorData, error: floorError } = await supabase
      .from("floors")
      .select("*")
      .eq("id", floorId)
      .single();

    if (floorError) {
      setLoadingMap(false);
      setErrorMessage(floorError.message);
      return;
    }

    if (floorData.plan_image_path) {
      const { data: signedData, error: signedError } = await supabase.storage
        .from("plan-images")
        .createSignedUrl(floorData.plan_image_path, 60 * 60);

      if (signedError) {
        setLoadingMap(false);
        setErrorMessage(signedError.message);
        return;
      }

      setSignedUrl(signedData.signedUrl);
    }

    const [{ data: elementsData, error: elementsError }, { data: edgesData, error: edgesError }] =
      await Promise.all([
        supabase
          .from("accessible_elements")
          .select("*")
          .eq("floor_id", floorId)
          .order("created_at", { ascending: true }),
        supabase
          .from("route_edges")
          .select("*")
          .eq("floor_id", floorId)
          .order("created_at", { ascending: true }),
      ]);

    setLoadingMap(false);

    if (elementsError) {
      setErrorMessage(elementsError.message);
      return;
    }

    if (edgesError) {
      setErrorMessage(edgesError.message);
      return;
    }

    setElements((elementsData ?? []) as AccessibleElement[]);
    setEdges((edgesData ?? []) as RouteEdge[]);
  }

  function getElementById(elementId: string) {
    return elements.find((element) => element.id === elementId) ?? null;
  }

  function getElementLabel(elementId: string) {
    const element = getElementById(elementId);

    if (!element) return "Élément inconnu";

    return element.label || labelByType[element.type];
  }

  function getFloorById(floorId: string) {
    return floors.find((floor) => floor.id === floorId) ?? null;
  }

  function getElementOptionLabel(element: AccessibleElement) {
    const floor = getFloorById(element.floor_id);
    const elementLabel = element.label || labelByType[element.type];

    if (!floor) return elementLabel;

    return `${elementLabel} · ${floor.name} · Niveau ${floor.level}`;
  }

  function handleCalculateRoute() {
    setErrorMessage(null);
    setRouteResult(null);

    if (!fromElementId || !toElementId) {
      setErrorMessage("Sélectionnez un point de départ et une destination.");
      return;
    }

    if (fromElementId === toElementId) {
      setErrorMessage("Le départ et la destination doivent être différents.");
      return;
    }

    const result = calculateAccessibleRoute({
      elements,
      edges,
      floors,
      fromElementId,
      toElementId,
      mobilityProfile,
    });

    if (!result) {
      setErrorMessage(
        "Aucun itinéraire accessible trouvé avec ce profil de mobilité."
      );
      return;
    }

    setRouteResult(result);

    const origin = getElementById(fromElementId);

    if (origin) {
      setSelectedFloorId(origin.floor_id);
    }
  }

  if (loadingOrganizations) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex items-center gap-3 text-slate-300">
          <Loader2 className="animate-spin" size={20} />
          Chargement des bâtiments accessibles...
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
              <h1 className="text-xl font-bold">AccessMap</h1>
              <p className="text-sm text-slate-400">
                Itinéraires accessibles
              </p>
            </div>
          </div>

          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/10"
          >
            <ArrowLeft size={16} />
            Accueil
          </button>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[0.8fr_1.5fr_0.8fr]">
        <aside className="space-y-6">
          <Panel
            title="1. Choisir le bâtiment"
            subtitle="Sélectionnez l'établissement où vous vous trouvez."
          >
            {organizations.length === 0 ? (
              <EmptyState
                icon={<ShieldAlert size={30} />}
                text="Aucun bâtiment publié pour l'instant."
              />
            ) : (
              <div className="space-y-4">
                <SelectBlock
                  label="Organisation"
                  value={selectedOrganizationId}
                  onChange={setSelectedOrganizationId}
                  options={organizations.map((organization) => ({
                    value: organization.id,
                    label: organization.name,
                  }))}
                  emptyLabel="Aucune organisation"
                />

                <SelectBlock
                  label="Bâtiment"
                  value={selectedBuildingId}
                  onChange={setSelectedBuildingId}
                  options={buildings.map((building) => ({
                    value: building.id,
                    label: building.name,
                  }))}
                  emptyLabel="Aucun bâtiment"
                />

                <SelectBlock
                  label="Étage"
                  value={selectedFloorId}
                  onChange={setSelectedFloorId}
                  options={floors.map((floor) => ({
                    value: floor.id,
                    label: `${floor.name} · Niveau ${floor.level}`,
                  }))}
                  emptyLabel="Aucun étage publié"
                />
              </div>
            )}
          </Panel>

          <Panel
            title="2. Votre itinéraire"
            subtitle="Choisissez le départ, l'arrivée et le profil."
          >
            <div className="space-y-4">
              <SelectBlock
                label="Départ"
                value={fromElementId}
                onChange={setFromElementId}
                options={selectableElements.map((element) => ({
                  value: element.id,
                  label: getElementOptionLabel(element),
                }))}
                emptyLabel="Aucun point disponible"
              />

              <SelectBlock
                label="Destination"
                value={toElementId}
                onChange={setToElementId}
                options={selectableElements.map((element) => ({
                  value: element.id,
                  label: element.label || labelByType[element.type],
                }))}
                emptyLabel="Aucune destination disponible"
              />

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Profil de mobilité
                </label>

                <select
                  value={mobilityProfile}
                  onChange={(event) =>
                    setMobilityProfile(event.target.value as MobilityProfile)
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-cyan-300"
                >
                  <option value="wheelchair">Fauteuil roulant</option>
                  <option value="crutches">Béquilles</option>
                  <option value="reduced_mobility">Mobilité réduite</option>
                </select>
              </div>

              <button
                onClick={handleCalculateRoute}
                disabled={
                  !fromElementId ||
                  !toElementId ||
                  elements.length < 2 ||
                  edges.length === 0
                }
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-4 py-3 font-medium text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Calculer l'itinéraire
                <ArrowRight size={18} />
              </button>
            </div>
          </Panel>
        </aside>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">Plan accessible</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                {selectedOrganization?.name ?? "Organisation"} ·{" "}
                {selectedBuilding?.name ?? "Bâtiment"} ·{" "}
                {selectedFloor?.name ?? "Étage"}
              </p>
            </div>

            <div className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">
              {mobilityLabels[mobilityProfile]}
            </div>
          </div>

          {errorMessage && (
            <div className="mb-4 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
              {errorMessage}
            </div>
          )}

          {loadingMap ? (
            <div className="flex min-h-[540px] items-center justify-center rounded-3xl bg-slate-900">
              <div className="flex items-center gap-3 text-slate-300">
                <Loader2 className="animate-spin" size={20} />
                Chargement du plan...
              </div>
            </div>
          ) : !signedUrl ? (
            <div className="flex min-h-[540px] items-center justify-center rounded-3xl border border-dashed border-white/15 bg-slate-900 p-8 text-center">
              <div>
                <MapPin className="mx-auto mb-4 text-slate-500" size={42} />
                <h3 className="text-xl font-semibold">Aucun plan sélectionné</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
                  Sélectionnez une organisation, un bâtiment et un étage publié.
                </p>
              </div>
            </div>
          ) : (
            <div className="relative flex min-h-[540px] items-center justify-center overflow-auto rounded-3xl bg-slate-900 p-4">
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={signedUrl}
                  alt="Plan du bâtiment"
                  className="block max-h-[72vh] max-w-full rounded-2xl border border-white/10"
                />

                <svg
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  {visibleEdges.map((edge) => {
                    const from = getElementById(edge.from_element_id);
                    const to = getElementById(edge.to_element_id);

                    if (!from || !to) return null;

                    const isInRoute = routeEdgeIds.has(edge.id);

                    return (
                      <line
                        key={edge.id}
                        x1={from.x * 100}
                        y1={from.y * 100}
                        x2={to.x * 100}
                        y2={to.y * 100}
                        stroke={
                          isInRoute
                            ? "#22d3ee"
                            : edge.wheelchair_accessible
                              ? "rgba(148,163,184,0.45)"
                              : "rgba(248,113,113,0.45)"
                        }
                        strokeWidth={isInRoute ? "1.3" : "0.45"}
                        strokeLinecap="round"
                        strokeDasharray={
                          edge.wheelchair_accessible ? "0" : "2 1.5"
                        }
                      />
                    );
                  })}
                </svg>

                <div className="pointer-events-none absolute inset-0">
                  {visibleElements.map((element, index) => (
                    <MapMarker
                      key={element.id}
                      element={element}
                      index={index + 1}
                      highlighted={routeNodeIds.has(element.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <Panel
            title="Instructions"
            subtitle="Chemin calculé selon votre profil."
          >
            {!routeResult ? (
              <EmptyState
                icon={<Route size={30} />}
                text="Calculez un itinéraire pour voir les étapes."
              />
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-4">
                  <p className="text-sm text-cyan-200">Distance estimée</p>
                  <p className="text-3xl font-bold text-white">
                    {routeResult.totalDistance.toFixed(1)} m
                  </p>
                </div>

                <div className="space-y-3">
                  {routeResult.steps.map((step, index) => {
                    const floor = getFloorById(step.floorId);

                    return (
                      <div
                        key={`${step.nodeId}-${index}`}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-300 text-sm font-bold text-slate-950">
                            {index + 1}
                          </span>

                          <div>
                            <p className="font-semibold text-white">{step.title}</p>
                            <p className="text-xs text-slate-400">
                              {floor ? `${floor.name} · Niveau ${floor.level}` : "Étage inconnu"}
                            </p>
                          </div>
                        </div>

                        <p className="mt-3 text-sm text-slate-300">{step.instruction}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Légende" subtitle="Comprendre le plan.">
            <div className="space-y-3 text-sm text-slate-300">
              <LegendItem
                icon={<div className="h-1 w-8 rounded-full bg-cyan-300" />}
                text="Itinéraire recommandé"
              />
              <LegendItem
                icon={
                  <div className="h-1 w-8 rounded-full bg-slate-400/60" />
                }
                text="Connexion disponible"
              />
              <LegendItem
                icon={
                  <div className="h-1 w-8 rounded-full border-t border-dashed border-red-300" />
                }
                text="Connexion non adaptée fauteuil"
              />
              <LegendItem
                icon={
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-400 text-xs font-bold text-slate-950">
                    1
                  </div>
                }
                text="Point accessible"
              />
            </div>
          </Panel>
        </aside>
      </section>
    </main>
  );
}

function normalizeVerticalLabel(label: string | null) {
  return (label ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function buildVirtualVerticalEdges(
  elements: AccessibleElement[],
  floors: Floor[]
): RoutingEdge[] {
  const floorById = new Map(floors.map((floor) => [floor.id, floor]));

  const elevators = elements.filter(
    (element) => element.type === "elevator" && element.label
  );

  const groups = new Map<string, AccessibleElement[]>();

  for (const elevator of elevators) {
    const key = normalizeVerticalLabel(elevator.label);

    if (!key) continue;

    const group = groups.get(key) ?? [];
    group.push(elevator);
    groups.set(key, group);
  }

  const virtualEdges: RoutingEdge[] = [];

  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => {
      const floorA = floorById.get(a.floor_id);
      const floorB = floorById.get(b.floor_id);

      return (floorA?.level ?? 0) - (floorB?.level ?? 0);
    });

    for (let index = 0; index < sorted.length - 1; index++) {
      const from = sorted[index];
      const to = sorted[index + 1];

      const fromFloor = floorById.get(from.floor_id);
      const toFloor = floorById.get(to.floor_id);

      const levelDelta = Math.abs((toFloor?.level ?? 0) - (fromFloor?.level ?? 0));

      virtualEdges.push({
        id: `virtual-elevator-${from.id}-${to.id}`,
        floor_id: from.floor_id,
        from_element_id: from.id,
        to_element_id: to.id,
        distance_meters: Math.max(5, levelDelta * 6),
        wheelchair_accessible: true,
        crutches_accessible: true,
        is_bidirectional: true,
        notes: "Connexion verticale virtuelle entre étages",
        created_at: new Date().toISOString(),
        edge_type: "elevator",
        synthetic: true,
      });
    }
  }

  return virtualEdges;
}

function calculateAccessibleRoute({
  elements,
  edges,
  floors,
  fromElementId,
  toElementId,
  mobilityProfile,
}: {
  elements: AccessibleElement[];
  edges: RoutingEdge[];
  floors: Floor[];
  fromElementId: string;
  toElementId: string;
  mobilityProfile: MobilityProfile;
}): RouteResult | null {
  const elementIds = elements.map((element) => element.id);
  const distances = new Map<string, number>();
  const visited = new Set<string>();
  const previous = new Map<string, { nodeId: string; edgeId: string }>();

  const adjacency = new Map<
    string,
    { to: string; distance: number; edgeId: string }[]
  >();


  for (const id of elementIds) {
    distances.set(id, Number.POSITIVE_INFINITY);
    adjacency.set(id, []);
  }

  distances.set(fromElementId, 0);

  for (const edge of edges) {
    if (!isEdgeAllowed(edge, mobilityProfile)) continue;

    adjacency.get(edge.from_element_id)?.push({
      to: edge.to_element_id,
      distance: edge.distance_meters,
      edgeId: edge.id,
    });

    if (edge.is_bidirectional) {
      adjacency.get(edge.to_element_id)?.push({
        to: edge.from_element_id,
        distance: edge.distance_meters,
        edgeId: edge.id,
      });
    }
  }

  while (visited.size < elementIds.length) {
    let currentId: string | null = null;
    let currentDistance = Number.POSITIVE_INFINITY;

    for (const id of elementIds) {
      const distance = distances.get(id) ?? Number.POSITIVE_INFINITY;

      if (!visited.has(id) && distance < currentDistance) {
        currentId = id;
        currentDistance = distance;
      }
    }

    if (!currentId) break;
    if (currentDistance === Number.POSITIVE_INFINITY) break;
    if (currentId === toElementId) break;

    visited.add(currentId);

    for (const neighbor of adjacency.get(currentId) ?? []) {
      if (visited.has(neighbor.to)) continue;

      const candidateDistance = currentDistance + neighbor.distance;
      const knownDistance =
        distances.get(neighbor.to) ?? Number.POSITIVE_INFINITY;

      if (candidateDistance < knownDistance) {
        distances.set(neighbor.to, candidateDistance);
        previous.set(neighbor.to, {
          nodeId: currentId,
          edgeId: neighbor.edgeId,
        });
      }
    }
  }

  const finalDistance = distances.get(toElementId);

  if (
    finalDistance === undefined ||
    finalDistance === Number.POSITIVE_INFINITY
  ) {
    return null;
  }

  const nodeIds: string[] = [];
  const edgeIds: string[] = [];

  let currentId = toElementId;
  nodeIds.unshift(currentId);

  while (currentId !== fromElementId) {
    const previousStep = previous.get(currentId);

    if (!previousStep) return null;

    edgeIds.unshift(previousStep.edgeId);
    currentId = previousStep.nodeId;
    nodeIds.unshift(currentId);
  }

  const steps = buildRouteSteps({
    nodeIds,
    elements,
    edges,
    floors,
  });

  return {
    nodeIds,
    edgeIds,
    totalDistance: finalDistance,
    steps,
  };
}

function buildRouteSteps({
  nodeIds,
  elements,
  edges,
  floors,
}: {
  nodeIds: string[];
  elements: AccessibleElement[];
  edges: RoutingEdge[];
  floors: Floor[];
}): RouteStep[] {
  const elementById = new Map(elements.map((element) => [element.id, element]));
  const floorById = new Map(floors.map((floor) => [floor.id, floor]));

  const steps: RouteStep[] = [];

  for (let index = 0; index < nodeIds.length; index++) {
    const current = elementById.get(nodeIds[index]);
    const next = elementById.get(nodeIds[index + 1]);

    if (!current) continue;

    const currentFloor = floorById.get(current.floor_id);
    const currentLabel = current.label || labelByType[current.type];

    if (index === 0) {
      steps.push({
        nodeId: current.id,
        floorId: current.floor_id,
        title: currentLabel,
        instruction: `Départ depuis ${currentLabel}, ${currentFloor?.name ?? "étage inconnu"}.`,
      });
      continue;
    }

    if (!next) {
      steps.push({
        nodeId: current.id,
        floorId: current.floor_id,
        title: currentLabel,
        instruction: `Vous êtes arrivé à ${currentLabel}.`,
      });
      continue;
    }

    const nextFloor = floorById.get(next.floor_id);
    const nextLabel = next.label || labelByType[next.type];

    if (current.floor_id !== next.floor_id) {
      steps.push({
        nodeId: current.id,
        floorId: current.floor_id,
        title: currentLabel,
        instruction: `Prenez ${currentLabel} pour aller vers ${nextFloor?.name ?? "l'étage suivant"}, niveau ${nextFloor?.level ?? "?"}.`,
      });
    } else {
      steps.push({
        nodeId: current.id,
        floorId: current.floor_id,
        title: currentLabel,
        instruction: `Continuez vers ${nextLabel}.`,
      });
    }
  }

  return steps;
}

function isEdgeAllowed(edge: RouteEdge, mobilityProfile: MobilityProfile) {
  if (mobilityProfile === "wheelchair") {
    return edge.wheelchair_accessible;
  }

  if (mobilityProfile === "crutches") {
    return edge.crutches_accessible;
  }

  return edge.wheelchair_accessible || edge.crutches_accessible;
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
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

function SelectBlock({
  label,
  value,
  onChange,
  options,
  emptyLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  emptyLabel: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm text-slate-300">{label}</label>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={options.length === 0}
        className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-cyan-300 disabled:opacity-50"
      >
        {options.length === 0 ? (
          <option value="">{emptyLabel}</option>
        ) : (
          options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
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
  highlighted,
}: {
  element: AccessibleElement;
  index: number;
  highlighted: boolean;
}) {
  return (
    <div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2"
      style={{
        left: `${element.x * 100}%`,
        top: `${element.y * 100}%`,
      }}
    >
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shadow-lg ring-4 ${
          highlighted
            ? "bg-cyan-300 text-slate-950 ring-cyan-300/30"
            : "bg-slate-950 text-cyan-200 ring-cyan-400/40"
        }`}
      >
        {index}
      </div>

      <div
        className={`hidden rounded-full px-3 py-1 text-xs backdrop-blur md:block ${
          highlighted
            ? "bg-cyan-300 text-slate-950"
            : "bg-slate-950/85 text-white"
        }`}
      >
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
  if (type === "obstacle") {
    return <ShieldAlert className="text-red-300" size={18} />;
  }

  return <CheckCircle2 className={className} size={18} />;
}

function EmptyState({
  icon,
  text,
}: {
  icon: ReactNode;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-slate-900 p-5 text-center">
      <div className="mx-auto mb-3 flex justify-center text-slate-500">
        {icon}
      </div>
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  );
}

function LegendItem({
  icon,
  text,
}: {
  icon: ReactNode;
  text: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-10 items-center justify-center">{icon}</div>
      <span>{text}</span>
    </div>
  );
}