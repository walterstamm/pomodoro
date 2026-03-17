"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const initialMode = params.get("mode");
    if (initialMode === "register") setMode("register");
  }, [params]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setToast(null);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          confirmEmail,
          password,
          confirmPassword,
          firstName,
          lastName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast(data?.message ?? "Algo salió mal");
        return;
      }
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error(error);
      setToast("No pudimos procesar tu solicitud");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,rgba(123,220,255,0.14),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(255,158,184,0.18),transparent_32%),radial-gradient(circle_at_70%_70%,rgba(124,141,255,0.15),transparent_35%),#05060b] text-foreground">
      <div className="mx-auto flex max-w-md flex-col gap-6 px-6 py-16">
        <div className="glass rounded-3xl p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            {mode === "login" ? "Ingresar a FocoPulse" : "Crear cuenta en FocoPulse"}
          </p>
          <h1 className="mt-2 text-2xl font-semibold">
            {mode === "login" ? "Inicia sesión" : "Crea tu cuenta"}
          </h1>
          <form className="mt-6 space-y-4" onSubmit={submit}>
            <div className="space-y-1">
              <label className="text-sm text-[var(--muted)]">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none focus:border-white/40"
                placeholder="nombre@correo.com"
              />
            </div>
            {mode === "register" && (
              <div className="space-y-1">
                <label className="text-sm text-[var(--muted)]">Confirmar email</label>
                <input
                  type="email"
                  required
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none focus:border-white/40"
                  placeholder="Repite el correo"
                />
              </div>
            )}
            {mode === "register" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm text-[var(--muted)]">Nombre</label>
                  <input
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none focus:border-white/40"
                    placeholder="Tu nombre"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-[var(--muted)]">Apellido</label>
                  <input
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none focus:border-white/40"
                    placeholder="Tu apellido"
                  />
                </div>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-sm text-[var(--muted)]">Contraseña</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none focus:border-white/40"
                placeholder="Mínimo 8 caracteres"
              />
              <p className="text-xs text-[var(--muted)]">
                Las claves se guardan cifradas con bcrypt.
              </p>
            </div>
            {mode === "register" && (
              <div className="space-y-1">
                <label className="text-sm text-[var(--muted)]">Confirmar contraseña</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none focus:border-white/40"
                  placeholder="Repite la contraseña"
                />
              </div>
            )}

            {toast && (
              <div className="rounded-xl bg-white/10 px-3 py-2 text-sm text-red-200">
                {toast}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="pill w-full bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              {submitting
                ? "Procesando..."
                : mode === "login"
                  ? "Entrar"
                  : "Crear cuenta"}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between text-sm text-[var(--muted)]">
            <span>
              {mode === "login" ? "¿Aún no tienes cuenta?" : "¿Ya tienes cuenta?"}
            </span>
            <button
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="text-foreground underline"
              type="button"
            >
              {mode === "login" ? "Crear una" : "Iniciar sesión"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
