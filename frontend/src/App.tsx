import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WebApp from "@twa-dev/sdk";

const SUBSCRIPTION_CLIENT_LIMIT = 9999;
const UNIVERSAL_INVITE_CODE = "TEST-CLIENT";
let currentLanguage: "ru" | "en" = "ru";

function getRoleStorageKey(base: string, role: Role | null) {
  return role ? `${base}:${role}` : base;
}

type Role = "trainer" | "client" | null;

type ProfileResponse = {
  ok: true;
  user: {
    tgUserId: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    role: Role;
    theme?: "light" | "dark" | null;
    language?: "ru" | "en" | null;
  };
};

type Tab = "home" | "schedule" | "clients" | "settings";
type ClientTab = "home" | "schedule" | "book" | "settings";
type SettingsScreen = "main" | "personal" | "theme" | "booking" | "reminders" | "language";
type ClientsScreen = "list" | "add" | "detail";
type UiText = {
  login: string;
  loginHint: string;
  chooseRoleTitle: string;
  roleTrainer: string;
  roleClient: string;
  roleContinue: string;
  roleChangeLater: string;
  roleHello: string;
  navHome: string;
  navSchedule: string;
  navClients: string;
  navSettings: string;
  navMyTrainer: string;
  scheduleTitle: string;
  scheduleToday: string;
  scheduleBook: string;
  scheduleHistory: string;
  myTrainerTitle: string;
  myTrainersTab: string;
  addTrainerTab: string;
  settingsSystem: string;
  settingsUseful: string;
  settingsBooking: string;
  settingsReminders: string;
  settingsLanguage: string;
  settingsTheme: string;
  settingsHelp: string;
  settingsSupport: string;
  settingsPrivacy: string;
  languageTitle: string;
  languageRu: string;
  languageEn: string;
  themeLight: string;
  themeDark: string;
  bookingTrainerOnly: string;
  bookingBoth: string;
  remindersOn: string;
  remindersOff: string;
  deleteProfile: string;
};

type TrainerClientInvite = {
  id: string;
  username: string; // без @
  code: string;
  createdAt: number;
  status: "pending" | "active";
  photoUrl?: string;
  fullName?: string;
  height?: string;
  weight?: string;
  goal?: string;
  comment?: string;
  exercises?: { id: string; name: string; weight: string }[];
  subscriptionStart?: string;
  subscriptionEnd?: string;
  subscriptionPrice?: string;
  subscriptionTotal?: string;
  subscriptionLeft?: string;
  archived?: boolean;
  trainerProfile?: {
    fitnessClub?: string;
    specialization?: string;
    experience?: string;
    about?: string;
    requirements?: string;
    extraInfo?: string;
    phone?: string;
    instagram?: string;
    otherSocial?: string;
  };
};

type TrainerProfile = {
  fullName?: string;
  fitnessClub?: string;
  specialization?: string;
  experience?: string;
  about?: string;
  requirements?: string;
  extraInfo?: string;
  phone?: string;
  instagram?: string;
  otherSocial?: string;
};

type FreeWindow = {
  id: string;
  start: string; // HH:MM
  end: string; // HH:MM
  clientUsername?: string; // without @
};

type SessionItem = {
  id: string;
  dateKey: string;
  start: string; // HH:MM
  end: string; // HH:MM
  clientUsername: string; // without @
  type?: string;
  price?: string;
  comment?: string;
};

const LanguageContext = React.createContext<"ru" | "en">("ru");

function useTr() {
  const language = React.useContext(LanguageContext);
  return useCallback((ru: string, en: string) => (language === "en" ? en : ru), [language]);
}

function trGlobal(ru: string, en: string) {
  return currentLanguage === "en" ? en : ru;
}

export default function App() {
  const apiBase = useMemo(() => import.meta.env.VITE_API_BASE as string, []);
  const initialLanguage = (() => {
    try {
      const storedRole = localStorage.getItem("role");
      const stored = localStorage.getItem(getRoleStorageKey("appLanguage", storedRole as Role | null));
      return stored === "en" ? "en" : "ru";
    } catch {
      return "ru";
    }
  })();

  const [token, setToken] = useState<string>(() => {
    try {
      return localStorage.getItem("token") || "";
    } catch {
      return "";
    }
  });
  const [status, setStatus] = useState<string>(
    initialLanguage === "en" ? "Open Telegram and tap Login" : "Открой в Telegram и нажми Login"
  );
  const [roleChosen, setRoleChosen] = useState<boolean>(() => {
    try {
      return localStorage.getItem("roleChosen") === "true";
    } catch {
      return false;
    }
  });
  const [language, setLanguage] = useState<"ru" | "en">(initialLanguage);
  currentLanguage = language;
  const tr = useCallback((ru: string, en: string) => (language === "en" ? en : ru), [language]);
  const [role, setRole] = useState<Role>(() => {
    try {
      const chosen = localStorage.getItem("roleChosen") === "true";
      if (!chosen) return null;
      const stored = localStorage.getItem("role");
      return stored === "trainer" || stored === "client" ? stored : null;
    } catch {
      return null;
    }
  });
  const [authChecking, setAuthChecking] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      const storedRole = localStorage.getItem("role");
      return localStorage.getItem(getRoleStorageKey("theme", storedRole as Role | null)) === "dark"
        ? "dark"
        : "light";
    } catch {
      return "light";
    }
  });

  const [name, setName] = useState<string>(() => {
    try {
      return localStorage.getItem("profileName") || "";
    } catch {
      return "";
    }
  });
  const [tgUsername, setTgUsername] = useState<string>(() => {
    try {
      return localStorage.getItem("tgUsername") || "";
    } catch {
      return "";
    }
  });
  const [tgPhotoUrl, setTgPhotoUrl] = useState<string>(() => {
    try {
      return localStorage.getItem("tgPhotoUrl") || "";
    } catch {
      return "";
    }
  });
  const [trainerProfile, setTrainerProfile] = useState<TrainerProfile | null>(null);
  const prefsSyncRef = useRef<number | null>(null);

  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [settingsScreen, setSettingsScreen] = useState<SettingsScreen>("main");
  const [clientSettingsScreen, setClientSettingsScreen] = useState<SettingsScreen>("main");
  const [clientTab, setClientTab] = useState<ClientTab>("home");
  const [clientConnected, setClientConnected] = useState<boolean>(() => {
    try {
      return localStorage.getItem("clientConnected") === "true";
    } catch {
      return false;
    }
  });

  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const hasTgBack = typeof WebApp?.BackButton?.show === "function";

  const scrollAreaStyle = {
    ...styles.scrollArea,
    paddingBottom: (keyboardOpen ? 16 : 72) + keyboardInset + 8,
    scrollPaddingBottom: keyboardInset + 32,
  };

  // ----- Clients state (локально, без бэка)
  const [clientsScreen, setClientsScreen] = useState<ClientsScreen>("list");
  const [invites, setInvites] = useState<TrainerClientInvite[]>([
    {
      id: "test_client_1",
      username: "test_client",
      code: "TEST1234",
      createdAt: Date.now(),
      status: "active",
      photoUrl: "",
      fullName: "",
      height: "",
      weight: "",
      goal: "",
      comment: "",
      exercises: [],
      subscriptionStart: "",
      subscriptionEnd: "",
      subscriptionPrice: "",
      subscriptionTotal: "",
      subscriptionLeft: "",
      archived: false,
    },
  ]);
  const [sessionsByDate, setSessionsByDate] = useState<Record<string, SessionItem[]>>({});
  const [historyByClient, setHistoryByClient] = useState<Record<string, SessionItem[]>>({});
  const processedSessionIdsRef = useRef<Set<string>>(new Set());
  const [pendingSession, setPendingSession] = useState<SessionItem | null>(null);
  const [clientInviteCode, setClientInviteCode] = useState("");
  const [clientInviteMessage, setClientInviteMessage] = useState("");

  async function fetchClients() {
    if (!token || role !== "trainer") return;
    try {
      const res = await fetch(`${apiBase}/clients`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { ok: boolean; clients?: any[] };
      if (!data?.clients) return;
      setInvites(data.clients.map((c) => mapClientFromApi(c)));
    } catch {
      // ignore
    }
  }

  async function loadClientHistory(client: TrainerClientInvite) {
    if (!token || role !== "trainer") return;
    try {
      const res = await fetch(`${apiBase}/clients/${client.id}/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { ok: boolean; sessions?: any[] };
      if (!data?.sessions) return;
      const mapped = data.sessions.map((s) => mapSessionFromApi(s));
      setHistoryByClient((prev) => ({ ...prev, [client.username]: mapped }));
    } catch {
      // ignore
    }
  }

  async function saveClientExercises(
    clientId: string,
    exercises: { id: string; name: string; weight: string }[]
  ) {
    if (!token || role !== "trainer") return;
    try {
      const res = await fetch(`${apiBase}/clients/${clientId}/exercises`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ exercises }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { ok: boolean; client?: any };
      if (data?.client) {
        setInvites((prev) =>
          prev.map((c) => (c.id === data.client.id ? mapClientFromApi(data.client) : c))
        );
      }
    } catch {
      // ignore
    }
  }

  async function fetchTrainerProfile() {
    if (!token || role !== "trainer") return;
    try {
      const res = await fetch(`${apiBase}/profile/trainer`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { ok: boolean; profile?: TrainerProfile };
      if (data?.profile) setTrainerProfile(data.profile);
    } catch {
      // ignore
    }
  }

  async function saveTrainerProfile(patch: Partial<TrainerProfile>) {
    if (!token || role !== "trainer") return;
    try {
      setTrainerProfile((prev) => ({ ...(prev || {}), ...patch }));
      await fetch(`${apiBase}/profile/trainer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(patch),
      });
    } catch {
      // ignore
    }
  }

  function schedulePrefsSync(nextTheme: "light" | "dark", nextLanguage: "ru" | "en") {
    if (!token) return;
    if (prefsSyncRef.current) window.clearTimeout(prefsSyncRef.current);
    prefsSyncRef.current = window.setTimeout(async () => {
      try {
        await fetch(`${apiBase}/profile/preferences`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ theme: nextTheme, language: nextLanguage }),
        });
      } catch {
        // ignore
      }
    }, 250);
  }

  const t = useMemo<UiText>(
    () => ({
      login: language === "en" ? "Login" : "Войти",
      loginHint: status,
      chooseRoleTitle: language === "en" ? "Choose your role" : "Выбери роль",
      roleTrainer: language === "en" ? "I'm a trainer" : "Я тренер",
      roleClient: language === "en" ? "I'm a client" : "Я клиент",
      roleContinue: language === "en" ? "Choose a role to continue." : "Выбери роль, чтобы продолжить работу в приложении.",
      roleChangeLater:
        language === "en" ? "You can change the role later in settings." : "Роль можно изменить позже в настройках профиля.",
      roleHello: `${getGreetingByTime(new Date(), language)},`,
      navHome: language === "en" ? "Home" : "Главная",
      navSchedule: language === "en" ? "Schedule" : "Расписание",
      navClients: language === "en" ? "Clients" : "Клиенты",
      navSettings: language === "en" ? "Settings" : "Настройки",
      navMyTrainer: language === "en" ? "My Coach" : "Мой тренер",
      scheduleTitle: language === "en" ? "Schedule" : "Расписание",
      scheduleToday: language === "en" ? "Today" : "Тренировки сегодня",
      scheduleBook: language === "en" ? "Plan a session" : "Запланировать занятие",
      scheduleHistory: language === "en" ? "History" : "История тренировок",
      myTrainerTitle: language === "en" ? "My Coach" : "Мой тренер",
      myTrainersTab: language === "en" ? "My coaches" : "Мои тренеры",
      addTrainerTab: language === "en" ? "Add coach" : "Добавить тренера",
      settingsSystem: language === "en" ? "System" : "Системные",
      settingsUseful: language === "en" ? "Useful" : "Полезное",
      settingsBooking: language === "en" ? "Booking" : "Запись на тренировки",
      settingsReminders: language === "en" ? "Session reminders" : "Напоминание о занятиях",
      settingsLanguage: language === "en" ? "Language" : "Язык интерфейса",
      settingsTheme: language === "en" ? "Color scheme" : "Цветовая схема",
      settingsHelp: language === "en" ? "How to use?" : "Как пользоваться?",
      settingsSupport: language === "en" ? "Support" : "Служба поддержки",
      settingsPrivacy: language === "en" ? "Privacy policy" : "Политика конфиденциальности",
      languageTitle: language === "en" ? "Language" : "Язык интерфейса",
      languageRu: language === "en" ? "Russian" : "Русский",
      languageEn: language === "en" ? "English" : "English",
      themeLight: language === "en" ? "Light" : "Светлая",
      themeDark: language === "en" ? "Dark" : "Тёмная",
      bookingTrainerOnly: language === "en" ? "Trainer only" : "Только тренер",
      bookingBoth: language === "en" ? "Trainer and client" : "Тренер и клиент",
      remindersOn: language === "en" ? "On" : "Включено",
      remindersOff: language === "en" ? "Off" : "Выключено",
      deleteProfile: language === "en" ? "Delete profile" : "Удалить профиль",
    }),
    [language, status]
  );

  useEffect(() => {
    try {
      localStorage.setItem(getRoleStorageKey("appLanguage", role), language);
    } catch {
      // ignore
    }
    if (role && token) {
      schedulePrefsSync(theme, language);
    }
  }, [language, role]);

  useEffect(() => {
    if (!token || role !== "trainer") return;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      const allSessions = Object.values(sessionsByDate).flat();
      const payload = allSessions.map((s) => ({
        id: s.id,
        clientUsername: s.clientUsername,
        clientName: getClientLabel(invites, s.clientUsername),
        startAt: sessionStartTime(s).toISOString(),
        endAt: sessionEndTime(s).toISOString(),
        startTime: s.start,
        endTime: s.end,
        type: s.type ?? null,
      }));

      try {
        await fetch(`${apiBase}/sessions/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ sessions: payload }),
          signal: controller.signal,
        });
      } catch {
        // ignore sync errors on client
      }
    }, 400);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [sessionsByDate, invites, token, role, apiBase]);

  useEffect(() => {
    fetchClients();
  }, [token, role, apiBase]);

  useEffect(() => {
    fetchTrainerProfile();
  }, [token, role, apiBase]);

  async function login() {
    try {
      const initData = WebApp.initData;
      if (!initData) {
        setStatus(
          tr(
            "initData пустой. Открой это внутри Telegram Mini App (через кнопку Menu).",
            "initData is empty. Open this inside the Telegram Mini App (via the Menu button)."
          )
        );
        return;
      }

      const res = await fetch(`${apiBase}/auth/telegram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
      });

      const text = await res.text();
      if (!res.ok) {
        setStatus(`${tr("Ошибка сервера", "Server error")}: ${res.status}\n${text}`);
        return;
      }

      const data = JSON.parse(text) as { token: string };
      setToken(data.token);
      try {
        localStorage.setItem("token", data.token);
      } catch {
        // ignore
      }
      await loadProfile(data.token);
    } catch (e: any) {
      setStatus(`${tr("Ошибка", "Error")}: ${e?.message ?? String(e)}`);
    }
  }

  async function loadProfile(t: string) {
    const res = await fetch(`${apiBase}/profile`, {
      headers: { Authorization: `Bearer ${t}` },
    });

    const text = await res.text();
    if (!res.ok) {
      try {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("roleChosen");
      } catch {
        // ignore
      }
      setToken("");
      setRole(null);
      setRoleChosen(false);
      setAuthChecking(false);
      setStatus(`${tr("Не удалось загрузить профиль", "Failed to load profile")}: ${res.status}\n${text}`);
      return;
    }

    const data = JSON.parse(text) as ProfileResponse;
    setRole(data.user.role);
    try {
      if (data.user.role) {
        localStorage.setItem("role", data.user.role);
        localStorage.setItem("roleChosen", "true");
        setRoleChosen(true);
      } else {
        localStorage.removeItem("role");
        localStorage.removeItem("roleChosen");
        setRoleChosen(false);
      }
    } catch {
      // ignore
    }
    setAuthChecking(false);

    const fullName =
      [data.user.firstName, data.user.lastName].filter(Boolean).join(" ") ||
      data.user.username ||
      data.user.tgUserId;

    setName(fullName);
    setTgUsername(data.user.username ?? "");

    if (data.user.theme === "dark" || data.user.theme === "light") {
      setTheme(data.user.theme);
    }
    if (data.user.language === "ru" || data.user.language === "en") {
      setLanguage(data.user.language);
    }

    const tgUser = WebApp.initDataUnsafe?.user;
    if (tgUser?.photo_url) {
      setTgPhotoUrl(tgUser.photo_url);
      try {
        localStorage.setItem("tgPhotoUrl", tgUser.photo_url);
      } catch {
        // ignore
      }
    }
    if (data.user.username) {
      try {
        localStorage.setItem("tgUsername", data.user.username);
      } catch {
        // ignore
      }
    }
    try {
      localStorage.setItem("profileName", fullName);
    } catch {
      // ignore
    }
  }

  async function chooseRole(r: Exclude<Role, null>) {
    if (!token) {
      setStatus(tr("Сначала нажми Login", "Tap Login first"));
      return;
    }

    const res = await fetch(`${apiBase}/role`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role: r }),
    });

    const text = await res.text();
    if (!res.ok) {
      setStatus(`${tr("Ошибка сохранения роли", "Failed to save role")}: ${res.status}\n${text}`);
      return;
    }

    setRole(r);
    try {
      localStorage.setItem("role", r);
      localStorage.setItem("roleChosen", "true");
      setRoleChosen(true);
    } catch {
      // ignore
    }
    if (r === "client") {
      setClientConnected(false);
      try {
        localStorage.setItem("clientConnected", "false");
      } catch {
        // ignore
      }
    }
    setActiveTab("home");
  }

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        try {
          WebApp.ready();
          WebApp.expand();
        } catch {
          // ignore
        }

        const tgUser = WebApp.initDataUnsafe?.user;
        if (tgUser) {
          const fastName =
            [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ") ||
            tgUser.username ||
            String(tgUser.id || "");
          if (fastName) {
            setName(fastName);
            try {
              localStorage.setItem("profileName", fastName);
            } catch {
              // ignore
            }
          }
          if (tgUser.username) {
            setTgUsername(tgUser.username);
            try {
              localStorage.setItem("tgUsername", tgUser.username);
            } catch {
              // ignore
            }
          }
          if (tgUser.photo_url) {
            setTgPhotoUrl(tgUser.photo_url);
            try {
              localStorage.setItem("tgPhotoUrl", tgUser.photo_url);
            } catch {
              // ignore
            }
          }
        }

        const initData = WebApp.initData;

        if (!initData) {
          if (!cancelled) setAuthChecking(false);
          return;
        }

        const res = await fetch(`${apiBase}/auth/telegram`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData }),
        });

        const text = await res.text();
        if (!res.ok) {
          if (!cancelled) {
            try {
              localStorage.removeItem("token");
              localStorage.removeItem("role");
              localStorage.removeItem("roleChosen");
            } catch {
              // ignore
            }
            setToken("");
            setRole(null);
            setRoleChosen(false);
            setStatus(`${tr("Ошибка автологина", "Auto-login error")}: ${res.status}\n${text}`);
            setAuthChecking(false);
          }
          return;
        }

        const data = JSON.parse(text) as { token: string };
        if (cancelled) return;

        setToken(data.token);
        try {
          localStorage.setItem("token", data.token);
        } catch {
          // ignore
        }
        await loadProfile(data.token);

        if (!cancelled) {
          setActiveTab("home");
          setAuthChecking(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          try {
            localStorage.removeItem("token");
            localStorage.removeItem("role");
            localStorage.removeItem("roleChosen");
          } catch {
            // ignore
          }
          setToken("");
          setRole(null);
          setRoleChosen(false);
          setStatus(`${tr("Ошибка автозапуска", "Auto-start error")}: ${e?.message ?? String(e)}`);
          setAuthChecking(false);
        }
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  const hasInitData = Boolean(WebApp.initData);
  const suppressLogin = authChecking && (hasInitData || roleChosen);

  useEffect(() => {
    try {
      const isDark = theme === "dark";
      const bg = isDark ? "#171a20" : "#ffffff";
      WebApp.setHeaderColor?.(bg as any);
      WebApp.setBackgroundColor?.(bg as any);
      WebApp.setBottomBarColor?.(bg as any);
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA") return;
      event.preventDefault();
      (target as HTMLInputElement | HTMLTextAreaElement).blur();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA") return;
      setKeyboardOpen(true);
      const ensureVisible = () => {
        const vvHeight = window.visualViewport?.height ?? window.innerHeight;
        const rect = target.getBoundingClientRect();
        const bottomLimit = vvHeight - 12;
        const topLimit = 12;
        const scrollParent = target.closest("[data-scroll-area]") as HTMLElement | null;
        if (rect.bottom > bottomLimit) {
          const delta = rect.bottom - bottomLimit;
          if (scrollParent) {
            scrollParent.scrollBy({ top: delta, behavior: "auto" });
          } else {
            target.scrollIntoView({ block: "center", behavior: "auto" });
          }
          return;
        }
        if (rect.top < topLimit) {
          const delta = rect.top - topLimit;
          if (scrollParent) {
            scrollParent.scrollBy({ top: delta, behavior: "auto" });
          } else {
            target.scrollIntoView({ block: "center", behavior: "auto" });
          }
        }
      };
      requestAnimationFrame(ensureVisible);
      window.setTimeout(ensureVisible, 250);
    };
    const onFocusOut = () => {
      window.setTimeout(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) {
          setKeyboardOpen(false);
          return;
        }
        const tag = el.tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA") {
          setKeyboardOpen(false);
        }
      }, 80);
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      const inset = Math.max(0, window.innerHeight - vv.height);
      setKeyboardInset(inset);
      try {
        document.documentElement.style.setProperty("--keyboard-inset", `${inset}px`);
      } catch {
        // ignore
      }
    };
    onResize();
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!hasTgBack) return;
    if (activeTab !== "settings" && activeTab !== "clients" && activeTab !== "home") return;

    const canBackSettings = activeTab === "settings" && settingsScreen !== "main";
    const canBackClients = activeTab === "clients" && clientsScreen !== "list";
    const canBackClientConnect = role === "client" && !clientConnected;
    const shouldShow = canBackSettings || canBackClients || canBackClientConnect;

    const handler = () => {
      if (canBackClientConnect) {
        setRole(null);
        try {
          localStorage.removeItem("role");
          localStorage.removeItem("roleChosen");
        } catch {
          // ignore
        }
        return;
      }
      if (canBackSettings) {
        setSettingsScreen("main");
        return;
      }
      if (canBackClients) {
        setClientsScreen("list");
      }
    };

    if (shouldShow) {
      WebApp.BackButton.show();
      WebApp.BackButton.onClick(handler);
    } else {
      WebApp.BackButton.hide();
    }

    return () => {
      try {
        WebApp.BackButton.offClick(handler);
      } catch {
        // ignore
      }
    };
  }, [hasTgBack, activeTab, settingsScreen, clientsScreen, role, clientConnected]);

  useEffect(() => {
    if (!hasTgBack) return;
    if (clientTab !== "settings") return;

    const shouldShow = clientSettingsScreen !== "main";

    const handler = () => {
      if (clientSettingsScreen !== "main") {
        setClientSettingsScreen("main");
      }
    };

    if (shouldShow) {
      WebApp.BackButton.show();
      WebApp.BackButton.onClick(handler);
    } else {
      WebApp.BackButton.hide();
    }

    return () => {
      try {
        WebApp.BackButton.offClick(handler);
      } catch {
        // ignore
      }
    };
  }, [hasTgBack, clientTab, clientSettingsScreen]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = new Date();
      setSessionsByDate((prev) => {
        const moved: SessionItem[] = Object.values(prev)
          .flat()
          .filter((s) => isSessionEnded(s, now));

        const uniqueMoved = moved.filter((s, idx, arr) =>
          arr.findIndex((x) => x.id === s.id) === idx
        );
        const newMoved = uniqueMoved.filter((s) => !processedSessionIdsRef.current.has(s.id));
        if (newMoved.length > 0) {
          newMoved.forEach((s) => processedSessionIdsRef.current.add(s.id));
        }

        if (newMoved.length > 0) {
          setHistoryByClient((prevHist) => {
            const nextHist: Record<string, SessionItem[]> = { ...prevHist };
            newMoved.forEach((s) => {
              const list = nextHist[s.clientUsername] ? [...nextHist[s.clientUsername]] : [];
              if (!list.find((x) => x.id === s.id)) {
                list.push(s);
              }
              nextHist[s.clientUsername] = list;
            });
            return nextHist;
          });
        }

        setInvites((prevInv) =>
          prevInv.map((c) => {
            const countForClient = newMoved.filter((s) => s.clientUsername === c.username).length;
            const left = parseInt(c.subscriptionLeft || "", 10);
            const endDate = c.subscriptionEnd ? parseDateDMY(c.subscriptionEnd) : null;
            const endExpired = endDate ? endDateEnd(endDate).getTime() <= now.getTime() : false;

            let nextLeft = Number.isNaN(left) ? left : left;
            if (!Number.isNaN(left) && countForClient > 0) {
              nextLeft = Math.max(0, left - countForClient);
            }

            const shouldArchive =
              endExpired || (Number.isNaN(nextLeft) ? false : nextLeft <= 0);

            if (endExpired && !Number.isNaN(left)) {
              nextLeft = 0;
            }

            if (Number.isNaN(left)) {
              return shouldArchive ? { ...c, archived: true } : c;
            }

            return {
              ...c,
              subscriptionLeft: String(nextLeft),
              archived: shouldArchive ? true : c.archived,
            };
          })
        );

        return prev;
      });
    }, 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const now = new Date();
    setInvites((prev) => {
      let changed = false;
      const next = prev.map((c) => {
        if (c.archived) return c;
        let shouldArchive = false;
        let nextLeft = c.subscriptionLeft;

        const left = parseInt(c.subscriptionLeft || "", 10);
        if (!Number.isNaN(left) && left <= 0) shouldArchive = true;

        if (c.subscriptionEnd) {
          const end = parseDateDMY(c.subscriptionEnd);
          if (end && endDateEnd(end).getTime() <= now.getTime()) {
            shouldArchive = true;
            nextLeft = "0";
          }
        }

        if (shouldArchive) {
          changed = true;
          return { ...c, archived: true, subscriptionLeft: nextLeft };
        }
        return c;
      });
      return changed ? next : prev;
    });
  }, [invites]);

  useEffect(() => {
    try {
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
      localStorage.setItem(getRoleStorageKey("theme", role), theme);
    } catch {
      // ignore
    }
    if (role && token) {
      schedulePrefsSync(theme, language);
    }
  }, [theme, role]);

  useEffect(() => {
    if (!role) return;
    try {
      const storedLang = localStorage.getItem(getRoleStorageKey("appLanguage", role));
      if (storedLang === "en" || storedLang === "ru") {
        setLanguage(storedLang);
      }
      const storedTheme = localStorage.getItem(getRoleStorageKey("theme", role));
      if (storedTheme === "dark" || storedTheme === "light") {
        setTheme(storedTheme);
      }
    } catch {
      // ignore
    }
  }, [role]);

  useEffect(() => {
    if (activeTab !== "settings") setSettingsScreen("main");
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "clients") setClientsScreen("list");
  }, [activeTab]);

  useEffect(() => {
    if (clientTab !== "settings") setClientSettingsScreen("main");
  }, [clientTab]);

  const handleDeleteProfile = () => {
    const isTrainer = role === "trainer";
    const message = isTrainer
      ? tr(
          "Вы уверены? Будут удалены данные о вас, клиентах и тренировках.",
          "Are you sure? Your profile, clients, and sessions data will be deleted."
        )
      : tr(
          "Вы уверены? Будут удалены данные о вас и ваших тренерах.",
          "Are you sure? Your profile and connected coaches will be deleted."
        );

    const doDelete = () => {
      setInvites([]);
      setSessionsByDate({});
      setHistoryByClient({});
      processedSessionIdsRef.current = new Set();
      setPendingSession(null);
      setClientConnected(false);
      setClientTab("home");
      setActiveTab("home");
      setSettingsScreen("main");
      setClientSettingsScreen("main");
      setRole(null);
      setRoleChosen(false);
      try {
        localStorage.removeItem("role");
        localStorage.removeItem("roleChosen");
        localStorage.removeItem("clientConnected");
        localStorage.removeItem("profileName");
        localStorage.removeItem("tgUsername");
        localStorage.removeItem("tgPhotoUrl");
      } catch {
        // ignore
      }
    };

    if (typeof WebApp?.showConfirm === "function") {
      WebApp.showConfirm(message, (ok) => {
        if (ok) doDelete();
      });
      return;
    }
    if (window.confirm(message)) doDelete();
  };

  if (!token && !suppressLogin) {
    return (
      <LanguageContext.Provider value={language}>
        <div style={styles.appShell}>
          <GlobalStyles />
          <div style={styles.pageContainer}>
            <button onClick={login} style={styles.primaryBtn}>
              {t.login}
            </button>
            <div style={styles.hint}>{t.loginHint}</div>
          </div>
        </div>
      </LanguageContext.Provider>
    );
  }

  if (role === null && token) {
    return (
      <LanguageContext.Provider value={language}>
        <div style={styles.appShell}>
          <GlobalStyles />
          <div style={styles.pageContainer}>
            <div style={styles.roleWrap}>
              <div style={styles.roleCard}>
                <div style={styles.roleHeaderRow}>
                  <AvatarCircle
                    name={name || tr("Пользователь", "User")}
                    photoUrl={tgPhotoUrl}
                    size={52}
                  />
                  <div>
                    <div style={styles.roleHello}>{t.roleHello}</div>
                    <div style={styles.roleName}>{name || tr("Пользователь", "User")}</div>
                  </div>
                </div>

                <div style={styles.roleIntro}>{t.roleContinue}</div>

                <div style={styles.roleButtons}>
                  <button
                    onClick={() => chooseRole("trainer")}
                    style={{ ...styles.primaryBtn, ...styles.roleBtnPrimary }}
                  >
                    {t.roleTrainer}
                  </button>
                  <button
                    onClick={() => chooseRole("client")}
                    style={{ ...styles.primaryBtn, ...styles.roleBtnSecondary }}
                  >
                    {t.roleClient}
                  </button>
                </div>

                <div style={styles.roleNote}>{t.roleChangeLater}</div>
              </div>
            </div>
          </div>
        </div>
      </LanguageContext.Provider>
    );
  }

  if (role === "trainer") {
    return (
      <LanguageContext.Provider value={language}>
        <div style={styles.appShell}>
          <GlobalStyles />

          <div style={styles.appFrame}>
            <div
              style={{
                ...scrollAreaStyle,
                overflowY: "auto",
                overscrollBehavior: "auto",
              }}
              data-scroll-area
            >
              {activeTab === "home" && (
                <TrainerHome
                  name={name}
                  photoUrl={tgPhotoUrl}
                  clients={invites}
                  sessionsByDate={sessionsByDate}
                  onOpenSession={(session) => {
                    setPendingSession(session);
                    setActiveTab("schedule");
                  }}
                  onOpenSettings={() => setActiveTab("settings")}
                />
              )}
              {activeTab === "schedule" && (
                <TrainerSchedule
                  clients={invites}
                  setClients={setInvites}
                  historyByClient={historyByClient}
                  sessionsByDate={sessionsByDate}
                  setSessionsByDate={setSessionsByDate}
                  pendingSession={pendingSession}
                  onConsumePendingSession={() => setPendingSession(null)}
                  onSaveExercises={saveClientExercises}
                />
              )}
              {activeTab === "clients" && (
                <TrainerClients
                  screen={clientsScreen}
                  setScreen={setClientsScreen}
                  invites={invites}
                  setInvites={setInvites}
                  historyByClient={historyByClient}
                  token={token}
                  apiBase={apiBase}
                  onLoadHistory={loadClientHistory}
                  onRefreshClients={fetchClients}
                />
              )}
              {activeTab === "settings" && (
              <TrainerSettings
                screen={settingsScreen}
                setScreen={setSettingsScreen}
                name={name}
                setName={setName}
                username={tgUsername}
                photoUrl={tgPhotoUrl}
                roleLabel={roleLabel(role, language)}
                theme={theme}
                setTheme={setTheme}
                language={language}
                setLanguage={setLanguage}
                t={t}
                trainerProfile={trainerProfile}
                onSaveTrainerProfile={saveTrainerProfile}
                subscriptionTabLabel={tr("История тренировок", "Training history")}
                onDeleteProfile={handleDeleteProfile}
              />
            )}
              <div style={{ height: 14 }} />
            </div>

            <BottomNav
              active={activeTab}
              onChange={(t) => setActiveTab(t)}
              items={[
                { id: "home", label: t.navHome, icon: <IconHome /> },
                { id: "schedule", label: t.navSchedule, icon: <IconCalendar /> },
                { id: "clients", label: t.navClients, icon: <IconUsers /> },
                { id: "settings", label: t.navSettings, icon: <IconSettings /> },
              ]}
            />
          </div>
        </div>
      </LanguageContext.Provider>
    );
  }

  if (!clientConnected) {
    return (
      <LanguageContext.Provider value={language}>
        <div style={styles.appShell}>
          <GlobalStyles />
          <div style={styles.pageContainer}>
            <div style={styles.pageTitle}>{tr("Кабинет клиента", "Client workspace")}</div>
            <div style={{ opacity: 0.72, fontSize: 14, marginTop: 10 }}>
              {tr(
                "Введите инвайт-код, чтобы подключиться к тренеру.",
                "Enter an invite code to connect to a coach."
              )}
            </div>
            <div style={{ marginTop: 14 }}>
              <input
                value={clientInviteCode}
                onChange={(e) => {
                  setClientInviteCode(e.target.value);
                  if (clientInviteMessage) setClientInviteMessage("");
                }}
                placeholder={tr("Инвайт-код", "Invite code")}
                style={styles.input}
              />
              <button
                type="button"
                onClick={() => {
                  const code = (clientInviteCode || "").trim();
                  if (!code) {
                    setClientInviteMessage(tr("Введите инвайт-код.", "Enter an invite code."));
                    return;
                  }
                  if (code.toLowerCase() === UNIVERSAL_INVITE_CODE.toLowerCase()) {
                    setClientInviteMessage("");
                    setClientInviteCode("");
                    setClientConnected(true);
                    setClientTab("home");
                    try {
                      localStorage.setItem("clientConnected", "true");
                    } catch {
                      // ignore
                    }
                    return;
                  }
                  let found = false;
                  setInvites((prev) => {
                    const idx = prev.findIndex((c) => c.code.toLowerCase() === code.toLowerCase());
                    if (idx === -1) return prev;
                    found = true;
                    return prev.map((c, i) =>
                      i === idx ? { ...c, status: "active", archived: false } : c
                    );
                  });
                  if (!found) {
                    setClientInviteMessage(
                      tr("Код не найден. Проверь правильность.", "Code not found. Check it and try again.")
                    );
                    return;
                  }
                  setClientInviteMessage("");
                  setClientInviteCode("");
                  setClientConnected(true);
                  setClientTab("home");
                  try {
                    localStorage.setItem("clientConnected", "true");
                  } catch {
                    // ignore
                  }
                }}
                style={{ ...styles.primaryBtn, marginTop: 10 }}
              >
                {tr("Подключиться", "Connect")}
              </button>
              {clientInviteMessage ? (
                <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>{clientInviteMessage}</div>
              ) : null}
            </div>
          </div>
        </div>
      </LanguageContext.Provider>
    );
  }

  return (
    <LanguageContext.Provider value={language}>
      <div style={styles.appShell}>
        <GlobalStyles />
        <div style={styles.appFrame}>
          <div
            style={{
              ...scrollAreaStyle,
              overflowY: clientTab === "home" ? "hidden" : "auto",
              overscrollBehavior: clientTab === "home" ? "none" : "auto",
            }}
            data-scroll-area
          >
          {clientTab === "home" && (
            <ClientHome
              name={name}
              photoUrl={tgPhotoUrl}
              onOpenSettings={() => setClientTab("settings")}
            />
          )}
          {clientTab === "schedule" && <ClientSchedule invites={invites} t={t} />}
          {clientTab === "book" && (
            <ClientBook
              invites={invites}
              setInvites={setInvites}
              setClientConnected={setClientConnected}
              t={t}
            />
          )}
          {clientTab === "settings" && (
            <ClientSettings
              screen={clientSettingsScreen}
              setScreen={setClientSettingsScreen}
              name={name}
              setName={setName}
              username={tgUsername}
              photoUrl={tgPhotoUrl}
              roleLabel={roleLabel("client", language)}
              theme={theme}
              setTheme={setTheme}
              language={language}
              setLanguage={setLanguage}
              t={t}
              invites={invites}
              setInvites={setInvites}
              setClientConnected={setClientConnected}
              onDeleteProfile={handleDeleteProfile}
            />
          )}
          <div style={{ height: 14 }} />
        </div>
        <BottomNav
          active={clientTab}
          onChange={(t) => setClientTab(t as ClientTab)}
          items={[
            { id: "home", label: t.navHome, icon: <IconHome /> },
            { id: "schedule", label: t.navSchedule, icon: <IconCalendar /> },
            { id: "book", label: t.navMyTrainer, icon: <IconUser /> },
            { id: "settings", label: t.navSettings, icon: <IconSettings /> },
          ]}
        />
      </div>
    </div>
    </LanguageContext.Provider>
  );
}

function roleLabel(r: Exclude<Role, null>, language?: "ru" | "en") {
  const lang = language ?? currentLanguage;
  return lang === "en" ? (r === "trainer" ? "Trainer" : "Client") : r === "trainer" ? "Тренер" : "Клиент";
}

function getGreetingByTime(date = new Date(), language?: "ru" | "en") {
  const lang = language ?? currentLanguage;
  const hour = date.getHours();
  if (lang === "en") {
    if (hour >= 6 && hour < 12) return "Good morning";
    if (hour >= 12 && hour < 18) return "Good afternoon";
    if (hour >= 18 && hour < 24) return "Good evening";
    return "Good night";
  }
  if (hour >= 6 && hour < 12) return "Доброе утро";
  if (hour >= 12 && hour < 18) return "Добрый день";
  if (hour >= 18 && hour < 24) return "Добрый вечер";
  return "Доброй ночи";
}

function startOfWeekMonday(date: Date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeekMonday(date: Date) {
  const start = startOfWeekMonday(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function getSubscriptionStatus(endsAt: string, now: Date) {
  if (!endsAt || endsAt === "—") {
    return { label: trGlobal("Нет подписки", "No subscription"), color: "var(--muted)" };
  }
  const end = parseDateDMY(endsAt);
  if (!end) {
    return { label: trGlobal("Нет подписки", "No subscription"), color: "var(--muted)" };
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const diffDays = Math.ceil((endDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) {
    return { label: trGlobal("Нет подписки", "No subscription"), color: "var(--muted)" };
  }
  if (diffDays <= 3) {
    if (diffDays === 1) {
      return { label: trGlobal("Истекает завтра", "Expires tomorrow"), color: "#ef4444" };
    }
    return {
      label: trGlobal(`Истекает через ${diffDays} дня`, `Expires in ${diffDays} days`),
      color: diffDays === 2 ? "#f59e0b" : "#16a34a",
    };
  }
  return { label: trGlobal("Активна", "Active"), color: "#16a34a" };
}

// -----------------------
// Screens
// -----------------------
function TrainerHome({
  name,
  photoUrl,
  clients,
  sessionsByDate,
  onOpenSession,
  onOpenSettings,
}: {
  name: string;
  photoUrl: string;
  clients: TrainerClientInvite[];
  sessionsByDate: Record<string, SessionItem[]>;
  onOpenSession: (session: SessionItem) => void;
  onOpenSettings: () => void;
}) {
  const tr = useTr();
  const [homeTab, setHomeTab] = useState<"work" | "income" | "subscription">("work");
  const [statsMode, setStatsMode] = useState<"money" | "count">("money");
  const [statsDate, setStatsDate] = useState<Date>(() => startOfDay(new Date()));
  const [statsRange, setStatsRange] = useState<7 | 14>(7);
  const [statsInfoOpen, setStatsInfoOpen] = useState(false);
  const [statsRangeOpen, setStatsRangeOpen] = useState(false);
  const [financeHistoryOpen, setFinanceHistoryOpen] = useState(false);
  const now = new Date();
  const todayKey = formatDateKey(now);
  const allSessions = Object.values(sessionsByDate).flat();
  const doneSessions = allSessions.filter((s) => sessionEndTime(s).getTime() <= now.getTime());
  const upcoming = allSessions
    .filter((s) => sessionEndTime(s).getTime() > now.getTime())
    .sort((a, b) => sessionStartTime(a).getTime() - sessionStartTime(b).getTime());
  const nearest = upcoming[0] || null;
  const todaySessions = sessionsByDate[todayKey] || [];
  const todayCount = todaySessions.length;
  const todayRemaining = todaySessions.filter((s) => sessionEndTime(s).getTime() > now.getTime()).length;
  const weekStart = startOfWeekMonday(now);
  const weekEnd = endOfWeekMonday(now);
  const completedThisWeek = allSessions.filter((s) => {
    const end = sessionEndTime(s);
    return end.getTime() <= now.getTime() && end.getTime() >= weekStart.getTime() && end.getTime() <= weekEnd.getTime();
  }).length;
  const subscriptionNextBilling = tr("Неопределена", "Not set");
  const subscriptionEndsAt = "01.03.2026";
  const rawSubscriptionStatusInfo = getSubscriptionStatus(subscriptionEndsAt, now);
  const subscriptionStatusInfo =
    rawSubscriptionStatusInfo.label === tr("Нет подписки", "No subscription")
      ? rawSubscriptionStatusInfo
      : {
          ...rawSubscriptionStatusInfo,
          label: tr(
            `Подписка: ${rawSubscriptionStatusInfo.label.toLowerCase()}`,
            `Subscription: ${rawSubscriptionStatusInfo.label.toLowerCase()}`
          ),
        };
  const subscriptionPlanName = tr("Тестовый", "Test");
  const subscriptionConnectedClients = clients.filter((c) => !c.archived).length;
  const subscriptionClientLimitLabel = "∞";

  const statsDateKey = formatDateKey(statsDate);
  const statsSessions = sessionsByDate[statsDateKey] || [];
  const statsPlannedCount = statsSessions.length;
  const statsDateStart = startOfDay(statsDate);
  const todayStart = startOfDay(now);
  const statsMaxDate = addDays(todayStart, 1);
  const statsDateEffective =
    statsDateStart.getTime() > statsMaxDate.getTime() ? statsMaxDate : statsDateStart;
  const statsDoneCount =
    statsDateEffective.getTime() > todayStart.getTime()
      ? 0
      : statsSessions.filter((s) => sessionEndTime(s).getTime() <= now.getTime()).length;
  const statsPlannedMoney = statsSessions.reduce((sum, s) => sum + getSessionPrice(clients, s), 0);
  const statsDoneMoney = statsSessions
    .filter((s) => sessionEndTime(s).getTime() <= now.getTime())
    .reduce((sum, s) => sum + getSessionPrice(clients, s), 0);
  const statsPlannedValue = statsMode === "money" ? statsPlannedMoney : statsPlannedCount;
  const statsDoneValue = statsMode === "money" ? statsDoneMoney : statsDoneCount;
  const statsPrevDate = addDays(statsDateEffective, -7);
  const statsPrevKey = formatDateKey(statsPrevDate);
  const statsPrevSessions = sessionsByDate[statsPrevKey] || [];
  const statsPrevPlannedCount = statsPrevSessions.length;
  const statsPrevPlannedMoney = statsPrevSessions.reduce((sum, s) => sum + getSessionPrice(clients, s), 0);
  const statsPrevDoneCount = statsPrevSessions.filter((s) => sessionEndTime(s).getTime() <= now.getTime()).length;
  const statsPrevDoneMoney = statsPrevSessions
    .filter((s) => sessionEndTime(s).getTime() <= now.getTime())
    .reduce((sum, s) => sum + getSessionPrice(clients, s), 0);
  const statsPrevPlannedValue = statsMode === "money" ? statsPrevPlannedMoney : statsPrevPlannedCount;
  const statsPrevDoneValue = statsMode === "money" ? statsPrevDoneMoney : statsPrevDoneCount;
  const statsSeriesDays = Array.from({ length: statsRange }, (_, idx) =>
    addDays(statsDateEffective, idx - (statsRange - 1))
  );
  const statsSeries = statsSeriesDays.map((d) => {
    const key = formatDateKey(d);
    const sessions = sessionsByDate[key] || [];
    const plannedCount = sessions.length;
    const plannedMoney = sessions.reduce((sum, s) => sum + getSessionPrice(clients, s), 0);
    const doneCount =
      startOfDay(d).getTime() > todayStart.getTime()
        ? 0
        : sessions.filter((s) => sessionEndTime(s).getTime() <= now.getTime()).length;
    const doneMoney = sessions
      .filter((s) => sessionEndTime(s).getTime() <= now.getTime())
      .reduce((sum, s) => sum + getSessionPrice(clients, s), 0);
    const plannedValue = statsMode === "money" ? plannedMoney : plannedCount;
    const doneValue = statsMode === "money" ? doneMoney : doneCount;
    return {
      date: d,
      label: String(d.getDate()).padStart(2, "0"),
      plannedValue,
      doneValue,
    };
  });
  const statsBaseline = statsMode === "money" ? 1000 : 1;
  const statsSeriesMax = Math.max(
    0,
    ...statsSeries.map((item) => Math.max(item.plannedValue, item.doneValue))
  );
  const statsChartMax = Math.max(
    statsSeriesMax,
    statsBaseline * 2,
    statsMode === "money" ? 2000 : 2
  );
  const statsDateLabel = formatDateShortMonth(statsDateEffective);
  const statsAxisTopLabel = statsMode === "money" ? tr("1 т.р.", "1k") : "1";
  const statsBaselineRatio = statsChartMax > 0 ? statsBaseline / statsChartMax : 0;
  const statsChartHeight = 170;
  const statsPrevLabel = formatDateShortMonth(statsPrevDate);
  const getStatsTrend = (current: number, prev: number) => {
    if (prev === 0) {
      if (current === 0) {
        return { dir: 0, pct: 0 };
      }
      return { dir: 1, pct: 100 };
    }
    const diff = current - prev;
    const dir = diff > 0 ? 1 : diff < 0 ? -1 : 0;
    const pct = Math.round((Math.abs(diff) / prev) * 100);
    return { dir, pct };
  };
  const plannedTrend = getStatsTrend(statsPlannedValue, statsPrevPlannedValue);
  const doneTrend = getStatsTrend(statsDoneValue, statsPrevDoneValue);
  const renderStatsTrend = (trend: { dir: number; pct: number }) => {
    const color = trend.dir > 0 ? "#16A34A" : trend.dir < 0 ? "#DC2626" : "var(--muted)";
    const icon = trend.dir > 0 ? "↑" : trend.dir < 0 ? "↓" : "→";
    return (
      <div style={styles.statsSummarySub}>
        <span style={{ ...styles.statsSummaryTrendIcon, color }}>{icon}</span>
        <span style={{ ...styles.statsSummaryTrendValue, color }}>{trend.pct}%</span>
        <span style={styles.statsSummaryTrendLabel}>{tr("к", "vs")} {statsPrevLabel}</span>
      </div>
    );
  };
  const financeMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const financeMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const financeMonthDone = doneSessions.filter((s) => {
    const end = sessionEndTime(s);
    return end.getTime() >= financeMonthStart.getTime() && end.getTime() < financeMonthEnd.getTime();
  });
  const financeBalance = financeMonthDone.reduce((sum, s) => sum + getSessionPrice(clients, s), 0);
  const financeHistoryMap = new Map<string, { year: number; month: number; count: number; amount: number }>();
  doneSessions.forEach((s) => {
    const end = sessionEndTime(s);
    const year = end.getFullYear();
    const month = end.getMonth();
    const key = `${year}-${month}`;
    const prev = financeHistoryMap.get(key) || { year, month, count: 0, amount: 0 };
    prev.count += 1;
    prev.amount += getSessionPrice(clients, s);
    financeHistoryMap.set(key, prev);
  });
  const financeHistory = Array.from(financeHistoryMap.values())
    .sort((a, b) => (a.year === b.year ? b.month - a.month : b.year - a.year))
    .map((item) => {
      const label = new Intl.DateTimeFormat(currentLanguage === "en" ? "en-US" : "ru-RU", {
        month: "long",
        year: "numeric",
      }).format(new Date(item.year, item.month, 1));
      return {
        ...item,
        label: label.charAt(0).toUpperCase() + label.slice(1),
      };
    });

  const formatNearestTime = (s: SessionItem) => {
    const startDate = parseDateKey(s.dateKey);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const sessionDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    let prefix = formatDateShort(startDate);
    if (sessionDay.getTime() === today.getTime()) prefix = tr("Сегодня", "Today");
    else if (sessionDay.getTime() === tomorrow.getTime()) prefix = tr("Завтра", "Tomorrow");
    return `${prefix} ${s.start}—${s.end}`;
  };

  return (
    <div style={styles.pageContainer}>
      <div style={styles.homeIntro}>
        <div style={styles.homeAvatarRow}>
          <button
            type="button"
            onClick={onOpenSettings}
            style={styles.homeAvatarBtn}
            aria-label={tr("настройки", "settings")}
          >
            <AvatarCircle name={name || tr("Пользователь", "User")} photoUrl={photoUrl} size={44} />
          </button>
          <div style={styles.homeStatusChip}>
            <span style={{ color: subscriptionStatusInfo.color }}>{subscriptionStatusInfo.label}</span>
          </div>
        </div>
        <div style={styles.scheduleTabs}>
          <button
            type="button"
            onClick={() => setHomeTab("work")}
            style={{
              ...styles.scheduleTab,
              ...(homeTab === "work" ? styles.scheduleTabActive : null),
            }}
          >
            {tr("Рабочий экран", "Workspace")}
          </button>
        <button
          type="button"
          onClick={() => setHomeTab("income")}
          style={{
            ...styles.scheduleTab,
            ...(homeTab === "income" ? styles.scheduleTabActive : null),
          }}
        >
          {tr("Статистика", "Stats")}
        </button>
          <button
            type="button"
            onClick={() => setHomeTab("subscription")}
            style={{
              ...styles.scheduleTab,
              ...(homeTab === "subscription" ? styles.scheduleTabActive : null),
            }}
          >
            {tr("Моя подписка", "My subscription")}
          </button>
        </div>
        <div style={{ borderTop: "1px solid var(--border-2)", marginTop: 4 }} />
        {homeTab === "work" ? (
          <>
            <div style={styles.homeGreeting}>
              {getGreetingByTime()}, {name || tr("Пользователь", "User")}
            </div>
            <div style={styles.homeNextBlock}>
              <div style={styles.homeNextTitle}>{tr("Ближайшее занятие", "Next session")}</div>
              {nearest ? (
                <>
                  <button
                    type="button"
                    className="home-next-card"
                    style={styles.homeNextCard}
                    onClick={() => onOpenSession(nearest)}
                  >
                    <div style={styles.homeNextRow}>
                      <div style={styles.homeNextTime}>{formatNearestTime(nearest)}</div>
                      <div style={{ ...styles.homeNextStatus, color: sessionStatusColor(nearest, now) }}>
                        {sessionStatusLabel(nearest, now)}
                      </div>
                    </div>
                    <div style={styles.homeNextMeta}>{getClientLabel(clients, nearest.clientUsername)}</div>
                  </button>
                  <div style={styles.homeNextContactRow}>
                    <div style={styles.homeNextContactLabel}>
                      {tr("Связаться с клиентом:", "Contact the client:")}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const handle = nearest.clientUsername?.trim();
                        if (!handle) return;
                        const link = `https://t.me/${handle.replace(/^@/, "")}`;
                        if (typeof WebApp?.openTelegramLink === "function") {
                          WebApp.openTelegramLink(link);
                        } else {
                          window.open(link, "_blank");
                        }
                      }}
                      style={styles.homeNextContactLink}
                    >
                      @{nearest.clientUsername}
                    </button>
                  </div>
                </>
              ) : (
                <div style={styles.homeNextEmpty}>
                  {tr("У вас пока нет запланированных занятий", "You don't have any scheduled sessions yet")}
                </div>
              )}
            </div>
            {todayCount > 0 ? (
              <div style={styles.homeTodayBlock}>
                <div style={styles.homeNextTitle}>{tr("Тренировки сегодня", "Today's sessions")}</div>
                <div style={styles.homeTodayCard}>
                  <div style={styles.homeTodayGrid}>
                    <div style={styles.homeTodayRow}>
                      <span>{tr("Запланировано", "Planned")}</span>
                      <span>{tr("Осталось", "Remaining")}</span>
                    </div>
                    <div style={styles.homeTodayRowValues}>
                      <span>{todayCount}</span>
                      <span>{todayRemaining}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            {completedThisWeek > 0 ? (
              <div style={styles.homeWeekBlock}>
                <div style={styles.homeNextTitle}>{tr("Тренировок за неделю", "Sessions this week")}</div>
                <div style={styles.homeWeekCard}>
                  <div style={styles.homeWeekValue}>{completedThisWeek}</div>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
        {homeTab === "income" ? (
          <div style={styles.statsBlock}>
            <div style={styles.statsHeader}>
              <div style={styles.statsHeaderLeft} />
              <div style={styles.statsHeaderRight}>
                <button
                  type="button"
                  style={styles.statsRangeBtn}
                  onClick={() => setStatsRangeOpen((prev) => !prev)}
                >
                  ⏱
                </button>
                <button type="button" style={styles.statsInfo} onClick={() => setStatsInfoOpen(true)}>
                  i
                </button>
                {statsRangeOpen ? (
                  <div style={styles.statsRangeMenu}>
                    {[7, 14].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setStatsRange(value as 7 | 14);
                          setStatsRangeOpen(false);
                        }}
                        style={{
                          ...styles.statsRangeOption,
                          ...(statsRange === value ? styles.statsRangeOptionActive : null),
                        }}
                      >
                        {tr(`${value} дней`, `${value} days`)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <div style={styles.statsControls}>
              <div style={styles.statsModeGroup}>
                <button
                  type="button"
                  onClick={() => setStatsMode("money")}
                  style={{
                    ...styles.statsModeBtn,
                    ...(statsMode === "money" ? styles.statsModeBtnActive : null),
                  }}
                >
                  ₽
                </button>
                <button
                  type="button"
                  onClick={() => setStatsMode("count")}
                  style={{
                    ...styles.statsModeBtn,
                    ...(statsMode === "count" ? styles.statsModeBtnActive : null),
                  }}
                >
                  {tr("Штуки", "Count")}
                </button>
              </div>
              <div style={styles.statsDatePicker}>
                <button
                  type="button"
                  style={styles.statsDateBtn}
                  onClick={() => setStatsDate((prev) => addDays(prev, -1))}
                >
                  ‹
                </button>
                <div style={styles.statsDateLabel}>{statsDateLabel}</div>
                <button
                  type="button"
                  style={{
                    ...styles.statsDateBtn,
                    opacity: statsDateStart.getTime() >= statsMaxDate.getTime() ? 0.4 : 1,
                    cursor: statsDateStart.getTime() >= statsMaxDate.getTime() ? "not-allowed" : "pointer",
                  }}
                  disabled={statsDateStart.getTime() >= statsMaxDate.getTime()}
                  onClick={() =>
                    setStatsDate((prev) => {
                      const next = addDays(prev, 1);
                      return next.getTime() > statsMaxDate.getTime() ? statsMaxDate : next;
                    })
                  }
                >
                  ›
                </button>
              </div>
            </div>
            <div style={styles.statsSummary}>
              <div style={styles.statsSummaryItem}>
                <div style={styles.statsSummaryLabel}>
                  <span style={{ ...styles.statsSummaryDot, background: "#D7DEE8" }} />
                  {tr("Запланировано", "Planned")}
                </div>
                <div style={styles.statsSummaryValue}>
                  {statsMode === "money" ? formatMoney(statsPlannedValue) : statsPlannedValue}
                </div>
                {renderStatsTrend(plannedTrend)}
              </div>
              <div style={styles.statsSummaryItem}>
                <div style={styles.statsSummaryLabel}>
                  <span style={{ ...styles.statsSummaryDot, background: "#1E6BFF" }} />
                  {tr("Проведено", "Completed")}
                </div>
                <div style={styles.statsSummaryValue}>
                  {statsMode === "money" ? formatMoney(statsDoneValue) : statsDoneValue}
                </div>
                {renderStatsTrend(doneTrend)}
              </div>
            </div>
            <div style={styles.statsChart}>
              <div style={styles.statsChartGrid}>
                <div style={styles.statsGridLine} />
                <div style={{ ...styles.statsGridLine, top: "auto", bottom: `${statsBaselineRatio * 100}%` }} />
                <div style={{ ...styles.statsAxisLabelTop, bottom: `${statsBaselineRatio * 100}%` }}>
                  {statsAxisTopLabel}
                </div>
                <div style={styles.statsAxisLabelBottom}>0</div>
                <div
                  style={{
                    ...styles.statsBarsRow,
                    display: "grid",
                    gridTemplateColumns: `repeat(${statsRange}, minmax(0, 1fr))`,
                    gap: statsRange === 14 ? 4 : 6,
                    padding: "0 24px 0 0px",
                  }}
                >
                  {statsSeries.map((item) => {
                    const isSelected = isSameDay(item.date, statsDateEffective);
                    const plannedHeight = Math.max(
                      6,
                      Math.min(statsChartHeight, (item.plannedValue / statsChartMax) * statsChartHeight)
                    );
                    const doneRatio = item.plannedValue > 0 ? item.doneValue / item.plannedValue : 0;
                    const doneHeight =
                      item.doneValue > 0
                        ? Math.max(6, Math.min(plannedHeight, doneRatio * plannedHeight))
                        : 0;
                    return (
                      <button
                        key={item.label + item.date.getMonth()}
                        type="button"
                        onClick={() => setStatsDate(item.date)}
                        style={styles.statsBarColButton}
                        aria-label={tr(`Выбрать дату ${item.label}`, `Select date ${item.label}`)}
                      >
                        <div
                          style={{
                            ...(isSelected ? styles.statsBarShellActive : styles.statsBarShell),
                            height: item.plannedValue > 0 ? `${plannedHeight}px` : 0,
                            opacity: item.plannedValue > 0 ? 1 : 0,
                          }}
                        >
                          {doneHeight > 0 ? (
                            <div
                              style={{
                                ...styles.statsBarFill,
                                height: `${doneHeight}px`,
                              }}
                            />
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div
                style={{
                  ...styles.statsDaysRow,
                  display: "grid",
                  gridTemplateColumns: `repeat(${statsRange}, minmax(0, 1fr))`,
                  gap: statsRange === 14 ? 4 : 6,
                  fontSize: statsRange === 14 ? 11 : 12,
                }}
              >
                {statsSeries.map((item) => {
                  const isSelected = isSameDay(item.date, statsDateEffective);
                  return (
                    <div
                      key={item.label + item.date.getMonth()}
                      style={isSelected ? styles.statsDayActive : styles.statsDay}
                    >
                      {item.label}
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={styles.financeBlock}>
              <div style={styles.financeHeader}>
                <div style={styles.financeTitle}>{tr("Финансы", "Finance")}</div>
              </div>
              <div style={styles.financeCard}>
                <div>
                  <div style={styles.financeLabel}>{tr("Текущий баланс", "Current balance")}</div>
                  <div style={styles.financeValue}>{formatMoney(financeBalance)}</div>
                </div>
                <button type="button" style={styles.financeBtn} onClick={() => setFinanceHistoryOpen(true)}>
                  {tr("История", "History")}
                </button>
              </div>
            </div>
            {statsInfoOpen ? (
              <div style={styles.statsInfoOverlay} onClick={() => setStatsInfoOpen(false)}>
                <div style={styles.statsInfoSheet} onClick={(event) => event.stopPropagation()}>
                  <button type="button" style={styles.statsInfoClose} onClick={() => setStatsInfoOpen(false)}>
                    ×
                  </button>
                  <div style={styles.statsInfoTitle}>{tr("Запланировано", "Planned")}</div>
                  <div style={styles.statsInfoText}>
                    {tr(
                      "Общая стоимость или количество запланированных тренировок за период - без учета отмен.",
                      "Total value or count of planned sessions for the period, excluding cancellations."
                    )}
                  </div>
                  <div style={styles.statsInfoTitleRow}>
                    <span style={{ ...styles.statsSummaryDot, background: "#1E6BFF" }} />
                    {tr("Проведено", "Completed")}
                  </div>
                  <div style={styles.statsInfoText}>
                    {tr(
                      "Общая сумма оплат за тренировки или количество тренировок, которые уже завершились на настоящий период времени.",
                      "Total payments or count of sessions that have already been completed in the current period."
                    )}
                  </div>
                </div>
              </div>
            ) : null}
            {financeHistoryOpen ? (
              <div style={styles.statsInfoOverlay} onClick={() => setFinanceHistoryOpen(false)}>
                <div style={styles.financeSheet} onClick={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    style={styles.statsInfoClose}
                    onClick={() => setFinanceHistoryOpen(false)}
                  >
                    ×
                  </button>
                  <div style={styles.financeSheetTitle}>{tr("История", "History")}</div>
                  {financeHistory.length ? (
                    <div style={styles.financeHistoryList}>
                      {financeHistory.map((item) => (
                        <div key={`${item.year}-${item.month}`} style={styles.financeHistoryItem}>
                          <div style={styles.financeHistoryMonth}>{item.label}</div>
                          <div style={styles.financeHistoryMeta}>
                            {tr("Проведено", "Completed")}: {item.count}
                          </div>
                          <div style={styles.financeHistoryMeta}>
                            {tr("Сумма", "Amount")}: {formatMoney(item.amount)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={styles.financeEmpty}>{tr("Пока нет данных", "No data yet")}</div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        {homeTab === "subscription" ? (
          <>
            <div style={styles.homeSubscriptionBlock}>
              <div style={styles.homeNextTitle}>{tr("Текущий статус подписки", "Subscription status")}</div>
              <div style={styles.homeSubscriptionRow}>
                <div style={styles.homeSubscriptionLabel}>{tr("Статус", "Status")}</div>
                <div style={{ ...styles.homeSubscriptionValue, color: subscriptionStatusInfo.color }}>
                  {subscriptionStatusInfo.label}
                </div>
              </div>
              <div style={styles.homeSubscriptionRow}>
                <div style={styles.homeSubscriptionLabel}>{tr("Тарифный план", "Plan")}</div>
                <div style={styles.homeSubscriptionValue}>{subscriptionPlanName}</div>
              </div>
              <div style={styles.homeSubscriptionRow}>
                <div style={styles.homeSubscriptionLabel}>{tr("Дата следующего списания", "Next charge date")}</div>
                <div style={styles.homeSubscriptionValue}>{subscriptionNextBilling}</div>
              </div>
              <div style={styles.homeSubscriptionRow}>
              <div style={styles.homeSubscriptionLabel}>{tr("Подключено клиентов", "Connected clients")}</div>
              <div style={styles.homeSubscriptionValue}>
                {subscriptionConnectedClients} {tr("из", "of")} {subscriptionClientLimitLabel}
              </div>
            </div>
            </div>
            <div style={styles.topBarDivider} />
            <div style={{ ...styles.sectionHeader, marginTop: -10 }}>{tr("Тарифные планы", "Plans")}</div>
            <div style={styles.tariffScroller}>
              <div style={styles.tariffCard}>
                <div style={{ ...styles.tariffBadge, background: "rgba(77, 163, 255, 0.18)", color: "var(--text)" }}>
                  {tr("Тестовый", "Test")}
                </div>
                <div style={styles.tariffPriceRow}>
                  <span style={styles.tariffPrice}>0 ₽</span>
                  <span style={styles.tariffPriceStrike}>4 990 ₽</span>
                </div>
                <div style={styles.tariffPeriod}>{tr("в месяц", "per month")}</div>
                <div style={styles.tariffFeatures}>
                  {[
                    tr(
                      "Неограниченный доступ ко всем функциям\nприложения",
                      "Unlimited access to all app features"
                    ),
                    tr("Безлимит клиентов", "Unlimited clients"),
                    tr("Безлимит тренировок", "Unlimited sessions"),
                  ].map((item) => (
                    <div key={item} style={styles.tariffFeatureRow}>
                      <span style={styles.tariffDot} />
                      <span style={{ whiteSpace: "pre-line" }}>{item}</span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  style={{ ...styles.tariffChoose, borderColor: "var(--primary)", color: "var(--primary)" }}
                >
                  {tr("Выбран", "Selected")}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function ClientHome(props: { name: string; photoUrl: string; onOpenSettings: () => void }) {
  const { name, photoUrl, onOpenSettings } = props;
  const tr = useTr();
  const [nearest] = useState<SessionItem | null>(null);
  const todayCount = 0;
  const todayRemaining = 0;
  const completedThisWeek = 0;

  return (
    <div style={styles.pageContainer}>
      <div style={styles.homeIntro}>
        <div style={styles.homeAvatarRow}>
          <button
            type="button"
            onClick={onOpenSettings}
            style={styles.homeAvatarBtn}
            aria-label={tr("настройки", "settings")}
          >
            <AvatarCircle name={name || tr("Пользователь", "User")} photoUrl={photoUrl} size={44} />
          </button>
          <div />
        </div>
        <div style={styles.homeGreeting}>
          {getGreetingByTime()}, {name || tr("Пользователь", "User")}
        </div>
        <div style={styles.homeNextBlock}>
          <div style={styles.homeNextTitle}>{tr("Ближайшее занятие", "Next session")}</div>
          {nearest ? (
            <div style={styles.homeNextCard}>
              <div style={styles.homeNextRow}>
                <div style={styles.homeNextTime}>{`${nearest.start}—${nearest.end}`}</div>
                <div style={{ ...styles.homeNextStatus, color: sessionStatusColor(nearest, new Date()) }}>
                  {sessionStatusLabel(nearest, new Date())}
                </div>
              </div>
              <div style={styles.homeNextMeta}>{tr("Тренировка", "Session")}</div>
            </div>
          ) : (
            <div style={styles.homeNextEmpty}>
              {tr("У вас пока нет запланированных занятий", "You don't have any scheduled sessions yet")}
            </div>
          )}
        </div>
        {todayCount > 0 ? (
          <div style={styles.homeTodayBlock}>
            <div style={styles.homeNextTitle}>{tr("Тренировки сегодня", "Today's sessions")}</div>
            <div style={styles.homeTodayCard}>
              <div style={styles.homeTodayGrid}>
                <div style={styles.homeTodayRow}>
                  <span>{tr("Запланировано", "Planned")}</span>
                  <span>{tr("Осталось", "Remaining")}</span>
                </div>
                <div style={styles.homeTodayRowValues}>
                  <span>{todayCount}</span>
                  <span>{todayRemaining}</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {completedThisWeek > 0 ? (
          <div style={styles.homeWeekBlock}>
            <div style={styles.homeNextTitle}>{tr("Тренировок за неделю", "Sessions this week")}</div>
            <div style={styles.homeWeekCard}>
              <div style={styles.homeWeekValue}>{completedThisWeek}</div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ClientSchedule(props: { invites: TrainerClientInvite[]; t: UiText }) {
  const { invites, t } = props;
  const tr = useTr();
  const [today, setToday] = useState<Date>(() => startOfDay(new Date()));
  const [selected, setSelected] = useState<Date>(() => startOfDay(new Date()));
  const [section, setSection] = useState<"today" | "book" | "history">("today");
  const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const todayRef = useRef<HTMLButtonElement | null>(null);
  const selectedRef = useRef<HTMLButtonElement | null>(null);
  const trainers = invites.filter((c) => !c.archived && c.status === "active");

  useEffect(() => {
    const tick = () => setToday(startOfDay(new Date()));
    tick();
    const id = window.setInterval(tick, 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  const days = useMemo(() => buildCalendarStrip(today, 30, 30), [today]);

  useEffect(() => {
    if (!todayRef.current || !scrollerRef.current) return;
    const el = todayRef.current;
    const scroller = scrollerRef.current;
    const left = el.offsetLeft - scroller.clientWidth / 2 + el.clientWidth / 2;
    scroller.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [days]);

  useEffect(() => {
    if (!selectedRef.current || !scrollerRef.current) return;
    const el = selectedRef.current;
    const scroller = scrollerRef.current;
    const left = el.offsetLeft - scroller.clientWidth / 2 + el.clientWidth / 2;
    scroller.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [selected, days]);

  useEffect(() => {
    if (section !== "book") return;
    if (!trainers.length) {
      setSelectedTrainerId(null);
      return;
    }
    if (selectedTrainerId && trainers.some((t) => t.id === selectedTrainerId)) return;
    setSelectedTrainerId(trainers[0].id);
  }, [section, trainers, selectedTrainerId]);

  return (
    <div style={styles.pageContainer}>
      <div style={styles.scheduleHeaderRow}>
        <div style={styles.pageTitle}>{t.scheduleTitle}</div>
        {section === "book" ? (
          <div style={styles.trainerSelectWrap}>
            <div style={styles.trainerSelectLabel}>{tr("Тренер", "Coach")}</div>
            <select
              value={selectedTrainerId ?? ""}
              onChange={(e) => setSelectedTrainerId(e.target.value || null)}
              style={styles.trainerSelect}
              disabled={trainers.length <= 1}
              aria-label={tr("Выбрать тренера", "Choose coach")}
            >
              {trainers.length === 0 ? (
                <option value="">{tr("Нет тренеров", "No coaches")}</option>
              ) : (
                trainers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName?.trim()
                      ? t.fullName
                      : t.username
                      ? `@${t.username}`
                      : tr("Тренер", "Coach")}
                  </option>
                ))
              )}
            </select>
          </div>
        ) : null}
      </div>

      <div ref={scrollerRef} style={styles.calendarStrip}>
        {days.map((d) => {
          const isToday = isSameDay(d.date, today);
          const isSelected = isSameDay(d.date, selected);
          const isPast = d.date.getTime() < today.getTime();

          return (
            <button
              key={d.key}
              ref={isSelected ? selectedRef : isToday ? todayRef : null}
              onClick={() => setSelected(d.date)}
              style={{
                ...styles.calendarDay,
                ...(isToday ? styles.calendarDayActive : {}),
                ...(isSelected && !isToday ? styles.calendarDaySelected : {}),
                ...(isPast ? styles.calendarDayPast : {}),
              }}
              aria-current={isToday ? "date" : undefined}
              type="button"
            >
              <div style={styles.calendarDayDate}>{d.dateText}</div>
            </button>
          );
        })}
      </div>

      <div style={styles.scheduleTabs}>
        <button
          type="button"
          onClick={() => setSection("today")}
          style={{
            ...styles.scheduleTab,
            ...(section === "today" ? styles.scheduleTabActive : null),
          }}
        >
          {t.scheduleToday}
        </button>
        <button
          type="button"
          onClick={() => setSection("book")}
          style={{
            ...styles.scheduleTab,
            ...(section === "book" ? styles.scheduleTabActive : null),
          }}
        >
          {t.scheduleBook}
        </button>
        <button
          type="button"
          onClick={() => setSection("history")}
          style={{
            ...styles.scheduleTab,
            ...(section === "history" ? styles.scheduleTabActive : null),
          }}
        >
          {t.scheduleHistory}
        </button>
      </div>
      <div style={styles.scheduleTabsDivider} />

      <div style={styles.schedulePanelPlain}>
        <div style={styles.schedulePanelBody}>{tr("Пока заглушка.", "Placeholder for now.")}</div>
      </div>
    </div>
  );
}

function ClientBook(props: {
  invites: TrainerClientInvite[];
  setInvites: React.Dispatch<React.SetStateAction<TrainerClientInvite[]>>;
  setClientConnected: (v: boolean) => void;
  t: UiText;
}) {
  const { invites, setInvites, setClientConnected, t } = props;
  const tr = useTr();
  const [section, setSection] = useState<"list" | "add">("list");
  const [view, setView] = useState<"tabs" | "detail">("tabs");
  const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(null);
  const hasTgBack = typeof WebApp?.BackButton?.show === "function";
  const trainersToShow = invites.filter((c) => !c.archived && c.status === "active");
  const selectedTrainer =
    selectedTrainerId ? trainersToShow.find((t) => t.id === selectedTrainerId) : null;

  useEffect(() => {
    if (!hasTgBack) return;
    if (view !== "detail") {
      try {
        WebApp.BackButton.hide();
      } catch {
        // ignore
      }
      return;
    }
    const handler = () => {
      setView("tabs");
      setSelectedTrainerId(null);
    };
    WebApp.BackButton.show();
    WebApp.BackButton.onClick(handler);
    return () => {
      try {
        WebApp.BackButton.offClick(handler);
      } catch {
        // ignore
      }
    };
  }, [hasTgBack, view]);

  if (view === "detail" && selectedTrainer) {
    return (
      <ClientTrainerDetailScreen
        trainer={selectedTrainer}
        onBack={() => {
          setView("tabs");
          setSelectedTrainerId(null);
        }}
      />
    );
  }

  return (
    <div style={styles.pageContainer}>
      <div style={styles.pageTitle}>{t.myTrainerTitle}</div>
      <div style={styles.scheduleTabs}>
        <button
          type="button"
          onClick={() => {
            setSection("list");
            setView("tabs");
          }}
          style={{
            ...styles.scheduleTab,
            ...(section === "list" ? styles.scheduleTabActive : null),
          }}
        >
          {t.myTrainersTab}
        </button>
        <button
          type="button"
          onClick={() => {
            setSection("add");
            setView("tabs");
          }}
          style={{
            ...styles.scheduleTab,
            ...(section === "add" ? styles.scheduleTabActive : null),
          }}
        >
          {t.addTrainerTab}
        </button>
      </div>
      {section === "list" ? (
        <div style={{ marginTop: 14 }}>
          <div style={styles.listBlock}>
            {trainersToShow.map((trainer, idx) => {
              const isLast = idx === trainersToShow.length - 1;
              const label =
                trainer.fullName?.trim()
                    ? trainer.fullName
                    : trainer.username
                      ? `@${trainer.username}`
                    : tr("Тренер", "Coach");
              return (
                <div
                  key={trainer.id}
                  style={{
                    ...styles.rowWrap,
                    borderBottom: isLast ? "none" : "1px solid var(--border-2)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTrainerId(trainer.id);
                      setView("detail");
                    }}
                    style={styles.rowBtnNoBorder}
                  >
                    <div style={styles.rowLeft}>
                      <div style={styles.userIconBtn}>
                        <IconUser />
                      </div>
                      <div style={{ textAlign: "left" }}>
                        <div style={styles.rowTitle}>{label}</div>
                        <div style={styles.rowSubtitle}>
                          {trainer.status === "active"
                            ? tr("Активен", "Active")
                            : tr("Ожидает активации", "Pending activation")}
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <ClientTrainerConnectScreen
          showTopBar={false}
          embedded
          onBack={() => setSection("list")}
          invites={invites}
          setInvites={setInvites}
          onConnected={() => {
            setClientConnected(true);
            setSection("list");
          }}
        />
      )}
    </div>
  );
}

function ClientSettings(props: {
  screen: SettingsScreen;
  setScreen: (s: SettingsScreen) => void;
  name: string;
  setName: (v: string) => void;
  username: string;
  photoUrl: string;
  roleLabel: string;
  theme: "light" | "dark";
  setTheme: (t: "light" | "dark") => void;
  language: "ru" | "en";
  setLanguage: (v: "ru" | "en") => void;
  t: UiText;
  invites: TrainerClientInvite[];
  setInvites: React.Dispatch<React.SetStateAction<TrainerClientInvite[]>>;
  setClientConnected: (v: boolean) => void;
  onDeleteProfile: () => void;
}) {
  const { screen, setScreen, invites, setInvites, setClientConnected, onDeleteProfile, ...rest } = props;
  const tr = useTr();

  return (
    <TrainerSettings
      {...rest}
      screen={screen}
      setScreen={setScreen}
      personalShowSubscription
      personalShowExtendedAbout={false}
      personalShowClientBasics
      personalShowClientWeights
      showBookingRow={false}
      aboutCardText={tr(
        "Здесь находится информация о вас, которая будет видна вашим тренерам!",
        "This is your info that will be visible to your coaches."
      )}
      subscriptionTabLabel={tr("Мой абонемент", "My subscription")}
      subscriptionItems={invites}
      onDeleteProfile={onDeleteProfile}
    />
  );
}

function TrainerSchedule(props: {
  clients: TrainerClientInvite[];
  setClients: React.Dispatch<React.SetStateAction<TrainerClientInvite[]>>;
  historyByClient: Record<string, SessionItem[]>;
  sessionsByDate: Record<string, SessionItem[]>;
  setSessionsByDate: React.Dispatch<React.SetStateAction<Record<string, SessionItem[]>>>;
  pendingSession?: SessionItem | null;
  onConsumePendingSession?: () => void;
  onSaveExercises?: (clientId: string, exercises: { id: string; name: string; weight: string }[]) => void;
}) {
  const {
    clients,
    setClients,
    historyByClient,
    sessionsByDate,
    setSessionsByDate,
    pendingSession,
    onConsumePendingSession,
    onSaveExercises,
  } = props;
  const tr = useTr();
  const hasTgBack = typeof WebApp?.BackButton?.show === "function";
  const [today, setToday] = useState<Date>(() => startOfDay(new Date()));
  const [selected, setSelected] = useState<Date>(() => startOfDay(new Date()));
  const [scheduleScreen, setScheduleScreen] = useState<"list" | "session">("list");
  const [activeSession, setActiveSession] = useState<SessionItem | null>(null);
  const [sessionTab, setSessionTab] = useState<"info" | "weights" | "history">("info");
  const sessionCommentRef = useRef<HTMLTextAreaElement | null>(null);
  const [showSessionExerciseForm, setShowSessionExerciseForm] = useState(false);
  const [draftSessionExerciseName, setDraftSessionExerciseName] = useState("");
  const [draftSessionExerciseWeight, setDraftSessionExerciseWeight] = useState("");

  useEffect(() => {
    if (!pendingSession) return;
    setActiveSession(pendingSession);
    setScheduleScreen("session");
    setSessionTab("info");
    onConsumePendingSession?.();
  }, [pendingSession, onConsumePendingSession]);

  useEffect(() => {
    if (!hasTgBack) return;
    if (scheduleScreen !== "session") {
      try {
        WebApp.BackButton.hide();
      } catch {
        // ignore
      }
      return;
    }

    const handler = () => {
      setScheduleScreen("list");
      setActiveSession(null);
    };
    WebApp.BackButton.show();
    WebApp.BackButton.onClick(handler);
    return () => {
      try {
        WebApp.BackButton.offClick(handler);
      } catch {
        // ignore
      }
    };
  }, [hasTgBack, scheduleScreen]);
  const [sessionExerciseError, setSessionExerciseError] = useState("");
  const [section, setSection] = useState<"sessions" | "free">("sessions");
  const [freeByDate, setFreeByDate] = useState<Record<string, FreeWindow[]>>({});
  const [showAddFree, setShowAddFree] = useState(false);
  const [freeStart, setFreeStart] = useState("");
  const [freeEnd, setFreeEnd] = useState("");
  const [freeError, setFreeError] = useState("");
  const [assignForId, setAssignForId] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const todayRef = useRef<HTMLButtonElement | null>(null);
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const tick = () => setToday(startOfDay(new Date()));
    tick();
    const id = window.setInterval(tick, 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const el = sessionCommentRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [activeSession?.comment, sessionTab, scheduleScreen]);

  const days = useMemo(() => buildCalendarStrip(today, 30, 30), [today]);

  useEffect(() => {
    if (!todayRef.current || !scrollerRef.current) return;
    const el = todayRef.current;
    const scroller = scrollerRef.current;
    const left = el.offsetLeft - scroller.clientWidth / 2 + el.clientWidth / 2;
    scroller.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [days]);

  useEffect(() => {
    if (!selectedRef.current || !scrollerRef.current) return;
    const el = selectedRef.current;
    const scroller = scrollerRef.current;
    const left = el.offsetLeft - scroller.clientWidth / 2 + el.clientWidth / 2;
    scroller.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [selected, days]);

  if (scheduleScreen === "session" && activeSession) {
    const sessionClient = clients.find((c) => c.username === activeSession.clientUsername) || null;
    return (
      <div style={styles.pageContainer}>
      <div style={styles.topBar}>
        {hasTgBack ? (
          <div style={{ width: 36 }} />
        ) : (
          <button
            onClick={() => {
              setScheduleScreen("list");
              setActiveSession(null);
            }}
            style={styles.backBtnInline}
            aria-label="back"
          >
            <IconArrowLeft />
          </button>
        )}
        <div style={styles.topBarTitle}>{tr("Тренировка", "Session")}</div>
        <div style={{ width: 36 }} />
      </div>
        <div style={styles.clientTabsScroll}>
          <div style={styles.clientTabs}>
            <button
              type="button"
              onClick={() => setSessionTab("info")}
              style={{
                ...styles.clientTab,
                ...(sessionTab === "info" ? styles.clientTabActive : null),
              }}
            >
              {tr("Информация о тренировке", "Session info")}
            </button>
            <button
              type="button"
              onClick={() => setSessionTab("weights")}
              style={{
                ...styles.clientTab,
                ...(sessionTab === "weights" ? styles.clientTabActive : null),
              }}
            >
              {tr("Рабочие веса клиента", "Client weights")}
            </button>
            <button
              type="button"
              onClick={() => setSessionTab("history")}
              style={{
                ...styles.clientTab,
                ...(sessionTab === "history" ? styles.clientTabActive : null),
              }}
            >
              {tr("История тренировок клиента", "Client history")}
            </button>
          </div>
        </div>
        <div style={styles.clientTabsDivider} />
        <div style={styles.clientPanelPlain}>
          {sessionTab === "info" ? (
            <div>
              <div style={styles.fieldLabel}>{tr("Клиент", "Client")}</div>
              <div style={styles.readOnlyValue}>
                {getClientLabel(clients, activeSession.clientUsername)}
              </div>
              <div style={{ marginTop: 16 }} />
              <div style={styles.metricsRow}>
                <div style={{ flex: 1 }}>
                  <div style={styles.fieldLabel}>{tr("Начало", "Start")}</div>
                  <div style={styles.readOnlyValue}>{activeSession.start}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={styles.fieldLabel}>{tr("Конец", "End")}</div>
                  <div style={styles.readOnlyValue}>{activeSession.end}</div>
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={styles.fieldLabel}>{tr("Тип тренировки", "Session type")}</div>
                <input
                  value={activeSession.type ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setActiveSession((prev) => (prev ? { ...prev, type: value } : prev));
                    setSessionsByDate((prev) => {
                      const dateKey = activeSession.dateKey;
                      const list = prev[dateKey] ? [...prev[dateKey]] : [];
                      const nextList = list.map((item) =>
                        item.id === activeSession.id ? { ...item, type: value } : item
                      );
                      return { ...prev, [dateKey]: nextList };
                    });
                  }}
                  placeholder={tr("Введите тип тренировки", "Enter session type")}
                  style={styles.input}
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={styles.fieldLabel}>{tr("Стоимость тренировки", "Session price")}</div>
                <div style={styles.inputRow}>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={activeSession.price ?? ""}
                    onChange={(e) => {
                      const value = normalizePriceRUBWithDelete(e.target.value, activeSession.price ?? "");
                      setActiveSession((prev) => (prev ? { ...prev, price: value } : prev));
                      setSessionsByDate((prev) => {
                        const dateKey = activeSession.dateKey;
                        const list = prev[dateKey] ? [...prev[dateKey]] : [];
                        const nextList = list.map((item) =>
                          item.id === activeSession.id ? { ...item, price: value } : item
                        );
                        return { ...prev, [dateKey]: nextList };
                      });
                    }}
                    placeholder={tr("Введите стоимость", "Enter price")}
                    style={{ ...styles.input, flex: 1 }}
                  />
                  <button
                    type="button"
                    style={styles.inlineCheckBtn}
                    onClick={() => {
                      (document.activeElement as HTMLElement | null)?.blur?.();
                    }}
                    aria-label="save"
                  >
                    ✓
                  </button>
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={styles.fieldLabel}>{tr("Комментарий к тренировке", "Session notes")}</div>
                <textarea
                  ref={sessionCommentRef}
                  value={activeSession.comment ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setActiveSession((prev) => (prev ? { ...prev, comment: value } : prev));
                    setSessionsByDate((prev) => {
                      const dateKey = activeSession.dateKey;
                      const list = prev[dateKey] ? [...prev[dateKey]] : [];
                      const nextList = list.map((item) =>
                        item.id === activeSession.id ? { ...item, comment: value } : item
                      );
                      return { ...prev, [dateKey]: nextList };
                    });
                  }}
                  placeholder={tr("Введите комментарий", "Enter notes")}
                  rows={3}
                  style={{ ...styles.input, resize: "none", overflow: "hidden" }}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const message = tr("Вы точно хотите удалить тренировку?", "Are you sure you want to delete this session?");
                  const doDelete = () => {
                    const dateKey = activeSession.dateKey;
                    setSessionsByDate((prev) => {
                      const list = prev[dateKey] ? prev[dateKey].filter((x) => x.id !== activeSession.id) : [];
                      if (list.length === 0) {
                        const next = { ...prev };
                        delete next[dateKey];
                        return next;
                      }
                      return { ...prev, [dateKey]: list };
                    });
                    setFreeByDate((prev) => {
                      const list = prev[dateKey] ? [...prev[dateKey]] : [];
                      list.push({ id: cryptoId(), start: activeSession.start, end: activeSession.end });
                      list.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
                      return { ...prev, [dateKey]: list };
                    });
                    setScheduleScreen("list");
                    setActiveSession(null);
                  };
                  if (typeof WebApp?.showConfirm === "function") {
                    WebApp.showConfirm(message, (yes) => {
                      if (yes) doDelete();
                    });
                    return;
                  }
                  if (window.confirm(message)) doDelete();
                }}
                style={{ ...styles.saveBtn, ...styles.dangerBtn, marginTop: 16 }}
              >
                {tr("Удалить тренировку", "Delete session")}
              </button>
            </div>
          ) : sessionTab === "weights" ? (
            <div>
              <button
                type="button"
                style={styles.addWindowBtn}
                onClick={() => {
                  setShowSessionExerciseForm((v) => !v);
                  setSessionExerciseError("");
                }}
              >
                {tr("Добавить упражнение", "Add exercise")}
              </button>
              {showSessionExerciseForm ? (
                <div style={{ marginTop: 12 }}>
                  <div style={styles.fieldLabel}>{tr("Название упражнения", "Exercise name")}</div>
                  <input
                    value={draftSessionExerciseName}
                    onChange={(e) => {
                      setDraftSessionExerciseName(e.target.value);
                      if (sessionExerciseError) setSessionExerciseError("");
                    }}
                    placeholder={tr("Например: Жим лёжа", "e.g., Bench press")}
                    style={styles.input}
                  />
                  <div style={{ marginTop: 12 }}>
                    <div style={styles.fieldLabel}>{tr("Вес", "Weight")}</div>
                    <input
                      value={draftSessionExerciseWeight}
                      onChange={(e) => {
                        setDraftSessionExerciseWeight(e.target.value);
                        if (sessionExerciseError) setSessionExerciseError("");
                      }}
                      placeholder={tr("Например: 60 кг", "e.g., 60 kg")}
                      style={styles.input}
                    />
                  </div>
                  {sessionExerciseError ? <div style={styles.errorText}>{sessionExerciseError}</div> : null}
                  <button
                    type="button"
                    onClick={() => {
                      if (!sessionClient) return;
                      const name = draftSessionExerciseName.trim();
                      const weight = draftSessionExerciseWeight.trim();
                      if (!name || !weight) {
                        setSessionExerciseError(tr("Заполни название и вес упражнения.", "Enter the exercise name and weight."));
                        return;
                      }
                      const nextList = [
                        ...(sessionClient.exercises ? sessionClient.exercises : []),
                        { id: cryptoId(), name, weight },
                      ];
                      setClients((prev) =>
                        prev.map((c) => (c.id === sessionClient.id ? { ...c, exercises: nextList } : c))
                      );
                      onSaveExercises?.(sessionClient.id, nextList);
                      setDraftSessionExerciseName("");
                      setDraftSessionExerciseWeight("");
                      setShowSessionExerciseForm(false);
                      setSessionExerciseError("");
                    }}
                    style={styles.saveBtn}
                  >
                    {tr("Сохранить", "Save")}
                  </button>
                </div>
              ) : null}

              {sessionClient?.exercises && sessionClient.exercises.length > 0 ? (
                <div style={{ marginTop: 16 }}>
                  <div style={styles.sectionHeaderSmall}>{tr("Список упражнений", "Exercises list")}</div>
                  <div style={styles.listBlock}>
                    {sessionClient.exercises.map((ex, idx) => {
                      const isLast = idx === sessionClient.exercises!.length - 1;
                      return (
                        <div
                          key={ex.id}
                          style={{
                            ...styles.rowWrap,
                            borderBottom: isLast ? "none" : "1px solid var(--border-2)",
                            padding: "12px 0",
                          }}
                        >
                          <div style={styles.exerciseRow}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={styles.rowTitle}>{ex.name || tr("Без названия", "Untitled")}</div>
                              <div style={styles.exerciseWeightRow}>
                                <input
                                  value={ex.weight || ""}
                                  onChange={(e) => {
                                    if (!sessionClient) return;
                                    const value = e.target.value;
                                    const list = sessionClient.exercises ? [...sessionClient.exercises] : [];
                                    const nextList = list.map((item) =>
                                      item.id === ex.id ? { ...item, weight: value } : item
                                    );
                                    setClients((prev) =>
                                      prev.map((c) => (c.id === sessionClient.id ? { ...c, exercises: nextList } : c))
                                    );
                                    onSaveExercises?.(sessionClient.id, nextList);
                                  }}
                                  placeholder={tr("Вес не указан", "Weight not set")}
                                  style={styles.exerciseInput}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!sessionClient) return;
                                    const nextList = (sessionClient.exercises || []).filter((item) => item.id !== ex.id);
                                    setClients((prev) =>
                                      prev.map((c) => (c.id === sessionClient.id ? { ...c, exercises: nextList } : c))
                                    );
                                    onSaveExercises?.(sessionClient.id, nextList);
                                  }}
                                  style={styles.exerciseTrashBtn}
                                  aria-label="delete exercise"
                                  title={tr("Удалить", "Delete")}
                                >
                                  <span style={styles.trashEmoji}>🗑</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 16, opacity: 0.7, fontSize: 14 }}>
                  {tr("Пока нет упражнений.", "No exercises yet.")}
                </div>
              )}
            </div>
          ) : sessionTab === "history" ? (
            <div>
              {(historyByClient[activeSession.clientUsername] || []).length ? (
                <div style={styles.listBlock}>
                  {(historyByClient[activeSession.clientUsername] || [])
                    .slice()
                    .sort((a, b) => {
                      const aEnd = sessionEndTime(a).getTime();
                      const bEnd = sessionEndTime(b).getTime();
                      return bEnd - aEnd;
                    })
                    .map((s, idx, arr) => {
                      const isLast = idx === arr.length - 1;
                      return (
                        <div
                          key={s.id}
                          style={{
                            ...styles.rowWrap,
                            borderBottom: isLast ? "none" : "1px solid var(--border-2)",
                            padding: "12px 0",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={styles.rowTitle}>{s.type?.trim() ? s.type : tr("Тренировка", "Session")}</div>
                            <div style={styles.rowSubtitle}>
                              {formatDateShort(parseDateKey(s.dateKey))} • {s.start} — {s.end}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div style={styles.clientPanelBody}>{tr("Пока нет завершённых тренировок.", "No completed sessions yet.")}</div>
              )}
            </div>
          ) : (
            <div style={styles.clientPanelBody}>{tr("Пока заглушка.", "Placeholder for now.")}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer}>
      <div style={styles.pageTitle}>{tr("Расписание", "Schedule")}</div>

      <div ref={scrollerRef} style={styles.calendarStrip}>
        {days.map((d) => {
          const isToday = isSameDay(d.date, today);
          const isSelected = isSameDay(d.date, selected);
          const isPast = d.date.getTime() < today.getTime();

          return (
            <button
              key={d.key}
              ref={isSelected ? selectedRef : isToday ? todayRef : null}
              onClick={() => setSelected(d.date)}
              style={{
                ...styles.calendarDay,
                ...(isToday ? styles.calendarDayActive : {}),
                ...(isSelected && !isToday ? styles.calendarDaySelected : {}),
                ...(isPast ? styles.calendarDayPast : {}),
              }}
              aria-current={isToday ? "date" : undefined}
              type="button"
            >
              <div style={styles.calendarDayDate}>{d.dateText}</div>
            </button>
          );
        })}
      </div>

      <div style={styles.scheduleTabs}>
        <button
          type="button"
          onClick={() => setSection("sessions")}
          style={{
            ...styles.scheduleTab,
            ...(section === "sessions" ? styles.scheduleTabActive : null),
          }}
        >
          {tr("Занятия сегодня", "Today's sessions")}
        </button>
        <button
          type="button"
          onClick={() => setSection("free")}
          style={{
            ...styles.scheduleTab,
            ...(section === "free" ? styles.scheduleTabActive : null),
          }}
        >
          {tr("Свободные окна", "Available slots")}
        </button>
      </div>

      {section === "sessions" ? (
        <div style={styles.schedulePanelPlain}>
          {(() => {
            const list = (sessionsByDate[formatDateKey(selected)] || [])
              .slice()
              .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
            if (list.length === 0) {
              return (
                <div style={styles.schedulePanelBody}>
                  {emptySessionsMessage(selected, today)}
                </div>
              );
            }
            return (
              <div style={styles.sessionList}>
                {list.map((s) => (
                  <div
                    key={s.id}
                    style={styles.sessionBanner}
                    onClick={() => {
                      setActiveSession(s);
                      setScheduleScreen("session");
                    }}
                  >
                    <div style={styles.sessionBannerLeft}>
                      <div style={styles.sessionBannerTitle}>
                        {s.type?.trim() ? s.type : tr("Тренировка", "Session")}
                      </div>
                      <div style={styles.sessionBannerTime}>
                        {s.start} — {s.end}
                      </div>
                      <div style={styles.sessionBannerClient}>
                        {getClientLabel(clients, s.clientUsername)}
                      </div>
                      {null}
                    <div
                      style={{
                        ...styles.sessionBannerStatus,
                        color: sessionStatusColor(s),
                      }}
                    >
                      {sessionStatusLabel(s)}
                    </div>
                    </div>
                    <div style={styles.sessionBannerActions} />
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      ) : (
        <div style={styles.schedulePanelPlain}>
          <button
            type="button"
            onClick={() => {
              setShowAddFree((v) => !v);
              setFreeError("");
            }}
            style={styles.addWindowBtn}
          >
            {tr("Добавить окно тренировки", "Add session slot")}
          </button>

          {showAddFree ? (
            <div style={styles.freeForm}>
              <div style={styles.freeField}>
                <div style={styles.fieldLabel}>{tr("Начало", "Start")}</div>
                <input
                  type="time"
                  value={freeStart}
                  onChange={(e) => setFreeStart(e.target.value)}
                  step={300}
                  style={styles.input}
                />
              </div>
              <div style={styles.freeField}>
                <div style={styles.fieldLabel}>{tr("Конец", "End")}</div>
                <input
                  type="time"
                  value={freeEnd}
                  onChange={(e) => setFreeEnd(e.target.value)}
                  step={300}
                  style={styles.input}
                />
              </div>
              {freeError ? <div style={styles.errorText}>{freeError}</div> : null}
              <button
                type="button"
                onClick={() => {
                  const dateKey = formatDateKey(selected);
                  const start = normalizeTimeInput(freeStart);
                  const end = normalizeTimeInput(freeEnd);
                  if (!start || !end) {
                    setFreeError(tr("Укажите время в формате ЧЧ:ММ (например 10:00).", "Enter time in HH:MM (e.g., 10:00)."));
                    return;
                  }
                  if (end <= start) {
                    setFreeError(tr("Время окончания должно быть больше времени начала.", "End time must be after start time."));
                    return;
                  }
                  const now = new Date();
                  const selectedDay = startOfDay(selected);
                  const todayDay = startOfDay(now);
                  if (selectedDay.getTime() < todayDay.getTime()) {
                    setFreeError(tr("Нельзя создавать окна в прошедших датах.", "You can't create slots in past dates."));
                    return;
                  }
                  if (selectedDay.getTime() === todayDay.getTime()) {
                    const startMin = timeToMinutes(start);
                    const nowMin = now.getHours() * 60 + now.getMinutes();
                    if (startMin <= nowMin) {
                      setFreeError(tr("Нельзя создавать окна в прошедшее время.", "You can't create slots in the past time."));
                      return;
                    }
                  }
                  const startMin = timeToMinutes(start);
                  const endMin = timeToMinutes(end);
                  const existing = freeByDate[dateKey] || [];
                  const existingSessions = sessionsByDate[dateKey] || [];
                  const overlaps = existing.some((w) => {
                    const wStart = timeToMinutes(w.start);
                    const wEnd = timeToMinutes(w.end);
                    return startMin < wEnd && endMin > wStart;
                  });
                  const overlapsSession = existingSessions.some((s) => {
                    const sStart = timeToMinutes(s.start);
                    const sEnd = timeToMinutes(s.end);
                    return startMin < sEnd && endMin > sStart;
                  });
                  if (overlaps || overlapsSession) {
                    setFreeError(tr("Окна не должны пересекаться или дублироваться с занятиями.", "Slots must not overlap with each other or sessions."));
                    return;
                  }
                  const next: FreeWindow = { id: cryptoId(), start, end };
                  setFreeByDate((prev) => {
                    const list = prev[dateKey] ? [...prev[dateKey]] : [];
                    list.push(next);
                    return { ...prev, [dateKey]: list };
                  });
                  setShowAddFree(false);
                  setFreeError("");
                  setFreeStart("");
                  setFreeEnd("");
                }}
                style={styles.saveBtn}
              >
                {tr("Добавить", "Add")}
              </button>
            </div>
          ) : null}

          <div style={{ marginTop: 10 }}>
            <div style={styles.freeList}>
              {(freeByDate[formatDateKey(selected)] || [])
                .slice()
                .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start))
                .map((w) => (
                <div key={w.id} style={styles.freeBanner}>
                  <div style={styles.freeBannerLeft}>
                    <div style={styles.freeBannerTitle}>{tr("Свободное окно", "Available slot")}</div>
                    <div style={styles.freeBannerTime}>
                      {w.start} — {w.end}
                    </div>
                    {assignForId === w.id ? (
                      <div style={styles.assignRow}>
                        <select
                          value={w.clientUsername ?? ""}
                          onChange={(e) => {
                            const value = e.target.value || undefined;
                            const dateKey = formatDateKey(selected);
                            if (value) {
                              if (!canScheduleClientOnDate(clients, value)) return;
                              setSessionsByDate((prev) => {
                                const list = prev[dateKey] ? [...prev[dateKey]] : [];
                                list.push({
                                  id: cryptoId(),
                                  dateKey,
                                  start: w.start,
                                  end: w.end,
                                  clientUsername: value,
                                });
                                return { ...prev, [dateKey]: list };
                              });
                              setFreeByDate((prev) => {
                                const list = prev[dateKey] ? prev[dateKey].filter((x) => x.id !== w.id) : [];
                                if (list.length === 0) {
                                  const next = { ...prev };
                                  delete next[dateKey];
                                  return next;
                                }
                                return { ...prev, [dateKey]: list };
                              });
                            }
                            setAssignForId(null);
                          }}
                          style={styles.selectInline}
                          aria-label="assign client"
                        >
                          <option value="">{tr("Выбери клиента", "Choose client")}</option>
                          {clients
                            .filter((c) => canScheduleClientOnDate(clients, c.username))
                            .map((c) => (
                              <option key={c.id} value={c.username}>
                                {c.fullName?.trim() ? c.fullName : `@${c.username}`}
                              </option>
                            ))}
                        </select>
                      </div>
                    ) : null}
                  </div>
                  <div style={styles.freeBannerActions}>
                    <button
                      type="button"
                      onClick={() => {
                        if (clients.length === 0) return;
                        setAssignForId((prev) => (prev === w.id ? null : w.id));
                      }}
                      style={styles.freeBannerAdd}
                      aria-label="assign client"
                      title={tr("Записать клиента", "Assign client")}
                      disabled={clients.length === 0}
                    >
                      ➕
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const dateKey = formatDateKey(selected);
                        setFreeByDate((prev) => {
                          const list = prev[dateKey] ? prev[dateKey].filter((x) => x.id !== w.id) : [];
                          if (list.length === 0) {
                            const next = { ...prev };
                            delete next[dateKey];
                            return next;
                          }
                          return { ...prev, [dateKey]: list };
                        });
                        setAssignForId((prev) => (prev === w.id ? null : prev));
                      }}
                      style={styles.freeBannerDelete}
                      aria-label="delete free window"
                      title={tr("Удалить", "Delete")}
                    >
                      <span style={styles.trashEmoji}>🗑</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TrainerClients(props: {
  screen: ClientsScreen;
  setScreen: (s: ClientsScreen) => void;
  invites: TrainerClientInvite[];
  setInvites: React.Dispatch<React.SetStateAction<TrainerClientInvite[]>>;
  historyByClient: Record<string, SessionItem[]>;
  token: string;
  apiBase: string;
  onLoadHistory?: (client: TrainerClientInvite) => void;
  onRefreshClients?: () => void;
}) {
  const {
    screen,
    setScreen,
    invites,
    setInvites,
    historyByClient,
    token,
    apiBase,
    onLoadHistory,
    onRefreshClients,
  } = props;
  const tr = useTr();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientsTab, setClientsTab] = useState<"my" | "pending" | "archive">("my");
  const activeClientsCount = invites.filter((c) => !c.archived).length;
  const limitReached = activeClientsCount >= SUBSCRIPTION_CLIENT_LIMIT;

  useEffect(() => {
    if (screen !== "detail") return;
    const client = invites.find((c) => c.id === selectedClientId) || null;
    if (client) onLoadHistory?.(client);
  }, [screen, selectedClientId, invites, onLoadHistory]);

  const showLimitWarning = () => {
    const message =
      tr(
        "По вашему тарифному плану вы достигли лимита активных клиентов. Добавление новых клиентов недоступно. Вы можете докупить дополнительные места.",
        "Your plan has reached the active client limit. Adding new clients is unavailable. You can purchase additional seats."
      );
    if (typeof WebApp?.showPopup === "function") {
      WebApp.showPopup({
        title: tr("Лимит клиентов", "Client limit"),
        message,
        buttons: [{ type: "ok" }],
      });
      return;
    }
    window.alert(message);
  };

  async function updateClient(id: string, patch: Partial<TrainerClientInvite>) {
    setInvites((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(patch),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { ok: boolean; client?: any };
      if (data?.client) {
        setInvites((prev) =>
          prev.map((c) => (c.id === data.client.id ? mapClientFromApi(data.client) : c))
        );
      }
    } catch {
      // ignore
    }
  }

  async function createClient(username: string) {
    if (!token) return null;
    try {
      const res = await fetch(`${apiBase}/clients`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username }),
      });
      const data = (await res.json()) as { ok: boolean; client?: any; existing?: boolean };
      if (!res.ok || !data?.client) return null;
      const mapped = mapClientFromApi(data.client);
      if (!data.existing) {
        setInvites((prev) => [mapped, ...prev]);
      }
      return { client: mapped, existing: Boolean(data.existing) };
    } catch {
      return null;
    }
  }

  async function deleteClient(inv: TrainerClientInvite) {
    setInvites((prev) => prev.filter((x) => x.id !== inv.id));
    if (!token) {
      try {
        WebApp?.showPopup?.({
          title: tr("Нет авторизации", "Not authorized"),
          message: tr("Перезайди в приложение и попробуй снова.", "Please re-open the app and try again."),
          buttons: [{ type: "ok" }],
        });
      } catch {
        // ignore
      }
    }
    try {
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${apiBase}/clients/${inv.id}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) {
        try {
          WebApp?.showPopup?.({
            title: tr("Не удалось удалить", "Delete failed"),
            message: `${tr("Статус", "Status")}: ${res.status}`,
            buttons: [{ type: "ok" }],
          });
        } catch {
          // ignore
        }
        onRefreshClients?.();
        return;
      }
      onRefreshClients?.();
      } catch {
        // ignore
      }
  }

  if (screen === "add") {
    return (
      <AddClientScreen
        onBack={() => setScreen("list")}
        existingInvites={invites}
        onCreate={createClient}
      />
    );
  }

  if (screen === "detail") {
    const client = invites.find((c) => c.id === selectedClientId) || null;
    return (
      <ClientDetailScreen
        client={client}
        onBack={() => setScreen("list")}
        onUpdateClient={updateClient}
        onSaveExercises={(clientId, exercises) => {
          if (!client) return;
          updateClient(clientId, { exercises });
        }}
        history={historyByClient[client?.username ?? ""] ?? []}
      />
    );
  }

  return (
    <div style={styles.pageContainer}>
      <div style={styles.topBarClients}>
        <div style={styles.pageTitle}>{tr("Клиенты", "Clients")}</div>
        {clientsTab === "pending" ? (
          <button
            onClick={() => {
              if (limitReached) {
                showLimitWarning();
                return;
              }
              setScreen("add");
            }}
            style={styles.iconBtn}
            aria-label="add client"
          >
            <IconPlus />
          </button>
        ) : (
          <div style={{ width: 44, height: 44 }} />
        )}
      </div>

      <div style={styles.scheduleTabs}>
        <button
          type="button"
          onClick={() => setClientsTab("my")}
          style={{
            ...styles.scheduleTab,
            ...(clientsTab === "my" ? styles.scheduleTabActive : null),
          }}
        >
          {tr("Мои клиенты", "My clients")}
        </button>
        <button
          type="button"
          onClick={() => setClientsTab("pending")}
          style={{
            ...styles.scheduleTab,
            ...(clientsTab === "pending" ? styles.scheduleTabActive : null),
          }}
        >
          {tr("Добавление клиентов", "Add clients")}
        </button>
        <button
          type="button"
          onClick={() => setClientsTab("archive")}
          style={{
            ...styles.scheduleTab,
            ...(clientsTab === "archive" ? styles.scheduleTabActive : null),
          }}
        >
          {tr("Архив клиентов", "Client archive")}
        </button>
      </div>

      {(() => {
        const filtered =
          clientsTab === "archive"
            ? invites.filter((x) => x.archived)
            : clientsTab === "pending"
              ? invites.filter((x) => !x.archived && x.status === "pending")
              : invites.filter((x) => !x.archived && x.status === "active");

        if (filtered.length === 0) {
          return (
            <div style={styles.emptyState}>
              <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: -0.15 }}>
                {clientsTab === "archive"
                  ? tr("Архив пуст", "Archive is empty")
                  : clientsTab === "pending"
                    ? tr("Нет подключаемых клиентов", "No pending clients")
                    : tr("Пока здесь пусто", "Nothing here yet")}
              </div>
              <div style={{ marginTop: 6, opacity: 0.7, fontSize: 14, lineHeight: 1.35 }}>
                {clientsTab === "archive"
                  ? tr("Здесь будут клиенты после архивации.", "Clients will appear here after archiving.")
                  : clientsTab === "pending"
                    ? tr(
                        "Нажми “+”, введи Telegram username клиента — и получишь код приглашения.",
                        "Tap “+”, enter the client's Telegram username, and you'll get an invite code."
                      )
                    : tr("Клиенты появятся после добавления", "Clients will appear after you add them")}
              </div>
            </div>
          );
        }
        return (
          <div style={{ marginTop: 14 }}>
            <div style={styles.listBlock}>
              {filtered.map((inv, idx) => {
                const isLast = idx === filtered.length - 1;
                return (
                  <div
                    key={inv.id}
                    style={{
                      ...styles.rowWrap,
                      borderBottom: isLast ? "none" : "1px solid var(--border-2)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedClientId(inv.id);
                        setScreen("detail");
                      }}
                      style={styles.rowBtnNoBorder}
                      aria-label={`open ${inv.username}`}
                    >
                      <div style={styles.rowLeft}>
                        <AvatarCircle name={inv.fullName?.trim() || inv.username} photoUrl={inv.photoUrl || ""} size={40} />
                        <div style={{ textAlign: "left" }}>
                          <div style={styles.rowTitle}>
                            {inv.fullName?.trim() ? inv.fullName : `@${inv.username}`}
                          </div>
                          <div style={styles.rowSubtitle}>
                            {clientsTab === "pending" ? (
                              <span>{tr("Ожидает активации", "Pending activation")}</span>
                            ) : clientsTab === "archive" ? (
                              <span style={{ opacity: 0.7 }}>{tr("Архивирован", "Archived")}</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </button>

                    {clientsTab === "pending" ? (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          deleteClient(inv).catch(() => {
                            // ignore
                          });
                        }}
                        style={styles.trashBtn}
                        aria-label={`delete ${inv.username}`}
                        title={tr("Удалить", "Delete")}
                      >
                        <IconTrash />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function AddClientScreen(props: {
  onBack: () => void;
  onCreate: (username: string) => Promise<{ client: TrainerClientInvite; existing?: boolean } | null>;
  existingInvites: TrainerClientInvite[];
}) {
  const { onBack, onCreate, existingInvites } = props;
  const tr = useTr();

  const [input, setInput] = useState<string>("@");
  const [error, setError] = useState<string>("");
  const [created, setCreated] = useState<TrainerClientInvite | null>(null);
  const activeClientsCount = existingInvites.filter((c) => !c.archived).length;
  const limitReached = activeClientsCount >= SUBSCRIPTION_CLIENT_LIMIT;

  const showLimitWarning = () => {
    const message =
      tr(
        "По вашему тарифному плану вы достигли лимита активных клиентов. Добавление новых клиентов недоступно. Вы можете докупить дополнительные места.",
        "Your plan has reached the active client limit. Adding new clients is unavailable. You can purchase additional seats."
      );
    if (typeof WebApp?.showPopup === "function") {
      WebApp.showPopup({
        title: tr("Лимит клиентов", "Client limit"),
        message,
        buttons: [{ type: "ok" }],
      });
      return;
    }
    window.alert(message);
  };

  function normalizeUsername(raw: string) {
    const v = (raw || "").trim();
    const cleaned = v.startsWith("@") ? v.slice(1) : v;
    return cleaned.replace(/\s+/g, "");
  }

  async function createInvite() {
    setError("");
    if (limitReached) {
      setError(tr("Достигнут лимит активных клиентов по тарифу.", "Active client limit reached for your plan."));
      showLimitWarning();
      return;
    }

    const u = normalizeUsername(input);
    if (!u) {
      setError(tr("Введи username клиента (например @username).", "Enter the client's username (e.g., @username)."));
      return;
    }
    if (!/^[a-zA-Z0-9_]{5,32}$/.test(u)) {
      setError(tr("Похоже на неправильный username. Допустимо: буквы/цифры/_, 5–32 символа.", "The username looks invalid. Allowed: letters/numbers/_, 5–32 characters."));
      return;
    }

    const result = await onCreate(u);
    if (!result?.client) {
      setError(tr("Не удалось создать клиента. Попробуй позже.", "Failed to create client. Try again."));
      return;
    }
    setCreated(result.client);
  }

  function copyCode() {
    if (!created) return;
    copyText(created.code);
    WebApp?.showPopup?.({
      title: tr("Скопировано", "Copied"),
      message: tr(`Код для @${created.username}: ${created.code}`, `Code for @${created.username}: ${created.code}`),
      buttons: [{ type: "ok" }],
    });
  }

  return (
    <div style={styles.pageContainer}>
      <div style={styles.topBar}>
        {typeof WebApp?.BackButton?.show === "function" ? (
          <div style={{ width: 36 }} />
        ) : (
          <button onClick={onBack} style={styles.backBtnInline} aria-label="back">
            <IconArrowLeft />
          </button>
        )}
        <div style={styles.topBarTitle}>{tr("Добавить клиента", "Add client")}</div>
        <div style={{ width: 36 }} />
      </div>

      {!created ? (
        <>
          <div style={{ opacity: 0.72, fontSize: 14, lineHeight: 1.35, marginTop: 6 }}>
            {tr(
              "Введи Telegram username клиента (например ",
              "Enter the client's Telegram username (e.g., "
            )}
            <b>@username</b>
            {tr("). После этого появится уникальный код, который ты отправишь клиенту.", "). After that you will get a unique code to send to the client.")}
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={styles.fieldLabel}>Username</div>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="@username"
              style={styles.input}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>

          {error ? <div style={styles.errorText}>{error}</div> : null}

          <button onClick={createInvite} style={styles.saveBtn}>
            {tr("Добавить", "Add")}
          </button>

          <div style={{ marginTop: 12, opacity: 0.6, fontSize: 12, lineHeight: 1.35 }}>
            {tr(
              "По твоей логике username нужен, чтобы в будущем при вводе кода приложение проверяло, что код предназначен именно этому клиенту.",
              "The username is needed so in the future the app can verify the code belongs to that client."
            )}
          </div>
        </>
      ) : (
        <>
          <div style={{ marginTop: 10, opacity: 0.8, fontSize: 14 }}>
            {tr("Клиент", "Client")}: <b>@{created.username}</b>
          </div>

          <div style={styles.codeBox}>
            <div style={{ fontWeight: 800, fontSize: 14, opacity: 0.8 }}>{tr("Код для клиента", "Client code")}</div>
            <div style={styles.codeValue}>{created.code}</div>

            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button
                onClick={copyCode}
                style={{
                  ...styles.primaryBtn,
                  flex: 1,
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  justifyContent: "center",
                }}
                >
                  <IconCopy />
                {tr("Скопировать", "Copy")}
              </button>
              <button onClick={onBack} style={{ ...styles.primaryBtn, flex: 1 }}>
                {tr("Готово", "Done")}
              </button>
            </div>
          </div>

          <div style={{ marginTop: 12, opacity: 0.6, fontSize: 12, lineHeight: 1.35 }}>
            {tr(
              "Следующий шаг: на стороне клиента экран “Ввести код тренера”, проверка username и активация связи.",
              "Next step: on the client side there is an “Enter coach code” screen, username check, and activation."
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ClientDetailScreen(props: {
  client: TrainerClientInvite | null;
  onBack: () => void;
  onUpdateClient: (id: string, patch: Partial<TrainerClientInvite>) => void;
  history: SessionItem[];
  onSaveExercises?: (clientId: string, exercises: { id: string; name: string; weight: string }[]) => void;
}) {
  const { client, onBack, onUpdateClient, history, onSaveExercises } = props;
  const tr = useTr();
  const [tab, setTab] = useState<"info" | "weights" | "history">("info");
  const showOnlyInfo = client?.status === "pending";
  const visibleTab = showOnlyInfo ? "info" : tab;
  const [draftFullName, setDraftFullName] = useState(client?.fullName ?? "");
  const [draftHeight, setDraftHeight] = useState("");
  const [draftWeight, setDraftWeight] = useState("");
  const [draftGoal, setDraftGoal] = useState("");
  const [draftComment, setDraftComment] = useState("");
  const [showExerciseForm, setShowExerciseForm] = useState(false);
  const [draftExerciseName, setDraftExerciseName] = useState("");
  const [draftExerciseWeight, setDraftExerciseWeight] = useState("");
  const [exerciseError, setExerciseError] = useState("");
  const goalRef = React.useRef<HTMLTextAreaElement | null>(null);
  const commentRef = React.useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setDraftFullName(client?.fullName ?? "");
    setDraftHeight(client?.height ?? "");
    setDraftWeight(client?.weight ?? "");
    setDraftGoal(client?.goal ?? "");
    setDraftComment(client?.comment ?? "");
    setDraftExerciseName("");
    setDraftExerciseWeight("");
    setShowExerciseForm(false);
    setExerciseError("");
    if (client?.status === "pending") setTab("info");
  }, [
    client?.id,
    client?.fullName,
    client?.height,
    client?.weight,
    client?.goal,
    client?.comment,
    client?.status,
  ]);

  useEffect(() => {
    const el = goalRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draftGoal, tab]);

  useEffect(() => {
    const el = commentRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draftComment, tab]);

  return (
    <div style={styles.pageContainer}>
      <div style={styles.topBar}>
        {typeof WebApp?.BackButton?.show === "function" ? (
          <div style={{ width: 36 }} />
        ) : (
          <button onClick={onBack} style={styles.backBtnInline} aria-label="back">
            <IconArrowLeft />
          </button>
        )}
        <div style={styles.topBarTitle}>{tr("Клиент", "Client")}</div>
        <div style={{ width: 36 }} />
      </div>

      <div style={styles.personalHeaderRow}>
        <AvatarCircle name={client?.username || tr("Клиент", "Client")} photoUrl={client?.photoUrl || ""} size={44} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", lineHeight: 1.2 }}>
            {client?.fullName?.trim()
              ? client.fullName
              : client?.username
                ? `@${client.username}`
                : tr("Клиент", "Client")}
          </div>
          <div style={{ opacity: 0.62, fontSize: 13, marginTop: 2 }}>
            {client?.status === "active" ? tr("Активен", "Active") : tr("Ожидает активации", "Pending activation")}
          </div>
        </div>
      </div>

      <div style={styles.clientTabsScroll}>
        <div style={styles.clientTabs}>
          <button
            type="button"
            onClick={() => setTab("info")}
            style={{
              ...styles.clientTab,
              ...(visibleTab === "info" ? styles.clientTabActive : null),
            }}
          >
            {tr("Информация о клиенте", "Client info")}
          </button>
          {!showOnlyInfo ? (
            <>
              <button
                type="button"
                onClick={() => setTab("weights")}
                style={{
                  ...styles.clientTab,
                  ...(visibleTab === "weights" ? styles.clientTabActive : null),
                }}
              >
                {tr("Рабочие веса", "Working weights")}
              </button>
              <button
                type="button"
                onClick={() => setTab("history")}
                style={{
                  ...styles.clientTab,
                  ...(visibleTab === "history" ? styles.clientTabActive : null),
                }}
              >
                {tr("История тренировок", "Training history")}
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div style={styles.clientTabsDivider} />

      {visibleTab === "info" ? (
        <div style={styles.clientPanelPlain}>
          <div style={{ marginTop: 6 }}>
            <div style={styles.fieldLabel}>{tr("ФИО клиента", "Client full name")}</div>
            <input
              value={draftFullName}
              onChange={(e) => {
                const v = e.target.value;
                setDraftFullName(v);
                if (!client) return;
                onUpdateClient(client.id, { fullName: v.trim() });
              }}
              placeholder={tr("Введите ФИО клиента", "Enter client full name")}
              style={styles.input}
            />
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={styles.fieldLabel}>Username</div>
            <div style={styles.readOnlyValue}>{client?.username ? `@${client.username}` : "—"}</div>
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={styles.fieldLabel}>{tr("Инвайт‑код", "Invite code")}</div>
            <div style={styles.copyRow}>
              <div style={styles.readOnlyValue}>{client?.code || "—"}</div>
              <button
                type="button"
                onClick={() => {
                  if (!client?.code) return;
                  copyText(client.code);
                  WebApp?.showPopup?.({
                    title: tr("Код скопирован", "Code copied"),
                    message: tr(`Код для @${client.username}: ${client.code}`, `Code for @${client.username}: ${client.code}`),
                    buttons: [{ type: "ok" }],
                  });
                }}
                style={styles.copyBtn}
                aria-label="copy invite code"
              >
                <IconCopy />
                <span style={{ fontSize: 13 }}>{tr("Копировать", "Copy")}</span>
              </button>
            </div>
          </div>

          <div style={styles.metricsRow}>
            <div style={{ flex: 1 }}>
              <div style={styles.fieldLabel}>{tr("Рост", "Height")}</div>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={draftHeight}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraftHeight(v);
                  if (!client) return;
                  onUpdateClient(client.id, { height: v });
                }}
                onBlur={() => {
                  const v = normalizeNumberWithUnit(draftHeight, "см");
                  if (!v || !client) return;
                  setDraftHeight(v);
                  onUpdateClient(client.id, { height: v });
                }}
                placeholder={tr("см", "cm")}
                style={styles.input}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={styles.fieldLabel}>{tr("Вес", "Weight")}</div>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={draftWeight}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraftWeight(v);
                  if (!client) return;
                  onUpdateClient(client.id, { weight: v });
                }}
                onBlur={() => {
                  const v = normalizeNumberWithUnit(draftWeight, "кг");
                  if (!v || !client) return;
                  setDraftWeight(v);
                  onUpdateClient(client.id, { weight: v });
                }}
                placeholder={tr("кг", "kg")}
                style={styles.input}
              />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={styles.fieldLabel}>{tr("Цель", "Goal")}</div>
            <textarea
              ref={goalRef}
              value={draftGoal}
              onChange={(e) => {
                const v = e.target.value;
                setDraftGoal(v);
                if (!client) return;
                onUpdateClient(client.id, { goal: v });
              }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${el.scrollHeight}px`;
              }}
              placeholder={tr("Например: похудеть на 5 кг", "e.g., lose 5 kg")}
              rows={1}
              style={styles.goalTextarea}
            />
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={styles.fieldLabel}>{tr("Комментарии", "Comments")}</div>
            <textarea
              ref={commentRef}
              value={draftComment}
              onChange={(e) => {
                const v = e.target.value;
                setDraftComment(v);
                if (!client) return;
                onUpdateClient(client.id, { comment: v });
              }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${el.scrollHeight}px`;
              }}
              placeholder={tr("Комментарий о клиенте", "Comment about the client")}
              rows={1}
              style={styles.goalTextarea}
            />
          </div>
        </div>
      ) : visibleTab === "history" ? (
        <div style={styles.clientPanelPlain}>
          {history.length === 0 ? (
            <div style={styles.clientPanelBody}>{tr("Пока нет завершённых тренировок.", "No completed sessions yet.")}</div>
          ) : (
            <div style={styles.listBlock}>
              {history
                .slice()
                .sort((a, b) => {
                  const aEnd = sessionEndTime(a).getTime();
                  const bEnd = sessionEndTime(b).getTime();
                  return bEnd - aEnd;
                })
                .map((s, idx) => {
                  const isLast = idx === history.length - 1;
                  return (
                    <div
                      key={s.id}
                      style={{
                        ...styles.rowWrap,
                        borderBottom: isLast ? "none" : "1px solid var(--border-2)",
                        padding: "12px 0",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={styles.rowTitle}>{tr("Тренировка", "Session")}</div>
                        <div style={styles.rowSubtitle}>
                          {formatDateShort(parseDateKey(s.dateKey))} • {s.start} — {s.end}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      ) : (
        <div style={styles.clientPanelPlain}>
          <button
            type="button"
            style={styles.addWindowBtn}
            onClick={() => {
              setShowExerciseForm((v) => !v);
            }}
          >
            {tr("Добавить упражнение", "Add exercise")}
          </button>
          {showExerciseForm ? (
            <div style={{ marginTop: 12 }}>
              <div style={styles.fieldLabel}>{tr("Название упражнения", "Exercise name")}</div>
              <input
                value={draftExerciseName}
                onChange={(e) => {
                  setDraftExerciseName(e.target.value);
                  if (exerciseError) setExerciseError("");
                }}
                placeholder={tr("Например: Жим лёжа", "e.g., Bench press")}
                style={styles.input}
              />
              <div style={{ marginTop: 12 }}>
                <div style={styles.fieldLabel}>{tr("Вес", "Weight")}</div>
                <input
                  value={draftExerciseWeight}
                  onChange={(e) => {
                    setDraftExerciseWeight(e.target.value);
                    if (exerciseError) setExerciseError("");
                  }}
                  placeholder={tr("Например: 60 кг", "e.g., 60 kg")}
                  style={styles.input}
                />
              </div>
              {exerciseError ? <div style={styles.errorText}>{exerciseError}</div> : null}
              <button
                type="button"
                onClick={() => {
                  if (!client) return;
                  const name = draftExerciseName.trim();
                  const weight = draftExerciseWeight.trim();
                  if (!name || !weight) {
                    setExerciseError(tr("Заполни название и вес упражнения.", "Enter the exercise name and weight."));
                    return;
                  }
                  const list = client.exercises ? [...client.exercises] : [];
                  const next = [...list, { id: cryptoId(), name, weight }];
                  onUpdateClient(client.id, { exercises: next });
                  onSaveExercises?.(client.id, next);
                  setDraftExerciseName("");
                  setDraftExerciseWeight("");
                  setShowExerciseForm(false);
                  setExerciseError("");
                }}
                style={styles.saveBtn}
              >
                {tr("Сохранить", "Save")}
              </button>
            </div>
          ) : null}

          {client?.exercises && client.exercises.length > 0 ? (
            <div style={{ marginTop: 16 }}>
              <div style={styles.sectionHeaderSmall}>{tr("Список упражнений", "Exercises list")}</div>
              <div style={styles.listBlock}>
                {client.exercises.map((ex, idx) => {
                  const isLast = idx === client.exercises!.length - 1;
                  return (
                      <div
                        key={ex.id}
                        style={{
                          ...styles.rowWrap,
                          borderBottom: isLast ? "none" : "1px solid var(--border-2)",
                          padding: "12px 0",
                        }}
                      >
                        <div style={styles.exerciseRow}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={styles.rowTitle}>{ex.name || tr("Без названия", "Untitled")}</div>
                            <div style={styles.exerciseWeightRow}>
                              <input
                                value={ex.weight || ""}
                                onChange={(e) => {
                                  if (!client) return;
                                  const value = e.target.value;
                                  const next = client.exercises!.map((item) =>
                                    item.id === ex.id ? { ...item, weight: value } : item
                                  );
                                  onUpdateClient(client.id, { exercises: next });
                                  onSaveExercises?.(client.id, next);
                                }}
                                placeholder={tr("Вес не указан", "Weight not set")}
                                style={styles.exerciseInput}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (!client) return;
                                  const next = client.exercises!.filter((x) => x.id !== ex.id);
                                  onUpdateClient(client.id, { exercises: next });
                                  onSaveExercises?.(client.id, next);
                                }}
                                style={styles.exerciseTrashBtn}
                                aria-label="delete exercise"
                                title={tr("Удалить", "Delete")}
                              >
                                <span style={styles.trashEmoji}>🗑</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}


// -----------------------
// Settings
// -----------------------
function TrainerSettings(props: {
  screen: SettingsScreen;
  setScreen: (s: SettingsScreen) => void;
  name: string;
  setName: (v: string) => void;
  username: string;
  photoUrl: string;
  roleLabel: string;
  theme: "light" | "dark";
  setTheme: (t: "light" | "dark") => void;
  language: "ru" | "en";
  setLanguage: (v: "ru" | "en") => void;
  t: UiText;
  trainerProfile?: TrainerProfile | null;
  onSaveTrainerProfile?: (patch: Partial<TrainerProfile>) => void;
  personalShowSubscription?: boolean;
  personalShowExtendedAbout?: boolean;
  personalShowClientBasics?: boolean;
  personalShowClientWeights?: boolean;
  showBookingRow?: boolean;
  systemExtraRows?: React.ReactNode;
  aboutCardText?: string;
  subscriptionTabLabel?: string;
  subscriptionItems?: TrainerClientInvite[];
  onDeleteProfile?: () => void;
}) {
  const {
    screen,
    setScreen,
    name,
    setName,
    username,
    photoUrl,
    roleLabel,
    theme,
    setTheme,
    language,
    setLanguage,
    t,
    trainerProfile,
    onSaveTrainerProfile,
    personalShowSubscription = true,
    personalShowExtendedAbout = true,
    personalShowClientBasics = false,
    personalShowClientWeights = false,
    showBookingRow = true,
    systemExtraRows,
    aboutCardText,
    subscriptionTabLabel,
    subscriptionItems,
    onDeleteProfile,
  } = props;
  const tr = useTr();
  const resolvedAboutCardText =
    aboutCardText ??
    tr("Здесь находится информация о вас, которая будет видна всем вашим клиентам!", "This is your info that will be visible to all your clients.");
  const resolvedSubscriptionTabLabel = subscriptionTabLabel ?? tr("Моя подписка", "My subscription");
  const [bookingMode, setBookingMode] = useState<"trainer" | "both">("trainer");
  const [remindersEnabled, setRemindersEnabled] = useState<boolean>(true);

  useEffect(() => {
    if (!showBookingRow && screen === "booking") {
      setScreen("main");
    }
  }, [showBookingRow, screen, setScreen]);

  if (screen === "personal") {
    return (
      <PersonalDataScreen
        name={name}
        username={username}
        photoUrl={photoUrl}
        onUpdateName={setName}
        trainerProfile={trainerProfile}
        onSaveTrainerProfile={onSaveTrainerProfile}
        showSubscriptionTab={personalShowSubscription}
        showExtendedAbout={personalShowExtendedAbout}
        showClientBasics={personalShowClientBasics}
        showClientWeights={personalShowClientWeights}
        subscriptionTabLabel={resolvedSubscriptionTabLabel}
        subscriptionItems={subscriptionItems}
      />
    );
  }
  if (screen === "theme") {
    return (
      <ThemeSchemeScreen onBack={() => setScreen("main")} theme={theme} setTheme={setTheme} t={t} />
    );
  }
  if (screen === "booking") {
    return (
      <BookingModeScreen
        onBack={() => setScreen("main")}
        bookingMode={bookingMode}
        setBookingMode={setBookingMode}
        t={t}
      />
    );
  }
  if (screen === "reminders") {
    return (
      <RemindersScreen
        onBack={() => setScreen("main")}
        enabled={remindersEnabled}
        setEnabled={setRemindersEnabled}
        t={t}
      />
    );
  }
  if (screen === "language") {
    return (
      <LanguageScreen
        onBack={() => setScreen("main")}
        language={language}
        setLanguage={setLanguage}
        t={t}
      />
    );
  }

  return (
    <div style={styles.pageContainer}>
      <div style={styles.settingsHeader}>
        <AvatarCircle name={name || username || tr("Пользователь", "User")} photoUrl={photoUrl} size={78} />
        <div style={styles.profileName}>{name || tr("Пользователь", "User")}</div>
        <div style={styles.profileSub}>{username ? `@${username}` : " "}</div>
        <div style={styles.rolePill}>{roleLabel}</div>
      </div>

      <button type="button" onClick={() => setScreen("personal")} style={styles.aboutCardBtn}>
        <div style={styles.aboutHeader}>
          <div style={styles.aboutIcon}>✦</div>
          <div style={styles.aboutTitle}>{tr("Личная информация", "Personal info")}</div>
        </div>
        <div style={styles.aboutText}>{resolvedAboutCardText}</div>
      </button>

      <div style={styles.sectionHeader}>{t.settingsSystem}</div>
      <div style={styles.listBlock}>
        {showBookingRow ? (
          <SettingsRow
            icon={<IconUsers />}
            title={t.settingsBooking}
            right={bookingMode === "both" ? t.bookingBoth : t.bookingTrainerOnly}
            onClick={() => setScreen("booking")}
          />
        ) : null}
        <SettingsRow
          icon={<IconBell />}
          title={t.settingsReminders}
          right={remindersEnabled ? t.remindersOn : t.remindersOff}
          onClick={() => setScreen("reminders")}
        />
        <SettingsRow
          icon={<IconGlobe />}
          title={t.settingsLanguage}
          right={language === "en" ? t.languageEn : t.languageRu}
          onClick={() => setScreen("language")}
        />
        <SettingsRow
          icon={<IconPalette />}
          title={t.settingsTheme}
          right={theme === "dark" ? t.themeDark : t.themeLight}
          onClick={() => setScreen("theme")}
        />
        {systemExtraRows}
      </div>

      <div style={{ height: 18 }} />

      <div style={styles.sectionHeader}>{t.settingsUseful}</div>
      <div style={styles.listBlock}>
        <SettingsRow
          icon={<IconBox />}
          title={t.settingsHelp}
          onClick={() => alert(tr("Позже добавим справку", "Help will be added later."))}
        />
        <SettingsRow
          icon={<IconSupport />}
          title={t.settingsSupport}
          onClick={() => alert(tr("Позже добавим поддержку", "Support will be added later."))}
        />
        <SettingsRow
          icon={<IconLock />}
          title={t.settingsPrivacy}
          onClick={() => alert(tr("Позже добавим страницу политики", "Privacy policy page will be added later."))}
          isLast
        />
      </div>
      {onDeleteProfile ? (
        <button
          type="button"
          onClick={onDeleteProfile}
          style={{ ...styles.saveBtn, ...styles.dangerBtn, marginTop: 18 }}
        >
          {t.deleteProfile}
        </button>
      ) : null}
    </div>
  );
}


function ThemeSchemeScreen(props: {
  onBack: () => void;
  theme: "light" | "dark";
  setTheme: (t: "light" | "dark") => void;
  t: UiText;
}) {
  const { onBack, theme, setTheme, t } = props;
  return (
    <div style={styles.pageContainer}>
      <div style={styles.topBar}>
        {typeof WebApp?.BackButton?.show === "function" ? (
          <div style={{ width: 36 }} />
        ) : (
          <button onClick={onBack} style={styles.backBtnInline} aria-label="back">
            <IconArrowLeft />
          </button>
        )}
        <div style={styles.topBarTitle}>{t.settingsTheme}</div>
        <div style={{ width: 36 }} />
      </div>
      <div style={styles.topBarDivider} />

      <div style={styles.themeTabs}>
        <button
          type="button"
          onClick={() => setTheme("light")}
          style={{
            ...styles.scheduleTab,
            ...(theme === "light" ? styles.scheduleTabActive : null),
            alignSelf: "flex-start",
          }}
        >
          {t.themeLight}
        </button>
        <button
          type="button"
          onClick={() => setTheme("dark")}
          style={{
            ...styles.scheduleTab,
            ...(theme === "dark" ? styles.scheduleTabActive : null),
            alignSelf: "flex-start",
          }}
        >
          {t.themeDark}
        </button>
      </div>
    </div>
  );
}

function BookingModeScreen(props: {
  onBack: () => void;
  bookingMode: "trainer" | "both";
  setBookingMode: (m: "trainer" | "both") => void;
  t: UiText;
}) {
  const { onBack, bookingMode, setBookingMode, t } = props;
  return (
    <div style={styles.pageContainer}>
      <div style={styles.topBar}>
        {typeof WebApp?.BackButton?.show === "function" ? (
          <div style={{ width: 36 }} />
        ) : (
          <button onClick={onBack} style={styles.backBtnInline} aria-label="back">
            <IconArrowLeft />
          </button>
        )}
        <div style={styles.topBarTitle}>{t.settingsBooking}</div>
        <div style={{ width: 36 }} />
      </div>
      <div style={styles.topBarDivider} />

      <div style={styles.themeTabs}>
        <button
          type="button"
          onClick={() => setBookingMode("trainer")}
          style={{
            ...styles.scheduleTab,
            ...(bookingMode === "trainer" ? styles.scheduleTabActive : null),
            alignSelf: "flex-start",
          }}
        >
          {t.bookingTrainerOnly}
        </button>
        <button
          type="button"
          onClick={() => setBookingMode("both")}
          style={{
            ...styles.scheduleTab,
            ...(bookingMode === "both" ? styles.scheduleTabActive : null),
            alignSelf: "flex-start",
          }}
        >
          {t.bookingBoth}
        </button>
      </div>
    </div>
  );
}

function RemindersScreen(props: {
  onBack: () => void;
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  t: UiText;
}) {
  const { onBack, enabled, setEnabled, t } = props;
  return (
    <div style={styles.pageContainer}>
      <div style={styles.topBar}>
        {typeof WebApp?.BackButton?.show === "function" ? (
          <div style={{ width: 36 }} />
        ) : (
          <button onClick={onBack} style={styles.backBtnInline} aria-label="back">
            <IconArrowLeft />
          </button>
        )}
        <div style={styles.topBarTitle}>{t.settingsReminders}</div>
        <div style={{ width: 36 }} />
      </div>
      <div style={styles.topBarDivider} />

      <div style={styles.themeTabs}>
        <button
          type="button"
          onClick={() => setEnabled(true)}
          style={{
            ...styles.scheduleTab,
            ...(enabled ? styles.scheduleTabActive : null),
            alignSelf: "flex-start",
          }}
        >
          {t.remindersOn}
        </button>
        <button
          type="button"
          onClick={() => setEnabled(false)}
          style={{
            ...styles.scheduleTab,
            ...(!enabled ? styles.scheduleTabActive : null),
            alignSelf: "flex-start",
          }}
        >
          {t.remindersOff}
        </button>
      </div>
    </div>
  );
}

function LanguageScreen(props: {
  onBack: () => void;
  language: "ru" | "en";
  setLanguage: (v: "ru" | "en") => void;
  t: UiText;
}) {
  const { onBack, language, setLanguage, t } = props;
  return (
    <div style={styles.pageContainer}>
      <div style={styles.topBar}>
        {typeof WebApp?.BackButton?.show === "function" ? (
          <div style={{ width: 36 }} />
        ) : (
          <button onClick={onBack} style={styles.backBtnInline} aria-label="back">
            <IconArrowLeft />
          </button>
        )}
        <div style={styles.topBarTitle}>{t.languageTitle}</div>
        <div style={{ width: 36 }} />
      </div>
      <div style={styles.topBarDivider} />

      <div style={styles.themeTabs}>
        <button
          type="button"
          onClick={() => setLanguage("ru")}
          style={{
            ...styles.scheduleTab,
            ...(language === "ru" ? styles.scheduleTabActive : null),
            alignSelf: "flex-start",
          }}
        >
          {t.languageRu}
        </button>
        <button
          type="button"
          onClick={() => setLanguage("en")}
          style={{
            ...styles.scheduleTab,
            ...(language === "en" ? styles.scheduleTabActive : null),
            alignSelf: "flex-start",
          }}
        >
          {t.languageEn}
        </button>
      </div>
    </div>
  );
}

function PersonalDataScreen(props: {
  name: string;
  username: string;
  photoUrl: string;
  onUpdateName: (v: string) => void;
  trainerProfile?: TrainerProfile | null;
  onSaveTrainerProfile?: (patch: Partial<TrainerProfile>) => void;
  showSubscriptionTab?: boolean;
  showExtendedAbout?: boolean;
  showClientBasics?: boolean;
  showClientWeights?: boolean;
  subscriptionTabLabel?: string;
  subscriptionItems?: TrainerClientInvite[];
}) {
  const {
    name,
    username,
    photoUrl,
    onUpdateName,
    trainerProfile,
    onSaveTrainerProfile,
    showSubscriptionTab = true,
    showExtendedAbout = true,
    showClientBasics = false,
    showClientWeights = false,
    subscriptionTabLabel,
    subscriptionItems,
  } = props;
  const tr = useTr();
  const resolvedSubscriptionTabLabel = subscriptionTabLabel ?? tr("Моя подписка", "My subscription");

  const [fio, setFio] = useState(name || "");
  const [about, setAbout] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [experience, setExperience] = useState("");
  const [fitnessClub, setFitnessClub] = useState("");
  const [requirements, setRequirements] = useState("");
  const [extraInfo, setExtraInfo] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [clientWeights, setClientWeights] = useState<{ id: string; name: string; weight: string }[]>([]);
  const [showWeightsForm, setShowWeightsForm] = useState(false);
  const [draftWeightName, setDraftWeightName] = useState("");
  const [draftWeightValue, setDraftWeightValue] = useState("");
  const [weightsError, setWeightsError] = useState("");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [otherSocial, setOtherSocial] = useState("");
  const aboutRef = useRef<HTMLTextAreaElement | null>(null);
  const specializationRef = useRef<HTMLTextAreaElement | null>(null);
  const experienceRef = useRef<HTMLTextAreaElement | null>(null);
  const fitnessClubRef = useRef<HTMLTextAreaElement | null>(null);
  const requirementsRef = useRef<HTMLTextAreaElement | null>(null);
  const extraInfoRef = useRef<HTMLTextAreaElement | null>(null);
  const phoneRef = useRef<HTMLTextAreaElement | null>(null);
  const instagramRef = useRef<HTMLTextAreaElement | null>(null);
  const otherSocialRef = useRef<HTMLTextAreaElement | null>(null);
  const [personalTab, setPersonalTab] = useState<"about" | "contacts" | "weights" | "subscription">("about");
  const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(null);

  const subscriptionTrainers = (subscriptionItems || []).filter((c) => !c.archived && c.status === "active");
  const trainerWeights = (subscriptionItems || []).flatMap((trainer) =>
    (trainer.exercises || []).map((ex) => ({
      ...ex,
      trainerId: trainer.id,
      trainerLabel:
        trainer.fullName?.trim()
          ? trainer.fullName
          : trainer.username
            ? `@${trainer.username}`
            : tr("Тренер", "Coach"),
    }))
  );

  useEffect(() => {
    if (!trainerProfile) return;
    if (trainerProfile.fullName !== undefined) setFio(trainerProfile.fullName || "");
    if (trainerProfile.fitnessClub !== undefined) setFitnessClub(trainerProfile.fitnessClub || "");
    if (trainerProfile.specialization !== undefined) setSpecialization(trainerProfile.specialization || "");
    if (trainerProfile.experience !== undefined) setExperience(trainerProfile.experience || "");
    if (trainerProfile.about !== undefined) setAbout(trainerProfile.about || "");
    if (trainerProfile.requirements !== undefined) setRequirements(trainerProfile.requirements || "");
    if (trainerProfile.extraInfo !== undefined) setExtraInfo(trainerProfile.extraInfo || "");
    if (trainerProfile.phone !== undefined) setPhone(trainerProfile.phone || "");
    if (trainerProfile.instagram !== undefined) setInstagram(trainerProfile.instagram || "");
    if (trainerProfile.otherSocial !== undefined) setOtherSocial(trainerProfile.otherSocial || "");
  }, [trainerProfile]);

  const saveTrainerField = (field: keyof TrainerProfile, value: string) => {
    if (!onSaveTrainerProfile) return;
    const current = trainerProfile?.[field] ?? "";
    if (String(current || "") === String(value || "")) return;
    onSaveTrainerProfile({ [field]: value } as Partial<TrainerProfile>);
  };

  useEffect(() => {
    if (!subscriptionTrainers.length) {
      setSelectedTrainerId(null);
      return;
    }
    if (selectedTrainerId && subscriptionTrainers.some((t) => t.id === selectedTrainerId)) return;
    setSelectedTrainerId(subscriptionTrainers[0].id);
  }, [subscriptionTrainers, selectedTrainerId]);

  useEffect(() => {
    if (!showSubscriptionTab && personalTab === "subscription") {
      setPersonalTab("about");
    }
  }, [showSubscriptionTab, personalTab]);

  useEffect(() => {
    if (!showClientWeights && personalTab === "weights") {
      setPersonalTab("about");
    }
  }, [showClientWeights, personalTab]);

  useEffect(() => {
    const el = aboutRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [about, personalTab]);

  useEffect(() => {
    const el = specializationRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [specialization, personalTab]);

  useEffect(() => {
    const el = experienceRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [experience, personalTab]);

  useEffect(() => {
    const el = fitnessClubRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [fitnessClub, personalTab]);

  useEffect(() => {
    const el = requirementsRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [requirements, personalTab]);

  useEffect(() => {
    const el = extraInfoRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [extraInfo, personalTab]);

  useEffect(() => {
    const el = phoneRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [phone, personalTab]);

  useEffect(() => {
    const el = instagramRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [instagram, personalTab]);

  useEffect(() => {
    const el = otherSocialRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [otherSocial, personalTab]);

  return (
    <div style={styles.pageContainer}>
      <div style={styles.personalHeaderRow}>
        <AvatarCircle name={fio || name || username || tr("Пользователь", "User")} photoUrl={photoUrl} size={44} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", lineHeight: 1.2 }}>
            {fio || name || tr("Пользователь", "User")}
          </div>
          <div style={{ opacity: 0.62, fontSize: 13, marginTop: 2 }}>{username ? `@${username}` : ""}</div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={styles.scheduleTabs}>
          <button
            type="button"
            onClick={() => setPersonalTab("about")}
            style={{
              ...styles.scheduleTab,
              ...(personalTab === "about" ? styles.scheduleTabActive : null),
            }}
          >
            {tr("Личная информация", "Personal info")}
          </button>
          <button
            type="button"
            onClick={() => setPersonalTab("contacts")}
            style={{
              ...styles.scheduleTab,
              ...(personalTab === "contacts" ? styles.scheduleTabActive : null),
            }}
          >
            {tr("Контакты", "Contacts")}
          </button>
          {showClientWeights ? (
            <button
              type="button"
              onClick={() => setPersonalTab("weights")}
              style={{
                ...styles.scheduleTab,
                ...(personalTab === "weights" ? styles.scheduleTabActive : null),
              }}
            >
              {tr("Рабочие веса", "Working weights")}
            </button>
          ) : null}
          {showSubscriptionTab ? (
            <button
              type="button"
              onClick={() => setPersonalTab("subscription")}
              style={{
                ...styles.scheduleTab,
                ...(personalTab === "subscription" ? styles.scheduleTabActive : null),
              }}
            >
              {resolvedSubscriptionTabLabel}
            </button>
          ) : null}
        </div>
      </div>
      <div style={{ ...styles.topBarDivider, marginTop: 8 }} />
      {personalTab === "about" ? (
        <div style={styles.clientPanelPlain}>
          <div style={styles.fieldLabel}>
            {tr("ФИО (так будут видеть вас клиенты)", "Full name (visible to clients)")}
          </div>
          <input
            value={fio}
            onChange={(e) => {
              const v = e.target.value;
              setFio(v);
              onUpdateName(v);
            }}
            onBlur={() => {
              saveTrainerField("fullName", fio);
            }}
            placeholder={tr("Введите ФИО", "Enter full name")}
            style={styles.input}
          />
          {showClientBasics ? (
            <>
              <div style={styles.metricsRow}>
                <div style={{ flex: 1 }}>
                  <div style={styles.fieldLabel}>{tr("Рост", "Height")}</div>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={height}
                    onChange={(e) => setHeight(e.target.value.replace(/[^\d]/g, ""))}
                    placeholder={tr("см", "cm")}
                    style={styles.input}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={styles.fieldLabel}>{tr("Вес", "Weight")}</div>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value.replace(/[^\d]/g, ""))}
                    placeholder={tr("кг", "kg")}
                    style={styles.input}
                  />
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={styles.fieldLabel}>{tr("Цель", "Goal")}</div>
                <textarea
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = "auto";
                    el.style.height = `${el.scrollHeight}px`;
                  }}
                  placeholder={tr("Например: сбросить 5 кг", "e.g., lose 5 kg")}
                  rows={1}
                  style={{ ...styles.input, resize: "none", overflow: "hidden" }}
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={styles.fieldLabel}>{tr("Комментарии", "Comments")}</div>
                <textarea
                  value={extraInfo}
                  onChange={(e) => setExtraInfo(e.target.value)}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = "auto";
                    el.style.height = `${el.scrollHeight}px`;
                  }}
                  placeholder={tr("Комментарий", "Comment")}
                  rows={1}
                  style={{ ...styles.input, resize: "none", overflow: "hidden" }}
                />
              </div>
            </>
          ) : null}
          {showExtendedAbout ? (
            <>
              <div style={{ marginTop: 16 }}>
                <div style={styles.fieldLabel}>{tr("Фитнес-клуб", "Fitness club")}</div>
                <textarea
                  ref={fitnessClubRef}
                  value={fitnessClub}
                  onChange={(e) => setFitnessClub(e.target.value)}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = "auto";
                    el.style.height = `${el.scrollHeight}px`;
                  }}
                  onBlur={() => saveTrainerField("fitnessClub", fitnessClub)}
                  placeholder={tr("Введите адрес проведения занятий", "Enter the training address")}
                  rows={1}
                  style={{ ...styles.input, resize: "none", overflow: "hidden" }}
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={styles.fieldLabel}>{tr("Специаллизация", "Specialization")}</div>
                <textarea
                  ref={specializationRef}
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = "auto";
                    el.style.height = `${el.scrollHeight}px`;
                  }}
                  onBlur={() => saveTrainerField("specialization", specialization)}
                  placeholder={tr("Например: силовые тренировки...", "e.g., strength training...")}
                  rows={1}
                  style={{ ...styles.input, resize: "none", overflow: "hidden" }}
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={styles.fieldLabel}>{tr("Опыт работы", "Experience")}</div>
                <textarea
                  ref={experienceRef}
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = "auto";
                    el.style.height = `${el.scrollHeight}px`;
                  }}
                  onBlur={() => saveTrainerField("experience", experience)}
                  placeholder={tr("Например: 5 лет", "e.g., 5 years")}
                  rows={1}
                  style={{ ...styles.input, resize: "none", overflow: "hidden" }}
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={styles.fieldLabel}>{tr("О себе", "About")}</div>
                <textarea
                  ref={aboutRef}
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = "auto";
                    el.style.height = `${el.scrollHeight}px`;
                  }}
                  onBlur={() => saveTrainerField("about", about)}
                  placeholder={tr("Коротко о себе...", "Short bio...")}
                  rows={1}
                  style={{ ...styles.input, resize: "none", overflow: "hidden" }}
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={styles.fieldLabel}>{tr("Требования к проведению занятий", "Session requirements")}</div>
                <textarea
                  ref={requirementsRef}
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = "auto";
                    el.style.height = `${el.scrollHeight}px`;
                  }}
                  onBlur={() => saveTrainerField("requirements", requirements)}
                  placeholder={tr("Опишите требования...", "Describe requirements...")}
                  rows={1}
                  style={{ ...styles.input, resize: "none", overflow: "hidden" }}
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={styles.fieldLabel}>{tr("Дополнительная информация", "Additional info")}</div>
                <textarea
                  ref={extraInfoRef}
                  value={extraInfo}
                  onChange={(e) => setExtraInfo(e.target.value)}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = "auto";
                    el.style.height = `${el.scrollHeight}px`;
                  }}
                  onBlur={() => saveTrainerField("extraInfo", extraInfo)}
                  placeholder={tr("Добавьте информацию...", "Add information...")}
                  rows={1}
                  style={{ ...styles.input, resize: "none", overflow: "hidden" }}
                />
              </div>
            </>
          ) : null}
        </div>
      ) : personalTab === "contacts" ? (
        <div style={styles.clientPanelPlain}>
          <div style={styles.fieldLabel}>{tr("Номер телефона", "Phone number")}</div>
          <textarea
            ref={phoneRef}
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
            }}
            onBlur={() => saveTrainerField("phone", phone)}
            placeholder={tr("Введите номер телефона", "Enter phone number")}
            rows={1}
            style={{ ...styles.input, resize: "none", overflow: "hidden" }}
          />
          <div style={{ marginTop: 16 }}>
            <div style={styles.fieldLabel}>Telegram</div>
            <button
              type="button"
              onClick={() => {
                if (!username) return;
                copyText(username);
                WebApp?.showPopup?.({
                  title: tr("Скопировано", "Copied"),
                  message: `Username: @${username}`,
                  buttons: [{ type: "ok" }],
                });
              }}
              style={styles.copyRowBtn}
              aria-label="copy telegram username"
            >
              <div style={styles.readOnlyValue}>{username ? `@${username}` : "—"}</div>
            </button>
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={styles.fieldLabel}>Instagram</div>
          <textarea
            ref={instagramRef}
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
            }}
            onBlur={() => saveTrainerField("instagram", instagram)}
            placeholder={tr("Введите Instagram", "Enter Instagram")}
            rows={1}
            style={{ ...styles.input, resize: "none", overflow: "hidden" }}
          />
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={styles.fieldLabel}>{tr("Иная социальная сеть", "Other social network")}</div>
          <textarea
            ref={otherSocialRef}
            value={otherSocial}
            onChange={(e) => setOtherSocial(e.target.value)}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
            }}
            onBlur={() => saveTrainerField("otherSocial", otherSocial)}
            placeholder={tr("Введите ссылку или ник", "Enter link or handle")}
            rows={1}
            style={{ ...styles.input, resize: "none", overflow: "hidden" }}
          />
          </div>
        </div>
      ) : personalTab === "weights" ? (
        <div style={styles.clientPanelPlain}>
          <button
            type="button"
            style={styles.addWindowBtn}
            onClick={() => {
              setShowWeightsForm((v) => !v);
              setWeightsError("");
            }}
          >
            {tr("Добавить упражнение", "Add exercise")}
          </button>
          {showWeightsForm ? (
            <div style={{ marginTop: 12 }}>
              <div style={styles.fieldLabel}>{tr("Название упражнения", "Exercise name")}</div>
              <input
                value={draftWeightName}
                onChange={(e) => {
                  setDraftWeightName(e.target.value);
                  if (weightsError) setWeightsError("");
                }}
                placeholder={tr("Например: Жим лёжа", "e.g., Bench press")}
                style={styles.input}
              />
              <div style={{ marginTop: 12 }}>
                <div style={styles.fieldLabel}>{tr("Вес", "Weight")}</div>
                <input
                  value={draftWeightValue}
                  onChange={(e) => {
                    setDraftWeightValue(e.target.value);
                    if (weightsError) setWeightsError("");
                  }}
                  placeholder={tr("Например: 60 кг", "e.g., 60 kg")}
                  style={styles.input}
                />
              </div>
              {weightsError ? <div style={styles.errorText}>{weightsError}</div> : null}
              <button
                type="button"
                onClick={() => {
                  const nameValue = draftWeightName.trim();
                  const weightValue = draftWeightValue.trim();
                  if (!nameValue || !weightValue) {
                    setWeightsError(tr("Заполни название и вес упражнения.", "Enter the exercise name and weight."));
                    return;
                  }
                  setClientWeights((prev) => [
                    ...prev,
                    { id: cryptoId(), name: nameValue, weight: weightValue },
                  ]);
                  setDraftWeightName("");
                  setDraftWeightValue("");
                  setShowWeightsForm(false);
                  setWeightsError("");
                }}
                style={styles.saveBtn}
              >
                {tr("Сохранить", "Save")}
              </button>
            </div>
          ) : null}

          {trainerWeights.length === 0 && clientWeights.length === 0 ? (
            <div style={{ marginTop: 12, opacity: 0.7, fontSize: 14 }}>
              {tr("Пока нет рабочих весов.", "No working weights yet.")}
            </div>
          ) : (
            <div style={{ marginTop: 16 }}>
              <div style={styles.sectionHeaderSmall}>{tr("Список упражнений", "Exercises list")}</div>
              <div style={styles.listBlock}>
                {[...trainerWeights, ...clientWeights.map((ex) => ({ ...ex, trainerLabel: tr("Вы", "You") }))].map(
                  (ex, idx, arr) => {
                    const isLast = idx === arr.length - 1;
                    const canEdit = ex.trainerLabel === tr("Вы", "You");
                    return (
                      <div
                        key={ex.id}
                        style={{
                          ...styles.rowWrap,
                          borderBottom: isLast ? "none" : "1px solid var(--border-2)",
                          padding: "12px 0",
                        }}
                      >
                        <div style={styles.exerciseRow}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={styles.rowTitle}>{ex.name || tr("Без названия", "Untitled")}</div>
                            <div style={styles.rowSubtitle}>{ex.trainerLabel}</div>
                            <div style={styles.exerciseWeightRow}>
                              <input
                                value={ex.weight || ""}
                                onChange={(e) => {
                                  if (!canEdit) return;
                                  const value = e.target.value;
                                  setClientWeights((prev) =>
                                    prev.map((item) =>
                                      item.id === ex.id ? { ...item, weight: value } : item
                                    )
                                  );
                                }}
                                placeholder={tr("Вес не указан", "Weight not set")}
                                readOnly={!canEdit}
                                style={styles.exerciseInput}
                              />
                              {canEdit ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setClientWeights((prev) => prev.filter((item) => item.id !== ex.id));
                                  }}
                                  style={styles.exerciseTrashBtn}
                                  aria-label="delete exercise"
                                  title={tr("Удалить", "Delete")}
                                >
                                  <span style={styles.trashEmoji}>🗑</span>
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )}
        </div>
      ) : personalTab === "subscription" ? (
        <div style={styles.clientPanelPlain}>
          {subscriptionItems ? (
            subscriptionTrainers.length > 0 ? (
              <>
                <div style={styles.subscriptionTrainerStrip}>
                  {subscriptionTrainers.map((trainer) => {
                    const isActive = trainer.id === selectedTrainerId;
                    const label =
                      trainer.fullName?.trim()
                        ? trainer.fullName
                        : trainer.username
                        ? `@${trainer.username}`
                        : tr("Тренер", "Coach");
                    const statusInfo =
                      trainer.subscriptionEnd && trainer.subscriptionEnd !== "—"
                        ? getSubscriptionStatus(trainer.subscriptionEnd, new Date())
                        : { label: tr("Нет данных", "No data"), color: "var(--muted)" };

                    return (
                      <button
                        key={trainer.id}
                        type="button"
                        onClick={() => setSelectedTrainerId(trainer.id)}
                        style={{
                          ...(isActive ? styles.subscriptionTrainerCardActive : styles.subscriptionTrainerCard),
                        }}
                      >
                        <div style={styles.subscriptionTrainerName}>{label}</div>
                        <div style={{ ...styles.subscriptionTrainerStatus, color: statusInfo.color }}>
                          {statusInfo.label}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {selectedTrainerId ? (() => {
                  const trainer = subscriptionTrainers.find((t) => t.id === selectedTrainerId);
                  if (!trainer) return null;
                  const total = trainer.subscriptionTotal || "—";
                  const left =
                    trainer.subscriptionLeft && trainer.subscriptionLeft.length > 0
                      ? trainer.subscriptionLeft
                      : trainer.subscriptionTotal || "—";
                  const price = trainer.subscriptionPrice || "—";
                  return (
                    <div style={styles.subscriptionDetails}>
                      <div style={styles.subscriptionDetailsTitle}>{tr("Абонемент", "Subscription")}</div>
                      <div style={styles.subscriptionDetailsRow}>
                        <div style={styles.subscriptionDetailsLabel}>{tr("Дата начала", "Start date")}</div>
                        <div style={styles.subscriptionDetailsValue}>{trainer.subscriptionStart || "—"}</div>
                      </div>
                      <div style={styles.subscriptionDetailsRow}>
                        <div style={styles.subscriptionDetailsLabel}>{tr("Дата завершения", "End date")}</div>
                        <div style={styles.subscriptionDetailsValue}>{trainer.subscriptionEnd || "—"}</div>
                      </div>
                      <div style={styles.subscriptionDetailsRow}>
                        <div style={styles.subscriptionDetailsLabel}>{tr("Стоимость тренировки", "Session price")}</div>
                        <div style={styles.subscriptionDetailsValue}>{price}</div>
                      </div>
                      <div style={styles.subscriptionDetailsRow}>
                        <div style={styles.subscriptionDetailsLabel}>{tr("Занятий в абонементе", "Sessions in subscription")}</div>
                        <div style={styles.subscriptionDetailsValue}>{total}</div>
                      </div>
                      <div style={styles.subscriptionDetailsRow}>
                        <div style={styles.subscriptionDetailsLabel}>{tr("Занятий осталось", "Sessions left")}</div>
                        <div style={styles.subscriptionDetailsValue}>{left}</div>
                      </div>
                    </div>
                  );
                })() : null}
              </>
            ) : (
              <div style={styles.clientPanelBody}>{tr("Пока нет подключённых тренеров.", "No connected coaches yet.")}</div>
            )
          ) : (
            <div style={styles.clientPanelBody}>{tr("Пока заглушка.", "Placeholder for now.")}</div>
          )}
        </div>
      ) : (
        <div style={styles.clientPanelPlain}>
          <div style={styles.clientPanelBody}>{tr("Пока заглушка.", "Placeholder for now.")}</div>
        </div>
      )}
    </div>
  );
}

function ClientTrainerConnectScreen(props: {
  showTopBar?: boolean;
  embedded?: boolean;
  onBack: () => void;
  invites: TrainerClientInvite[];
  setInvites: React.Dispatch<React.SetStateAction<TrainerClientInvite[]>>;
  onConnected: () => void;
}) {
  const { showTopBar = true, embedded = false, onBack, invites: _invites, setInvites, onConnected } = props;
  const tr = useTr();
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState("");

  const content = (
    <>
      <div style={{ opacity: 0.72, fontSize: 14, lineHeight: 1.35 }}>
        {tr(
          "Для того, чтобы добавить тренера, введите ниже инвайт-код.",
          "To add a coach, enter the invite code below."
        )}
      </div>
      <div style={{ marginTop: 14 }}>
        <input
          value={inviteCode}
          onChange={(e) => {
            setInviteCode(e.target.value);
            if (message) setMessage("");
          }}
          placeholder={tr("Инвайт-код", "Invite code")}
          style={styles.input}
        />
        <button
          type="button"
          onClick={() => {
            const code = (inviteCode || "").trim();
            if (!code) {
              setMessage(tr("Введите инвайт-код.", "Enter an invite code."));
              return;
            }
            if (code.toLowerCase() === UNIVERSAL_INVITE_CODE.toLowerCase()) {
              setMessage("");
              setInviteCode("");
              onConnected();
              try {
                localStorage.setItem("clientConnected", "true");
              } catch {
                // ignore
              }
              return;
            }
            let found = false;
            setInvites((prev) => {
              const idx = prev.findIndex((c) => c.code.toLowerCase() === code.toLowerCase());
              if (idx === -1) return prev;
              found = true;
              return prev.map((c, i) => (i === idx ? { ...c, status: "active", archived: false } : c));
            });
            if (!found) {
              setMessage(tr("Код не найден. Проверь правильность.", "Code not found. Check it and try again."));
              return;
            }
            setMessage("");
            setInviteCode("");
            onConnected();
            try {
              localStorage.setItem("clientConnected", "true");
            } catch {
              // ignore
            }
          }}
          style={{ ...styles.primaryBtn, marginTop: 10 }}
        >
          {tr("Подключить", "Connect")}
        </button>
        {message ? <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>{message}</div> : null}
      </div>
    </>
  );

  if (embedded) {
    return <div style={{ marginTop: 10 }}>{content}</div>;
  }

  return (
    <div style={styles.pageContainer}>
      {showTopBar ? (
        <div style={styles.topBar}>
          {typeof WebApp?.BackButton?.show === "function" ? (
            <div style={{ width: 36 }} />
          ) : (
            <button onClick={onBack} style={styles.backBtnInline} aria-label="back">
              <IconArrowLeft />
            </button>
          )}
          <div style={styles.topBarTitle}>{tr("Добавить тренера", "Add coach")}</div>
          <div style={{ width: 36 }} />
        </div>
      ) : null}

      {content}
    </div>
  );
}

function ClientTrainerDetailScreen(props: { trainer: TrainerClientInvite; onBack: () => void }) {
  const { trainer, onBack } = props;
  const tr = useTr();
  const hasTgBack = typeof WebApp?.BackButton?.show === "function";
  const [tab, setTab] = useState<"about" | "contacts">("about");

  const displayName =
    trainer.fullName?.trim()
      ? trainer.fullName
      : trainer.username
      ? `@${trainer.username}`
      : tr("Тренер", "Coach");
  const profile = trainer.trainerProfile;

  const renderReadOnly = (label: string, value?: string) => (
    <div style={{ marginTop: 16 }}>
      <div style={styles.fieldLabel}>{label}</div>
      <div style={styles.readOnlyValue}>{value && value.trim() ? value : "—"}</div>
    </div>
  );

  return (
    <div style={styles.pageContainer}>
      <div style={styles.topBar}>
        {hasTgBack ? (
          <div style={{ width: 36 }} />
        ) : (
          <button onClick={onBack} style={styles.backBtnInline} aria-label="back">
            <IconArrowLeft />
          </button>
        )}
        <div style={styles.topBarTitle}>{tr("Тренер", "Coach")}</div>
        <div style={{ width: 36 }} />
      </div>

      <div style={styles.personalHeaderRow}>
        <AvatarCircle name={displayName} photoUrl={trainer.photoUrl || ""} size={44} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", lineHeight: 1.2 }}>
            {displayName}
          </div>
          <div style={{ opacity: 0.62, fontSize: 13, marginTop: 2 }}>
            {trainer.username ? `@${trainer.username}` : ""}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={styles.scheduleTabs}>
          <button
            type="button"
            onClick={() => setTab("about")}
            style={{
              ...styles.scheduleTab,
              ...(tab === "about" ? styles.scheduleTabActive : null),
            }}
          >
            {tr("Личная информация", "Personal info")}
          </button>
          <button
            type="button"
            onClick={() => setTab("contacts")}
            style={{
              ...styles.scheduleTab,
              ...(tab === "contacts" ? styles.scheduleTabActive : null),
            }}
          >
            {tr("Контакты", "Contacts")}
          </button>
        </div>
      </div>
      <div style={{ ...styles.topBarDivider, marginTop: 8 }} />

      {tab === "about" ? (
        <div style={styles.clientPanelPlain}>
          {renderReadOnly(tr("ФИО", "Full name"), displayName)}
          {renderReadOnly(tr("Фитнес-клуб", "Fitness club"), profile?.fitnessClub)}
          {renderReadOnly(tr("Специализация", "Specialization"), profile?.specialization)}
          {renderReadOnly(tr("Опыт работы", "Experience"), profile?.experience)}
          {renderReadOnly(tr("О себе", "About"), profile?.about)}
          {renderReadOnly(tr("Требования к проведению занятий", "Session requirements"), profile?.requirements)}
          {renderReadOnly(tr("Дополнительная информация", "Additional info"), profile?.extraInfo)}
        </div>
      ) : (
        <div style={styles.clientPanelPlain}>
          {renderReadOnly(tr("Номер телефона", "Phone number"), profile?.phone)}
          {renderReadOnly("Telegram", trainer.username ? `@${trainer.username}` : "")}
          {renderReadOnly("Instagram", profile?.instagram)}
          {renderReadOnly(tr("Иная социальная сеть", "Other social network"), profile?.otherSocial)}
        </div>
      )}
    </div>
  );
}


function SettingsRow(props: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onClick: () => void;
  isLast?: boolean;
  hideChevron?: boolean;
}) {
  const { icon, title, subtitle, right, onClick, isLast, hideChevron } = props;

  return (
    <button
      onClick={onClick}
      style={{
        ...styles.rowBtn,
        borderBottom: isLast ? "none" : "1px solid var(--border-2)",
      }}
    >
      <div style={styles.rowLeft}>
        <div style={styles.rowIcon}>{icon}</div>
        <div style={{ textAlign: "left" }}>
          <div style={styles.rowTitle}>{title}</div>
          {subtitle ? <div style={styles.rowSubtitle}>{subtitle}</div> : null}
        </div>
      </div>

      <div style={styles.rowRight}>
        {right ? <div style={styles.rowRightText}>{right}</div> : null}
        {!hideChevron ? (
          <div style={styles.rowChevron}>
            <IconChevronRight />
          </div>
        ) : null}
      </div>
    </button>
  );
}

function AvatarCircle({ name, photoUrl, size }: { name: string; photoUrl: string; size: number }) {
  const initial = (name || "?").trim().slice(0, 1).toUpperCase();

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        background: "var(--surface-2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto",
      }}
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt="avatar"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          referrerPolicy="no-referrer"
        />
      ) : (
        <div style={{ fontSize: Math.floor(size / 2), fontWeight: 800, color: "var(--muted)" }}>{initial}</div>
      )}
    </div>
  );
}

// -----------------------
// Bottom navigation
// -----------------------
function BottomNav<T extends string>(props: {
  active: T;
  onChange: (t: T) => void;
  items: { id: T; label: string; icon: React.ReactNode }[];
  hidden?: boolean;
}) {
  const { active, onChange, items, hidden } = props;

  return (
    <div style={{ ...styles.bottomNav, display: hidden ? "none" : "flex" }}>
      {items.map((it) => {
        const isActive = it.id === active;
        const color = isActive ? "var(--accent)" : "var(--muted)";

        return (
          <button
            key={it.id}
            onClick={() => onChange(it.id)}
            style={{
              ...styles.navBtn,
              color,
            }}
          >
            <div style={{ ...styles.navIconWrap, color }}>{it.icon}</div>
            <div style={{ ...styles.navLabel, color, fontWeight: isActive ? 700 : 600 }}>{it.label}</div>
          </button>
        );
      })}
    </div>
  );
}

// -----------------------
// Helpers
// -----------------------
function cryptoId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function startOfDay(d: Date) {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function addDays(d: Date, delta: number) {
  const out = new Date(d);
  out.setDate(out.getDate() + delta);
  return out;
}

function formatDateShort(d: Date) {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}`;
}

function formatDateShortMonth(d: Date) {
  const months =
    currentLanguage === "en"
      ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      : ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const day = String(d.getDate()).padStart(2, "0");
  return `${day} ${months[d.getMonth()]}`;
}

function formatMoney(value: number) {
  const locale = currentLanguage === "en" ? "en-US" : "ru-RU";
  return `${value.toLocaleString(locale)} ₽`;
}

function parsePriceToNumber(raw: string | undefined) {
  if (!raw) return 0;
  const num = parseInt(raw.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(num) ? num : 0;
}

function getSessionPrice(clients: TrainerClientInvite[], session: SessionItem) {
  if (session.price && session.price.trim()) {
    return parsePriceToNumber(session.price);
  }
  const client = clients.find((c) => c.username === session.clientUsername);
  return parsePriceToNumber(client?.subscriptionPrice);
}

function formatDateKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function parseDateKey(key: string) {
  const [y, m, d] = key.split("-").map((x) => parseInt(x, 10));
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

function normalizeTimeInput(raw: string) {
  const v = (raw || "").trim();
  if (!v) return "";
  if (/^\d{1,2}$/.test(v)) {
    const h = Math.max(0, Math.min(23, parseInt(v, 10)));
    return `${String(h).padStart(2, "0")}:00`;
  }
  const cleaned = v.replace(/[.\-]/g, ":");
  if (/^\d{1,2}:\d{1,2}$/.test(cleaned)) {
    const [hRaw, mRaw] = cleaned.split(":");
    const h = parseInt(hRaw, 10);
    const m = parseInt(mRaw, 10);
    if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return "";
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  return "";
}

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function sessionEndTime(s: SessionItem) {
  const d = parseDateKey(s.dateKey);
  const [h, m] = s.end.split(":").map((x) => parseInt(x, 10));
  if (!Number.isNaN(h)) d.setHours(h);
  if (!Number.isNaN(m)) d.setMinutes(m);
  d.setSeconds(0, 0);
  return d;
}

function isSessionEnded(s: SessionItem, now: Date) {
  return sessionEndTime(s).getTime() <= now.getTime();
}

function sessionStartTime(s: SessionItem) {
  const d = parseDateKey(s.dateKey);
  const [h, m] = s.start.split(":").map((x) => parseInt(x, 10));
  if (!Number.isNaN(h)) d.setHours(h);
  if (!Number.isNaN(m)) d.setMinutes(m);
  d.setSeconds(0, 0);
  return d;
}

function sessionStatusLabel(s: SessionItem, now = new Date()) {
  const start = sessionStartTime(s).getTime();
  const end = sessionEndTime(s).getTime();
  if (now.getTime() < start) return trGlobal("Запланирована", "Scheduled");
  if (now.getTime() >= start && now.getTime() < end) return trGlobal("Идёт", "In progress");
  return trGlobal("Завершена", "Completed");
}

function sessionStatusColor(s: SessionItem, now = new Date()) {
  const start = sessionStartTime(s).getTime();
  const end = sessionEndTime(s).getTime();
  if (now.getTime() < start) return "var(--accent)";
  if (now.getTime() >= start && now.getTime() < end) return "#22c55e";
  return "#8b93a6";
}

function mapClientFromApi(c: any): TrainerClientInvite {
  return {
    id: String(c.id),
    username: String(c.clientUsername || ""),
    code: String(c.code || ""),
    createdAt: c.createdAt ? new Date(c.createdAt).getTime() : Date.now(),
    status: c.status === "active" ? "active" : "pending",
    photoUrl: "",
    fullName: c.fullName ?? "",
    height: c.height ?? "",
    weight: c.weight ?? "",
    goal: c.goal ?? "",
    comment: c.comment ?? "",
    exercises: Array.isArray(c.exercises)
      ? c.exercises.map((ex: any) => ({
          id: String(ex.id),
          name: String(ex.name || ""),
          weight: String(ex.weight || ""),
        }))
      : [],
    subscriptionStart: c.subscriptionStart ?? "",
    subscriptionEnd: c.subscriptionEnd ?? "",
    subscriptionPrice: c.subscriptionPrice ?? "",
    subscriptionTotal: c.subscriptionTotal ?? "",
    subscriptionLeft: c.subscriptionLeft ?? "",
    archived: Boolean(c.archived),
  };
}

function mapSessionFromApi(s: any): SessionItem {
  const startAt = s?.startAt ? new Date(s.startAt) : new Date();
  return {
    id: String(s.id),
    dateKey: formatDateKey(startAt),
    start: String(s.startTime || ""),
    end: String(s.endTime || ""),
    clientUsername: String(s.clientUsername || ""),
    type: s.type ? String(s.type) : undefined,
    comment: s.comment ? String(s.comment) : undefined,
  };
}

function getClientLabel(clients: TrainerClientInvite[], username: string) {
  const c = clients.find((x) => x.username === username);
  if (c?.fullName && c.fullName.trim()) return c.fullName;
  return `@${username}`;
}

function canScheduleClientOnDate(
  clients: TrainerClientInvite[],
  username: string
) {
  const c = clients.find((x) => x.username === username);
  if (!c || c.archived) return false;
  if (c.status !== "active") return false;
  return true;
}

function normalizeNumberWithUnit(raw: string, unit: "см" | "кг") {
  const v = (raw || "").trim().replace(",", ".");
  if (!v) return "";
  const num = parseFloat(v);
  if (Number.isNaN(num)) return "";
  const clean = Number.isInteger(num) ? String(num) : String(num);
  const mappedUnit = currentLanguage === "en" ? (unit === "см" ? "cm" : "kg") : unit;
  return `${clean} ${mappedUnit}`;
}

function parseDateDMY(value: string) {
  const v = (value || "").trim();
  if (!/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(v)) return null;
  const [dRaw, mRaw, yRaw] = v.split(".");
  const d = parseInt(dRaw, 10);
  const m = parseInt(mRaw, 10);
  const y = parseInt(yRaw, 10);
  if (Number.isNaN(d) || Number.isNaN(m) || Number.isNaN(y)) return null;
  const date = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

function endDateEnd(d: Date) {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

function normalizePriceRUB(raw: string) {
  const v = (raw || "").trim();
  if (!v) return "";
  const cleaned = v.replace(/[^\d.,]/g, "").replace(",", ".");
  if (!cleaned) return "";
  const num = parseFloat(cleaned);
  if (Number.isNaN(num)) return "";
  const formatted = Number.isInteger(num) ? String(num) : String(num);
  return `${formatted} ₽`;
}

function normalizePriceRUBWithDelete(raw: string, prev: string) {
  if (prev && prev.includes("₽") && !raw.includes("₽") && raw.length < prev.length) {
    return raw.trimEnd();
  }
  return normalizePriceRUB(raw);
}

function emptySessionsMessage(selected: Date, today: Date) {
  const day = startOfDay(selected);
  const base = startOfDay(today);
  const diffDays = Math.round((day.getTime() - base.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return trGlobal("На сегодня нет запланированных занятий", "No sessions scheduled for today");
  if (diffDays === 1) return trGlobal("На завтра нет запланированных занятий", "No sessions scheduled for tomorrow");
  return trGlobal(`На ${formatDateShort(day)} нет запланированных занятий`, `No sessions scheduled for ${formatDateShort(day)}`);
}

function buildCalendarStrip(base: Date, daysBefore: number, daysAfter: number) {
  const out: { key: string; date: Date; dateText: string }[] = [];
  for (let i = -daysBefore; i <= daysAfter; i++) {
    const date = addDays(base, i);
    out.push({
      key: formatDateKey(date),
      date,
      dateText: formatDateShort(date),
    });
  }
  return out;
}

function copyText(text: string) {
  try {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // ignore
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  } catch {
    // ignore
  }
}

// -----------------------
// Global styles
// -----------------------
function GlobalStyles() {
  return (
    <style>{`
      :root {
        --bg: #ffffff;
        --surface: #ffffff;
        --surface-2: #f6f7f9;
        --text: #111827;
        --text-strong: #1f2d3d;
        --muted: #6b7280;
        --border: #e5e7eb;
        --border-2: #ececec;
        --nav-border: #e6e6e6;
        --accent: #1677ff;
        --accent-contrast: #ffffff;
        --success-bg: #eaf7ea;
        --success-text: #1b7f2a;
        --danger: #b42318;
        --keyboard-inset: 0px;
        color-scheme: light;
      }
      :root[data-theme="dark"] {
        --bg: #171a20;
        --surface: #1f2430;
        --surface-2: #262c3a;
        --text: #f0f3f7;
        --text-strong: #ffffff;
        --muted: #b1bccb;
        --border: #323a4a;
        --border-2: #2b3242;
        --nav-border: #2a3140;
        --accent: #66afff;
        --accent-contrast: #0e1420;
        --success-bg: #1c3a28;
        --success-text: #7ee29c;
        --danger: #ff8a8a;
        color-scheme: dark;
      }
      input, textarea { caret-color: var(--text); font-size: 16px; }
      .home-next-card {
        transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease;
      }
      .home-next-card:active {
        transform: scale(0.99);
        box-shadow: inset 0 0 0 1px rgba(77, 163, 255, 0.2);
      }
      html, body, #root { width: 100vw; height: var(--tg-viewport-stable-height, 100%); margin: 0; background: var(--bg); color: var(--text); overflow: hidden; }
      body { position: fixed; width: 100vw; height: var(--tg-viewport-stable-height, 100%); overscroll-behavior: none; }
      body.keyboard-open { position: fixed; width: 100vw; height: 100%; overflow: hidden; }
      [data-scroll-area] { scrollbar-gutter: stable; }
      * { scrollbar-width: none; -ms-overflow-style: none; }
      *::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none; }
      button { -webkit-tap-highlight-color: transparent; }
      @keyframes spin { to { transform: rotate(360deg); } }
    `}</style>
  );
}

// -----------------------
// Icons (flat SVG)
// -----------------------
type IconProps = { size?: number; strokeWidth?: number };

function SvgIcon({ children, size = 22, strokeWidth = 1.9 }: React.PropsWithChildren<IconProps>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

function IconHome() {
  return (
    <SvgIcon>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.8V21h13V9.8" />
      <path d="M9.5 21v-6.5h5V21" />
    </SvgIcon>
  );
}

function IconCalendar() {
  return (
    <SvgIcon>
      <path d="M7 3v3M17 3v3" />
      <path d="M4.5 7.5h15" />
      <rect x="4.5" y="6" width="15" height="15" rx="2.5" />
      <path d="M8 12h3M13 12h3M8 16h3M13 16h3" />
    </SvgIcon>
  );
}

function IconUsers() {
  return (
    <SvgIcon>
      <path d="M16 11.2a3.2 3.2 0 1 0-3.2-3.2A3.2 3.2 0 0 0 16 11.2Z" />
      <path d="M8.2 11.6A2.8 2.8 0 1 0 5.4 8.8a2.8 2.8 0 0 0 2.8 2.8Z" />
      <path d="M20.5 20.5c-.6-3-2.7-4.7-4.9-4.7H15c-2.2 0-4.3 1.7-4.9 4.7" />
      <path d="M10.8 20.5c-.4-2.2-2.1-3.5-4-3.5H6.3c-1.9 0-3.6 1.3-4 3.5" />
    </SvgIcon>
  );
}

function IconSettings() {
  return (
    <SvgIcon>
      <path d="M12 15.2a3.2 3.2 0 1 0-3.2-3.2 3.2 3.2 0 0 0 3.2 3.2Z" />
      <path d="M19.4 12a7.5 7.5 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.7-1l-.4-2.6H9.2l-.4 2.6a8 8 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.5a7.5 7.5 0 0 0 0 2L.7 13.5l2 3.4 2.4-1a8 8 0 0 0 1.7 1l.4 2.6h5.6l.4-2.6a8 8 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z" />
    </SvgIcon>
  );
}

function IconUser() {
  return (
    <SvgIcon>
      <path d="M12 12.2a4.2 4.2 0 1 0-4.2-4.2A4.2 4.2 0 0 0 12 12.2Z" />
      <path d="M20 21c-1.2-4-4.2-6.1-8-6.1S5.2 17 4 21" />
    </SvgIcon>
  );
}

function IconGlobe() {
  return (
    <SvgIcon>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 12h17" />
      <path d="M12 3c2.7 2.5 4.2 5.6 4.2 9S14.7 18.5 12 21c-2.7-2.5-4.2-5.6-4.2-9S9.3 5.5 12 3Z" />
    </SvgIcon>
  );
}

function IconPalette() {
  return (
    <SvgIcon>
      <path d="M12 3.2c5.1 0 9.3 3.6 9.3 8 0 2.4-1.5 3.8-3.7 3.8h-1.9c-1 0-1.8.8-1.8 1.8 0 1.6-1.2 2.8-3.9 2.8C6 20.4 2.7 17.2 2.7 13c0-5.5 4-9.8 9.3-9.8Z" />
      <path d="M7.3 11.2h0" />
      <path d="M10 8.5h0" />
      <path d="M14.3 8.8h0" />
      <path d="M16.6 12h0" />
    </SvgIcon>
  );
}

function IconBox() {
  return (
    <SvgIcon>
      <path d="M21 8.5 12 3 3 8.5l9 5 9-5Z" />
      <path d="M3 8.5V16l9 5 9-5V8.5" />
      <path d="M12 13.5V21" />
    </SvgIcon>
  );
}

function IconSupport() {
  return (
    <SvgIcon>
      <path d="M4.5 12a7.5 7.5 0 0 1 15 0" />
      <path d="M4.5 12v4a2 2 0 0 0 2 2h1" />
      <path d="M19.5 12v4a2 2 0 0 1-2 2h-1" />
      <path d="M7.5 12v3" />
      <path d="M16.5 12v3" />
    </SvgIcon>
  );
}

function IconLock() {
  return (
    <SvgIcon>
      <rect x="6.5" y="11" width="11" height="10" rx="2" />
      <path d="M8.5 11V8.5A3.5 3.5 0 0 1 12 5a3.5 3.5 0 0 1 3.5 3.5V11" />
      <path d="M12 15.3v2.2" />
    </SvgIcon>
  );
}

function IconBell() {
  return (
    <SvgIcon>
      <path d="M6 9a6 6 0 1 1 12 0c0 4 1.2 5.3 2 6H4c.8-.7 2-2 2-6Z" />
      <path d="M9.5 19a2.5 2.5 0 0 0 5 0" />
    </SvgIcon>
  );
}

function IconChevronRight() {
  return (
    <SvgIcon size={18} strokeWidth={2}>
      <path d="M9 6l6 6-6 6" />
    </SvgIcon>
  );
}

function IconArrowLeft() {
  return (
    <SvgIcon size={18} strokeWidth={2}>
      <path d="M12 19l-7-7 7-7" />
      <path d="M5 12h14" />
    </SvgIcon>
  );
}

function IconPlus() {
  return <span style={{ fontSize: 26, lineHeight: 1 }}>➕</span>;
}

function IconCopy() {
  return (
    <SvgIcon size={18} strokeWidth={2}>
      <rect x="9" y="9" width="10" height="10" rx="2" />
      <path d="M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" />
    </SvgIcon>
  );
}

function IconTrash() {
  // ✅ чуть крупнее + контрастнее
  return (
    <SvgIcon size={22} strokeWidth={2.1}>
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 14h10l1-14" />
      <path d="M9 7V4h6v3" />
    </SvgIcon>
  );
}

// -----------------------
// Styles
// -----------------------
const styles: Record<string, any> = {
  appShell: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif',
    background: "var(--bg)",
    minHeight: "100vh",
    color: "var(--text)",
    overflowX: "hidden",
  },

  appFrame: {
    width: "100vw",
    maxWidth: 520,
    margin: "0 auto",
    height: "var(--tg-viewport-stable-height, 100vh)",
    display: "flex",
    flexDirection: "column",
    background: "var(--bg)",
    overflowX: "hidden",
  },

  scrollArea: {
    flex: 1,
    overflowY: "scroll",
    paddingBottom: 72,
    background: "var(--bg)",
    overflowX: "hidden",
    scrollbarGutter: "stable",
  },

  pageContainer: {
    width: "100vw",
    maxWidth: 520,
    margin: "0 auto",
    padding: "18px 18px",
    boxSizing: "border-box",
    background: "var(--bg)",
  },

  centerBox: {
    width: "100vw",
    maxWidth: 520,
    margin: "0 auto",
    padding: 18,
    boxSizing: "border-box",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    background: "var(--bg)",
  },

  loadingText: {
    width: "100%",
    textAlign: "center",
    fontWeight: 700,
    opacity: 0.72,
    fontSize: 16,
  },
  loadingSpinner: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    border: "3px solid rgba(22, 119, 255, 0.18)",
    borderTopColor: "var(--accent)",
    animation: "spin 900ms linear infinite",
    marginBottom: 12,
  },

  pageTitle: {
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: -0.25,
    marginTop: 6,
    color: "var(--text)",
  },

  hint: {
    marginTop: 10,
    fontSize: 12,
    opacity: 0.6,
    textAlign: "center",
    lineHeight: 1.35,
  },

  primaryBtn: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    cursor: "pointer",
    fontWeight: 700,
    width: "100%",
    color: "var(--text)",
  },

  profileBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    paddingTop: 6,
    paddingBottom: 8,
  },
  profileName: {
    marginTop: 10,
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: -0.35,
    textAlign: "center",
    color: "var(--text-strong)",
    lineHeight: 1.2,
  },
  profileSub: {
    marginTop: 6,
    fontSize: 13,
    opacity: 0.7,
    lineHeight: 1.3,
    textAlign: "center",
    color: "var(--muted)",
  },
  rolePill: {
    marginTop: 10,
    padding: "8px 14px",
    borderRadius: 999,
    background: "#E6F1FF",
    color: "#1D4ED8",
    fontWeight: 700,
    fontSize: 12,
  },
  settingsHeader: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    paddingTop: 10,
    paddingBottom: 12,
  },
  aboutCardBtn: {
    marginTop: 6,
    marginBottom: 18,
    padding: 16,
    borderRadius: 16,
    background: "var(--surface-2)",
    border: "1px solid var(--border-2)",
    textAlign: "left",
    width: "100%",
    cursor: "pointer",
  },
  roleCard: {
    marginTop: 20,
    padding: 18,
    borderRadius: 18,
    border: "1px solid rgba(22, 119, 255, 0.2)",
    background: "linear-gradient(180deg, rgba(22, 119, 255, 0.08), rgba(22, 119, 255, 0.02))",
    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.06)",
  },
  roleWrap: {
    minHeight: "70vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  roleHeaderRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  roleHello: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--muted)",
  },
  roleName: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: 800,
    color: "var(--text)",
    letterSpacing: -0.2,
  },
  roleIntro: {
    marginTop: 12,
    fontSize: 14,
    color: "var(--text)",
    opacity: 0.8,
    lineHeight: 1.4,
  },
  roleButtons: {
    marginTop: 16,
    display: "grid",
    gap: 10,
  },
  roleBtnPrimary: {
    background: "rgba(22, 119, 255, 0.12)",
    color: "var(--text)",
    borderColor: "rgba(22, 119, 255, 0.35)",
  },
  roleBtnSecondary: {
    background: "rgba(22, 119, 255, 0.12)",
    color: "var(--text)",
    borderColor: "rgba(22, 119, 255, 0.35)",
  },
  roleNote: {
    marginTop: 12,
    fontSize: 12,
    color: "var(--muted)",
  },
  aboutHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  aboutIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    background: "var(--surface)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    color: "var(--text)",
  },
  aboutTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "var(--text)",
    letterSpacing: -0.2,
  },
  aboutText: {
    marginTop: 8,
    fontSize: 13,
    opacity: 0.75,
    lineHeight: 1.4,
  },

  sectionHeader: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 10,
    letterSpacing: -0.2,
    color: "var(--text)",
    lineHeight: 1.3,
  },
  sectionHeaderSmall: {
    fontSize: 16,
    fontWeight: 800,
    letterSpacing: -0.15,
    marginBottom: 8,
    color: "var(--text)",
  },

  listBlock: {
    borderTop: "1px solid var(--border-2)",
    borderBottom: "1px solid var(--border-2)",
  },

  rowWrap: {
    display: "flex",
    alignItems: "stretch",
    gap: 10,
  },

  rowBtn: {
    width: "100%",
    border: "none",
    background: "transparent",
    padding: "16px 0",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    cursor: "pointer",
  },

  rowBtnNoBorder: {
    flex: 1,
    border: "none",
    background: "transparent",
    padding: "14px 0",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    cursor: "default",
    minWidth: 0,
  },

  rowLeft: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    minWidth: 0,
  },
  rowIcon: {
    width: 26,
    height: 26,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--text)",
    opacity: 0.9,
    flex: "0 0 auto",
  },
  rowTitle: {
    fontWeight: 500,
    fontSize: 15,
    color: "var(--text)",
    letterSpacing: -0.1,
    lineHeight: 1.25,
  },
  rowSubtitle: {
    marginTop: 2,
    fontSize: 13,
    opacity: 0.75,
    lineHeight: 1.35,
    color: "var(--muted)",
  },
  rowRight: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flex: "0 0 auto",
  },
  copyBtn: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "var(--text)",
    opacity: 0.75,
  },
  copyRow: {
    marginTop: 6,
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  copyRowBtn: {
    width: "100%",
    border: "none",
    background: "transparent",
    padding: 0,
    textAlign: "left",
    cursor: "pointer",
  },
  rowRightText: {
    fontSize: 13,
    opacity: 0.8,
    color: "var(--muted)",
    display: "flex",
    alignItems: "center",
  },
  rowChevron: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.45,
    color: "var(--muted)",
  },
  themeRowBtn: {
    width: "100%",
    border: "none",
    background: "transparent",
    padding: "14px 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    cursor: "pointer",
  },
  themeCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    border: "2px solid var(--accent)",
    color: "var(--accent)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    fontWeight: 800,
    flex: "0 0 auto",
  },
  themeTabs: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginTop: 6,
  },
  userIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--text)",
    flex: "0 0 auto",
  },
  statusActive: {
    color: "var(--accent)",
    fontWeight: 700,
  },
  subscriptionWarning: {
    color: "#e54b4b",
    fontWeight: 700,
  },
  subscriptionInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  subscriptionDates: {
    color: "var(--accent)",
    fontWeight: 700,
  },
  subscriptionLeftText: {
    color: "var(--text)",
    opacity: 0.8,
  },
  exerciseRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
  },
  exerciseWeightRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
  },
  exerciseInput: {
    border: "1px solid var(--border)",
    borderRadius: 14,
    padding: "10px 12px",
    fontSize: 16,
    background: "var(--panel-2)",
    color: "var(--text)",
    flex: 1,
    minWidth: 0,
  },
  exerciseTrashBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--panel-2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flex: "0 0 auto",
  },
  selectInline: {
    border: "none",
    borderRadius: 10,
    padding: "4px 0",
    fontSize: 16,
    background: "transparent",
    color: "var(--text)",
    cursor: "pointer",
  },

  // ✅ заметная урна: размер + цвет + зона тапа
  trashBtn: {
    width: 52,
    flex: "0 0 52px",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--text)",
    opacity: 0.75,
  },

  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    position: "relative",
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: 700,
    textAlign: "center",
    flex: 1,
    color: "var(--text)",
    letterSpacing: -0.15,
    width: "100%",
    paddingLeft: 44,
    paddingRight: 44,
  },
  backBtnInline: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--text)",
    position: "absolute",
    left: 0,
  },
  topBarDivider: {
    height: 1,
    background: "var(--border-2)",
    marginBottom: 12,
  },

  topBarClients: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  homeAvatarBtn: {
    border: "none",
    background: "transparent",
    padding: 0,
    cursor: "pointer",
    display: "inline-flex",
    alignSelf: "flex-start",
    width: "fit-content",
  },
  homeIntro: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 12,
    width: "100%",
    minWidth: "100%",
    maxWidth: "100%",
  },
  homeAvatarRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  homeStatusChip: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(77, 163, 255, 0.25)",
    background: "rgba(77, 163, 255, 0.08)",
    fontSize: 12,
    fontWeight: 700,
  },
  homeGreeting: {
    padding: "12px 16px",
    borderRadius: 14,
    border: "1px solid rgba(77, 163, 255, 0.25)",
    background: "linear-gradient(180deg, rgba(77, 163, 255, 0.14), rgba(77, 163, 255, 0.06))",
    boxShadow: "0 1px 0 rgba(17, 24, 39, 0.04)",
    color: "var(--text)",
    fontSize: 17,
    fontWeight: 650,
    letterSpacing: -0.2,
    lineHeight: 1.25,
    display: "block",
    width: "100%",
    textAlign: "left",
    boxSizing: "border-box",
    marginLeft: 0,
    marginRight: 0,
  },
  homeNextBlock: {
    marginTop: 10,
    padding: "10px 12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(77, 163, 255, 0.25)",
    background: "rgba(77, 163, 255, 0.03)",
  },
  homeNextTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "var(--text)",
    marginBottom: 8,
  },
  homeNextCard: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(77, 163, 255, 0.25)",
    background: "linear-gradient(180deg, rgba(77, 163, 255, 0.12), rgba(77, 163, 255, 0.04))",
    boxShadow: "0 1px 0 rgba(17, 24, 39, 0.04)",
    width: "100%",
    textAlign: "left",
    cursor: "pointer",
    display: "block",
  },
  homeNextRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  homeNextTime: {
    fontSize: 16,
    fontWeight: 700,
    color: "var(--text)",
  },
  homeNextStatus: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: -0.1,
  },
  homeNextMeta: {
    marginTop: 6,
    fontSize: 14,
    color: "var(--text)",
    opacity: 0.9,
  },
  homeNextEmpty: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px dashed var(--border)",
    color: "var(--muted)",
    fontSize: 14,
  },
  homeNextContactRow: {
    marginTop: 10,
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  homeNextContactLabel: {
    fontSize: 13,
    color: "var(--muted)",
  },
  homeNextContactLink: {
    border: "none",
    background: "transparent",
    padding: 0,
    color: "var(--accent)",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  homeTodayBlock: {
    marginTop: 10,
    padding: "10px 12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(77, 163, 255, 0.25)",
    background: "rgba(77, 163, 255, 0.03)",
  },
  homeTodayCard: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(77, 163, 255, 0.25)",
    background: "linear-gradient(180deg, rgba(77, 163, 255, 0.12), rgba(77, 163, 255, 0.04))",
    boxShadow: "0 1px 0 rgba(17, 24, 39, 0.04)",
  },
  homeTodayGrid: {
    maxWidth: 260,
    margin: "0 auto",
  },
  homeTodayRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    columnGap: 16,
    fontSize: 12,
    fontWeight: 600,
    color: "var(--muted)",
    textAlign: "center",
  },
  homeTodayRowValues: {
    marginTop: 6,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    columnGap: 16,
    fontSize: 20,
    fontWeight: 800,
    color: "var(--text)",
    textAlign: "center",
  },
  homeWeekBlock: {
    marginTop: 10,
    padding: "10px 12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(77, 163, 255, 0.25)",
    background: "rgba(77, 163, 255, 0.03)",
    textAlign: "left",
  },
  homeWeekCard: {
    marginTop: 6,
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(77, 163, 255, 0.25)",
    background: "linear-gradient(180deg, rgba(77, 163, 255, 0.12), rgba(77, 163, 255, 0.04))",
    boxShadow: "0 1px 0 rgba(17, 24, 39, 0.04)",
    textAlign: "center",
  },
  homeWeekValue: {
    fontSize: 22,
    fontWeight: 800,
    color: "var(--text)",
  },
  homeSubscriptionBlock: {
    marginTop: 12,
    padding: "12px",
    borderRadius: 14,
    border: "1px solid rgba(77, 163, 255, 0.25)",
    background: "rgba(77, 163, 255, 0.03)",
  },
  homeSubscriptionRow: {
    marginTop: 8,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(77, 163, 255, 0.18)",
    background: "linear-gradient(180deg, rgba(77, 163, 255, 0.08), rgba(77, 163, 255, 0.02))",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  homeSubscriptionLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--muted)",
  },
  homeSubscriptionValue: {
    fontSize: 14,
    fontWeight: 700,
    color: "var(--text)",
  },
  statsBlock: {
    marginTop: 12,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  statsHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statsHeaderLeft: {
    flex: 1,
  },
  statsHeaderRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    position: "relative",
  },
  statsRangeBtn: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontSize: 14,
  },
  statsInfo: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    border: "1px solid var(--border)",
    color: "var(--muted)",
    background: "var(--surface)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    cursor: "pointer",
  },
  statsInfoOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.25)",
    zIndex: 80,
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-end",
  },
  statsInfoSheet: {
    width: "100%",
    maxWidth: 520,
    background: "var(--surface)",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: "16px 18px 18px",
    boxShadow: "0 -18px 30px rgba(15, 23, 42, 0.18)",
    position: "relative",
    minHeight: "34vh",
  },
  statsInfoClose: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: "50%",
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--muted)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    cursor: "pointer",
  },
  statsInfoTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "var(--text)",
    marginTop: 8,
  },
  statsInfoTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 18,
    fontWeight: 800,
    color: "var(--text)",
    marginTop: 8,
  },
  statsInfoText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 1.5,
    color: "var(--muted)",
  },
  statsInfoAction: {
    marginTop: 18,
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(77, 163, 255, 0.2)",
    background: "rgba(77, 163, 255, 0.12)",
    color: "var(--primary)",
    fontWeight: 700,
    fontSize: 16,
    cursor: "pointer",
  },
  statsRangeMenu: {
    position: "absolute",
    top: 36,
    right: 0,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 6,
    boxShadow: "0 8px 20px rgba(15, 23, 42, 0.12)",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    zIndex: 10,
  },
  statsRangeOption: {
    border: "none",
    background: "transparent",
    padding: "6px 10px",
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text)",
    cursor: "pointer",
    textAlign: "left",
  },
  statsRangeOptionActive: {
    background: "rgba(77, 163, 255, 0.12)",
    color: "var(--primary)",
  },
  statsControls: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  statsModeGroup: {
    display: "flex",
    gap: 8,
  },
  statsModeBtn: {
    padding: "8px 14px",
    borderRadius: 14,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    fontWeight: 700,
    color: "var(--text)",
    cursor: "pointer",
  },
  statsModeBtnActive: {
    background: "var(--text)",
    color: "white",
    borderColor: "var(--text)",
  },
  statsDatePicker: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  statsDateBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    fontSize: 18,
    cursor: "pointer",
    color: "var(--text)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
    padding: 0,
  },
  statsDateLabel: {
    fontSize: 16,
    fontWeight: 700,
    color: "var(--text)",
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
  },
  statsSummary: {
    borderRadius: 16,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    padding: "14px 16px",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  statsSummaryItem: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  statsSummaryLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text)",
  },
  statsSummaryDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flex: "0 0 auto",
  },
  statsSummaryValue: {
    fontSize: 24,
    fontWeight: 800,
    color: "var(--text)",
  },
  statsSummarySub: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: "var(--muted)",
  },
  statsSummaryTrendIcon: {
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1,
  },
  statsSummaryTrendValue: {
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1,
  },
  statsSummaryTrendLabel: {
    color: "var(--muted)",
  },
  statsChart: {
    borderRadius: 16,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    padding: "16px 14px 12px",
    position: "relative",
  },
  statsChartGrid: {
    position: "relative",
    height: 170,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  statsGridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
    background: "var(--border-2)",
  },
  statsAxisLabelTop: {
    position: "absolute",
    right: 0,
    transform: "translateY(-50%)",
    fontSize: 12,
    color: "var(--muted)",
  },
  statsAxisLabelBottom: {
    position: "absolute",
    right: 0,
    bottom: -4,
    transform: "translateY(100%)",
    fontSize: 12,
    color: "var(--muted)",
  },
  statsBarsRow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    height: "100%",
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
    padding: "0 24px 0 0px",
    boxSizing: "border-box",
  },
  statsBarCol: {
    flex: 1,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  statsBarColButton: {
    flex: 1,
    background: "transparent",
    border: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    cursor: "pointer",
  },
  statsBarShell: {
    width: 18,
    borderRadius: 12,
    position: "relative",
    overflow: "hidden",
    boxSizing: "border-box",
    border: "2px solid rgba(15, 23, 42, 0.28)",
    background: "rgba(15, 23, 42, 0.04)",
  },
  statsBarShellActive: {
    width: 22,
    borderRadius: 14,
    border: "2px solid rgba(15, 23, 42, 0.45)",
    position: "relative",
    overflow: "hidden",
    boxSizing: "border-box",
    background: "rgba(15, 23, 42, 0.04)",
  },
  statsBarFill: {
    position: "absolute",
    left: 0,
    bottom: 0,
    width: "100%",
    minHeight: 6,
    borderRadius: 12,
    background: "#1E6BFF",
  },
  statsDaysRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    padding: "0 24px 0 0px",
    color: "var(--muted)",
    fontSize: 12,
  },
  statsDay: {
    textAlign: "center",
    minWidth: 0,
  },
  statsDayActive: {
    textAlign: "center",
    minWidth: 0,
    fontWeight: 700,
    color: "var(--text)",
  },
  financeBlock: {
    marginTop: 10,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  financeHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  financeTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "var(--text)",
  },
  financeCard: {
    borderRadius: 16,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  financeLabel: {
    fontSize: 13,
    color: "var(--muted)",
    fontWeight: 600,
  },
  financeValue: {
    fontSize: 24,
    fontWeight: 800,
    color: "var(--text)",
    marginTop: 6,
  },
  financeBtn: {
    padding: "10px 16px",
    borderRadius: 12,
    border: "1px solid rgba(77, 163, 255, 0.25)",
    background: "rgba(77, 163, 255, 0.12)",
    color: "var(--primary)",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  financeSheet: {
    width: "100%",
    maxWidth: 520,
    background: "var(--surface)",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: "14px 18px 18px",
    boxShadow: "0 -18px 30px rgba(15, 23, 42, 0.18)",
    position: "relative",
    minHeight: "28vh",
  },
  financeSheetTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "var(--text)",
    marginTop: 6,
  },
  financeHistoryList: {
    marginTop: 12,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  financeHistoryItem: {
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--surface-2, rgba(15, 23, 42, 0.02))",
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  financeHistoryMonth: {
    fontSize: 14,
    fontWeight: 700,
    color: "var(--text)",
  },
  financeHistoryMeta: {
    fontSize: 13,
    color: "var(--muted)",
  },
  financeEmpty: {
    marginTop: 14,
    fontSize: 13,
    color: "var(--muted)",
  },
  tariffScroller: {
    marginTop: 10,
    display: "flex",
    gap: 12,
    overflowX: "hidden",
    paddingBottom: 6,
    paddingRight: 6,
    scrollSnapType: "x mandatory",
  },
  tariffCard: {
    minWidth: "100%",
    width: "100%",
    flex: "0 0 auto",
    padding: "14px 14px 16px",
    borderRadius: 14,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    boxShadow: "0 6px 20px rgba(15, 23, 42, 0.06)",
    boxSizing: "border-box",
    scrollSnapAlign: "start",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
  },
  tariffBadge: {
    padding: "6px 12px",
    borderRadius: 999,
    color: "white",
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: 0.2,
  },
  tariffPrice: {
    fontSize: 26,
    fontWeight: 800,
    color: "var(--text)",
  },
  tariffPriceRow: {
    marginTop: 10,
    display: "flex",
    alignItems: "baseline",
    gap: 10,
  },
  tariffPriceStrike: {
    fontSize: 13,
    color: "var(--muted)",
    textDecoration: "line-through",
  },
  tariffPeriod: {
    marginTop: 2,
    fontSize: 12,
    color: "var(--muted)",
  },
  tariffLimit: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text)",
  },
  tariffFeatures: {
    marginTop: 10,
    display: "grid",
    gap: 6,
    fontSize: 12,
    color: "var(--muted)",
  },
  tariffFeatureRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    lineHeight: 1.35,
  },
  tariffDot: {
    width: 6,
    height: 6,
    marginTop: 6,
    borderRadius: "50%",
    background: "rgba(77, 163, 255, 0.6)",
    flex: "0 0 auto",
  },
  tariffChoose: {
    marginTop: 12,
    alignSelf: "stretch",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid var(--primary)",
    background: "transparent",
    fontWeight: 700,
    cursor: "pointer",
  },

  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--text)",
  },

  personalHeaderRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginTop: 6,
    marginBottom: 14,
  },
  clientTabsScroll: {
    marginTop: 8,
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
  },
  clientTabs: {
    display: "flex",
    gap: 10,
    minWidth: "max-content",
  },
  clientTabsDivider: {
    marginTop: 12,
    borderBottom: "1px solid var(--border-2)",
  },
  clientTab: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
    color: "var(--text)",
    padding: "0 10px",
  },
  clientTabActive: {
    background: "var(--accent)",
    color: "var(--accent-contrast)",
    borderColor: "var(--accent)",
  },
  clientPanel: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    border: "1px solid var(--border-2)",
    background: "var(--surface)",
  },
  clientPanelPlain: {
    marginTop: 12,
    padding: 0,
    borderRadius: 0,
    border: "none",
    background: "transparent",
  },
  clientPanelBody: {
    opacity: 0.7,
    fontSize: 14,
    lineHeight: 1.35,
  },

  fieldLabel: {
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 6,
    color: "var(--text)",
    letterSpacing: -0.05,
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 12,
    border: "1px solid var(--border)",
    padding: "12px 12px",
    outline: "none",
    fontSize: 16,
    background: "var(--surface)",
    color: "var(--text)",
  },
  inputNoBorder: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 12,
    border: "none",
    padding: "12px 12px",
    outline: "none",
    fontSize: 16,
    background: "var(--surface)",
    color: "var(--text)",
  },
  goalTextarea: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 12,
    border: "1px solid var(--border)",
    padding: "12px 12px",
    outline: "none",
    fontSize: 16,
    background: "var(--surface)",
    color: "var(--text)",
    resize: "none",
    overflow: "hidden",
    minHeight: 42,
    lineHeight: 1.35,
  },
  readOnlyValue: {
    marginTop: 6,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text)",
    fontSize: 14,
  },
  metricsRow: {
    marginTop: 16,
    display: "flex",
    gap: 12,
  },
  subscriptionRow: {
    marginTop: 12,
    display: "flex",
    gap: 12,
  },
  subscriptionField: {
    flex: 1,
    textAlign: "left",
  },
  subscriptionTrainerStrip: {
    display: "flex",
    gap: 10,
    overflowX: "auto",
    paddingBottom: 6,
  },
  subscriptionTrainerCard: {
    minWidth: 180,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    padding: "12px 14px",
    textAlign: "left",
    cursor: "pointer",
    flex: "0 0 auto",
  },
  subscriptionTrainerCardActive: {
    minWidth: 180,
    borderRadius: 12,
    border: "1px solid var(--accent)",
    background: "rgba(22, 119, 255, 0.08)",
    padding: "12px 14px",
    textAlign: "left",
    cursor: "pointer",
    flex: "0 0 auto",
  },
  subscriptionTrainerName: {
    fontSize: 14,
    fontWeight: 800,
    color: "var(--text)",
  },
  subscriptionTrainerStatus: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: 700,
  },
  subscriptionDetails: {
    marginTop: 12,
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--surface)",
  },
  subscriptionDetailsTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: "var(--text)",
    marginBottom: 8,
  },
  subscriptionDetailsRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "8px 0",
    borderTop: "1px solid var(--border-2)",
  },
  subscriptionDetailsLabel: {
    fontSize: 13,
    color: "var(--muted)",
    fontWeight: 600,
  },
  subscriptionDetailsValue: {
    fontSize: 13,
    color: "var(--text)",
    fontWeight: 700,
  },
  inputRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  inlineCheckBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    border: "none",
    background: "var(--accent)",
    color: "var(--accent-contrast)",
    fontSize: 20,
    fontWeight: 800,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  saveBtn: {
    marginTop: 18,
    width: "100%",
    height: 48,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 15,
    color: "var(--text)",
  },
  dangerBtn: {
    background: "#e5484d",
    borderColor: "#e5484d",
    color: "#fff",
  },

  errorText: {
    marginTop: 10,
    color: "var(--danger)",
    fontSize: 13,
    lineHeight: 1.35,
  },

  emptyState: {
    marginTop: 18,
    padding: 16,
    border: "1px solid var(--border)",
    borderRadius: 16,
    background: "var(--surface-2)",
    boxShadow: "0 1px 0 rgba(15, 23, 42, 0.04)",
  },

  calendarStrip: {
    marginTop: 12,
    display: "flex",
    gap: 8,
    overflowX: "auto",
    paddingBottom: 6,
    WebkitOverflowScrolling: "touch",
  },
  calendarDay: {
    flex: "0 0 calc((100% - 32px) / 5)",
    minWidth: "calc((100% - 32px) / 5)",
    borderRadius: 12,
    border: "1px solid var(--border)",
    padding: "10px 8px",
    background: "var(--surface)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
    color: "var(--text)",
  },
  calendarDayActive: {
    background: "var(--accent)",
    borderColor: "var(--accent)",
    color: "var(--accent-contrast)",
  },
  calendarDaySelected: {
    background: "var(--surface)",
    borderColor: "var(--accent)",
    color: "var(--accent)",
    boxShadow: "0 0 0 2px rgba(22, 119, 255, 0.18)",
  },
  calendarDayPast: {
    opacity: 0.45,
  },
  calendarDayDate: {
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: -0.2,
  },
  scheduleTabs: {
    marginTop: 14,
    display: "flex",
    gap: 10,
    width: "100%",
  },
  scheduleTab: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 14,
    color: "var(--text)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
  },
  scheduleTabActive: {
    background: "var(--accent)",
    color: "var(--accent-contrast)",
    border: "1px solid var(--accent)",
  },
  scheduleTabsDivider: {
    height: 1,
    background: "var(--border-2)",
    marginTop: 12,
  },
  schedulePanel: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    border: "1px solid var(--border-2)",
    background: "var(--surface)",
  },
  scheduleHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  trainerSelectWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 6,
    flex: "0 0 auto",
  },
  trainerSelectLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.2,
    textTransform: "uppercase",
    color: "var(--muted)",
  },
  trainerSelect: {
    border: "1px solid rgba(22, 119, 255, 0.35)",
    borderRadius: 14,
    padding: "10px 12px",
    fontSize: 14,
    fontWeight: 700,
    background: "rgba(22, 119, 255, 0.08)",
    color: "var(--text)",
    cursor: "pointer",
    maxWidth: 220,
    boxShadow: "0 1px 0 rgba(17, 24, 39, 0.04)",
  },
  schedulePanelPlain: {
    marginTop: 14,
    padding: 0,
    borderRadius: 0,
    border: "none",
    background: "transparent",
  },
  addWindowBtn: {
    width: "100%",
    height: 46,
    borderRadius: 12,
    border: "1px solid var(--accent)",
    background: "var(--surface)",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 14,
    color: "var(--accent)",
    marginBottom: 12,
  },
  schedulePanelTitle: {
    fontWeight: 800,
    fontSize: 15,
    letterSpacing: -0.2,
    color: "var(--text)",
  },
  schedulePanelBody: {
    marginTop: 8,
    opacity: 0.7,
    fontSize: 14,
    lineHeight: 1.35,
  },
  sessionList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  sessionBanner: {
    position: "relative",
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(77, 163, 255, 0.35)",
    background: "rgba(77, 163, 255, 0.18)",
    color: "var(--text)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sessionBannerLeft: {
    minWidth: 0,
  },
  sessionEditBlock: {
    marginTop: 10,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  sessionBannerActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flex: "0 0 auto",
  },
  sessionBannerTitle: {
    fontWeight: 800,
    fontSize: 14,
    color: "var(--text)",
  },
  sessionBannerTime: {
    marginTop: 6,
    fontSize: 14,
    opacity: 0.9,
    color: "var(--text)",
  },
  sessionBannerClient: {
    marginTop: 6,
    fontSize: 13,
    opacity: 0.9,
    color: "var(--text)",
  },
  sessionBannerStatus: {
    position: "absolute",
    top: 12,
    right: 12,
    fontSize: 12,
    fontWeight: 700,
    color: "var(--accent)",
  },
  sessionBannerLeftCount: {
    marginTop: 6,
    fontSize: 12,
    opacity: 0.8,
    color: "var(--text)",
  },
  freeForm: {
    marginTop: 12,
  },
  freeField: {
    marginTop: 10,
  },
  freeList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginTop: 6,
  },
  freeBanner: {
    padding: 12,
    borderRadius: 12,
    background: "rgba(77, 163, 255, 0.18)",
    border: "1px solid rgba(77, 163, 255, 0.35)",
    color: "var(--text)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  freeBannerLeft: {
    minWidth: 0,
  },
  freeBannerTitle: {
    fontWeight: 800,
    fontSize: 14,
  },
  freeBannerTime: {
    marginTop: 6,
    fontSize: 14,
    opacity: 0.85,
  },
  freeBannerDelete: {
    width: 44,
    height: 44,
    borderRadius: 12,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    color: "var(--text)",
    opacity: 0.75,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
  },
  freeBannerActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flex: "0 0 auto",
  },
  freeBannerAdd: {
    width: 44,
    height: 44,
    borderRadius: 12,
    border: "1px solid var(--accent)",
    background: "var(--surface)",
    cursor: "pointer",
    color: "var(--accent)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
  },
  trashEmoji: {
    fontSize: 20,
    lineHeight: 1,
  },
  assignRow: {
    marginTop: 8,
  },

  codeBox: {
    marginTop: 18,
    border: "1px solid var(--border-2)",
    borderRadius: 14,
    padding: 14,
    background: "var(--surface)",
  },
  codeValue: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: 900,
    letterSpacing: 2,
    textAlign: "center",
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid var(--border)",
  },

  bottomNav: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    height: 76,
    background: "var(--surface)",
    borderTop: "1px solid var(--nav-border)",
    display: "flex",
    justifyContent: "space-around",
    paddingTop: 6,
    paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)",
    boxSizing: "border-box",
    zIndex: 10,
  },
  navBtn: {
    flex: 1,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: "20px 6px 8px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  navIconWrap: {
    height: 22,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  navLabel: {
    fontSize: 12,
    marginTop: 4,
    letterSpacing: -0.1,
  },
};
