/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import useSound from "use-sound";
import { apiFetch } from "@/lib/client-api";
import { computeRemainingSeconds, minutesBetween } from "../utils/time";

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
  goalPeriod: GoalPeriod | null;
  goalMinutes: number | null;
  createdAt: string;
  sessions?: Session[];
};

type TimerState = "idle" | "running" | "paused";
type User = { id: string; email: string };
type SoundChoice = "campana" | "digital" | "none";
type GoalPeriod = "DAILY" | "WEEKLY";

const palettes = ["#7BD1FF", "#FFB4BC", "#C6FF7B", "#B7A3FF", "#FFD27B"];
const BRAND = "FocoPulse";
const GOAL_PERIOD_LABELS: Record<GoalPeriod, string> = {
  DAILY: "diaria",
  WEEKLY: "semanal",
};
const GOAL_PERIOD_COPY: Record<GoalPeriod, string> = {
  DAILY: "Hoy",
  WEEKLY: "Esta semana",
};
const SOUND_OPTIONS: Record<
  SoundChoice,
  { label: string; file: string | null; helper?: string }
> = {
  campana: {
    label: "Campana suave",
    file: "/sounds/campana.wav",
    helper: "Tono corto, tipo campana",
  },
  digital: {
    label: "Bip digital",
    file: "/sounds/digital.wav",
    helper: "Pitido breve estilo reloj",
  },
  none: {
    label: "Sin sonido",
    file: null,
    helper: "Solo se mostrará la notificación",
  },
};
const SOUND_ORDER: SoundChoice[] = ["campana", "digital", "none"];
const FOCUS_TIME_BLOCKS = [
  { start: 0, end: 6, label: "00-06 hs" },
  { start: 6, end: 9, label: "06-09 hs" },
  { start: 9, end: 12, label: "09-12 hs" },
  { start: 12, end: 15, label: "12-15 hs" },
  { start: 15, end: 18, label: "15-18 hs" },
  { start: 18, end: 21, label: "18-21 hs" },
  { start: 21, end: 24, label: "21-00 hs" },
];

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

const getGoalWindow = (period: GoalPeriod, now: Date) => {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (period === "WEEKLY") {
    const mondayOffset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - mondayOffset);
  }

  const end = new Date(start);
  end.setDate(end.getDate() + (period === "DAILY" ? 1 : 7));
  return { start, end };
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
  const [goalPeriod, setGoalPeriod] = useState<GoalPeriod>("DAILY");
  const [goalMinutes, setGoalMinutes] = useState("120");
  const [isSavingGoal, setIsSavingGoal] = useState(false);

  const [duration, setDuration] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(duration * 60);
  const [timerState, setTimerState] = useState<TimerState>("idle");
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<{ id: string; message: string }[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [flipMode, setFlipMode] = useState(false);
  const [freezeNow, setFreezeNow] = useState<number | null>(Date.now());
  const [isMobile, setIsMobile] = useState(false);
  const [soundChoice, setSoundChoice] = useState<SoundChoice>("campana");
  const soundChoiceRef = useRef<SoundChoice>("campana");
  const completingRef = useRef(false);
  const endTimeRef = useRef<Date | null>(null);
  const pendingSoundRef = useRef(false);

  const commonSoundOpts = { html5: true as const, preload: true, interrupt: true };
  const [playCampana] = useSound(SOUND_OPTIONS.campana.file!, {
    volume: 0.5,
    ...commonSoundOpts,
  });
  const [playDigital] = useSound(SOUND_OPTIONS.digital.file!, {
    volume: 0.45,
    ...commonSoundOpts,
  });

  const activeProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  useEffect(() => {
    if (!activeProject) return;
    setGoalPeriod(activeProject.goalPeriod ?? "DAILY");
    setGoalMinutes(
      String(
        activeProject.goalMinutes ??
          (activeProject.goalPeriod === "WEEKLY" ? 600 : 120),
      ),
    );
  }, [activeProject?.id, activeProject?.goalPeriod, activeProject?.goalMinutes]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await apiFetch("/api/auth/me", { cache: "no-store" });
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
        const res = await apiFetch("/api/projects", { cache: "no-store" });
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
    const tick = () => {
      if (!endTimeRef.current) return;
      const remainingSeconds = computeRemainingSeconds(endTimeRef.current);
      setSecondsLeft(remainingSeconds);
      if (remainingSeconds <= 0) {
        handleComplete();
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [timerState]);

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

  const focusSummary = useMemo(() => {
    const { start, end } = getGoalWindow("WEEKLY", new Date());
    const weekSessions = filteredSessions.filter((session) => {
      const startedAt = new Date(session.startedAt);
      return startedAt >= start && startedAt < end;
    });

    const totalMinutes = weekSessions.reduce(
      (total, session) => total + session.durationMinutes,
      0,
    );

    const blockCounts = FOCUS_TIME_BLOCKS.map((block) => ({
      ...block,
      count: weekSessions.filter((session) => {
        const hour = new Date(session.startedAt).getHours();
        return hour >= block.start && hour < block.end;
      }).length,
    }));
    const mostActiveBlock = blockCounts.reduce(
      (best, block) => (block.count > best.count ? block : best),
      blockCounts[0],
    );

    return {
      sessionsThisWeek: weekSessions.length,
      totalMinutes,
      averageMinutes:
        weekSessions.length > 0 ? Math.round(totalMinutes / weekSessions.length) : 0,
      activeBlockLabel: mostActiveBlock.count > 0 ? mostActiveBlock.label : "Sin datos",
    };
  }, [filteredSessions]);

  const activeGoalProgress = useMemo(() => {
    if (!activeProject?.goalPeriod || !activeProject.goalMinutes) return null;

    const { start, end } = getGoalWindow(activeProject.goalPeriod, new Date());
    const completedMinutes = filteredSessions.reduce((total, session) => {
      const startedAt = new Date(session.startedAt);
      if (startedAt >= start && startedAt < end) {
        return total + session.durationMinutes;
      }
      return total;
    }, 0);
    const targetMinutes = activeProject.goalMinutes;
    const percentage = Math.min(100, Math.round((completedMinutes / targetMinutes) * 100));

    return {
      completedMinutes,
      targetMinutes,
      percentage,
      remainingMinutes: Math.max(0, targetMinutes - completedMinutes),
      windowLabel: GOAL_PERIOD_COPY[activeProject.goalPeriod],
      periodLabel: GOAL_PERIOD_LABELS[activeProject.goalPeriod],
    };
  }, [activeProject, filteredSessions]);

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
      const res = await apiFetch("/api/projects", {
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
      const res = await apiFetch(`/api/projects/${id}`, { method: "DELETE" });
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

  const saveProjectGoal = async () => {
    if (!activeProject) {
      showFlash("Selecciona un proyecto para configurar su meta.");
      return;
    }

    const maxGoalMinutes = goalPeriod === "DAILY" ? 1440 : 10080;
    const parsedGoalMinutes = Number(goalMinutes);
    const normalizedMinutes = Math.round(parsedGoalMinutes);
    if (
      goalMinutes.trim() === "" ||
      !Number.isFinite(parsedGoalMinutes) ||
      normalizedMinutes < 1 ||
      normalizedMinutes > maxGoalMinutes
    ) {
      showFlash(
        `La meta ${GOAL_PERIOD_LABELS[goalPeriod]} debe estar entre 1 y ${maxGoalMinutes} minutos.`,
      );
      return;
    }

    setIsSavingGoal(true);
    try {
      const res = await apiFetch(`/api/projects/${activeProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goalPeriod,
          goalMinutes: normalizedMinutes,
        }),
      });
      if (!res.ok) throw new Error("No se pudo guardar la meta");
      const updatedProject: Project = await res.json();
      setProjects((prev) =>
        prev.map((project) =>
          project.id === updatedProject.id
            ? { ...updatedProject, sessions: updatedProject.sessions ?? project.sessions }
            : project,
        ),
      );
      showFlash("Meta guardada");
    } catch (error) {
      console.error(error);
      showFlash("No se pudo guardar la meta");
    } finally {
      setIsSavingGoal(false);
    }
  };

  const clearProjectGoal = async () => {
    if (!activeProject) return;

    setIsSavingGoal(true);
    try {
      const res = await apiFetch(`/api/projects/${activeProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalPeriod: null, goalMinutes: null }),
      });
      if (!res.ok) throw new Error("No se pudo quitar la meta");
      const updatedProject: Project = await res.json();
      setProjects((prev) =>
        prev.map((project) =>
          project.id === updatedProject.id
            ? { ...updatedProject, sessions: updatedProject.sessions ?? project.sessions }
            : project,
        ),
      );
      showFlash("Meta desactivada");
    } catch (error) {
      console.error(error);
      showFlash("No se pudo quitar la meta");
    } finally {
      setIsSavingGoal(false);
    }
  };

  const startTimer = () => {
    if (!selectedProjectId) {
      showFlash("Crea y selecciona un proyecto antes de comenzar.");
      return;
    }
    const now = new Date();
    setStartedAt(now);
    endTimeRef.current = new Date(now.getTime() + duration * 60 * 1000);
    setSecondsLeft(duration * 60);
    setTimerState("running");
  };

  const pauseTimer = () => {
    setTimerState("paused");
    endTimeRef.current = null;
  };
  const resumeTimer = () => {
    endTimeRef.current = new Date(Date.now() + secondsLeft * 1000);
    setTimerState("running");
  };
  const finishNow = () => {
    setSecondsLeft(0);
    handleComplete(new Date());
  };
  const resetTimer = () => {
    setTimerState("idle");
    setSecondsLeft(duration * 60);
    setStartedAt(null);
    endTimeRef.current = null;
    completingRef.current = false;
    pendingSoundRef.current = false;
  };

  const handleComplete = async (forcedEndTime?: Date) => {
    if (completingRef.current) return;
    completingRef.current = true;

    setTimerState("idle");
    playCompletionSound();
    const endTime = forcedEndTime ?? new Date();
    const startTime =
      startedAt ?? new Date(endTime.getTime() - (duration * 60 - secondsLeft) * 1000);
    const actualMinutes = minutesBetween(startTime, endTime);

    if (!selectedProjectId) {
      resetTimer();
      completingRef.current = false;
      return;
    }

      const sessionPayload = {
        projectId: selectedProjectId,
        startedAt: startTime.toISOString(),
        endedAt: endTime.toISOString(),
        durationMinutes: actualMinutes,
      };

    try {
      const res = await apiFetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionPayload),
      });
      if (!res.ok) throw new Error("No se pudo guardar la sesión");
      const session: Session = await res.json();

      setSessions((prev) =>
        prev.some((s) => s.id === session.id) ? prev : [session, ...prev],
      );
      setProjects((prev) =>
        prev.map((p) =>
          p.id === session.projectId
            ? (() => {
                const already = (p.sessions ?? []).some((s) => s.id === session.id);
                return {
                  ...p,
                  sessions: already ? p.sessions : [session, ...(p.sessions ?? [])],
                };
              })()
            : p,
        ),
      );
      showFlash("Sesión guardada");
    } catch (error) {
      console.error(error);
      showFlash("No pudimos guardar la sesión");
    } finally {
      resetTimer();
      completingRef.current = false;
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
    soundChoiceRef.current = soundChoice;
  }, [soundChoice]);

  useEffect(() => {
    if (!user) {
      setSettingsOpen(false);
    }
  }, [user]);

  useEffect(() => {
    const compute = () =>
      setIsMobile(typeof window !== "undefined" ? window.innerWidth < 640 : false);
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (typeof document === "undefined" || document.visibilityState !== "visible") return;

      if (timerState === "running" && endTimeRef.current) {
        const remaining = computeRemainingSeconds(endTimeRef.current);
        setSecondsLeft(remaining);
        if (remaining <= 0) {
          handleComplete(new Date());
        }
      }

      if (pendingSoundRef.current) {
        playCompletionSound();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [timerState]);

  const playSound = (choice: SoundChoice) => {
    if (choice === "campana") playCampana();
    if (choice === "digital") playDigital();
  };

  const playCompletionSound = () => {
    const choice = soundChoiceRef.current;
    if (choice === "none") {
      pendingSoundRef.current = false;
      return;
    }
    const result: unknown = playSound(choice);
    if (result instanceof Promise) {
      result
        .then(() => {
          pendingSoundRef.current = false;
        })
        .catch(() => {
          pendingSoundRef.current = true;
        });
    } else {
      pendingSoundRef.current = false;
    }
  };

  const renderSoundSelector = () => (
    <div className="mt-2 space-y-2">
      {SOUND_ORDER.map((key) => {
        const option = SOUND_OPTIONS[key];
        return (
          <label
            key={key}
            className="flex cursor-pointer items-start gap-3 rounded-xl bg-white/5 px-3 py-2 text-sm transition hover:bg-white/10"
          >
            <input
              type="radio"
              className="mt-1 h-4 w-4 accent-white"
              checked={soundChoice === key}
              onChange={() => setSoundChoice(key)}
            />
            <div className="flex-1">
              <p className="font-medium">{option.label}</p>
              {option.helper && (
                <p className="text-xs text-[var(--muted)]">{option.helper}</p>
              )}
            </div>
            {key !== "none" && (
              <button
                type="button"
                className="text-xs text-[var(--muted)] underline transition hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  playSound(key);
                }}
              >
                Probar
              </button>
            )}
          </label>
        );
      })}
    </div>
  );

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
              {timerState !== "idle" && (
                <button
                  onClick={finishNow}
                  className="pill bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
                >
                  Terminar
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
        <nav className="glass relative z-40 flex items-center justify-between rounded-3xl px-5 py-4">
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
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setSettingsOpen((v) => !v)}
                    className="pill bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-white/90"
                    aria-label="Abrir ajustes"
                    aria-expanded={settingsOpen}
                  >
                    ⚙️ Ajustes
                  </button>
                  {settingsOpen && (
                    <div className="absolute right-0 top-12 z-50 w-80 rounded-2xl bg-black/90 p-4 shadow-3xl backdrop-blur">
                      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                        Sonido al terminar
                      </p>
                      {renderSoundSelector()}
                      <div className="mt-3 border-t border-white/10 pt-3">
                        <button
                          onClick={handleLogout}
                          className="w-full rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-white/90"
                        >
                          Cerrar sesión
                        </button>
                      </div>
                    </div>
                  )}
                </div>
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
              <div className="absolute right-4 top-16 z-50 w-64 rounded-2xl bg-black/85 p-3 shadow-3xl backdrop-blur">
                {user ? (
                  <>
                    <div className="rounded-xl bg-white/5 px-3 py-2 text-sm text-[var(--muted)]">
                      {user.email}
                    </div>
                    <div className="mt-3 rounded-2xl bg-white/5 p-3">
                      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                        Sonido al terminar
                      </p>
                      {renderSoundSelector()}
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
                              {project.goalPeriod && project.goalMinutes && (
                                <p className="text-[11px] text-white/75">
                                  Meta {GOAL_PERIOD_LABELS[project.goalPeriod]}:{" "}
                                  {friendlyMinutes(project.goalMinutes)}
                                </p>
                              )}
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

                  {activeGoalProgress && (
                    <div className="mt-6 rounded-2xl bg-white/5 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                            Meta {activeGoalProgress.periodLabel}
                          </p>
                          <p className="text-lg font-semibold">
                            {activeGoalProgress.windowLabel}:{" "}
                            {friendlyMinutes(activeGoalProgress.completedMinutes)} de{" "}
                            {friendlyMinutes(activeGoalProgress.targetMinutes)}
                          </p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-xl font-semibold text-white">
                            {activeGoalProgress.percentage}%
                          </p>
                          <p className="text-sm text-[var(--muted)]">
                            {activeGoalProgress.remainingMinutes > 0
                              ? `Faltan ${friendlyMinutes(activeGoalProgress.remainingMinutes)}`
                              : "Meta completa"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 h-3 overflow-hidden rounded-full bg-black/30">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${activeGoalProgress.percentage}%`,
                            backgroundColor: activeProject?.color ?? "#ffffff",
                          }}
                        />
                      </div>
                    </div>
                  )}

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
                              onClick={finishNow}
                              className="pill bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
                            >
                  Terminar
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
                              onClick={finishNow}
                              className="pill bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
                            >
                  Terminar
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
                      <div className="rounded-2xl bg-black/20 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                              Meta del proyecto
                            </p>
                            <h3 className="text-lg font-semibold">
                              {activeProject?.goalPeriod ? "Editar meta" : "Crear meta"}
                            </h3>
                          </div>
                          {activeProject?.goalPeriod && (
                            <span className="pill bg-white/10 px-3 py-1 text-xs text-[var(--muted)]">
                              {GOAL_PERIOD_LABELS[activeProject.goalPeriod]}
                            </span>
                          )}
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-white/5 p-1">
                          {(["DAILY", "WEEKLY"] as GoalPeriod[]).map((period) => (
                            <button
                              key={period}
                              type="button"
                              disabled={!activeProject || isSavingGoal}
                              onClick={() => setGoalPeriod(period)}
                              className={`rounded-xl px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                                goalPeriod === period
                                  ? "bg-white text-black"
                                  : "text-[var(--muted)] hover:bg-white/10 hover:text-white"
                              }`}
                            >
                              {GOAL_PERIOD_LABELS[period]}
                            </button>
                          ))}
                        </div>

                        <label className="mt-4 block text-xs uppercase tracking-wide text-[var(--muted)]">
                          Minutos de foco
                        </label>
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            max={goalPeriod === "DAILY" ? 1440 : 10080}
                            value={goalMinutes}
                            disabled={!activeProject || isSavingGoal}
                            onChange={(e) => setGoalMinutes(e.target.value)}
                            className="h-11 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-foreground outline-none focus:border-white/30 disabled:opacity-60"
                          />
                          <span className="text-xs text-[var(--muted)]">
                            {goalPeriod === "DAILY" ? "por día" : "por semana"}
                          </span>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={saveProjectGoal}
                            disabled={!activeProject || isSavingGoal}
                            className="pill bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
                          >
                            {isSavingGoal ? "Guardando..." : "Guardar meta"}
                          </button>
                          {activeProject?.goalPeriod && (
                            <button
                              type="button"
                              onClick={clearProjectGoal}
                              disabled={isSavingGoal}
                              className="pill bg-white/10 px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-white/20 disabled:opacity-50"
                            >
                              Quitar
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 border-t border-white/10 pt-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                              Resumen
                            </p>
                            <h3 className="text-lg font-semibold">Tu semana de foco</h3>
                          </div>
                          <span className="text-xs text-[var(--muted)]">
                            {filteredSessions.length} registradas
                          </span>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl bg-white/5 px-3 py-3">
                            <p className="text-2xl font-semibold">
                              {focusSummary.sessionsThisWeek}
                            </p>
                            <p className="text-xs text-[var(--muted)]">
                              sesiones esta semana
                            </p>
                          </div>
                          <div className="rounded-2xl bg-white/5 px-3 py-3">
                            <p className="text-2xl font-semibold">
                              {friendlyMinutes(focusSummary.totalMinutes)}
                            </p>
                            <p className="text-xs text-[var(--muted)]">
                              tiempo enfocado
                            </p>
                          </div>
                          <div className="rounded-2xl bg-white/5 px-3 py-3">
                            <p className="text-2xl font-semibold">
                              {focusSummary.activeBlockLabel}
                            </p>
                            <p className="text-xs text-[var(--muted)]">
                              franja mas activa
                            </p>
                          </div>
                        </div>

                        <div className="mt-5 flex items-center justify-between">
                          <h3 className="text-lg font-semibold">Sesiones recientes</h3>
                          <span className="text-xs text-[var(--muted)]">
                            promedio {friendlyMinutes(focusSummary.averageMinutes)}
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
