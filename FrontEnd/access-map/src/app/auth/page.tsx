"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Accessibility,
  Building2,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "login" | "register";

export default function AuthPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<AuthMode>("register");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setMessage(null);
    setErrorMessage(null);

    if (mode === "register") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: "responsable",
          },
        },
      });

      setLoading(false);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data.session) {
        router.push("/dashboard");
        return;
      }

      setMessage(
        "Compte créé. Vérifiez votre email si la confirmation est activée."
      );
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-10">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400 text-slate-950">
            <Accessibility size={28} />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight">AccessMap</h1>
            <p className="text-sm text-slate-400">
              Espace responsable bâtiment
            </p>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
              <Building2 size={16} />
              Gestion des bâtiments accessibles
            </div>

            <h2 className="max-w-2xl text-4xl font-bold tracking-tight md:text-6xl">
              Créez votre organisation et importez vos plans.
            </h2>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
              Les responsables peuvent ajouter des bâtiments, créer des étages,
              téléverser les images des plans et valider les éléments
              accessibles détectés par l’application.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl"
          >
            <div className="mb-6 flex rounded-2xl bg-slate-900 p-1">
              <button
                type="button"
                onClick={() => setMode("register")}
                className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium ${
                  mode === "register"
                    ? "bg-cyan-400 text-slate-950"
                    : "text-slate-300 hover:bg-white/10"
                }`}
              >
                Créer un compte
              </button>

              <button
                type="button"
                onClick={() => setMode("login")}
                className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium ${
                  mode === "login"
                    ? "bg-cyan-400 text-slate-950"
                    : "text-slate-300 hover:bg-white/10"
                }`}
              >
                Se connecter
              </button>
            </div>

            <h3 className="text-2xl font-semibold">
              {mode === "register" ? "Inscription responsable" : "Connexion"}
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              {mode === "register"
                ? "Créez un compte pour gérer les plans de votre établissement."
                : "Connectez-vous pour retrouver vos organisations et bâtiments."}
            </p>

            <div className="mt-6 space-y-4">
              {mode === "register" && (
                <div>
                  <label className="mb-2 block text-sm text-slate-300">
                    Nom complet
                  </label>
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 focus-within:border-cyan-300">
                    <UserRound size={18} className="text-slate-400" />
                    <input
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      className="w-full bg-transparent text-sm outline-none"
                      placeholder="Marie Dupont"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Email professionnel
                </label>
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 focus-within:border-cyan-300">
                  <Mail size={18} className="text-slate-400" />
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    required
                    className="w-full bg-transparent text-sm outline-none"
                    placeholder="responsable@organisation.fr"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Mot de passe
                </label>
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 focus-within:border-cyan-300">
                  <LockKeyhole size={18} className="text-slate-400" />
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    required
                    minLength={6}
                    className="w-full bg-transparent text-sm outline-none"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            {errorMessage && (
              <div className="mt-5 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
                {errorMessage}
              </div>
            )}

            {message && (
              <div className="mt-5 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-4 text-sm text-cyan-200">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full rounded-2xl bg-cyan-400 px-5 py-4 font-medium text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Chargement..."
                : mode === "register"
                  ? "Créer mon compte"
                  : "Se connecter"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}