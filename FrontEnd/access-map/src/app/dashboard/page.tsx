"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PlanImageEditorModal, {
  EditedPlanImageResult,
} from "@/components/PlanImageEditorModal";
import {
  Accessibility,
  Building2,
  Factory,
  FileImage,
  Layers,
  Loader2,
  LogOut,
  Plus,
  Upload,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { sanitizeFilename } from "@/lib/image/processPlanImage";

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
  status: FloorStatus;
  created_at: string;
  real_width_meters: number | null;
  real_height_meters: number | null;
  meters_per_pixel_x: number | null;
  meters_per_pixel_y: number | null;
  plan_rotation_degrees: number | null;
  plan_crop_json: Record<string, unknown>;
};

type FloorWithUrl = Floor & {
  signedUrl?: string | null;
};

type UserInfo = {
  id: string;
  email?: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<UserInfo | null>(null);

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [floors, setFloors] = useState<FloorWithUrl[]>([]);

  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [selectedBuildingId, setSelectedBuildingId] = useState("");

  const [organizationName, setOrganizationName] = useState("");
  const [organizationType, setOrganizationType] = useState("university");

  const [buildingName, setBuildingName] = useState("");
  const [buildingAddress, setBuildingAddress] = useState("");

  const [floorName, setFloorName] = useState("");
  const [floorLevel, setFloorLevel] = useState("0");

  const [loading, setLoading] = useState(true);
  const [savingOrganization, setSavingOrganization] = useState(false);
  const [savingBuilding, setSavingBuilding] = useState(false);
  const [savingFloor, setSavingFloor] = useState(false);
  const [uploadingFloorId, setUploadingFloorId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [editorState, setEditorState] = useState<{
    floorId: string;
    file: File;
  } | null>(null);

  useEffect(() => {
    async function initialize() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth");
        return;
      }

      setUser({
        id: user.id,
        email: user.email ?? undefined,
      });

      await loadOrganizations(user.id);
      setLoading(false);
    }

    initialize();
  }, [router, supabase]);

  useEffect(() => {
    if (!selectedOrganizationId) {
      setBuildings([]);
      setSelectedBuildingId("");
      return;
    }

    loadBuildings(selectedOrganizationId);
  }, [selectedOrganizationId]);

  useEffect(() => {
    if (!selectedBuildingId) {
      setFloors([]);
      return;
    }

    loadFloors(selectedBuildingId);
  }, [selectedBuildingId]);

  async function loadOrganizations(ownerId: string) {
    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    const rows = data ?? [];
    setOrganizations(rows);

    if (rows.length > 0) {
      setSelectedOrganizationId((current) => current || rows[0].id);
    }
  }

  async function loadBuildings(organizationId: string) {
    const { data, error } = await supabase
      .from("buildings")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    const rows = data ?? [];
    setBuildings(rows);

    if (rows.length > 0) {
      setSelectedBuildingId(rows[0].id);
    } else {
      setSelectedBuildingId("");
      setFloors([]);
    }
  }

  async function loadFloors(buildingId: string) {
    const { data, error } = await supabase
      .from("floors")
      .select("*")
      .eq("building_id", buildingId)
      .order("level", { ascending: true });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    const rows = (data ?? []) as Floor[];

    const rowsWithSignedUrls = await Promise.all(
      rows.map(async (floor) => {
        if (!floor.plan_image_path) {
          return {
            ...floor,
            signedUrl: null,
          };
        }

        const { data: signedData, error: signedError } = await supabase.storage
          .from("plan-images")
          .createSignedUrl(floor.plan_image_path, 60 * 60);

        if (signedError) {
          return {
            ...floor,
            signedUrl: null,
          };
        }

        return {
          ...floor,
          signedUrl: signedData.signedUrl,
        };
      })
    );

    setFloors(rowsWithSignedUrls);
  }

  async function handleCreateOrganization(event: React.FormEvent) {
    event.preventDefault();

    if (!user) return;
    if (!organizationName.trim()) return;

    setSavingOrganization(true);
    setErrorMessage(null);

    const { data, error } = await supabase
      .from("organizations")
      .insert({
        owner_id: user.id,
        name: organizationName.trim(),
        type: organizationType,
      })
      .select("*")
      .single();

    setSavingOrganization(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setOrganizations((current) => [data, ...current]);
    setSelectedOrganizationId(data.id);
    setOrganizationName("");
  }

  async function handleCreateBuilding(event: React.FormEvent) {
    event.preventDefault();

    if (!selectedOrganizationId) return;
    if (!buildingName.trim()) return;

    setSavingBuilding(true);
    setErrorMessage(null);

    const { data, error } = await supabase
      .from("buildings")
      .insert({
        organization_id: selectedOrganizationId,
        name: buildingName.trim(),
        address: buildingAddress.trim() || null,
      })
      .select("*")
      .single();

    setSavingBuilding(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setBuildings((current) => [data, ...current]);
    setSelectedBuildingId(data.id);
    setBuildingName("");
    setBuildingAddress("");
  }

  async function handleCreateFloor(event: React.FormEvent) {
    event.preventDefault();

    if (!selectedBuildingId) return;
    if (!floorName.trim()) return;

    const level = Number.parseInt(floorLevel, 10);

    if (Number.isNaN(level)) {
      setErrorMessage("Le niveau de l'étage doit être un nombre.");
      return;
    }

    setSavingFloor(true);
    setErrorMessage(null);

    const { data, error } = await supabase
      .from("floors")
      .insert({
        building_id: selectedBuildingId,
        level,
        name: floorName.trim(),
        status: "uploaded",
      })
      .select("*")
      .single();

    setSavingFloor(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setFloors((current) =>
      [...current, { ...data, signedUrl: null }].sort((a, b) => a.level - b.level)
    );

    setFloorName("");
    setFloorLevel(String(level + 1));
  }

  async function handleUploadPlan(
    floorId: string,
    editedImage: EditedPlanImageResult
  ) {
    if (!user) return;

    setUploadingFloorId(floorId);
    setErrorMessage(null);

    try {
      const safeOriginalName = sanitizeFilename(editedImage.originalName);
      const timestamp = Date.now();

      const storagePath = `${user.id}/${floorId}/${timestamp}-${editedImage.file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("plan-images")
        .upload(storagePath, editedImage.file, {
          cacheControl: "3600",
          upsert: false,
          contentType: editedImage.mimeType,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { error: updateError } = await supabase
        .from("floors")
        .update({
          plan_image_path: storagePath,
          plan_image_width: editedImage.width,
          plan_image_height: editedImage.height,
          plan_image_size_bytes: editedImage.processedSizeBytes,
          plan_image_mime_type: editedImage.mimeType,
          plan_original_name: safeOriginalName,
          plan_uploaded_at: new Date().toISOString(),

          real_width_meters: editedImage.realWidthMeters,
          real_height_meters: editedImage.realHeightMeters,
          meters_per_pixel_x: editedImage.metersPerPixelX,
          meters_per_pixel_y: editedImage.metersPerPixelY,
          plan_rotation_degrees: editedImage.rotationDegrees,
          plan_crop_json: {
            cropPercent: editedImage.cropPercent,
           originalWidth: editedImage.originalWidth,
            originalHeight: editedImage.originalHeight,
            originalSizeBytes: editedImage.originalSizeBytes,
          },

          status: "needs_review",
        })
        .eq("id", floorId);

      if (updateError) {
        throw updateError;
      }

      await loadFloors(selectedBuildingId);
    } catch (error) {
      console.error("Erreur import plan:", error);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setUploadingFloorId(null);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  const selectedOrganization = organizations.find(
    (organization) => organization.id === selectedOrganizationId
  );

  const selectedBuilding = buildings.find(
    (building) => building.id === selectedBuildingId
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex items-center gap-3 text-slate-300">
          <Loader2 className="animate-spin" size={20} />
          Chargement...
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
                Tableau de bord responsable
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/10"
          >
            <LogOut size={16} />
            Déconnexion
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8">
          <p className="text-sm text-slate-400">Connecté en tant que</p>
          <h2 className="text-2xl font-bold">{user?.email}</h2>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
            {errorMessage}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-6">
            <Panel
              icon={<Factory size={24} />}
              title="1. Organisation"
              subtitle="Créez ou sélectionnez une entité responsable."
            >
              <form onSubmit={handleCreateOrganization} className="space-y-3">
                <input
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-cyan-300"
                  placeholder="Nom de l'organisation"
                />

                <select
                  value={organizationType}
                  onChange={(event) => setOrganizationType(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-cyan-300"
                >
                  <option value="university">Université</option>
                  <option value="hospital">Hôpital</option>
                  <option value="museum">Musée</option>
                  <option value="public_service">Service public</option>
                  <option value="other">Autre</option>
                </select>

                <button
                  disabled={savingOrganization}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-4 py-3 font-medium text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
                >
                  {savingOrganization ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <Plus size={18} />
                  )}
                  Créer organisation
                </button>
              </form>

              <SelectBlock
                label="Organisation active"
                value={selectedOrganizationId}
                onChange={setSelectedOrganizationId}
                options={organizations.map((organization) => ({
                  value: organization.id,
                  label: organization.name,
                }))}
                emptyLabel="Aucune organisation"
              />
            </Panel>

            <Panel
              icon={<Building2 size={24} />}
              title="2. Bâtiment"
              subtitle="Ajoutez les bâtiments de l'organisation."
            >
              <form onSubmit={handleCreateBuilding} className="space-y-3">
                <input
                  value={buildingName}
                  onChange={(event) => setBuildingName(event.target.value)}
                  disabled={!selectedOrganizationId}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-cyan-300 disabled:opacity-50"
                  placeholder="Nom du bâtiment"
                />

                <input
                  value={buildingAddress}
                  onChange={(event) => setBuildingAddress(event.target.value)}
                  disabled={!selectedOrganizationId}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-cyan-300 disabled:opacity-50"
                  placeholder="Adresse"
                />

                <button
                  disabled={!selectedOrganizationId || savingBuilding}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-4 py-3 font-medium text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingBuilding ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <Plus size={18} />
                  )}
                  Créer bâtiment
                </button>
              </form>

              <SelectBlock
                label="Bâtiment actif"
                value={selectedBuildingId}
                onChange={setSelectedBuildingId}
                options={buildings.map((building) => ({
                  value: building.id,
                  label: building.name,
                }))}
                emptyLabel="Aucun bâtiment"
              />
            </Panel>

            <Panel
              icon={<Layers size={24} />}
              title="3. Étage"
              subtitle="Créez les étages avant d'importer les plans."
            >
              <form onSubmit={handleCreateFloor} className="grid gap-3 sm:grid-cols-[0.35fr_0.65fr]">
                <input
                  value={floorLevel}
                  onChange={(event) => setFloorLevel(event.target.value)}
                  disabled={!selectedBuildingId}
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-cyan-300 disabled:opacity-50"
                  placeholder="0"
                />

                <input
                  value={floorName}
                  onChange={(event) => setFloorName(event.target.value)}
                  disabled={!selectedBuildingId}
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-cyan-300 disabled:opacity-50"
                  placeholder="RDC, 1er étage..."
                />

                <button
                  disabled={!selectedBuildingId || savingFloor}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-4 py-3 font-medium text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2"
                >
                  {savingFloor ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <Plus size={18} />
                  )}
                  Créer étage
                </button>
              </form>
            </Panel>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <div className="mb-6">
              <div className="mb-2 flex items-center gap-3 text-cyan-300">
                <FileImage size={24} />
                <h3 className="text-2xl font-semibold text-white">
                  Plans du bâtiment
                </h3>
              </div>

              <p className="text-sm leading-6 text-slate-400">
                Organisation :{" "}
                <span className="text-slate-200">
                  {selectedOrganization?.name ?? "Non sélectionnée"}
                </span>
                <br />
                Bâtiment :{" "}
                <span className="text-slate-200">
                  {selectedBuilding?.name ?? "Non sélectionné"}
                </span>
              </p>
            </div>

            {floors.length === 0 ? (
              <div className="flex min-h-80 items-center justify-center rounded-3xl border border-dashed border-white/15 bg-slate-900 p-8 text-center">
                <div>
                  <Layers className="mx-auto mb-4 text-slate-500" size={38} />
                  <p className="font-medium text-slate-300">
                    Aucun étage pour l'instant
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Créez un étage, puis importez l'image du plan.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {floors.map((floor) => (
                  <FloorCard
                    key={floor.id}
                    floor={floor}
                    uploading={uploadingFloorId === floor.id}
                    onSelectFile={(floorId, file) => {
                        setEditorState({
                        floorId,
                        file,
                        });
                    }}
                    />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {editorState && (
        <PlanImageEditorModal
            file={editorState.file}
            onCancel={() => setEditorState(null)}
            onConfirm={async (editedImage) => {
            await handleUploadPlan(editorState.floorId, editedImage);
            setEditorState(null);
            }}
        />
        )}
    </main>
  );
}

function Panel({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
          {icon}
        </div>

        <div>
          <h3 className="text-xl font-semibold">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-400">{subtitle}</p>
        </div>
      </div>

      <div className="space-y-4">{children}</div>
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
        className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-cyan-300"
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

function FloorCard({
  floor,
  uploading,
  onSelectFile,
}: {
  floor: FloorWithUrl;
  uploading: boolean;
  onSelectFile: (floorId: string, file: File) => void;
}) {
  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    onSelectFile(floor.id, file);
    event.target.value = "";
  }

  return (
    <article className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
      <div className="relative flex aspect-[4/3] items-center justify-center bg-slate-950">
        {floor.signedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={floor.signedUrl}
            alt={`Plan ${floor.name}`}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="text-center">
            <FileImage className="mx-auto mb-3 text-slate-500" size={38} />
            <p className="text-sm text-slate-500">Aucun plan importé</p>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm">
            <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-sm text-slate-200">
              <Loader2 className="animate-spin" size={18} />
              Préparation et import...
            </div>
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-cyan-200">Niveau {floor.level}</p>
            <h4 className="text-lg font-semibold">{floor.name}</h4>
          </div>

          <StatusBadge status={floor.status} />
        </div>

        {floor.plan_image_path && (
          <div className="mb-4 rounded-2xl bg-white/[0.04] p-3 text-xs leading-5 text-slate-400">
            <p>
              Image :{" "}
              <span className="text-slate-200">
                {floor.plan_image_width} × {floor.plan_image_height}px
              </span>
            </p>
            <p>
              Taille :{" "}
              <span className="text-slate-200">
                {formatBytes(floor.plan_image_size_bytes ?? 0)}
              </span>
            </p>
            <p>
              Fichier original :{" "}
              <span className="text-slate-200">
                {floor.plan_original_name ?? "—"}
              </span>
            </p>
            {floor.real_width_meters && floor.real_height_meters && (
            <p>
                Dimensions réelles :{" "}
                <span className="text-slate-200">
                {floor.real_width_meters} m × {floor.real_height_meters} m
                </span>
            </p>
            )}
          </div>
        )}

        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-medium text-slate-950 hover:bg-cyan-300">
          <Upload size={16} />
          {floor.plan_image_path ? "Remplacer le plan" : "Importer le plan"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            className="hidden"
            disabled={uploading}
            onChange={handleFileChange}
          />
          <Link
          href={`/dashboard/floors/${floor.id}`}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-200 hover:bg-white/10"
          >
            Valider le plan
          </Link>
        </label>
      </div>
    </article>
  );
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
    <span
      className={`rounded-full px-3 py-1 text-xs ${classByStatus[status]}`}
    >
      {labelByStatus[status]}
    </span>
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return "Erreur inconnue.";
  }
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, index);

  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}