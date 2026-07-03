"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Accessibility,
  Building2,
  UserRound,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

type Role = "responsable" | "usuario" | null;

export default function Home() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<Role>(null);

  function handleContinue() {
    if (!selectedRole) return;

    localStorage.setItem("accessmap-role", selectedRole);

    if (selectedRole === "responsable") {
      router.push("/auth");
      return;
    }

    router.push("/navigation");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-10">
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400 text-slate-950">
            <Accessibility size={28} />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight">AccessMap</h1>
            <p className="text-sm text-slate-400">
              Navigation intérieure accessible
            </p>
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <p className="mb-3 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
              App web pour bâtiments accessibles
            </p>

            <h2 className="max-w-2xl text-4xl font-bold tracking-tight md:text-6xl">
              Faciliter les déplacements des personnes à mobilité réduite.
            </h2>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
              L’application aide à trouver un itinéraire accessible dans les
              musées, hôpitaux, universités et bâtiments publics à partir des
              plans fournis par les responsables.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
            <h3 className="text-2xl font-semibold">Qui êtes-vous ?</h3>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Sélectionnez votre profil pour accéder à l’espace adapté.
            </p>

            <div className="mt-6 grid gap-4">
              <RoleCard
                title="Responsable d’un bâtiment"
                description="Je veux créer une organisation, ajouter des bâtiments, importer des plans et valider les éléments accessibles."
                icon={<Building2 size={30} />}
                selected={selectedRole === "responsable"}
                onClick={() => setSelectedRole("responsable")}
              />

              <RoleCard
                title="Utilisateur final"
                description="Je cherche un itinéraire accessible pour me déplacer dans un bâtiment public."
                icon={<UserRound size={30} />}
                selected={selectedRole === "usuario"}
                onClick={() => setSelectedRole("usuario")}
              />
            </div>

            <button
              onClick={handleContinue}
              disabled={!selectedRole}
              className={`mt-6 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 font-medium transition ${
                selectedRole
                  ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                  : "cursor-not-allowed bg-white/10 text-slate-500"
              }`}
            >
              Continuer
              <ArrowRight size={18} />
            </button>

            {selectedRole && (
              <p className="mt-4 text-center text-sm text-slate-400">
                Profil sélectionné :{" "}
                <span className="font-medium text-cyan-200">
                  {selectedRole === "responsable"
                    ? "Responsable"
                    : "Utilisateur final"}
                </span>
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function RoleCard({
  title,
  description,
  icon,
  selected,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative rounded-3xl border p-5 text-left transition ${
        selected
          ? "border-cyan-300 bg-cyan-400/10"
          : "border-white/10 bg-slate-900 hover:border-white/25 hover:bg-white/[0.06]"
      }`}
    >
      {selected && (
        <div className="absolute right-4 top-4 text-cyan-300">
          <CheckCircle2 size={22} />
        </div>
      )}

      <div
        className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${
          selected
            ? "bg-cyan-400 text-slate-950"
            : "bg-white/10 text-slate-300"
        }`}
      >
        {icon}
      </div>

      <h4 className="text-lg font-semibold text-white">{title}</h4>

      <p className="mt-2 pr-4 text-sm leading-6 text-slate-400">
        {description}
      </p>
    </button>
  );
}