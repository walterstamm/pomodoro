/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

const FlipClockCountdown = dynamic(
  () => import("@leenguyen/react-flip-clock-countdown").then((m) => m.default),
  { ssr: false },
);
import "@leenguyen/react-flip-clock-countdown/dist/index.css";

type Session = {
  id: string;
  projectId: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
};

type Project = {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  sessions?: Session[];
};

type TimerState = "idle" | "running" | "paused";
type User = { id: string; email: string };

const palettes = ["#7BD1FF", "#FFB4BC", "#C6FF7B", "#B7A3FF", "#FFD27B"];
const BRAND = "FocoPulse";

const toClock = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
};

const friendlyMinutes = (minutes: number) => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
};

const hexToRgba = (hex: string, alpha: number) => {
  const clean = hex.replace("#", "");
  const normalized =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const bigint = Number.parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [isSavingProject, setIsSavingProject] = useState(false);

  const [duration, setDuration] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(duration * 60);
  const [timerState, setTimerState] = useState<TimerState>("idle");
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<{ id: string; message: string }[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [flipMode, setFlipMode] = useState(false);
  const [freezeNow, setFreezeNow] = useState<number | null>(Date.now());
  const [isMobile, setIsMobile] = useState(false);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setAuthChecked(true);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setProjects([]);
        setSessions([]);
        setSelectedProjectId(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch("/api/projects", { cache: "no-store" });
        if (!res.ok) throw new Error("No se pudieron cargar los proyectos");
        const data = await res.json();
        const loadedProjects: Project[] = data.projects ?? [];
        const loadedSessions: Session[] = loadedProjects.flatMap(
          (p) => p.sessions ?? [],
        );

        setProjects(loadedProjects);
        setSessions(
          loadedSessions.sort(
            (a, b) =>
              new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
          ),
        );

        if (!selectedProjectId && loadedProjects[0]) {
          setSelectedProjectId(loadedProjects[0].id);
        }
      } catch (error) {
        console.error(error);
        showFlash("No pudimos cargar los proyectos. Reintenta en unos segundos.");
      } finally {
        setLoading(false);
      }
    };

    if (authChecked) {
      load();
    }
  }, [authChecked, user]);

  useEffect(() => {
    if (timerState !== "running") return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerState, duration]);

  useEffect(() => {
    if (timerState === "idle") {
      setSecondsLeft(duration * 60);
    }
  }, [duration, timerState]);

  const projectTotals = useMemo(() => {
    const acc = new Map<string, number>();
    sessions.forEach((s) => {
      acc.set(s.projectId, (acc.get(s.projectId) ?? 0) + s.durationMinutes);
    });
    return acc;
  }, [sessions]);

  const filteredSessions = useMemo(
    () =>
      sessions.filter((s) =>
        selectedProjectId ? s.projectId === selectedProjectId : true,
      ),
    [sessions, selectedProjectId],
  );

  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const monthDays = useMemo(
    () =>
      Array.from({ length: daysInMonth }, (_, i) => {
        const d = new Date(today.getFullYear(), today.getMonth(), i + 1);
        return d;
      }),
    [daysInMonth, today.getFullYear(), today.getMonth()],
  );

  const minutesByDay = useMemo(() => {
    const dayMap = new Map<string, number>();
    filteredSessions.forEach((session) => {
      const d = new Date(session.startedAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      dayMap.set(key, (dayMap.get(key) ?? 0) + session.durationMinutes);
    });
    return dayMap;
  }, [filteredSessions]);

  const maxMinutesInMonth =
    Math.max(...Array.from(minutesByDay.values()), duration) || duration;

  const showFlash = (message: string) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2600);
  };

  const createProject = async () => {
    if (projectName.trim().length < 2) {
      showFlash("El nombre del proyecto debe tener al menos 2 letras.");
      return;
    }
    setIsSavingProject(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName.trim(),
          color: palettes[Math.floor(Math.random() * palettes.length)],
        }),
      });
      if (!res.ok) {
        throw new Error("No se pudo crear el proyecto");
      }
      const project: Project = await res.json();
      setProjects((prev) => [...prev, { ...project, sessions: [] }]);

      const shouldSelectNew = !selectedProjectId || timerState === "idle";
      if (shouldSelectNew) {
        setSelectedProjectId(project.id);
      }

      setProjectName("");
      showFlash("Proyecto creado");
    } catch (error) {
      console.error(error);
      showFlash("Error al crear el proyecto");
    } finally {
      setIsSavingProject(false);
    }
  };

  const deleteProject = async (id: string) => {
    if (timerState !== "idle" && selectedProjectId === id) {
      showFlash("Detén o termina la sesión antes de eliminar este proyecto.");
      return;
    }
    if (!confirm("¿Eliminar este proyecto y sus sesiones?")) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("No se pudo eliminar");
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setSessions((prev) => prev.filter((s) => s.projectId !== id));
      if (selectedProjectId === id) {
        setSelectedProjectId(projects.find((p) => p.id !== id)?.id ?? null);
      }
      showFlash("Proyecto eliminado");
    } catch (error) {
      console.error(error);
      showFlash("No se pudo eliminar el proyecto");
    }
  };

  const startTimer = () => {
    if (!selectedProjectId) {
      showFlash("Crea y selecciona un proyecto antes de comenzar.");
      return;
    }
    setStartedAt(new Date());
    setSecondsLeft(duration * 60);
    setTimerState("running");
  };

  const pauseTimer = () => setTimerState("paused");
  const resumeTimer = () => setTimerState("running");
  const resetTimer = () => {
    setTimerState("idle");
    setSecondsLeft(duration * 60);
    setStartedAt(null);
  };

  const handleComplete = async () => {
    setTimerState("idle");
    const endTime = new Date();
    const startTime =
      startedAt ?? new Date(endTime.getTime() - (duration * 60 - secondsLeft) * 1000);

    if (!selectedProjectId) {
      resetTimer();
      return;
    }

    const sessionPayload = {
      projectId: selectedProjectId,
      startedAt: startTime.toISOString(),
      endedAt: endTime.toISOString(),
      durationMinutes: duration,
    };

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionPayload),
      });
      if (!res.ok) throw new Error("No se pudo guardar la sesión");
      const session: Session = await res.json();

      setSessions((prev) => [session, ...prev]);
      setProjects((prev) =>
        prev.map((p) =>
          p.id === session.projectId
            ? { ...p, sessions: [session, ...(p.sessions ?? [])] }
            : p,
        ),
      );
      showFlash("Sesión guardada");
    } catch (error) {
      console.error(error);
      showFlash("No pudimos guardar la sesión");
    } finally {
      resetTimer();
    }
  };

  const intensityColor = (minutes: number) => {
    const base = activeProject?.color ?? "#7BD1FF";
    const strength = Math.min(1, minutes / maxMinutesInMonth);
    return {
      backgroundColor: hexToRgba(base, 0.2 + strength * 0.65),
      borderColor: hexToRgba(base, 0.4),
    };
  };

  const monthLabel = today.toLocaleString("es", {
    month: "long",
    year: "numeric",
  });

  const clockString = toClock(secondsLeft);

  useEffect(() => {
    if (timerState === "running") {
      setFreezeNow(null);
    } else {
      setFreezeNow(Date.now());
    }
  }, [timerState]);

  useEffect(() => {
    const compute = () =>
      setIsMobile(typeof window !== "undefined" ? window.innerWidth < 640 : false);
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  const getFlipStyles = (fullscreen = false) => {
    if (isMobile) {
      return {
        digitBlockStyle: {
          width: fullscreen ? 96 : 80,
          height: fullscreen ? 150 : 120,
          fontSize: fullscreen ? 76 : 62,
          color: "#e8ecf5",
          backgroundColor: "#111216",
          borderRadius: 14,
        },
        separatorStyle: { color: "#8f8f91", size: "10px" },
        dividerStyle: { color: "#141414", height: 1 },
      } as const;
    }
    return {
      digitBlockStyle: {
        width: fullscreen ? 180 : 120,
        height: fullscreen ? 260 : 170,
        fontSize: fullscreen ? 140 : 86,
        color: "#e8ecf5",
        backgroundColor: "#111216",
        borderRadius: fullscreen ? 20 : 16,
      },
      separatorStyle: { color: "#8f8f91", size: "14px" },
      dividerStyle: { color: "#141414", height: 1 },
    } as const;
  };

  const effectiveNow =
    timerState === "running" || freezeNow === null ? Date.now() : freezeNow;
  const flipTarget = effectiveNow + secondsLeft * 1000;
  const flipStyles = getFlipStyles(false);
  const flipStylesFull = getFlipStyles(true);

  const handleProjectSelect = (id: string) => {
    if (timerState !== "idle") {
      showFlash("Termina o cancela la sesión antes de cambiar de proyecto.");
      return;
    }
    setSelectedProjectId(id);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setProjects([]);
    setSessions([]);
    setSelectedProjectId(null);
    showFlash("Sesión cerrada.");
  };

  return (
    <div className="min-h-screen text-foreground">
      {fullScreen && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur overflow-hidden">
          <div className="w-full max-w-6xl px-4 sm:px-6 text-center">
            <div className="mb-4 flex items-center justify-between gap-4 text-xs text-[var(--muted)]">
              <button
                type="button"
                onClick={() => setFullScreen(false)}
                className="text-lg transition hover:text-white"
                aria-label="Salir de pantalla completa"
              >
                ⤡
              </button>
              <div className="flex items-center gap-2">
                <span>Flip clock</span>
                <button
                  type="button"
                  onClick={() => setFlipMode((v) => !v)}
                  className={`flex h-6 w-12 items-center rounded-full border border-white/20 px-1 transition ${
                    flipMode ? "bg-white/30" : "bg-white/5"
                  }`}
                  aria-label="Toggle flip clock fullscreen"
                >
                  <span
                    className={`h-4 w-4 rounded-full bg-white transition ${
                      flipMode ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
            <p className="mb-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              {activeProject ? activeProject.name : BRAND}
            </p>
            <div className="flex justify-center items-center w-full px-2 overflow-hidden">
              {flipMode ? (
                <FlipClockCountdown
                  to={flipTarget}
                  now={() => effectiveNow}
                  stopOnHiddenVisibility={false}
                  renderOnServer={false}
                  renderMap={[false, false, true, true]}
                  showLabels={false}
                  showSeparators
                  duration={0.5}
                  hideOnComplete={false}
                  digitBlockStyle={flipStylesFull.digitBlockStyle}
                  separatorStyle={flipStylesFull.separatorStyle}
                  dividerStyle={flipStylesFull.dividerStyle}
                />
              ) : (
                <div className="fullscreen-clock font-semibold">{clockString}</div>
              )}
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {timerState === "running"
                ? "En curso…"
                : timerState === "paused"
                  ? "Pausado"
                  : "Listo"}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {timerState === "idle" && (
                <button
                  onClick={startTimer}
                  className="pill border border-white/30 px-5 py-3 text-sm font-semibold text-foreground transition hover:border-white/50"
                >
                  Iniciar
                </button>
              )}
              {timerState === "running" && (
                <button
                  onClick={pauseTimer}
                  className="pill border border-white/30 px-5 py-3 text-sm font-semibold text-foreground transition hover:border-white/50"
                >
                  ❚❚ Pausar
                </button>
              )}
              {timerState === "paused" && (
                <button
                  onClick={resumeTimer}
                  className="pill border border-white/30 px-5 py-3 text-sm font-semibold text-foreground transition hover:border-white/50"
                >
                  Reanudar
                </button>
              )}
              {timerState !== "idle" && (
                <button
                  onClick={resetTimer}
                  className="pill bg-white/10 px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-white/20"
                >
                  ✕ Cancelar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto glass pill flex items-center gap-3 px-4 py-3 text-sm shadow-xl"
          >
            <div className="h-2 w-2 rounded-full bg-white" />
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
        <nav className="glass relative flex items-center justify-between rounded-3xl px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-sm font-semibold text-foreground">
              ⏱️
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">{BRAND}</h1>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Pomodoro por proyecto
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-3 sm:flex">
            {user ? (
              <>
                <span className="rounded-full bg-white/5 px-3 py-2 text-sm text-[var(--muted)]">
                  {user.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="pill bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-white/90"
                >
                  Cerrar sesión
                </button>
              </>
            ) : (
              <a
                href="/login"
                className="pill bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-white/90"
              >
                Iniciar sesión
              </a>
            )}
          </div>

          <div className="flex items-center sm:hidden">
            <button
              type="button"
              className="pill bg-white/10 px-3 py-2 text-sm text-foreground"
              onClick={() => setNavOpen((v) => !v)}
              aria-label="Abrir menú"
            >
              ☰
            </button>
            {navOpen && (
              <div className="absolute right-4 top-16 z-40 w-56 rounded-2xl bg-black/80 p-3 shadow-2xl backdrop-blur">
                {user ? (
                  <>
                    <div className="rounded-xl bg-white/5 px-3 py-2 text-sm text-[var(--muted)]">
                      {user.email}
                    </div>
                    <button
                      onClick={() => {
                        setNavOpen(false);
                        handleLogout();
                      }}
                      className="mt-3 w-full rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
                    >
                      Cerrar sesión
                    </button>
                  </>
                ) : (
                  <a
                    href="/login"
                    onClick={() => setNavOpen(false)}
                    className="block w-full rounded-xl bg-white px-4 py-2 text-center text-sm font-semibold text-black transition hover:bg-white/90"
                  >
                    Iniciar sesión
                  </a>
                )}
              </div>
            )}
          </div>
        </nav>

        {!authChecked ? (
          <p className="text-sm text-[var(--muted)]">Verificando sesión…</p>
        ) : user ? (
          <>
            <header className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-sm font-semibold text-foreground glass">
                  ⏱️
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Tablero
                  </p>
                  <h2 className="text-2xl font-semibold leading-tight">
                    Enfoca, mide y reporta por proyecto
                  </h2>
                </div>
              </div>
              <p className="max-w-3xl text-sm text-[var(--muted)]">
                Timer Pomodoro con registro automático por proyecto y un calendario de
                dedicación listo para conectarse a PostgreSQL.
              </p>
            </header>

            <div
              className={`grid gap-6 ${flipMode ? "" : "lg:grid-cols-[320px,1fr]"}`}
            >
              <aside className="glass rounded-3xl p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">Proyectos</h2>
                  <span className="text-xs text-[var(--muted)]">
                    {projects.length} activo(s)
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl bg-white/5 p-3">
                    <label className="text-xs uppercase tracking-wide text-[var(--muted)]">
                      Crear
                    </label>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        className="h-11 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-foreground outline-none focus:border-white/30"
                        placeholder="Nombre del proyecto"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                      />
                      <button
                        onClick={createProject}
                        disabled={isSavingProject}
                        className="pill bg-white/90 px-4 py-2 text-xs font-semibold text-black transition hover:bg-white"
                      >
                        {isSavingProject ? "Creando..." : "Guardar"}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {loading && <p className="text-sm text-[var(--muted)]">Cargando…</p>}
                    {!loading && projects.length === 0 && (
                      <p className="text-sm text-[var(--muted)]">
                        Aún no tienes proyectos. Crea uno para empezar a cronometrar.
                      </p>
                    )}

                    {projects.map((project) => {
                      const total = projectTotals.get(project.id) ?? 0;
                      return (
                        <div
                          key={project.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleProjectSelect(project.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleProjectSelect(project.id);
                            }
                          }}
                          style={{ borderColor: project.color }}
                          className={`group flex w-full cursor-pointer items-center justify-between rounded-2xl border px-3 py-3 text-left transition hover:bg-white/5 ${
                            selectedProjectId === project.id ? "bg-white/10" : "bg-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className="h-4 w-4 rounded-full"
                              style={{ backgroundColor: project.color }}
                            />
                            <div>
                              <p className="font-semibold">{project.name}</p>
                              <p className="text-xs text-[var(--muted)]">
                                {friendlyMinutes(total)} acumulados
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] text-[var(--muted)]">
                              {project.sessions?.length ?? 0} sesiones
                            </span>
                            <button
                              type="button"
                              aria-label="Eliminar proyecto"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteProject(project.id);
                              }}
                              className="hidden h-8 w-8 place-items-center rounded-full bg-white/5 text-xs text-[var(--muted)] transition hover:bg-white/10 group-hover:grid"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </aside>

              <div className="space-y-6">
                <section className="glass rounded-3xl p-6">
                  <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                        Sesión enfocada
                      </p>
                      <h2 className="text-3xl font-semibold">
                        {activeProject ? activeProject.name : "Selecciona un proyecto"}
                      </h2>
                      <p className="text-sm text-[var(--muted)]">
                        Cuando termine el ciclo se registrará automáticamente en el proyecto.
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-[var(--muted)]">
                      Ciclo de {duration} min ·{" "}
                      {friendlyMinutes(projectTotals.get(selectedProjectId ?? "") ?? 0)} acumulados
                    </div>
                  </div>

                  <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr,0.9fr]">
                    <div className="rounded-3xl bg-black/30 p-6 text-center shadow-2xl">
                      <div className="relative pt-6">
                        <div className="mb-4 flex items-center justify-between text-xs text-[var(--muted)]">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setFullScreen(true)}
                              className="text-lg text-[var(--muted)] transition hover:text-white"
                              aria-label="Pantalla completa"
                            >
                              ⤢
                            </button>
                            <span className="uppercase tracking-[0.2em]">
                              {activeProject ? activeProject.name : BRAND}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span>Flip clock</span>
                            <button
                              type="button"
                              onClick={() => setFlipMode((v) => !v)}
                              className={`flex h-6 w-12 items-center rounded-full border border-white/20 px-1 transition ${
                                flipMode ? "bg-white/30" : "bg-white/5"
                              }`}
                              aria-label="Toggle flip clock"
                            >
                              <span
                                className={`h-4 w-4 rounded-full bg-white transition ${
                                  flipMode ? "translate-x-6" : "translate-x-0"
                                }`}
                              />
                            </button>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-col items-center gap-3">
                          <div className="flex w-full justify-center overflow-hidden">
                            {flipMode ? (
                              <FlipClockCountdown
                                to={flipTarget}
                                now={() => effectiveNow}
                                stopOnHiddenVisibility={false}
                                renderOnServer={false}
                                renderMap={[false, false, true, true]}
                                showLabels={false}
                                showSeparators
                                duration={0.5}
                                hideOnComplete={false}
                                digitBlockStyle={flipStyles.digitBlockStyle}
                                separatorStyle={flipStyles.separatorStyle}
                                dividerStyle={flipStyles.dividerStyle}
                              />
                            ) : (
                              <div className="text-7xl font-semibold tracking-tight">
                                {clockString}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        {timerState === "running"
                          ? "En curso…"
                          : timerState === "paused"
                            ? "Pausado"
                            : "Listo para comenzar"}
                      </p>

                      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                        {timerState === "idle" && (
                          <button
                            onClick={startTimer}
                            className="pill bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
                          >
                            Comenzar
                          </button>
                        )}
                        {timerState === "running" && (
                          <>
                            <button
                              onClick={pauseTimer}
                              className="pill border border-white/30 px-5 py-3 text-sm font-semibold text-foreground transition hover:border-white/50"
                            >
                              Pausar
                            </button>
                            <button
                              onClick={resetTimer}
                              className="pill bg-white/10 px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-white/20"
                            >
                              Cancelar
                            </button>
                          </>
                        )}
                        {timerState === "paused" && (
                          <>
                            <button
                              onClick={resumeTimer}
                              className="pill bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
                            >
                              Reanudar
                            </button>
                            <button
                              onClick={resetTimer}
                              className="pill bg-white/10 px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-white/20"
                            >
                              Cancelar
                            </button>
                          </>
                        )}
                      </div>

                      <div className="mt-8">
                        <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                          Duración (1 a 120 min)
                        </label>
                        <div className="mt-3 flex items-center gap-3">
                          <input
                            type="range"
                            min={1}
                            max={120}
                            step={1}
                            value={duration}
                            disabled={timerState !== "idle"}
                            onChange={(e) => setDuration(Number(e.target.value))}
                            className="w-full accent-white"
                          />
                          <input
                            type="number"
                            min={1}
                            max={120}
                            value={duration}
                            disabled={timerState !== "idle"}
                            onChange={(e) =>
                              setDuration(
                                Math.max(1, Math.min(120, Number(e.target.value) || 1)),
                              )
                            }
                            className="w-20 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground outline-none focus:border-white/30 disabled:opacity-60"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-3xl bg-white/5 p-5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Sesiones recientes</h3>
                        <span className="text-xs text-[var(--muted)]">
                          {filteredSessions.length} registradas
                        </span>
                      </div>

                      <div className="mt-4 space-y-3">
                        {filteredSessions.slice(0, 5).map((session) => {
                          const start = new Date(session.startedAt);
                          return (
                            <div
                              key={session.id}
                              className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-3"
                            >
                              <div>
                                <p className="text-sm font-semibold">
                                  {start.toLocaleDateString("es", {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </p>
                                <p className="text-xs text-[var(--muted)]">
                                  {start.toLocaleTimeString("es", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                              </div>
                              <span className="pill bg-white/10 px-3 py-1 text-xs">
                                {session.durationMinutes} min
                              </span>
                            </div>
                          );
                        })}
                        {filteredSessions.length === 0 && (
                          <p className="text-sm text-[var(--muted)]">
                            Aún no hay sesiones para este proyecto.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="glass rounded-3xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                        Calendario
                      </p>
                      <h3 className="text-xl font-semibold">
                        Mapa de dedicación · {monthLabel}
                      </h3>
                      <p className="text-sm text-[var(--muted)]">
                        Cada punto refleja los minutos dedicados por día al proyecto seleccionado.
                      </p>
                    </div>
                    <div className="pill bg-white/5 px-3 py-1 text-xs text-[var(--muted)]">
                      Máximo diario observado: {friendlyMinutes(maxMinutesInMonth)}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 rounded-3xl bg-black/25 p-4">
                    <div className="grid grid-cols-7 gap-2 text-xs text-[var(--muted)]">
                      {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
                        <span key={d} className="text-center">
                          {d}
                        </span>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                      {monthDays.map((day) => {
                        const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
                        const minutes = minutesByDay.get(key) ?? 0;
                        return (
                          <div
                            key={key}
                            className="flex h-16 flex-col justify-between rounded-xl border border-white/10 p-2 text-xs text-[var(--muted)] transition"
                            style={intensityColor(minutes)}
                          >
                            <span className="text-[10px] text-white/80">
                              {day.toLocaleDateString("es", { day: "numeric" })}
                            </span>
                            <span className="text-[11px] font-semibold text-white">
                              {minutes ? friendlyMinutes(minutes) : "—"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </>
        ) : (
          <section className="glass mt-6 rounded-3xl p-10 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Bienvenido a {BRAND}
            </p>
            <h2 className="mt-2 text-3xl font-semibold">
              Inicia sesión para crear proyectos y registrar tus pomodoros
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Guardamos todo en PostgreSQL y tus credenciales se cifran con bcrypt.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <a
                href="/login?mode=register"
                className="pill bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                Crear cuenta
              </a>
              <a
                href="/login"
                className="pill border border-white/30 px-5 py-3 text-sm font-semibold text-foreground transition hover:border-white/50"
              >
                Iniciar sesión
              </a>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
