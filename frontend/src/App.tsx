import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { HugeiconsIcon } from "@hugeicons/react";
import { Home08Icon, Calendar04Icon, UserMultiple02Icon, Settings01Icon, UserAdd02Icon } from "@hugeicons/core-free-icons";

const SUBSCRIPTION_CLIENT_LIMIT = 9999;
let currentLanguage: "ru" | "en" = "ru";

function getRoleStorageKey(base: string, role: Role | null) {
  return role ? `${base}:${role}` : base;
}

type Role = "trainer" | "client" | null;

function formatReminderLabel(hours: number, language: "ru" | "en", t: UiText) {
  if (!hours || hours <= 0) return t.remindersOff;
  if (language === "en") return `In ${hours} hour${hours === 1 ? "" : "s"}`;
  const mod10 = hours % 10;
  const mod100 = hours % 100;
  let suffix = "часов";
  if (mod10 === 1 && mod100 !== 11) suffix = "час";
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) suffix = "часа";
  return `За ${hours} ${suffix}`;
}

function formatCancellationLabel(hours: number, language: "ru" | "en", t: UiText) {
  if (!hours || hours <= 0) return language === "en" ? "From session start" : "С момента начала";
  if (language === "en") {
    if (hours === 24) return "1 day";
    if (hours < 1) return `${Math.round(hours * 60)} min`;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  if (hours === 24) return "1 день";
  if (hours < 1) return `За ${Math.round(hours * 60)} минут`;
  return formatReminderLabel(hours, language, t);
}

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
    reminderHours?: number | null;
  };
};

type Tab = "home" | "schedule" | "clients" | "settings";
type ClientTab = "home" | "schedule" | "book" | "settings";
type SettingsScreen =
  | "main"
  | "personal"
  | "theme"
  | "booking"
  | "cancellation"
  | "reminders"
  | "language"
  | "paymentMethods"
  | "paymentHistory";
type ClientsScreen = "list" | "add" | "detail";
type TariffPeriod = "month" | "quarter" | "year";
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
  settingsPayments: string;
  settingsUseful: string;
  settingsBooking: string;
  settingsCancellationPolicy: string;
  settingsReminders: string;
  settingsLanguage: string;
  settingsTheme: string;
  settingsPaymentMethods: string;
  settingsPaymentHistory: string;
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
  isLocal?: boolean;
  photoUrl?: string;
  clientName?: string;
  trainerTgUserId?: string;
  trainerUsername?: string;
  trainerName?: string;
  trainerPhotoUrl?: string;
  bookingMode?: "trainer" | "both";
  fullName?: string;
  gender?: string;
  height?: string;
  weight?: string;
  goal?: string;
  comment?: string;
  contactTelegram?: string;
  contactPhone?: string;
  contactInstagram?: string;
  contactOtherSocial?: string;
  exercises?: { id: string; name: string; weight: string }[];
  subscriptionStart?: string;
  subscriptionEnd?: string;
  subscriptionPrice?: string;
  subscriptionTotal?: string;
  subscriptionLeft?: string;
  subscriptionEnabled?: boolean;
  activeSubscriptionHistoryId?: string;
  subscriptionHistory?: SubscriptionHistoryItem[];
  archived?: boolean;
  clientProfile?: {
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

type SubscriptionHistoryItem = {
  id: string;
  purchasedAt: string;
  price?: string;
  total?: string;
  start?: string;
  end?: string;
};

type SubscriptionSessionDetail = {
  id: string;
  title: string;
  dateLabel: string;
  timeLabel: string;
  statusLabel: string;
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
  bookingMode?: "trainer" | "both";
  cancelWindowHours?: number;
};

type ClientProfile = {
  fullName?: string;
  gender?: string;
  height?: string;
  weight?: string;
  goal?: string;
  comment?: string;
};

type ExerciseHistoryItem = {
  id: string;
  value: string;
  recordedAt: string;
};

type TrainingSlot = {
  id: string;
  trainerTgUserId: string;
  dateKey: string;
  start: string;
  end: string;
  isGroup?: boolean;
  capacity?: number | null;
  bookedCount?: number;
  sessionId?: string | null;
};

type SessionItem = {
  id: string;
  dateKey: string;
  start: string; // HH:MM
  end: string; // HH:MM
  clientUsername: string; // without @
  clientName?: string;
  trainerTgUserId?: string;
  source?: "trainer" | "client";
  type?: string;
  price?: string;
  comment?: string;
  color?: string;
  subscriptionHistoryId?: string | null;
  subscriptionChargedAt?: string | null;
  participants?: {
    clientId: string;
    clientUsername: string;
    clientName?: string;
    subscriptionHistoryId?: string | null;
    subscriptionChargedAt?: string | null;
  }[];
};


type NotesListItem = {
  id: string;
  title: string;
  createdAt: string;
};

type NotesTaskItem = {
  id: string;
  listId: string;
  title: string;
  done: boolean;
  createdAt: string;
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
  const [tgUserId, setTgUserId] = useState<string>("");
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
  const [reminderHours, setReminderHours] = useState<number>(() => {
    try {
      const storedRole = localStorage.getItem("role");
      const raw = localStorage.getItem(getRoleStorageKey("reminderHours", storedRole as Role | null));
      const parsed = raw ? Number(raw) : NaN;
      return Number.isFinite(parsed) ? parsed : 1;
    } catch {
      return 1;
    }
  });
  const [cancelWindowHours, setCancelWindowHours] = useState<number>(() => {
    try {
      const storedRole = localStorage.getItem("role");
      const raw = localStorage.getItem(getRoleStorageKey("cancelWindowHours", storedRole as Role | null));
      const parsed = raw ? Number(raw) : NaN;
      return Number.isFinite(parsed) ? parsed : 0;
    } catch {
      return 0;
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
  useEffect(() => {
    if (typeof trainerProfile?.cancelWindowHours === "number" && Number.isFinite(trainerProfile.cancelWindowHours)) {
      setCancelWindowHours(trainerProfile.cancelWindowHours);
    }
  }, [trainerProfile?.cancelWindowHours]);
  const prefsSyncRef = useRef<number | null>(null);

  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [settingsScreen, setSettingsScreen] = useState<SettingsScreen>("main");
  const [clientSettingsScreen, setClientSettingsScreen] = useState<SettingsScreen>("main");
  const [clientTab, setClientTab] = useState<ClientTab>("home");
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [quickAddScheduleSignal, setQuickAddScheduleSignal] = useState(0);
  const [quickAddScheduleHandled, setQuickAddScheduleHandled] = useState(0);
  const [clientConnected, setClientConnected] = useState<boolean>(() => {
    try {
      return localStorage.getItem("clientConnected") === "true";
    } catch {
      return false;
    }
  });

  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const pendingFocusRef = useRef<HTMLElement | null>(null);
  const hasTgBack = typeof WebApp?.BackButton?.show === "function";
  const isKeyboardVisible = keyboardInset > 0 || keyboardOpen;
  const hideBottomNav = keyboardOpen;

  const scrollAreaStyle = {
    ...styles.scrollArea,
    paddingBottom: isKeyboardVisible ? 16 : 80,
    scrollPaddingBottom: isKeyboardVisible ? 16 : 32,
  };

  // ----- Clients state (локально, без бэка)
  const [clientsScreen, setClientsScreen] = useState<ClientsScreen>("list");
  const [invites, setInvites] = useState<TrainerClientInvite[]>([]);
  const [clientTrainers, setClientTrainers] = useState<TrainerClientInvite[]>([]);
  const [sessionsByDate, setSessionsByDate] = useState<Record<string, SessionItem[]>>({});
  const [clientSessionsByDate, setClientSessionsByDate] = useState<Record<string, SessionItem[]>>({});
  const [historyByClient, setHistoryByClient] = useState<Record<string, SessionItem[]>>({});
  const processedSessionIdsRef = useRef<Set<string>>(new Set());
  const [pendingSession, setPendingSession] = useState<SessionItem | null>(null);
  const [trainerSessionsLoaded, setTrainerSessionsLoaded] = useState(false);
  const trainerHistory = useMemo(() => {
    if (role !== "trainer") return [];
    return Object.values(sessionsByDate)
      .flat()
      .filter((s) => isSessionEnded(s, new Date()));
  }, [sessionsByDate, role]);
  const [clientInviteCode, setClientInviteCode] = useState("");
  const [clientInviteMessage, setClientInviteMessage] = useState("");
  const invitesSigRef = useRef<string>("");
  const clientTrainersSigRef = useRef<string>("");
  const trainerSessionsSigRef = useRef<string>("");
  const clientSessionsSigRef = useRef<string>("");
  const trainerProfileSigRef = useRef<string>("");

  async function fetchClients() {
    if (!token || role !== "trainer") return;
    try {
      const res = await fetch(`${apiBase}/clients`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { ok: boolean; clients?: any[] };
      if (!data?.clients) return;
      const mapped = data.clients.map((c) => mapClientFromApi(c));
      const sig = buildInvitesSignature(mapped);
      if (sig === invitesSigRef.current) return;
      invitesSigRef.current = sig;
      setInvites(mapped);
    } catch {
      // ignore
    }
  }

  async function fetchClientTrainers() {
    if (!token || role !== "client") return;
    try {
      const res = await fetch(`${apiBase}/client/trainers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { ok: boolean; trainers?: any[] };
      if (!data?.trainers) return;
      const mapped = data.trainers.map((c) => mapClientFromApi(c));
      const sig = buildInvitesSignature(mapped);
      if (sig === clientTrainersSigRef.current) return;
      clientTrainersSigRef.current = sig;
      setClientTrainers(mapped);
      const connected = mapped.length > 0;
      setClientConnected(connected);
      try {
        localStorage.setItem("clientConnected", connected ? "true" : "false");
      } catch {
        // ignore
      }
    } catch {
      // ignore
    }
  }

  async function fetchTrainerSessions() {
    if (!token || role !== "trainer") return;
    try {
      const res = await fetch(`${apiBase}/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { ok: boolean; sessions?: any[] };
      if (!data?.sessions) return;
      const mapped = data.sessions.map((s) => mapSessionFromApi(s));
      const next: Record<string, SessionItem[]> = {};
      mapped.forEach((s) => {
        const list = next[s.dateKey] ? next[s.dateKey].slice() : [];
        list.push(s);
        next[s.dateKey] = list;
      });
      const sig = buildSessionsSignature(next);
      if (sig === trainerSessionsSigRef.current) {
        if (!trainerSessionsLoaded) setTrainerSessionsLoaded(true);
        return;
      }
      trainerSessionsSigRef.current = sig;
      setSessionsByDate(next);
      setTrainerSessionsLoaded(true);
    } catch {
      // ignore
    }
  }

  async function fetchClientSessions() {
    if (!token || role !== "client") return;
    try {
      const res = await fetch(`${apiBase}/client/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { ok: boolean; sessions?: any[] };
      if (!data?.sessions) return;
      const mapped = data.sessions.map((s) => mapSessionFromApi(s));
      const next: Record<string, SessionItem[]> = {};
      mapped.forEach((s) => {
        const list = next[s.dateKey] ? next[s.dateKey].slice() : [];
        list.push(s);
        next[s.dateKey] = list;
      });
      const sig = buildSessionsSignature(next);
      if (sig === clientSessionsSigRef.current) return;
      clientSessionsSigRef.current = sig;
      setClientSessionsByDate(next);
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
      setHistoryByClient((prev) => {
        const next = { ...prev, [client.username]: mapped };
        try {
          if (tgUserId) {
            localStorage.setItem(`historyByClient:${tgUserId}`, JSON.stringify(next));
          }
        } catch {
          // ignore
        }
        return next;
      });
    } catch {
      // ignore
    }
  }

  async function saveClientExercises(
    clientId: string,
    exercises: { id: string; name: string; weight: string }[]
  ): Promise<TrainerClientInvite | null> {
    if (!token) return null;
    try {
      const payload = exercises.map((ex) => ({
        ...ex,
        id: ex.id && ex.id.startsWith("local_") ? undefined : ex.id,
      }));
      const res = await fetch(`${apiBase}/clients/${clientId}/exercises`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ exercises: payload }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { ok: boolean; client?: any };
      if (data?.client) {
        const mapped = mapClientFromApi(data.client);
        if (role === "trainer") {
          setInvites((prev) => prev.map((c) => (c.id === data.client.id ? mapped : c)));
        } else if (role === "client") {
          setClientTrainers((prev) => prev.map((c) => (c.id === data.client.id ? mapped : c)));
        }
        return mapped;
      }
    } catch {
      // ignore
    }
    return null;
  }

  async function fetchTrainerProfile() {
    if (!token || (role !== "trainer" && role !== "client")) return;
    try {
      const res = await fetch(`${apiBase}/profile/trainer`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { ok: boolean; profile?: TrainerProfile };
      if (data?.profile) {
        const sig = stableStringify(data.profile);
        if (sig === trainerProfileSigRef.current) return;
        trainerProfileSigRef.current = sig;
        setTrainerProfile(data.profile);
      }
    } catch {
      // ignore
    }
  }

  async function saveTrainerProfile(patch: Partial<TrainerProfile>) {
    if (!token || (role !== "trainer" && role !== "client")) return;
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

  async function saveClientProfile(patch: Partial<ClientProfile>) {
    if (!token || role !== "client") return;
    try {
      await fetch(`${apiBase}/client/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(patch),
      });
      setClientTrainers((prev) =>
        prev.map((c) =>
          c.status === "active" ? { ...c, ...patch } : c
        )
      );
    } catch {
      // ignore
    }
  }

  function schedulePrefsSync(patch: {
    theme?: "light" | "dark";
    language?: "ru" | "en";
    reminderHours?: number;
  }) {
    if (!token) return;
    if (prefsSyncRef.current) window.clearTimeout(prefsSyncRef.current);
    prefsSyncRef.current = window.setTimeout(async () => {
      try {
        await fetch(`${apiBase}/profile/preferences`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(patch),
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
      roleTrainer: language === "en" ? "Trainer" : "Тренер",
      roleClient: language === "en" ? "Athlete" : "Спортсмен",
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
      settingsPayments: language === "en" ? "Payment info" : "Платежная информация",
      settingsUseful: language === "en" ? "Useful" : "Полезное",
      settingsBooking: language === "en" ? "Booking" : "Запись на тренировки",
      settingsCancellationPolicy: language === "en" ? "Subscription charge timing" : "Списание тренировок по абонементу",
      settingsReminders: language === "en" ? "Session reminders" : "Напоминание о занятиях",
      settingsLanguage: language === "en" ? "Language" : "Язык интерфейса",
      settingsTheme: language === "en" ? "Color scheme" : "Цветовая схема",
      settingsPaymentMethods: language === "en" ? "Payment methods" : "Способы оплаты",
      settingsPaymentHistory: language === "en" ? "Payment history" : "История оплат",
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
      schedulePrefsSync({ theme, language });
    }
  }, [language, role]);

  useEffect(() => {
    if (!token || role !== "trainer") return;
    if (!trainerSessionsLoaded) return;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      const allSessions = Object.values(sessionsByDate)
        .flat()
        .filter((s) => s.source !== "client");
      const payload = allSessions.map((s) => ({
        id: s.id,
        clientUsername: s.clientUsername,
        clientName: sessionClientLabel(s, tr, invites) || null,
        startAt: sessionStartTime(s).toISOString(),
        endAt: sessionEndTime(s).toISOString(),
        startTime: s.start,
        endTime: s.end,
        type: s.type ?? null,
        color: s.color ?? null,
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
    if (!token || role !== "trainer") {
      setTrainerSessionsLoaded(false);
    }
  }, [token, role]);

  useEffect(() => {
    fetchClients();
  }, [token, role, apiBase]);

  useEffect(() => {
    fetchTrainerProfile();
  }, [token, role, apiBase]);

  useEffect(() => {
    fetchClientTrainers();
    fetchClientSessions();
  }, [token, role, apiBase]);

  useEffect(() => {
    if (role !== "trainer") return;
    if (activeTab !== "schedule" && activeTab !== "home") return;
    fetchTrainerSessions();
  }, [token, role, apiBase, activeTab]);

  useEffect(() => {
    if (!token || !role) return;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      fetchClients();
      fetchTrainerSessions();
      fetchClientTrainers();
      fetchClientSessions();
      fetchTrainerProfile();
    };
    tick();
    const id = window.setInterval(tick, 10 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
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
    setTgUserId(data.user.tgUserId);
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
    if (typeof data.user.reminderHours === "number") {
      setReminderHours(data.user.reminderHours);
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
    const ensureInputVisible = (target: HTMLElement) => {
      if (document.activeElement !== target) return;
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

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA") return;
      setKeyboardOpen(true);
      pendingFocusRef.current = target;
      if (!window.visualViewport) {
        requestAnimationFrame(() => ensureInputVisible(target));
      } else {
        window.setTimeout(() => {
          if (pendingFocusRef.current !== target) return;
          ensureInputVisible(target);
          pendingFocusRef.current = null;
        }, 140);
      }
    };
    const onFocusOut = () => {
      pendingFocusRef.current = null;
      const el = document.activeElement as HTMLElement | null;
      if (!el) {
        setKeyboardOpen(false);
        return;
      }
      const tag = el.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA") {
        setKeyboardOpen(false);
      }
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
      setKeyboardOpen(inset > 0);
      try {
        document.documentElement.style.setProperty("--keyboard-inset", `${inset}px`);
      } catch {
        // ignore
      }
      if (inset > 0 && pendingFocusRef.current) {
        const target = pendingFocusRef.current;
        pendingFocusRef.current = null;
        requestAnimationFrame(() => {
          if (document.activeElement === target) {
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
          }
        });
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
    const run = () => {
      const now = new Date();

      setSessionsByDate((prev) => {
        const allSessions = Object.values(prev).flat();
        const moved: SessionItem[] = allSessions.filter((s) => isSessionEnded(s, now));
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

        return prev;
      });
    };
    run();
    const id = window.setInterval(run, 10 * 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    // intentionally left: no auto-archive on subscription end
  }, []);

  useEffect(() => {
    try {
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
      localStorage.setItem(getRoleStorageKey("theme", role), theme);
    } catch {
      // ignore
    }
    if (role && token) {
      schedulePrefsSync({ theme, language });
    }
  }, [theme, role]);

  useEffect(() => {
    if (!role) return;
    try {
      localStorage.setItem(getRoleStorageKey("reminderHours", role), String(reminderHours));
    } catch {
      // ignore
    }
    if (role && token) {
      schedulePrefsSync({ reminderHours });
    }
  }, [reminderHours, role, token]);

  useEffect(() => {
    if (!role) return;
    try {
      localStorage.setItem(getRoleStorageKey("cancelWindowHours", role), String(cancelWindowHours));
    } catch {
      // ignore
    }
  }, [cancelWindowHours, role]);

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
      const storedReminders = localStorage.getItem(getRoleStorageKey("reminderHours", role));
      const parsed = storedReminders ? Number(storedReminders) : NaN;
      if (Number.isFinite(parsed)) setReminderHours(parsed);
      const storedCancelWindow = localStorage.getItem(getRoleStorageKey("cancelWindowHours", role));
      const parsedCancelWindow = storedCancelWindow ? Number(storedCancelWindow) : NaN;
      if (Number.isFinite(parsedCancelWindow)) setCancelWindowHours(parsedCancelWindow);
    } catch {
      // ignore
    }
  }, [role]);

  useEffect(() => {
    if (role !== "trainer" || !tgUserId) return;
    try {
      const cached = localStorage.getItem(`historyByClient:${tgUserId}`);
      if (cached) {
        const parsed = JSON.parse(cached) as Record<string, SessionItem[]>;
        if (parsed && typeof parsed === "object") {
          setHistoryByClient(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, [role, tgUserId]);

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

    const doDelete = async () => {
      if (token) {
        try {
          const res = await fetch(`${apiBase}/profile`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
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
            return;
          }
        } catch {
          try {
            WebApp?.showPopup?.({
              title: tr("Не удалось удалить", "Delete failed"),
              message: tr("Проверьте соединение и попробуйте снова.", "Check your connection and try again."),
              buttons: [{ type: "ok" }],
            });
          } catch {
            // ignore
          }
          return;
        }
      }
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
        if (ok) void doDelete();
      });
      return;
    }
    if (window.confirm(message)) void doDelete();
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
          <div style={{ ...styles.pageContainer, ...styles.rolePage }}>
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
                  token={token}
                  apiBase={apiBase}
                />
              )}
              {activeTab === "schedule" && (
                  <TrainerSchedule
                    clients={invites}
                    setClients={setInvites}
                    historyByClient={historyByClient}
                    sessionsByDate={sessionsByDate}
                    setSessionsByDate={setSessionsByDate}
                    token={token}
                    apiBase={apiBase}
                    trainerTgUserId={tgUserId}
                    theme={theme}
                    trainerProfile={trainerProfile}
                    pendingSession={pendingSession}
                    onConsumePendingSession={() => setPendingSession(null)}
                    onLoadHistory={loadClientHistory}
                  onSaveExercises={saveClientExercises}
                  openQuickAddSignal={quickAddScheduleSignal}
                  quickAddHandled={quickAddScheduleHandled}
                  onQuickAddHandled={setQuickAddScheduleHandled}
                />
              )}
              {activeTab === "clients" && (
                <TrainerClients
                  screen={clientsScreen}
                  setScreen={setClientsScreen}
                  invites={invites}
                  setInvites={setInvites}
                  historyByClient={historyByClient}
                  sessionsByDate={sessionsByDate}
                  setSessionsByDate={setSessionsByDate}
                  token={token}
                  apiBase={apiBase}
                  trainerTgUserId={tgUserId}
                  onLoadHistory={loadClientHistory}
                  onRefreshClients={fetchClients}
                  onSaveClientExercises={saveClientExercises}
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
                token={token}
                apiBase={apiBase}
                theme={theme}
                setTheme={setTheme}
                language={language}
                setLanguage={setLanguage}
                reminderHours={reminderHours}
                setReminderHours={setReminderHours}
                cancelWindowHours={cancelWindowHours}
                setCancelWindowHours={setCancelWindowHours}
                t={t}
                trainerProfile={trainerProfile}
                onSaveTrainerProfile={saveTrainerProfile}
                subscriptionTabLabel={tr("История тренировок", "Training history")}
                subscriptionItems={invites}
                trainerHistory={trainerHistory}
                onDeleteProfile={handleDeleteProfile}
              />
            )}
              <div style={{ height: 14 }} />
            </div>

            {addMenuOpen && (
              <div
                style={styles.addMenuOverlay}
                onClick={() => setAddMenuOpen(false)}
                role="presentation"
              >
                <div
                  style={styles.addMenuGlass}
                  onClick={(event) => event.stopPropagation()}
                  role="presentation"
                >
                  <div style={styles.addMenuGlassRow}>
                    <button
                      type="button"
                      style={styles.addMenuGlassBtn}
                      aria-label={tr("Добавить тренировку", "Add session")}
                      onClick={() => {
                        setAddMenuOpen(false);
                        setActiveTab("schedule");
                        setQuickAddScheduleSignal((prev) => prev + 1);
                      }}
                    >
                      {tr("Добавить тренировку", "Add session")}
                    </button>
                    <button
                      type="button"
                      style={styles.addMenuGlassBtn}
                      aria-label={tr("Шаблон", "Template")}
                    >
                      {tr("Шаблон", "Template")}
                    </button>
                    <button
                      type="button"
                      style={styles.addMenuGlassBtn}
                      aria-label={tr("Повторить тренировку", "Repeat session")}
                    >
                      {tr("Повторить тренировку", "Repeat session")}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div style={{ ...styles.bottomNav, display: hideBottomNav ? "none" : "flex" }}>
              <button
                onClick={() => setActiveTab("home")}
                style={styles.navBtn}
              >
                <div
                  style={{
                    ...styles.navIconWrap,
                    ...(activeTab === "home" ? styles.navIconWrapActive : null),
                  color: activeTab === "home" ? "var(--accent)" : "var(--muted)",
                  }}
                >
                  <IconHome />
                </div>
                <div
                  style={{
                    ...styles.navLabel,
                  color: activeTab === "home" ? "var(--accent)" : "var(--muted)",
                    fontWeight: activeTab === "home" ? 700 : 600,
                  }}
                >
                  {t.navHome}
                </div>
              </button>

              <button
                onClick={() => setActiveTab("schedule")}
                style={styles.navBtn}
              >
                <div
                  style={{
                    ...styles.navIconWrap,
                    ...(activeTab === "schedule" ? styles.navIconWrapActive : null),
                  color: activeTab === "schedule" ? "var(--accent)" : "var(--muted)",
                  }}
                >
                  <IconCalendar />
                </div>
                <div
                  style={{
                    ...styles.navLabel,
                  color: activeTab === "schedule" ? "var(--accent)" : "var(--muted)",
                    fontWeight: activeTab === "schedule" ? 700 : 600,
                  }}
                >
                  {t.navSchedule}
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAddMenuOpen(false);
                  setActiveTab("schedule");
                  setQuickAddScheduleSignal((prev) => prev + 1);
                }}
                style={styles.navAddBtn}
                aria-label={tr("Добавить тренировку", "Add session")}
              >
                <IconPlus />
              </button>

              <button
                onClick={() => setActiveTab("clients")}
                style={styles.navBtn}
              >
                <div
                  style={{
                    ...styles.navIconWrap,
                    ...(activeTab === "clients" ? styles.navIconWrapActive : null),
                  color: activeTab === "clients" ? "var(--accent)" : "var(--muted)",
                  }}
                >
                  <IconUsers />
                </div>
                <div
                  style={{
                    ...styles.navLabel,
                  color: activeTab === "clients" ? "var(--accent)" : "var(--muted)",
                    fontWeight: activeTab === "clients" ? 700 : 600,
                  }}
                >
                  {t.navClients}
                </div>
              </button>

              <button
                onClick={() => setActiveTab("settings")}
                style={styles.navBtn}
              >
                <div
                  style={{
                    ...styles.navIconWrap,
                    ...(activeTab === "settings" ? styles.navIconWrapActive : null),
                  color: activeTab === "settings" ? "var(--accent)" : "var(--muted)",
                  }}
                >
                  <IconSettings />
                </div>
                <div
                  style={{
                    ...styles.navLabel,
                  color: activeTab === "settings" ? "var(--accent)" : "var(--muted)",
                    fontWeight: activeTab === "settings" ? 700 : 600,
                  }}
                >
                  {t.navSettings}
                </div>
              </button>
            </div>
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
          <div style={{ ...styles.pageContainer, ...styles.rolePage }}>
            <div style={styles.roleWrap}>
              <div style={styles.roleCard}>
                <div style={styles.roleInviteTitle}>{tr("Кабинет спортсмена", "Athlete workspace")}</div>
                <div style={styles.roleInviteIntro}>
                  {tr(
                    "Введите инвайт-код, чтобы подключиться к тренеру.",
                    "Enter an invite code to connect to a coach."
                  )}
                </div>
                <div style={{ marginTop: 14 }}>
                  <input
                    className="role-invite-input"
                    value={clientInviteCode}
                    onChange={(e) => {
                      setClientInviteCode(e.target.value);
                      if (clientInviteMessage) setClientInviteMessage("");
                    }}
                    placeholder={tr("Инвайт-код", "Invite code")}
                    style={styles.roleInviteInput}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const code = (clientInviteCode || "").trim();
                      if (!code) {
                        setClientInviteMessage(tr("Введите инвайт-код.", "Enter an invite code."));
                        return;
                      }
                      (async () => {
                        try {
                          const res = await fetch(`${apiBase}/clients/activate`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                            body: JSON.stringify({ code }),
                          });
                          if (!res.ok) {
                            setClientInviteMessage(
                              tr("Код не найден. Проверь правильность.", "Code not found. Check it and try again.")
                            );
                            return;
                          }
                          setClientInviteMessage("");
                          setClientInviteCode("");
                          setClientConnected(true);
                          setClientTab("home");
                          fetchClientTrainers();
                          fetchClientSessions();
                          try {
                            localStorage.setItem("clientConnected", "true");
                          } catch {
                            // ignore
                          }
                        } catch {
                          setClientInviteMessage(tr("Не удалось подключиться.", "Failed to connect."));
                        }
                      })();
                    }}
                    style={{ ...styles.primaryBtn, ...styles.roleInviteBtn }}
                  >
                    {tr("Подключиться", "Connect")}
                  </button>
                  {clientInviteMessage ? (
                    <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
                      {clientInviteMessage}
                    </div>
                  ) : null}
                </div>
              </div>
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
              sessionsByDate={clientSessionsByDate}
              trainers={clientTrainers}
            />
          )}
          {clientTab === "schedule" && (
            <ClientSchedule
              invites={clientTrainers}
              t={t}
              token={token}
              apiBase={apiBase}
              sessionsByDate={clientSessionsByDate}
              onBooked={fetchClientSessions}
              onSaveExercises={saveClientExercises}
            />
          )}
          {clientTab === "book" && (
            <ClientBook
              invites={clientTrainers}
              setClientConnected={setClientConnected}
              token={token}
              apiBase={apiBase}
              onRefresh={fetchClientTrainers}
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
              token={token}
              apiBase={apiBase}
              theme={theme}
              setTheme={setTheme}
              language={language}
              setLanguage={setLanguage}
              reminderHours={reminderHours}
              setReminderHours={setReminderHours}
              cancelWindowHours={cancelWindowHours}
              setCancelWindowHours={setCancelWindowHours}
              t={t}
              trainerProfile={trainerProfile}
              onSaveTrainerProfile={saveTrainerProfile}
              onSaveClientProfile={saveClientProfile}
              onSaveClientExercises={saveClientExercises}
              invites={clientTrainers}
              setInvites={setClientTrainers}
              setClientConnected={setClientConnected}
              onDeleteProfile={handleDeleteProfile}
            />
          )}
          <div style={{ height: 14 }} />
        </div>
        <BottomNav
          active={clientTab}
          onChange={(t) => setClientTab(t as ClientTab)}
          hidden={hideBottomNav}
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

function formatWeekdayShort(date: Date, language: "ru" | "en") {
  if (language === "en") {
    return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date);
  }
  const names = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
  const day = date.getDay();
  const idx = day === 0 ? 6 : day - 1;
  return names[idx];
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
  token,
  apiBase,
}: {
  name: string;
  photoUrl: string;
  clients: TrainerClientInvite[];
  sessionsByDate: Record<string, SessionItem[]>;
  onOpenSession: (session: SessionItem) => void;
  onOpenSettings: () => void;
  token: string;
  apiBase: string;
}) {
  const tr = useTr();
  const [homeTab, setHomeTab] = useState<"work" | "income" | "subscription">("work");
  const [tariffPeriod, setTariffPeriod] = useState<TariffPeriod>("month");
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesLists, setNotesLists] = useState<NotesListItem[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [notesCreating, setNotesCreating] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesEditingId, setNotesEditingId] = useState<string | null>(null);
  const [notesEditDraft, setNotesEditDraft] = useState("");
  const [notesEditing, setNotesEditing] = useState(false);
  const [notesSwipeId, setNotesSwipeId] = useState<string | null>(null);
  const [notesSwipeOffset, setNotesSwipeOffset] = useState(0);
  const [notesActiveList, setNotesActiveList] = useState<NotesListItem | null>(null);
  const [notesItems, setNotesItems] = useState<NotesTaskItem[]>([]);
  const [notesItemsLoading, setNotesItemsLoading] = useState(false);
  const [notesItemsError, setNotesItemsError] = useState<string | null>(null);
  const [notesItemCreating, setNotesItemCreating] = useState(false);
  const [notesItemDraft, setNotesItemDraft] = useState("");
  const [notesItemSaving, setNotesItemSaving] = useState(false);
  const [notesItemEditingId, setNotesItemEditingId] = useState<string | null>(null);
  const [notesItemEditDraft, setNotesItemEditDraft] = useState("");
  const [notesItemEditing, setNotesItemEditing] = useState(false);
  const [notesItemSwipeId, setNotesItemSwipeId] = useState<string | null>(null);
  const [notesItemSwipeOffset, setNotesItemSwipeOffset] = useState(0);
  const notesInputRef = useRef<HTMLInputElement | null>(null);
  const notesEditInputRef = useRef<HTMLInputElement | null>(null);
  const notesItemInputRef = useRef<HTMLInputElement | null>(null);
  const [prepayOpen, setPrepayOpen] = useState(false);
  const [prepayPlan, setPrepayPlan] = useState<{
    id: string;
    name: string;
    total: number;
    months: number;
    periodLabel: string;
  } | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoStatus, setPromoStatus] = useState<"idle" | "success" | "error">("idle");
  const [promoAppliedTotal, setPromoAppliedTotal] = useState<number | null>(null);
  const swipeStateRef = useRef<{ id: string | null; startX: number; dragging: boolean }>({
    id: null,
    startX: 0,
    dragging: false,
  });
  const itemSwipeStateRef = useRef<{ id: string | null; startX: number; dragging: boolean }>({
    id: null,
    startX: 0,
    dragging: false,
  });
  const [statsMode, setStatsMode] = useState<"money" | "count">("money");
  const [statsDate, setStatsDate] = useState<Date>(() => startOfDay(new Date()));
  const [statsSelectedDate, setStatsSelectedDate] = useState<Date>(() => startOfDay(new Date()));
  const [statsRange, setStatsRange] = useState<7 | 14>(7);
  const [statsInfoOpen, setStatsInfoOpen] = useState(false);
  const [statsRangeOpen, setStatsRangeOpen] = useState(false);
  const [financeHistoryOpen, setFinanceHistoryOpen] = useState(false);
  const [clientStatsMonth, setClientStatsMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [clientStatsMode, setClientStatsMode] = useState<"count" | "money">("count");
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60 * 1000);
    return () => window.clearInterval(id);
  }, []);
  const hasTgBack = typeof WebApp?.BackButton?.show === "function";
  useEffect(() => {
    if (homeTab !== "work" && notesOpen) setNotesOpen(false);
  }, [homeTab, notesOpen]);
  useEffect(() => {
    if (!notesOpen || !token) return;
    let cancelled = false;
    const load = async () => {
      setNotesLoading(true);
      setNotesError(null);
      try {
        const res = await fetch(`${apiBase}/notes/lists`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          if (!cancelled) setNotesError(tr("Не удалось загрузить списки.", "Failed to load lists."));
          return;
        }
        const data = (await res.json()) as { ok: boolean; lists?: NotesListItem[] };
        if (!cancelled) setNotesLists(Array.isArray(data.lists) ? data.lists : []);
      } catch {
        if (!cancelled) setNotesError(tr("Проверьте соединение.", "Check your connection."));
      } finally {
        if (!cancelled) setNotesLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [notesOpen, token, apiBase, tr]);
  useEffect(() => {
    if (notesCreating) {
      window.setTimeout(() => notesInputRef.current?.focus(), 0);
    }
  }, [notesCreating]);
  useEffect(() => {
    if (notesEditingId) {
      window.setTimeout(() => notesEditInputRef.current?.focus(), 0);
    }
  }, [notesEditingId]);
  useEffect(() => {
    if (notesItemCreating) {
      window.setTimeout(() => notesItemInputRef.current?.focus(), 0);
    }
  }, [notesItemCreating]);
  useEffect(() => {
    if (notesItemEditingId) {
      window.setTimeout(() => notesItemInputRef.current?.focus(), 0);
    }
  }, [notesItemEditingId]);
  useEffect(() => {
    if (!hasTgBack) return;
    if (!notesOpen) {
      WebApp.BackButton.hide();
      return;
    }
    const handler = () => {
      if (notesActiveList) {
        setNotesActiveList(null);
        setNotesItems([]);
        setNotesItemsError(null);
        setNotesItemCreating(false);
        return;
      }
      setNotesOpen(false);
      setNotesActiveList(null);
      setNotesItems([]);
      setNotesItemsError(null);
      setNotesItemCreating(false);
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
  }, [hasTgBack, notesOpen, notesActiveList]);
  useEffect(() => {
    if (!prepayOpen) return;
    const scroller = document.querySelector("[data-scroll-area]") as HTMLElement | null;
    if (scroller) {
      scroller.scrollTo({ top: 0, behavior: "auto" });
    } else {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [prepayOpen]);
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
  const subscriptionPlanName = tr("Ultimate", "Ultimate");
  const subscriptionConnectedClients = clients.filter((c) => !c.archived).length;
  const subscriptionClientLimitLabel = "∞";
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const completedThisMonth = allSessions.filter((s) => {
    const end = sessionEndTime(s);
    return end.getTime() <= now.getTime() && end.getTime() >= monthStart.getTime() && end.getTime() <= monthEnd.getTime();
  }).length;
  const subscriptionMonthlyLimitLabel = "∞";
  const tariffPeriodMeta: Record<
    TariffPeriod,
    { months: number; discount: number; label: string; toggleLabel: string }
  > = {
    month: {
      months: 1,
      discount: 0,
      label: tr("в месяц", "per month"),
      toggleLabel: tr("Мес", "Month"),
    },
    quarter: {
      months: 3,
      discount: 0.1,
      label: tr("за 3 месяца", "for 3 months"),
      toggleLabel: tr("3 мес", "3 mo"),
    },
    year: {
      months: 12,
      discount: 0.2,
      label: tr("в год", "per year"),
      toggleLabel: tr("Год", "Year"),
    },
  };
  const activeTariffPeriodMeta = tariffPeriodMeta[tariffPeriod];
  const tariffPlans = [
    {
      id: "free",
      name: "Free",
      badgeColor: "rgba(77, 163, 255, 0.18)",
      badgeText: "var(--text)",
      priceMonthly: 0,
      strikeMonthly: 300,
      features: [
        tr("1 подключенный клиент", "1 connected client"),
        tr("До 10 тренировок в месяц", "Up to 10 sessions per month"),
      ],
    },
    {
      id: "basic",
      name: "Basic",
      badgeColor: "rgba(99, 102, 241, 0.16)",
      badgeText: "var(--text)",
      priceMonthly: 990,
      strikeMonthly: 2490,
      priceByPeriod: { quarter: 2490, year: 9490 },
      strikeByPeriod: { quarter: 2970, year: 11800 },
      features: [
        tr("До 5 подключенных клиентов", "Up to 5 connected clients"),
        tr("Безлимит тренировок в месяц", "Unlimited sessions per month"),
      ],
    },
    {
      id: "ultimate",
      name: "Ultimate",
      badgeColor: "rgba(16, 185, 129, 0.18)",
      badgeText: "var(--text)",
      priceMonthly: 1490,
      strikeMonthly: 4990,
      priceByPeriod: { quarter: 3990, year: 14490 },
      strikeByPeriod: { quarter: 4990, year: 17490 },
      features: [tr("Безлимит клиентов", "Unlimited clients"), tr("Безлимит тренировок", "Unlimited sessions")],
    },
  ];
  const getTariffTotal = (plan: {
    priceMonthly: number;
    priceByPeriod?: Partial<Record<TariffPeriod, number>>;
  }) =>
    plan.priceByPeriod?.[tariffPeriod] ??
    Math.round(plan.priceMonthly * activeTariffPeriodMeta.months * (1 - activeTariffPeriodMeta.discount));
  const getTariffStrikeTotal = (plan: {
    strikeMonthly: number;
    strikeByPeriod?: Partial<Record<TariffPeriod, number>>;
  }) => plan.strikeByPeriod?.[tariffPeriod] ?? plan.strikeMonthly * activeTariffPeriodMeta.months;
  const openPrepay = (plan: { id: string; name: string; priceMonthly: number; priceByPeriod?: Partial<Record<TariffPeriod, number>> }) => {
    if (plan.id === "free") return;
    const total = getTariffTotal(plan);
    setPrepayPlan({
      id: plan.id,
      name: plan.name,
      total,
      months: activeTariffPeriodMeta.months,
      periodLabel: activeTariffPeriodMeta.label,
    });
    setPromoCode("");
    setPromoStatus("idle");
    setPromoAppliedTotal(null);
    setPrepayOpen(true);
  };

  useEffect(() => {
    if (!hasTgBack) return;
    if (!prepayOpen) {
      WebApp.BackButton.hide();
      return;
    }
    const handler = () => setPrepayOpen(false);
    WebApp.BackButton.show();
    WebApp.BackButton.onClick(handler);
    return () => {
      try {
        WebApp.BackButton.offClick(handler);
      } catch {
        // ignore
      }
    };
  }, [hasTgBack, prepayOpen]);

  const todayStart = startOfDay(now);
  const statsAnchorStart = startOfDay(statsDate);
  const statsSelectedStart = startOfDay(statsSelectedDate);
  const statsMaxDate = addDays(todayStart, 1);
  const statsAnchorEffective =
    statsAnchorStart.getTime() > statsMaxDate.getTime() ? statsMaxDate : statsAnchorStart;
  const statsSelectedEffective =
    statsSelectedStart.getTime() > statsMaxDate.getTime() ? statsMaxDate : statsSelectedStart;
  const statsDateKey = formatDateKey(statsSelectedEffective);
  const statsSessions = sessionsByDate[statsDateKey] || [];
  const statsPlannedCount = statsSessions.length;
  const statsDateStart = statsSelectedStart;
  const statsDateEffective = statsSelectedEffective;
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
    addDays(statsAnchorEffective, idx - (statsRange - 1))
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
  const clientStatsMonthStart = startOfMonth(clientStatsMonth);
  const clientStatsMonthEnd = endOfMonthExclusive(clientStatsMonthStart);
  const clientStatsMonthLabel = formatMonthYear(clientStatsMonthStart);
  const clientStatsMaxMonth = startOfMonth(now);
  const clientStatsSessions = doneSessions.filter((s) => {
    const end = sessionEndTime(s);
    return end.getTime() >= clientStatsMonthStart.getTime() && end.getTime() < clientStatsMonthEnd.getTime();
  });
  const clientStatsMap = new Map<string, { label: string; value: number }>();
  let oneTimeValue = 0;
  const addClientStat = (key: string, label: string, value: number) => {
    const prev = clientStatsMap.get(key) || { label, value: 0 };
    prev.value += value;
    clientStatsMap.set(key, prev);
  };
  clientStatsSessions.forEach((s) => {
    const isGroup = s.clientUsername === "group" || s.type === "group";
    const isOneTime = s.clientUsername === "one_time" || s.type === "one_time";
    if (isGroup) {
      const participants = s.participants || [];
      const total = getSessionPrice(clients, s);
      const perClientValue =
        clientStatsMode === "money"
          ? participants.length
            ? total / participants.length
            : 0
          : 1;
      (s.participants || []).forEach((p) => {
        const client = clients.find((c) => c.id === p.clientId || c.username === p.clientUsername) || null;
        const label = client
          ? getClientLabel(clients, client.username)
          : p.clientName?.trim()
            ? p.clientName
            : p.clientUsername
              ? `@${p.clientUsername.replace(/^@/, "")}`
              : tr("Клиент", "Client");
        const key = client?.id || client?.username || label;
        addClientStat(key, label, perClientValue);
      });
      return;
    }
    if (isOneTime) {
      oneTimeValue += clientStatsMode === "money" ? getSessionPrice(clients, s) : 1;
      return;
    }
    const client = clients.find((c) => c.username === s.clientUsername) || null;
    if (!client) return;
    addClientStat(
      client.id || client.username,
      getClientLabel(clients, client.username),
      clientStatsMode === "money" ? getSessionPrice(clients, s) : 1
    );
  });
  if (clientStatsSessions.length > 0) {
    const label = tr("Разовые", "One-time");
    clientStatsMap.set(label, { label, value: oneTimeValue });
  }
  const clientStats = Array.from(clientStatsMap.values()).sort((a, b) => b.value - a.value);
  const clientStatsMax = Math.max(1, ...clientStats.map((item) => item.value));
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
  const submitNotesDraft = async () => {
    const title = notesDraft.trim();
    if (!title) {
      setNotesDraft("");
      setNotesCreating(false);
      return;
    }
    if (!token) return;
    setNotesSaving(true);
    setNotesError(null);
    try {
      const res = await fetch(`${apiBase}/notes/lists`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        setNotesError(tr("Не удалось сохранить список.", "Failed to save list."));
        return;
      }
      const data = (await res.json()) as { ok: boolean; list?: NotesListItem };
      if (data?.list) {
        setNotesLists((prev) => {
          const next = prev.filter((item) => item.id !== data.list?.id);
          return [data.list as NotesListItem, ...next];
        });
      }
      setNotesDraft("");
      setNotesCreating(false);
    } catch {
      setNotesError(tr("Проверьте соединение.", "Check your connection."));
    } finally {
      setNotesSaving(false);
    }
  };
  const submitNotesEdit = async () => {
    if (!notesEditingId) return;
    const title = notesEditDraft.trim();
    if (!title) return;
    if (!token) return;
    setNotesEditing(true);
    setNotesError(null);
    try {
      const res = await fetch(`${apiBase}/notes/lists/${encodeURIComponent(notesEditingId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        setNotesError(tr("Не удалось сохранить список.", "Failed to save list."));
        return;
      }
      const data = (await res.json()) as { ok: boolean; list?: NotesListItem };
      if (data?.list) {
        setNotesLists((prev) =>
          prev.map((item) => (item.id === data.list?.id ? (data.list as NotesListItem) : item))
        );
      }
      setNotesEditingId(null);
      setNotesEditDraft("");
    } catch {
      setNotesError(tr("Проверьте соединение.", "Check your connection."));
    } finally {
      setNotesEditing(false);
    }
  };
  const handleDeleteNote = async (id: string) => {
    const message = tr("Вы действительно хотите удалить список?", "Delete this list?");
    const confirmDelete = async () => {
      if (!token) return;
      try {
        const res = await fetch(`${apiBase}/notes/lists/${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          setNotesError(tr("Не удалось удалить список.", "Failed to delete list."));
          return;
        }
        setNotesLists((prev) => prev.filter((item) => item.id !== id));
        if (notesSwipeId === id) {
          setNotesSwipeId(null);
          setNotesSwipeOffset(0);
        }
      } catch {
        setNotesError(tr("Проверьте соединение.", "Check your connection."));
      }
    };
    if (typeof WebApp?.showConfirm === "function") {
      WebApp.showConfirm(message, (ok) => {
        if (ok) void confirmDelete();
      });
      return;
    }
    if (window.confirm(message)) void confirmDelete();
  };

  const loadNotesItems = useCallback(
    async (listId: string) => {
      if (!token) return;
      setNotesItemsLoading(true);
      setNotesItemsError(null);
      try {
        const res = await fetch(`${apiBase}/notes/lists/${encodeURIComponent(listId)}/items`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          setNotesItemsError(tr("Не удалось загрузить задачи.", "Failed to load tasks."));
          return;
        }
        const data = (await res.json()) as { ok: boolean; items?: NotesTaskItem[] };
        setNotesItems(Array.isArray(data.items) ? data.items : []);
      } catch {
        setNotesItemsError(tr("Проверьте соединение.", "Check your connection."));
      } finally {
        setNotesItemsLoading(false);
      }
    },
    [apiBase, token, tr]
  );

  const submitNotesItemDraft = async () => {
    if (!notesActiveList) return;
    const title = notesItemDraft.trim();
    if (!title) {
      setNotesItemDraft("");
      setNotesItemCreating(false);
      return;
    }
    if (!token) return;
    setNotesItemSaving(true);
    setNotesItemsError(null);
    try {
      const res = await fetch(`${apiBase}/notes/lists/${encodeURIComponent(notesActiveList.id)}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        setNotesItemsError(tr("Не удалось сохранить задачу.", "Failed to save task."));
        return;
      }
      const data = (await res.json()) as { ok: boolean; item?: NotesTaskItem };
      if (data?.item) {
        setNotesItems((prev) => [data.item as NotesTaskItem, ...prev]);
      }
      setNotesItemDraft("");
      setNotesItemCreating(false);
    } catch {
      setNotesItemsError(tr("Проверьте соединение.", "Check your connection."));
    } finally {
      setNotesItemSaving(false);
    }
  };

  const submitNotesItemEdit = async () => {
    if (!notesItemEditingId) return;
    const title = notesItemEditDraft.trim();
    if (!title) return;
    if (!token) return;
    setNotesItemEditing(true);
    setNotesItemsError(null);
    try {
      const res = await fetch(`${apiBase}/notes/items/${encodeURIComponent(notesItemEditingId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        setNotesItemsError(tr("Не удалось сохранить задачу.", "Failed to save task."));
        return;
      }
      const data = (await res.json()) as { ok: boolean; item?: NotesTaskItem };
      if (data?.item) {
        setNotesItems((prev) => prev.map((it) => (it.id === data.item?.id ? (data.item as NotesTaskItem) : it)));
      }
      setNotesItemEditingId(null);
      setNotesItemEditDraft("");
    } catch {
      setNotesItemsError(tr("Проверьте соединение.", "Check your connection."));
    } finally {
      setNotesItemEditing(false);
    }
  };

  const handleDeleteNotesItem = async (id: string) => {
    const message = tr("Вы действительно хотите удалить задачу?", "Delete this task?");
    const confirmDelete = async () => {
      if (!token) return;
      try {
        const res = await fetch(`${apiBase}/notes/items/${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          setNotesItemsError(tr("Не удалось удалить задачу.", "Failed to delete task."));
          return;
        }
        setNotesItems((prev) => prev.filter((it) => it.id !== id));
        if (notesItemSwipeId === id) {
          setNotesItemSwipeId(null);
          setNotesItemSwipeOffset(0);
        }
      } catch {
        setNotesItemsError(tr("Проверьте соединение.", "Check your connection."));
      }
    };
    if (typeof WebApp?.showConfirm === "function") {
      WebApp.showConfirm(message, (ok) => {
        if (ok) void confirmDelete();
      });
      return;
    }
    if (window.confirm(message)) void confirmDelete();
  };

  const toggleNotesItem = async (item: NotesTaskItem) => {
    if (!token) return;
    const nextDone = !item.done;
    setNotesItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, done: nextDone } : it)));
    try {
      const res = await fetch(`${apiBase}/notes/items/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ done: nextDone }),
      });
      if (!res.ok) {
        setNotesItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, done: item.done } : it)));
        setNotesItemsError(tr("Не удалось обновить задачу.", "Failed to update task."));
      }
    } catch {
      setNotesItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, done: item.done } : it)));
      setNotesItemsError(tr("Проверьте соединение.", "Check your connection."));
    }
  };

  if (notesOpen && notesActiveList) {
    return (
      <div style={{ ...styles.pageContainer, ...styles.notesPage }}>
        <div style={styles.notesScreen}>
          <div style={{ ...styles.topBar, ...styles.notesTopBar }}>
            <div style={styles.backBtnSpacer} />
            <div style={{ ...styles.topBarTitle, ...styles.notesTitle }}>{notesActiveList.title}</div>
            <div style={styles.backBtnSpacer} />
          </div>
          <div style={styles.notesTopBarDivider} />
          <div style={styles.notesList}>
            {notesItemCreating ? (
              <div style={styles.notesRow}>
                <input
                  ref={notesItemInputRef}
                  value={notesItemDraft}
                  onChange={(e) => setNotesItemDraft(e.target.value)}
                  placeholder={tr("Новая задача", "New task")}
                  style={styles.notesInput}
                  disabled={notesItemSaving}
                  onKeyDown={(e) => {
                    if (notesItemSaving) return;
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitNotesItemDraft();
                    }
                    if (e.key === "Escape") {
                      setNotesItemDraft("");
                      setNotesItemCreating(false);
                    }
                  }}
                  onBlur={() => {
                    if (!notesItemDraft.trim()) {
                      setNotesItemDraft("");
                      setNotesItemCreating(false);
                    }
                  }}
                />
                <span style={{ ...styles.notesRowAction, ...styles.notesRowActionDisabled }}>+</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setNotesItemCreating(true);
                  setNotesItemDraft("");
                }}
                style={{ ...styles.notesRow, ...styles.notesRowButton }}
              >
                <span style={styles.notesRowTitle}>{tr("Новая задача", "New task")}</span>
                <span style={styles.notesRowAction}>+</span>
              </button>
            )}
            {notesItemsError ? <div style={styles.notesError}>{notesItemsError}</div> : null}
            {notesItemsLoading ? (
              <div style={styles.notesEmpty}>{tr("Загрузка...", "Loading...")}</div>
            ) : notesItems.length === 0 ? (
              <div style={styles.notesEmpty}>
                {tr("Добавьте первую задачу.", "Add your first task.")}
              </div>
            ) : (
              notesItems.map((item) => (
                <div key={item.id} style={styles.notesSwipeWrap}>
                  <div style={styles.notesSwipeActions}>
                    <button
                      type="button"
                      onClick={() => {
                        setNotesItemSwipeId(null);
                        setNotesItemSwipeOffset(0);
                        setNotesItemEditingId(item.id);
                        setNotesItemEditDraft(item.title);
                      }}
                      style={{ ...styles.notesSwipeBtn, ...styles.notesSwipeEdit }}
                      aria-label={tr("редактировать", "edit")}
                    >
                      <IconPencil />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteNotesItem(item.id)}
                      style={{ ...styles.notesSwipeBtn, ...styles.notesSwipeDelete }}
                      aria-label={tr("удалить", "delete")}
                    >
                      <IconTrash size={20} strokeWidth={2} />
                    </button>
                  </div>
                  <div
                    style={{
                      ...styles.notesRow,
                      ...styles.notesSwipeRow,
                      transform:
                        notesItemSwipeId === item.id
                          ? `translateX(${notesItemSwipeOffset}px)`
                          : "translateX(0px)",
                    }}
                    onPointerDown={(e) => {
                      if (notesItemEditingId) return;
                      itemSwipeStateRef.current = { id: item.id, startX: e.clientX, dragging: true };
                    }}
                    onPointerMove={(e) => {
                      if (!itemSwipeStateRef.current.dragging) return;
                      if (itemSwipeStateRef.current.id !== item.id) return;
                      const delta = e.clientX - itemSwipeStateRef.current.startX;
                      const clamped = Math.max(-120, Math.min(0, delta));
                      setNotesItemSwipeId(item.id);
                      setNotesItemSwipeOffset(clamped);
                    }}
                    onPointerUp={() => {
                      if (!itemSwipeStateRef.current.dragging) return;
                      itemSwipeStateRef.current.dragging = false;
                      const shouldOpen = notesItemSwipeOffset <= -60;
                      setNotesItemSwipeId(shouldOpen ? item.id : null);
                      setNotesItemSwipeOffset(shouldOpen ? -120 : 0);
                    }}
                    onPointerLeave={() => {
                      if (!itemSwipeStateRef.current.dragging) return;
                      itemSwipeStateRef.current.dragging = false;
                      const shouldOpen = notesItemSwipeOffset <= -60;
                      setNotesItemSwipeId(shouldOpen ? item.id : null);
                      setNotesItemSwipeOffset(shouldOpen ? -120 : 0);
                    }}
                  >
                    {notesItemEditingId === item.id ? (
                      <input
                        ref={notesItemInputRef}
                        value={notesItemEditDraft}
                        onChange={(e) => setNotesItemEditDraft(e.target.value)}
                        placeholder={tr("Новая задача", "New task")}
                        style={styles.notesInput}
                        disabled={notesItemEditing}
                        onKeyDown={(e) => {
                          if (notesItemEditing) return;
                          if (e.key === "Enter") {
                            e.preventDefault();
                            submitNotesItemEdit();
                          }
                          if (e.key === "Escape") {
                            setNotesItemEditingId(null);
                            setNotesItemEditDraft("");
                          }
                        }}
                        onBlur={() => {
                          if (!notesItemEditDraft.trim()) return;
                          submitNotesItemEdit();
                        }}
                      />
                    ) : (
                      <>
                        <span
                          style={{
                            ...styles.notesRowTitle,
                            ...(item.done ? styles.notesTaskDone : null),
                          }}
                        >
                          {item.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleNotesItem(item)}
                          style={{
                            ...styles.notesTaskToggle,
                            ...(item.done ? styles.notesTaskToggleActive : null),
                          }}
                          aria-label={tr("отметить задачу", "toggle task")}
                        >
                          {item.done ? <IconCheck size={14} strokeWidth={2.2} /> : null}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  if (notesOpen) {
    return (
      <div style={{ ...styles.pageContainer, ...styles.notesPage }}>
        <div style={styles.notesScreen}>
          <div style={{ ...styles.topBar, ...styles.notesTopBar }}>
            <div style={styles.backBtnSpacer} />
            <div style={{ ...styles.topBarTitle, ...styles.notesTitle }}>{tr("Заметки", "Notes")}</div>
            <div style={styles.backBtnSpacer} />
          </div>
          <div style={styles.notesTopBarDivider} />
          <div style={styles.notesList}>
            {notesCreating ? (
              <div style={styles.notesRow}>
                <input
                  ref={notesInputRef}
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  placeholder={tr("Новый список", "New list")}
                  style={styles.notesInput}
                  disabled={notesSaving}
                  onKeyDown={(e) => {
                    if (notesSaving) return;
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitNotesDraft();
                    }
                    if (e.key === "Escape") {
                      setNotesDraft("");
                      setNotesCreating(false);
                    }
                  }}
                  onBlur={() => {
                    if (!notesDraft.trim()) {
                      setNotesDraft("");
                      setNotesCreating(false);
                    }
                  }}
                />
                <span style={{ ...styles.notesRowAction, ...styles.notesRowActionDisabled }}>+</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setNotesCreating(true);
                  setNotesDraft("");
                }}
                style={{ ...styles.notesRow, ...styles.notesRowButton }}
              >
                <span style={styles.notesRowTitle}>{tr("Новый список", "New list")}</span>
                <span style={styles.notesRowAction}>+</span>
              </button>
            )}
            {notesError ? <div style={styles.notesError}>{notesError}</div> : null}
            {notesLoading ? (
              <div style={styles.notesEmpty}>{tr("Загрузка списков...", "Loading lists...")}</div>
            ) : notesLists.length === 0 ? (
              <div style={styles.notesEmpty}>
                {tr("Добавьте первый список заметок.", "Add your first notes list.")}
              </div>
            ) : (
              notesLists.map((item) => (
                <div key={item.id} style={styles.notesSwipeWrap}>
                  <div style={styles.notesSwipeActions}>
                    <button
                      type="button"
                      onClick={() => {
                        setNotesSwipeId(null);
                        setNotesSwipeOffset(0);
                        setNotesEditingId(item.id);
                        setNotesEditDraft(item.title);
                      }}
                      style={{ ...styles.notesSwipeBtn, ...styles.notesSwipeEdit }}
                      aria-label={tr("редактировать", "edit")}
                    >
                      <IconPencil />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteNote(item.id)}
                      style={{ ...styles.notesSwipeBtn, ...styles.notesSwipeDelete }}
                      aria-label={tr("удалить", "delete")}
                    >
                      <IconTrash size={20} strokeWidth={2} />
                    </button>
                  </div>
                  <div
                    style={{
                      ...styles.notesRow,
                      ...styles.notesSwipeRow,
                      transform:
                        notesSwipeId === item.id ? `translateX(${notesSwipeOffset}px)` : "translateX(0px)",
                    }}
                    onPointerDown={(e) => {
                      if (notesEditingId) return;
                      swipeStateRef.current = { id: item.id, startX: e.clientX, dragging: true };
                    }}
                    onPointerMove={(e) => {
                      if (!swipeStateRef.current.dragging) return;
                      if (swipeStateRef.current.id !== item.id) return;
                      const delta = e.clientX - swipeStateRef.current.startX;
                      const clamped = Math.max(-120, Math.min(0, delta));
                      setNotesSwipeId(item.id);
                      setNotesSwipeOffset(clamped);
                    }}
                    onPointerUp={() => {
                      if (!swipeStateRef.current.dragging) return;
                      swipeStateRef.current.dragging = false;
                      const shouldOpen = notesSwipeOffset <= -60;
                      setNotesSwipeId(shouldOpen ? item.id : null);
                      setNotesSwipeOffset(shouldOpen ? -120 : 0);
                    }}
                    onPointerLeave={() => {
                      if (!swipeStateRef.current.dragging) return;
                      swipeStateRef.current.dragging = false;
                      const shouldOpen = notesSwipeOffset <= -60;
                      setNotesSwipeId(shouldOpen ? item.id : null);
                      setNotesSwipeOffset(shouldOpen ? -120 : 0);
                    }}
                    onClick={() => {
                      if (notesEditingId || notesSwipeId === item.id) return;
                      setNotesActiveList(item);
                      setNotesItems([]);
                      setNotesItemsError(null);
                      setNotesItemCreating(false);
                      void loadNotesItems(item.id);
                    }}
                  >
                    {notesEditingId === item.id ? (
                      <input
                        ref={notesEditInputRef}
                        value={notesEditDraft}
                        onChange={(e) => setNotesEditDraft(e.target.value)}
                        placeholder={tr("Новый список", "New list")}
                        style={styles.notesInput}
                        disabled={notesEditing}
                        onKeyDown={(e) => {
                          if (notesEditing) return;
                          if (e.key === "Enter") {
                            e.preventDefault();
                            submitNotesEdit();
                          }
                          if (e.key === "Escape") {
                            setNotesEditingId(null);
                            setNotesEditDraft("");
                          }
                        }}
                        onBlur={() => {
                          if (!notesEditDraft.trim()) return;
                          submitNotesEdit();
                        }}
                      />
                    ) : (
                      <span style={styles.notesRowTitle}>{item.title}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  if (prepayOpen && prepayPlan) {
    const prepayTotal = promoAppliedTotal ?? prepayPlan.total;
    return (
      <div style={{ ...styles.pageContainer, ...styles.prepayPage }}>
        <div style={styles.prepayTitle}>{tr("Оплата подписки", "Subscription payment")}</div>
        <div style={styles.prepayCard}>
          <div style={styles.prepayRow}>
            <div>
              <div style={styles.prepayLabel}>{tr("Стоимость подписки", "Subscription price")}</div>
              <div style={styles.prepaySubLabel}>{prepayPlan.name}</div>
            </div>
            <div style={styles.prepayValue}>{formatMoney(prepayPlan.total)}</div>
          </div>
          <div style={styles.prepayRow}>
            <div>
              <div style={styles.prepayLabel}>{tr("Срок подписки", "Subscription term")}</div>
              <div style={styles.prepaySubLabel}>
                {tr("Начало", "Start")} {formatDateShort(new Date())}
              </div>
            </div>
            <div style={styles.prepayValue}>
              {prepayPlan.months} {tr("месяц", "month")}
              {prepayPlan.months > 1 ? tr("а", "s") : ""}
            </div>
          </div>
          <div style={styles.prepayRow}>
            <div style={styles.prepayLabel}>{tr("Промокод", "Promo code")}</div>
          </div>
          <div style={styles.promoRow}>
            <input
              value={promoCode}
              onChange={(e) => {
                setPromoCode(e.target.value);
                setPromoStatus("idle");
                setPromoAppliedTotal(null);
              }}
              placeholder={tr("Введите промокод", "Enter promo code")}
              style={styles.promoInput}
            />
            <button
              type="button"
              style={styles.promoApplyBtn}
              onClick={async () => {
                const code = promoCode.trim().toUpperCase();
                if (!code || !token) {
                  setPromoStatus("error");
                  setPromoAppliedTotal(null);
                  return;
                }
                try {
                  const res = await fetch(`${apiBase}/promo/apply`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({
                      code,
                      planId: prepayPlan.id,
                      planName: prepayPlan.name,
                      months: prepayPlan.months,
                    }),
                  });
                  if (!res.ok) {
                    setPromoStatus("error");
                    setPromoAppliedTotal(null);
                    return;
                  }
                  const data = (await res.json()) as { ok?: boolean; total?: number };
                  if (data?.ok) {
                    setPromoStatus("success");
                    setPromoAppliedTotal(typeof data.total === "number" ? data.total : 0);
                  } else {
                    setPromoStatus("error");
                    setPromoAppliedTotal(null);
                  }
                } catch {
                  setPromoStatus("error");
                  setPromoAppliedTotal(null);
                }
              }}
            >
              {tr("Применить", "Apply")}
            </button>
          </div>
          {promoStatus === "error" ? (
            <div style={styles.promoError}>{tr("Промокод не существует", "Promo code not found")}</div>
          ) : promoStatus === "success" ? (
            <div style={styles.promoSuccess}>{tr("Промокод успешно применён", "Promo code applied")}</div>
          ) : null}
          <div style={styles.prepayRow}>
            <div style={styles.prepayLabel}>{tr("Итого к оплате", "Total")}</div>
            <div style={styles.prepayTotal}>{formatMoney(prepayTotal)}</div>
          </div>
        </div>
        <button type="button" style={styles.prepayPayBtn}>
          {tr("Оплатить", "Pay")}
        </button>
        <div style={styles.prepayNote}>
          {tr(
            "Нажимая кнопку «Оплатить», я подтверждаю согласие на условия оплаты.",
            "By clicking Pay, I confirm acceptance of the payment terms."
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...styles.pageContainer, ...styles.homeWorkPage }}>
      <div style={{ ...styles.homeIntro, ...styles.homeIntroWork }}>
        <div style={styles.homeHero}>
          <div style={styles.homeHeroTop}>
            <button
              type="button"
              onClick={onOpenSettings}
              style={styles.homeAvatarBtn}
              aria-label={tr("настройки", "settings")}
            >
              <AvatarCircle name={name || tr("Пользователь", "User")} photoUrl={photoUrl} size={52} />
            </button>
            {homeTab === "work" ? (
              <button
                type="button"
                onClick={() => setNotesOpen(true)}
                style={styles.homeNotesBtn}
                aria-label={tr("заметки", "notes")}
              >
                {tr("Заметки", "Notes")}
              </button>
            ) : (
              <div style={styles.homeStatusPill}>
                <span style={{ color: subscriptionStatusInfo.color }}>{subscriptionStatusInfo.label}</span>
              </div>
            )}
          </div>
          <div style={styles.homeHeroText}>
            <div style={styles.homeHeroTitle}>
              {getGreetingByTime()}, {name || tr("Пользователь", "User")}
            </div>
            <div style={styles.homeHeroSubtitle}>{tr("Ваш день начинается здесь", "Your day starts here")}</div>
          </div>
          <div style={styles.homeTabs}>
            <button
              type="button"
              onClick={() => setHomeTab("work")}
              style={{
                ...styles.homeTab,
                ...(homeTab === "work" ? styles.homeTabActive : null),
              }}
            >
              {tr("Важное", "Highlights")}
            </button>
            <button
              type="button"
              onClick={() => setHomeTab("income")}
              style={{
                ...styles.homeTab,
                ...(homeTab === "income" ? styles.homeTabActive : null),
              }}
            >
              {tr("Статистика", "Stats")}
            </button>
            <button
              type="button"
              onClick={() => setHomeTab("subscription")}
              style={{
                ...styles.homeTab,
                ...(homeTab === "subscription" ? styles.homeTabActive : null),
              }}
            >
              {tr("Подписка", "Subscription")}
            </button>
          </div>
        </div>
        {homeTab === "work" ? (
          <>
            <div style={styles.homeNextBlockWork}>
              {nearest ? (
                <>
                  <button
                    type="button"
                    className="home-next-card"
                    style={styles.homeNextCardWork}
                    onClick={() => onOpenSession(nearest)}
                  >
                    <div style={styles.homeNextHeader}>
                      <div style={styles.homeNextLabel}>{tr("Ближайшее занятие", "Next session")}</div>
                      <div
                        style={{
                          ...styles.homeNextStatusPill,
                          color: sessionStatusColor(nearest, now),
                        }}
                      >
                        <span
                          style={{
                            ...styles.homeNextStatusDot,
                            background: sessionStatusColor(nearest, now),
                          }}
                        />
                        {sessionStatusLabel(nearest, now)}
                      </div>
                    </div>
                    <div style={styles.homeNextTimeWork}>{formatNearestTime(nearest)}</div>
                    <div style={styles.homeNextMetaWork}>{sessionClientLabel(nearest, tr, clients)}</div>
                  </button>
                  {(() => {
                    const isGroup = nearest.clientUsername === "group" || nearest.type === "group";
                    const isOneTime = nearest.clientUsername === "one_time" || nearest.type === "one_time";
                    if (isOneTime) return null;
                    const usernames = isGroup
                      ? Array.from(
                          new Set(
                            (nearest.participants || [])
                              .map((p) => String(p.clientUsername || "").replace(/^@/, "").trim())
                              .filter(Boolean)
                          )
                        )
                      : [String(nearest.clientUsername || "").replace(/^@/, "").trim()].filter(Boolean);
                    const tgUsernames = usernames.filter((u) => !isLocalClientUsername(u));
                    if (tgUsernames.length === 0) return null;
                    return (
                      <div style={styles.homeNextContactRow}>
                        <div style={styles.homeNextContactLabel}>
                          {tr("Связаться с клиентом:", "Contact the client:")}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {tgUsernames.map((handle) => (
                            <button
                              key={handle}
                              type="button"
                              onClick={() => {
                                const link = `https://t.me/${handle}`;
                                if (typeof WebApp?.openTelegramLink === "function") {
                                  WebApp.openTelegramLink(link);
                                } else {
                                  window.open(link, "_blank");
                                }
                              }}
                              style={styles.homeNextContactLink}
                            >
                              @{handle}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div style={styles.homeNextEmpty}>
                  {tr("У вас пока нет запланированных занятий", "You don't have any scheduled sessions yet")}
                </div>
              )}
            </div>
            <div style={styles.homeStatsBlock}>
              <div style={styles.homeStatsTitle}>{tr("Статистика за сегодня", "Today's stats")}</div>
              <div style={styles.homeStatsGrid}>
                <div style={styles.homeStatsCard}>
                  <div style={styles.homeStatsLabel}>{tr("Запланировано", "Planned")}</div>
                  <div style={styles.homeStatsValue}>{todayCount}</div>
                </div>
                <div style={styles.homeStatsCard}>
                  <div style={styles.homeStatsLabel}>{tr("Осталось", "Remaining")}</div>
                  <div style={styles.homeStatsValue}>{todayRemaining}</div>
                </div>
              </div>
            </div>
            <div style={styles.homeWeekBlockWork}>
              <div style={styles.homeWeekCardWork}>
                <div style={styles.homeWeekLabelWork}>{tr("Тренировок за неделю", "Sessions this week")}</div>
                <div style={styles.homeWeekValueWork}>{completedThisWeek}</div>
              </div>
            </div>
          </>
        ) : null}
        {homeTab === "income" ? (
          <div style={styles.statsBlock}>
            <div style={styles.statsHeader}>
              <div style={styles.statsHeaderLeft} />
              <div style={styles.statsHeaderRight} />
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
                  onClick={() => {
                    setStatsDate((prev) => addDays(prev, -1));
                    setStatsSelectedDate((prev) => addDays(prev, -1));
                  }}
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
                  onClick={() => {
                    setStatsDate((prev) => {
                      const next = addDays(prev, 1);
                      return next.getTime() > statsMaxDate.getTime() ? statsMaxDate : next;
                    });
                    setStatsSelectedDate((prev) => {
                      const next = addDays(prev, 1);
                      return next.getTime() > statsMaxDate.getTime() ? statsMaxDate : next;
                    });
                  }}
                >
                  ›
                </button>
              </div>
            </div>
            <div style={styles.statsSummary}>
              <div style={styles.statsSummaryRow}>
                <div style={styles.statsSummaryGrid}>
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
                <div style={styles.statsSummarySide}>
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
                        onClick={() => setStatsSelectedDate(item.date)}
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
            <div style={styles.clientStatsBlock}>
              <div style={styles.clientStatsHeader}>
                <div style={styles.clientStatsTitle}>{tr("Статистика по клиентам", "Client stats")}</div>
                <div style={styles.clientStatsControls}>
                  <div style={styles.clientStatsModeGroup}>
                    <button
                      type="button"
                      onClick={() => setClientStatsMode("count")}
                      style={{
                        ...styles.clientStatsModeBtn,
                        ...(clientStatsMode === "count" ? styles.clientStatsModeBtnActive : null),
                      }}
                    >
                      {tr("Шт.", "Count")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setClientStatsMode("money")}
                      style={{
                        ...styles.clientStatsModeBtn,
                        ...(clientStatsMode === "money" ? styles.clientStatsModeBtnActive : null),
                      }}
                    >
                      ₽
                    </button>
                  </div>
                  <button
                    type="button"
                    style={styles.clientStatsMonthBtn}
                    onClick={() => setClientStatsMonth(startOfMonth(addMonths(clientStatsMonthStart, -1)))}
                    aria-label={tr("Предыдущий месяц", "Previous month")}
                  >
                    ‹
                  </button>
                  <div style={styles.clientStatsMonthLabel}>{clientStatsMonthLabel}</div>
                  <button
                    type="button"
                    style={{
                      ...styles.clientStatsMonthBtn,
                      opacity: clientStatsMonthStart.getTime() >= clientStatsMaxMonth.getTime() ? 0.4 : 1,
                      cursor: clientStatsMonthStart.getTime() >= clientStatsMaxMonth.getTime() ? "not-allowed" : "pointer",
                    }}
                    onClick={() => {
                      if (clientStatsMonthStart.getTime() >= clientStatsMaxMonth.getTime()) return;
                      setClientStatsMonth(startOfMonth(addMonths(clientStatsMonthStart, 1)));
                    }}
                    disabled={clientStatsMonthStart.getTime() >= clientStatsMaxMonth.getTime()}
                    aria-label={tr("Следующий месяц", "Next month")}
                  >
                    ›
                  </button>
                </div>
              </div>
              {clientStats.length ? (
                <div style={styles.clientStatsList}>
                  {clientStats.map((item, idx) => (
                    <div key={`${item.label}-${idx}`} style={styles.clientStatsRow}>
                      <div style={styles.clientStatsName}>{item.label}</div>
                      <div style={styles.clientStatsBarTrack}>
                        <div
                          style={{
                            ...styles.clientStatsBarFill,
                            width: item.value === 0 ? "0%" : `${Math.max(6, (item.value / clientStatsMax) * 100)}%`,
                          }}
                        />
                      </div>
                      <div style={styles.clientStatsCount}>
                        {clientStatsMode === "money" ? formatMoney(Math.round(item.value)) : item.value}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={styles.clientStatsEmpty}>{tr("Пока нет данных", "No data yet")}</div>
              )}
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
                <div style={styles.homeSubscriptionLabel}>
                  {tr("Тренировок в этом месяце", "Sessions this month")}
                </div>
                <div style={styles.homeSubscriptionValue}>
                  {completedThisMonth} {tr("из", "of")} {subscriptionMonthlyLimitLabel}
                </div>
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
            <div style={styles.tariffToggleWrap}>
              <div style={styles.tariffToggle}>
                {(Object.keys(tariffPeriodMeta) as Array<keyof typeof tariffPeriodMeta>).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTariffPeriod(key)}
                    style={{
                      ...styles.tariffToggleBtn,
                      ...(tariffPeriod === key ? styles.tariffToggleBtnActive : null),
                    }}
                  >
                    {tariffPeriodMeta[key].toggleLabel}
                  </button>
                ))}
              </div>
            </div>
            <div style={styles.tariffScroller}>
              {tariffPlans.map((plan) => {
                const total = getTariffTotal(plan);
                const strikeTotal = getTariffStrikeTotal(plan);
                const isSelected = plan.id === "ultimate";
                return (
                  <div key={plan.id} style={styles.tariffCard}>
                    <div style={{ ...styles.tariffBadge, background: plan.badgeColor, color: plan.badgeText }}>
                      {plan.name}
                    </div>
                    <div style={styles.tariffPriceRow}>
                      <span style={styles.tariffPrice}>{formatMoney(total)}</span>
                      <span style={styles.tariffPriceStrike}>{formatMoney(strikeTotal)}</span>
                    </div>
                    <div style={styles.tariffPeriod}>{activeTariffPeriodMeta.label}</div>
                    <div style={styles.tariffFeatures}>
                      {plan.features.map((item) => (
                        <div key={item} style={styles.tariffFeatureRow}>
                          <span style={styles.tariffDot} />
                          <span style={{ whiteSpace: "pre-line" }}>{item}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      style={{
                        ...styles.tariffChoose,
                        borderColor: isSelected ? "var(--primary)" : "var(--border)",
                        color: isSelected ? "var(--primary)" : "var(--text)",
                      }}
                      onClick={() => openPrepay(plan)}
                    >
                      {isSelected ? tr("Выбран", "Selected") : tr("Выбрать", "Choose")}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function ClientHome(props: {
  name: string;
  photoUrl: string;
  onOpenSettings: () => void;
  sessionsByDate: Record<string, SessionItem[]>;
  trainers: TrainerClientInvite[];
}) {
  const { name, photoUrl, onOpenSettings, sessionsByDate, trainers } = props;
  const tr = useTr();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60 * 1000);
    return () => window.clearInterval(id);
  }, []);
  const todayKey = formatDateKey(now);
  const allSessions = Object.values(sessionsByDate).flat();
  const upcoming = allSessions
    .filter((s) => sessionEndTime(s).getTime() > now.getTime())
    .sort((a, b) => sessionStartTime(a).getTime() - sessionStartTime(b).getTime());
  const nearest = upcoming[0] || null;
  const trainerForNearest =
    nearest?.trainerTgUserId
      ? trainers.find((t) => t.trainerTgUserId === nearest.trainerTgUserId) || null
      : null;
  const trainerHandle = trainerForNearest?.trainerUsername?.trim() || "";
  const todaySessions = sessionsByDate[todayKey] || [];
  const todayCount = todaySessions.length;
  const todayRemaining = todaySessions.filter((s) => sessionEndTime(s).getTime() > now.getTime()).length;
  const weekStart = startOfWeekMonday(now);
  const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6, 23, 59, 59, 999);
  const completedThisWeek = allSessions.filter((s) => {
    const end = sessionEndTime(s);
    return end.getTime() <= now.getTime() && end.getTime() >= weekStart.getTime() && end.getTime() <= weekEnd.getTime();
  }).length;
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
    <div style={{ ...styles.pageContainer, ...styles.homeWorkPage }}>
      <div style={{ ...styles.homeIntro, ...styles.homeIntroWork }}>
        <div style={styles.homeHero}>
          <div style={styles.homeHeroTop}>
            <button
              type="button"
              onClick={onOpenSettings}
              style={styles.homeAvatarBtn}
              aria-label={tr("настройки", "settings")}
            >
              <AvatarCircle name={name || tr("Пользователь", "User")} photoUrl={photoUrl} size={52} />
            </button>
          </div>
          <div style={styles.homeHeroText}>
            <div style={styles.homeHeroTitle}>
              {getGreetingByTime()}, {name || tr("Пользователь", "User")}
            </div>
            <div style={styles.homeHeroSubtitle}>{tr("Ваш день начинается здесь", "Your day starts here")}</div>
          </div>
        </div>
        <>
          <div style={styles.homeNextBlockWork}>
            {nearest ? (
              <>
                <button type="button" className="home-next-card" style={styles.homeNextCardWork}>
                  <div style={styles.homeNextHeader}>
                    <div style={styles.homeNextLabel}>{tr("Ближайшее занятие", "Next session")}</div>
                    <div
                      style={{
                        ...styles.homeNextStatusPill,
                        color: sessionStatusColor(nearest, now),
                      }}
                    >
                      <span
                        style={{
                          ...styles.homeNextStatusDot,
                          background: sessionStatusColor(nearest, now),
                        }}
                      />
                      {sessionStatusLabel(nearest, now)}
                    </div>
                  </div>
                  <div style={styles.homeNextTimeWork}>{formatNearestTime(nearest)}</div>
                  <div style={styles.homeNextMetaWork}>{sessionTitle(nearest, tr)}</div>
                </button>
                {trainerHandle ? (
                  <div style={styles.homeNextContactRow}>
                    <div style={styles.homeNextContactLabel}>
                      {tr("Связаться с тренером:", "Contact the trainer:")}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const handle = trainerHandle.replace(/^@/, "");
                        if (!handle) return;
                        const link = `https://t.me/${handle}`;
                        if (typeof WebApp?.openTelegramLink === "function") {
                          WebApp.openTelegramLink(link);
                        } else {
                          window.open(link, "_blank");
                        }
                      }}
                      style={styles.homeNextContactLink}
                    >
                      @{trainerHandle.replace(/^@/, "")}
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <div style={styles.homeNextEmpty}>
                {tr("У вас пока нет запланированных занятий", "You don't have any scheduled sessions yet")}
              </div>
            )}
          </div>
          <div style={styles.homeStatsBlock}>
            <div style={styles.homeStatsTitle}>{tr("Статистика за сегодня", "Today's stats")}</div>
            <div style={styles.homeStatsGrid}>
              <div style={styles.homeStatsCard}>
                <div style={styles.homeStatsLabel}>{tr("Запланировано", "Planned")}</div>
                <div style={styles.homeStatsValue}>{todayCount}</div>
              </div>
              <div style={styles.homeStatsCard}>
                <div style={styles.homeStatsLabel}>{tr("Осталось", "Remaining")}</div>
                <div style={styles.homeStatsValue}>{todayRemaining}</div>
              </div>
            </div>
          </div>
          <div style={styles.homeWeekBlockWork}>
            <div style={styles.homeWeekCardWork}>
              <div style={styles.homeWeekLabelWork}>{tr("Тренировок за неделю", "Sessions this week")}</div>
              <div style={styles.homeWeekValueWork}>{completedThisWeek}</div>
            </div>
          </div>
        </>
      </div>
    </div>
  );
}

function ClientSchedule(props: {
  invites: TrainerClientInvite[];
  t: UiText;
  token: string;
  apiBase: string;
  sessionsByDate: Record<string, SessionItem[]>;
  onBooked: () => void;
  onSaveExercises?: (
    clientId: string,
    exercises: { id: string; name: string; weight: string }[]
  ) => Promise<TrainerClientInvite | null> | void;
}) {
  const { invites, t, token, apiBase, sessionsByDate, onBooked, onSaveExercises } = props;
  const tr = useTr();
  const [today, setToday] = useState<Date>(() => startOfDay(new Date()));
  const [selected, setSelected] = useState<Date>(() => startOfDay(new Date()));
  const [section, setSection] = useState<"today" | "book" | "history">("today");
  const [scheduleScreen, setScheduleScreen] = useState<"list" | "session">("list");
  const [activeSession, setActiveSession] = useState<SessionItem | null>(null);
  const [sessionTab, setSessionTab] = useState<"info" | "weights">("info");
  const [clientWeights, setClientWeights] = useState<{ id: string; name: string; weight: string }[]>([]);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const todayRef = useRef<HTMLButtonElement | null>(null);
  const selectedRef = useRef<HTMLButtonElement | null>(null);
  const trainers = invites.filter((c) => !c.archived && c.status === "active");
  const canBookAny = useMemo(
    () => trainers.some((t) => t.bookingMode === "both"),
    [trainers]
  );
  const [slots, setSlots] = useState<TrainingSlot[]>([]);
  const [slotError, setSlotError] = useState("");
  const hasTgBack = typeof WebApp?.BackButton?.show === "function";
  const slotsSigRef = useRef<string>("");
  const weightsSigRef = useRef<string>("");

  const activeTrainer = useMemo(() => {
    if (!activeSession?.trainerTgUserId) return null;
    return invites.find((t) => t.trainerTgUserId === activeSession.trainerTgUserId) || null;
  }, [activeSession?.trainerTgUserId, invites]);
  const clientExercises = activeTrainer?.exercises || [];
  const bookedGroupSlotKeys = useMemo(() => {
    const keys = new Set<string>();
    Object.values(sessionsByDate)
      .flat()
      .forEach((session) => {
        if (!(session.type === "group" || session.clientUsername === "group")) return;
        keys.add(`${session.trainerTgUserId}_${session.dateKey}_${session.start}_${session.end}`);
      });
    return keys;
  }, [sessionsByDate]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTs(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!activeTrainer) return;
    const sig = stableStringify(clientExercises || []);
    if (sig === weightsSigRef.current) return;
    weightsSigRef.current = sig;
    setClientWeights(clientExercises.map((ex) => ({ ...ex })));
  }, [activeTrainer, clientExercises]);

  const applySlots = useCallback((next: TrainingSlot[]) => {
    const sig = buildSlotsSignature(next);
    if (sig === slotsSigRef.current) return;
    slotsSigRef.current = sig;
    setSlots(next);
  }, []);

  useEffect(() => {
    const tick = () => setToday(startOfDay(new Date()));
    tick();
    const id = window.setInterval(tick, 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  const days = useMemo(() => buildCalendarStrip(today, 30, 30), [today]);

  useEffect(() => {
    if (!selectedRef.current || !scrollerRef.current) return;
    const el = selectedRef.current;
    const scroller = scrollerRef.current;
    const id = window.requestAnimationFrame(() => {
      const left = el.offsetLeft - scroller.clientWidth / 2 + el.clientWidth / 2;
      scroller.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [selected, days, scheduleScreen]);

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

  useEffect(() => {
    if (section !== "book") return;
    if (!trainers.length) {
      setSelectedTrainerId(null);
      return;
    }
    if (!canBookAny) {
      setSection("today");
      return;
    }
    if (selectedTrainerId && trainers.some((t) => t.id === selectedTrainerId)) return;
    setSelectedTrainerId(trainers[0].id);
  }, [section, trainers, selectedTrainerId, canBookAny]);

  useEffect(() => {
    if (section !== "book") return;
    const trainer = trainers.find((t) => t.id === selectedTrainerId);
    const trainerTgId = trainer?.trainerTgUserId;
    if (!trainerTgId || trainer?.archived) {
      applySlots([]);
      return;
    }
    if (trainer.bookingMode && trainer.bookingMode !== "both") {
      applySlots([]);
      return;
    }
    const dateKey = formatDateKey(selected);
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch(
          `${apiBase}/slots?trainerTgUserId=${encodeURIComponent(trainerTgId)}&dateKey=${encodeURIComponent(
            dateKey
          )}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) {
          setSlotError(tr("Не удалось загрузить свободные окна", "Failed to load slots"));
          return;
        }
        const data = (await res.json()) as { ok: boolean; slots?: TrainingSlot[] };
        if (!cancelled) {
          applySlots(data.slots || []);
          setSlotError((prev) => (prev ? "" : prev));
        }
      } catch {
        if (!cancelled) {
          setSlotError(tr("Не удалось загрузить свободные окна", "Failed to load slots"));
        }
      }
    };
    run();
    const id = window.setInterval(run, 10 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [section, selectedTrainerId, selected, trainers, apiBase, token, tr, applySlots]);

  if (scheduleScreen === "session" && activeSession) {
    const canClientDelete = activeTrainer?.bookingMode === "both";
    const canDeleteByTime = sessionStartTime(activeSession).getTime() > nowTs;
    const isGroupSession = activeSession.clientUsername === "group" || activeSession.type === "group";

    return (
      <div style={{ ...styles.pageContainer, ...styles.schedulePage }}>
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

        <div style={styles.sessionTabsScroll}>
          <div style={styles.sessionTabsWrap}>
            <div style={styles.sessionTabs}>
              <button
                type="button"
                onClick={() => setSessionTab("info")}
                style={{
                  ...styles.sessionTabPill,
                  ...(sessionTab === "info" ? styles.sessionTabPillActive : null),
                }}
              >
                {tr("Информация о тренировке", "Session info")}
              </button>
              <button
                type="button"
                onClick={() => setSessionTab("weights")}
                style={{
                  ...styles.sessionTabPill,
                  ...(sessionTab === "weights" ? styles.sessionTabPillActive : null),
                }}
              >
                {tr("Статистика упражнений", "Exercise stats")}
              </button>
            </div>
          </div>
        </div>
        <div style={styles.sessionTabsDivider} />

        <div style={styles.clientPanelPlain}>
          {sessionTab === "info" ? (
            <div style={styles.sessionInfoStack}>
              <div style={styles.sessionInfoRow}>
                <div style={styles.sessionCard}>
                  <div style={styles.sessionCardLabel}>{tr("Клиент", "Client")}</div>
                  <div style={styles.sessionCardValue}>
                    {activeSession.clientUsername ? sessionClientLabel(activeSession, tr, invites) : "—"}
                  </div>
                </div>
                <div style={styles.sessionCard}>
                  <div style={styles.sessionCardLabel}>{tr("Дата", "Date")}</div>
                  <div style={styles.sessionCardValue}>{formatDateShort(parseDateKey(activeSession.dateKey))}</div>
                </div>
              </div>
              <div style={styles.sessionCard}>
                <div style={styles.sessionCardLabel}>{tr("Время", "Time")}</div>
                <div style={styles.sessionTimeGrid}>
                  <div>
                    <div style={styles.sessionMiniLabel}>{tr("Начало", "Start")}</div>
                    <div style={styles.sessionCardValue}>{activeSession.start}</div>
                  </div>
                  <div>
                    <div style={styles.sessionMiniLabel}>{tr("Конец", "End")}</div>
                    <div style={styles.sessionCardValue}>{activeSession.end}</div>
                  </div>
                </div>
              </div>
              <div style={styles.sessionCard}>
                <div style={styles.sessionCardLabel}>{tr("Тип тренировки", "Session type")}</div>
                <div style={styles.sessionCardValue}>{sessionTitle(activeSession, tr)}</div>
              </div>
              <div style={{ ...styles.sessionCard, padding: "10px 12px" }}>
                <div style={styles.sessionCardLabel}>{tr("Стоимость тренировки", "Session price")}</div>
                <div style={styles.sessionCardValue}>
                  {(() => {
                    const isGroup = activeSession.clientUsername === "group" || activeSession.type === "group";
                    if (isGroup) {
                      const total = parsePriceToNumber(activeSession.price);
                      const count = activeSession.participants?.length || 0;
                      if (!total) return "—";
                      const perClient = count ? Math.round(total / count) : total;
                      return formatMoney(perClient);
                    }
                    const value =
                      (activeSession.price && String(activeSession.price).trim()
                        ? activeSession.price
                        : activeTrainer?.subscriptionPrice) || "";
                    return value ? value : "—";
                  })()}
                </div>
              </div>
              <div style={styles.sessionCard}>
                <div style={styles.sessionCardLabel}>{tr("Комментарий к тренировке", "Session notes")}</div>
                <div style={activeSession.comment && activeSession.comment.trim() ? styles.sessionCardValue : styles.sessionCardValueMuted}>
                  {activeSession.comment && activeSession.comment.trim()
                    ? activeSession.comment
                    : "—"}
                </div>
              </div>
              {isGroupSession && canDeleteByTime ? (
                <button
                  type="button"
                  onClick={() => {
                    const doLeave = async () => {
                      if (!token) return;
                      try {
                        const res = await fetch(
                          `${apiBase}/client/sessions/${encodeURIComponent(activeSession.id)}/leave`,
                          { method: "POST", headers: { Authorization: `Bearer ${token}` } }
                        );
                        if (!res.ok) {
                          try {
                            WebApp?.showPopup?.({
                              title: tr("Не удалось отказаться", "Failed to leave"),
                              message: `${tr("Статус", "Status")}: ${res.status}`,
                              buttons: [{ type: "ok" }],
                            });
                          } catch {
                            // ignore
                          }
                          return;
                        }
                        setScheduleScreen("list");
                        setActiveSession(null);
                        onBooked();
                      } catch {
                        // ignore
                      }
                    };
                    void doLeave();
                  }}
                  style={styles.sessionDangerBtn}
                >
                  {tr("Отказаться от тренировки", "Cancel participation")}
                </button>
              ) : canClientDelete && canDeleteByTime ? (
                <button
                  type="button"
                  onClick={() => {
                    const doDelete = async () => {
                      if (!token) return;
                      try {
                        const res = await fetch(`${apiBase}/client/sessions/${encodeURIComponent(activeSession.id)}`, {
                          method: "DELETE",
                          headers: { Authorization: `Bearer ${token}` },
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
                          return;
                        }
                      } catch {
                        try {
                          WebApp?.showPopup?.({
                            title: tr("Не удалось удалить", "Delete failed"),
                            message: tr(
                              "Проверьте соединение и попробуйте снова.",
                              "Check your connection and try again."
                            ),
                            buttons: [{ type: "ok" }],
                          });
                        } catch {
                          // ignore
                        }
                        return;
                      }
                      onBooked();
                      setScheduleScreen("list");
                      setActiveSession(null);
                    };
                    void doDelete();
                  }}
                  style={{ ...styles.saveBtn, ...styles.dangerBtn, marginTop: 16 }}
                >
                  {tr("Удалить тренировку", "Delete session")}
                </button>
              ) : null}
            </div>
          ) : (
            <ExerciseStatsPanel
              clientId={activeTrainer?.id ?? null}
              exercises={clientWeights}
              setExercises={setClientWeights}
              onSaveExercises={onSaveExercises}
              token={token}
              apiBase={apiBase}
              embedded
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...styles.pageContainer, ...styles.schedulePage }}>
      {section === "book" && trainers.length > 1 ? (
        <div style={styles.scheduleHeaderRow}>
          <div style={styles.trainerSelectWrap}>
            <div style={styles.trainerSelectLabel}>{tr("Тренер", "Coach")}</div>
            <select
              value={selectedTrainerId ?? ""}
              onChange={(e) => setSelectedTrainerId(e.target.value || null)}
              style={styles.trainerSelect}
              aria-label={tr("Выбрать тренера", "Choose coach")}
            >
              {trainers.length === 0 ? (
                <option value="">{tr("Нет тренеров", "No coaches")}</option>
              ) : (
                trainers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {getTrainerLabel(t, tr)}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      ) : null}

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
              <div style={styles.calendarDayWeek}>{d.weekdayText}</div>
            </button>
          );
        })}
      </div>

      <div style={{ ...styles.scheduleTabs, marginTop: 6 }}>
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
        {canBookAny ? (
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
        ) : null}
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
        {section === "today" ? (() => {
          const list = (sessionsByDate[formatDateKey(selected)] || [])
            .slice()
            .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
          if (list.length === 0) {
            return <div style={styles.schedulePanelBody}>{tr("Пока нет тренировок.", "No sessions yet.")}</div>;
          }
          return (
            <div style={styles.sessionList}>
              {list.map((s) => (
                <div
                  key={s.id}
                  style={{ ...styles.sessionBanner, ...(getSessionColorStyle(s.color) || null) }}
                  onClick={() => {
                    setActiveSession(s);
                    setScheduleScreen("session");
                  }}
                >
                  <div style={styles.sessionBannerLeft}>
                    <div style={styles.sessionBannerTitle}>
                      {sessionTitle(s, tr)}
                    </div>
                    <div style={styles.sessionBannerTime}>
                      {(() => {
                        const day = parseDateKey(s.dateKey);
                        const weekday = day ? formatWeekdayShort(day, currentLanguage) : "";
                        return `${weekday ? `${weekday} ` : ""}${s.start} — ${s.end}`;
                      })()}
                    </div>
                    <div
                      style={{
                        ...styles.sessionBannerStatus,
                        color: sessionStatusColor(s),
                      }}
                    >
                      {sessionStatusLabel(s)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })() : section === "book" ? (() => {
          const trainer = trainers.find((t) => t.id === selectedTrainerId) || null;
          if (!trainer) {
            return <div style={styles.schedulePanelBody}>{tr("Нет тренеров.", "No coaches.")}</div>;
          }
          if (trainer.bookingMode && trainer.bookingMode !== "both") {
            return (
              <div style={styles.schedulePanelBody}>
                {tr("Запись на тренировки доступна только у тренера.", "Booking is trainer-only.")}
              </div>
            );
          }
          if (slotError) {
            return <div style={styles.errorText}>{slotError}</div>;
          }
          if (slots.length === 0) {
            return <div style={styles.schedulePanelBody}>{tr("Нет свободных окон.", "No slots available.")}</div>;
          }
          return (
            <div style={styles.freeList}>
              {slots.map((w) => (
                (() => {
                  const isBookedGroupSlot =
                    w.isGroup &&
                    !!trainer.trainerTgUserId &&
                    bookedGroupSlotKeys.has(`${trainer.trainerTgUserId}_${w.dateKey}_${w.start}_${w.end}`);
                  return (
                    <div key={w.id} style={styles.freeBanner}>
                      <div style={styles.freeBannerLeft}>
                        <div style={styles.freeBannerTitle}>
                          {w.isGroup ? tr("Групповое окно", "Group slot") : tr("Свободное окно", "Available slot")}
                        </div>
                        <div style={styles.freeBannerTime}>
                          {w.start} — {w.end}
                        </div>
                        {w.isGroup ? (
                          <div style={styles.freeBannerMeta}>
                            {tr("Мест", "Spots")}: {Math.max(0, (w.capacity ?? 2) - (w.bookedCount ?? 0))}/
                            {w.capacity ?? 2}
                          </div>
                        ) : null}
                        {isBookedGroupSlot ? (
                          <div style={styles.freeBannerMeta}>{tr("Вы уже записаны", "You are already booked")}</div>
                        ) : null}
                      </div>
                      <div style={styles.freeBannerActions}>
                        <button
                          type="button"
                          style={styles.freeBannerAdd}
                          disabled={!canBookSlot(w.dateKey, w.start) || isBookedGroupSlot}
                          onClick={async () => {
                            if (!trainer.trainerTgUserId) return;
                            if (isBookedGroupSlot) return;
                            if (!canBookSlot(w.dateKey, w.start)) {
                              setSlotError(tr("Окно уже началось.", "The slot has already started."));
                              return;
                            }
                            try {
                              const res = await fetch(`${apiBase}/book`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                body: JSON.stringify({
                                  trainerTgUserId: trainer.trainerTgUserId,
                                  dateKey: w.dateKey,
                                  start: w.start,
                                  end: w.end,
                                }),
                              });
                              if (!res.ok) {
                                setSlotError(tr("Не удалось записаться.", "Booking failed."));
                                return;
                              }
                              setSlots((prev) => {
                                if (!w.isGroup) return prev.filter((s) => s.id !== w.id);
                                const nextBookedCount = Math.min((w.capacity ?? 2), Number(w.bookedCount || 0) + 1);
                                return prev.map((s) =>
                                  s.id === w.id ? { ...s, bookedCount: nextBookedCount } : s
                                );
                              });
                              onBooked();
                            } catch {
                              setSlotError(tr("Не удалось записаться.", "Booking failed."));
                            }
                          }}
                          title={
                            isBookedGroupSlot
                              ? tr("Вы уже записаны", "Already booked")
                              : tr("Записаться", "Book")
                          }
                        >
                          <span style={styles.iconOnAccent}>
                            <HugeiconsIcon
                              icon={UserAdd02Icon}
                              size={20}
                              strokeWidth={2.2}
                              style={{ color: "#ffffff", stroke: "currentColor" }}
                            />
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })()
              ))}
            </div>
          );
        })() : section === "history" ? (() => {
          const list = Object.values(sessionsByDate)
            .flat()
            .filter((s) => isSessionEnded(s, new Date()))
            .sort((a, b) => sessionEndTime(b).getTime() - sessionEndTime(a).getTime());
          if (list.length === 0) {
            return (
              <div style={styles.schedulePanelBody}>
                {tr("Пока нет завершённых тренировок.", "No completed sessions yet.")}
              </div>
            );
          }
          return (
            <div style={styles.sessionList}>
              {list.map((s) => (
                <div
                  key={s.id}
                  style={{ ...styles.sessionBanner, ...(getSessionColorStyle(s.color) || null) }}
                  onClick={() => {
                    setActiveSession(s);
                    setScheduleScreen("session");
                  }}
                >
                  <div style={styles.sessionBannerLeft}>
                    <div style={styles.sessionBannerTitle}>
                      {sessionTitle(s, tr)}
                    </div>
                    <div style={styles.sessionBannerTime}>
                      {(() => {
                        const day = parseDateKey(s.dateKey);
                        const weekday = day ? formatWeekdayShort(day, currentLanguage) : "";
                        return `${weekday ? `${weekday} ` : ""}${s.start} — ${s.end}`;
                      })()}
                    </div>
                    <div
                      style={{
                        ...styles.sessionBannerStatus,
                        color: sessionStatusColor(s),
                      }}
                    >
                      {sessionStatusLabel(s)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })() : (
          <div style={styles.schedulePanelBody}>{tr("Пока заглушка.", "Placeholder for now.")}</div>
        )}
      </div>
    </div>
  );
}

function ClientBook(props: {
  invites: TrainerClientInvite[];
  setClientConnected: (v: boolean) => void;
  token: string;
  apiBase: string;
  onRefresh: () => void;
  t: UiText;
}) {
  const { invites, setClientConnected, token, apiBase, onRefresh, t } = props;
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
    <div style={{ ...styles.pageContainer, ...styles.clientsPage }}>
      <div style={styles.trainerSelectTabs}>
        <button
          type="button"
          onClick={() => {
            setSection("list");
            setView("tabs");
          }}
          style={{
            ...styles.trainerSelectTab,
            ...(section === "list" ? styles.trainerSelectTabActive : null),
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
            ...styles.trainerSelectTab,
            ...(section === "add" ? styles.trainerSelectTabActive : null),
          }}
        >
          {t.addTrainerTab}
        </button>
      </div>
      {section === "list" ? (
        <div style={{ marginTop: 14 }}>
          <div style={styles.clientsList}>
            {trainersToShow.map((trainer) => {
              const label = getTrainerLabel(trainer, tr);
              return (
                <div key={trainer.id} style={styles.clientsCard}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTrainerId(trainer.id);
                      setView("detail");
                    }}
                    style={styles.clientsCardBtn}
                  >
                    <div style={styles.clientsRowLeft}>
                      <AvatarCircle name={label} photoUrl={trainer.trainerPhotoUrl || ""} size={52} />
                    <div style={{ minWidth: 0 }}>
                      <div style={styles.clientsName}>{label}</div>
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
          token={token}
          apiBase={apiBase}
          onRefresh={onRefresh}
          onConnected={() => {
            setClientConnected(true);
            setSection("list");
            onRefresh();
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
  reminderHours: number;
  setReminderHours: (v: number) => void;
  cancelWindowHours: number;
  setCancelWindowHours: (v: number) => void;
  t: UiText;
  trainerProfile?: TrainerProfile | null;
  onSaveTrainerProfile?: (patch: Partial<TrainerProfile>) => void;
  onSaveClientProfile?: (patch: Partial<ClientProfile>) => void;
  onSaveClientExercises?: (
    clientId: string,
    exercises: { id: string; name: string; weight: string }[]
  ) => Promise<TrainerClientInvite | null> | void;
  token?: string;
  apiBase?: string;
  invites: TrainerClientInvite[];
  setInvites: React.Dispatch<React.SetStateAction<TrainerClientInvite[]>>;
  setClientConnected: (v: boolean) => void;
  onDeleteProfile: () => void;
}) {
  const {
    screen,
    setScreen,
    invites,
    setInvites,
    setClientConnected,
    onDeleteProfile,
    onSaveClientExercises,
    token,
    apiBase,
    ...rest
  } = props;
  const tr = useTr();
  const clientProfile = useMemo(() => {
    const active = invites.find((c) => c.status === "active") || null;
    if (!active) return null;
    return {
      fullName: active.fullName || "",
      gender: active.gender || "",
      height: active.height || "",
      weight: active.weight || "",
      goal: active.goal || "",
      comment: active.comment || "",
    } as ClientProfile;
  }, [invites]);

  return (
    <TrainerSettings
      {...rest}
      token={token}
      apiBase={apiBase}
      screen={screen}
      setScreen={setScreen}
      personalShowSubscription={false}
      personalShowMySubscription
      personalShowExtendedAbout={false}
      personalShowClientBasics
      personalShowClientWeights
      showBookingRow={false}
      showCancellationRow={false}
      showPaymentsSection={false}
      aboutCardText={tr(
        "Здесь находится информация о вас, которая будет видна вашим тренерам!",
        "This is your info that will be visible to your coaches."
      )}
      subscriptionTabLabel={tr("Мой абонемент", "My subscription")}
      subscriptionItems={invites}
      clientProfile={clientProfile}
      onSaveClientExercises={onSaveClientExercises}
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
  token: string;
  apiBase: string;
  trainerTgUserId: string;
  theme: "light" | "dark";
  trainerProfile?: TrainerProfile | null;
  pendingSession?: SessionItem | null;
  onConsumePendingSession?: () => void;
  onLoadHistory?: (client: TrainerClientInvite) => void;
  onSaveExercises?: (
    clientId: string,
    exercises: { id: string; name: string; weight: string }[]
  ) => Promise<TrainerClientInvite | null> | void;
  openQuickAddSignal?: number;
  quickAddHandled?: number;
  onQuickAddHandled?: (value: number) => void;
}) {
  const {
    clients,
    setClients,
    historyByClient,
    sessionsByDate,
    setSessionsByDate,
    token,
    apiBase,
    trainerTgUserId,
    theme,
    trainerProfile,
    pendingSession,
    onConsumePendingSession,
    onLoadHistory,
    onSaveExercises,
    openQuickAddSignal,
    quickAddHandled,
    onQuickAddHandled,
  } = props;
  const tr = useTr();
  const language = React.useContext(LanguageContext);
  const hasTgBack = typeof WebApp?.BackButton?.show === "function";
  const [today, setToday] = useState<Date>(() => startOfDay(new Date()));
  const [selected, setSelected] = useState<Date>(() => startOfDay(new Date()));
  const [monthAnchor, setMonthAnchor] = useState<Date>(() => startOfMonth(new Date()));
  const [scheduleScreen, setScheduleScreen] = useState<"list" | "session" | "groupClient">("list");
  const [activeSession, setActiveSession] = useState<SessionItem | null>(null);
  const [sessionTab, setSessionTab] = useState<"info" | "weights" | "history">("info");
  const [groupClientTab, setGroupClientTab] = useState<"weights" | "history">("weights");
  const [groupClientId, setGroupClientId] = useState<string | null>(null);
  const sessionCommentRef = useRef<HTMLTextAreaElement | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [draftSessionType, setDraftSessionType] = useState("");
  const [draftSessionPrice, setDraftSessionPrice] = useState("");
  const [draftSessionComment, setDraftSessionComment] = useState("");
  const [draftSessionClientName, setDraftSessionClientName] = useState("");
  const [draftSessionStart, setDraftSessionStart] = useState("");
  const [draftSessionEnd, setDraftSessionEnd] = useState("");
  const [draftSessionDate, setDraftSessionDate] = useState("");
  const [sessionTimeError, setSessionTimeError] = useState("");
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [repeatDate, setRepeatDate] = useState("");
  const [repeatError, setRepeatError] = useState("");
  const [repeatSaving, setRepeatSaving] = useState(false);
  const [groupEditMode, setGroupEditMode] = useState(false);
  const [groupAddOpen, setGroupAddOpen] = useState(false);
  const [groupAddClientId, setGroupAddClientId] = useState("");
  const groupPressTimerRef = useRef<number | null>(null);
  const groupEditJustOpenedRef = useRef(false);
  const [groupPriceInfoOpen, setGroupPriceInfoOpen] = useState(false);
  const [weekScheduleMode, setWeekScheduleMode] = useState<"client" | "one_time" | "group">("client");
  const [weekScheduleClientName, setWeekScheduleClientName] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);
  const weekSwipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const [showWeekSchedule, setShowWeekSchedule] = useState(false);
  const [weekScheduleDate, setWeekScheduleDate] = useState<Date>(() => startOfDay(new Date()));
  const [weekScheduleMulti, setWeekScheduleMulti] = useState(false);
  const [weekScheduleDates, setWeekScheduleDates] = useState<string[]>([]);
  const [weekScheduleStart, setWeekScheduleStart] = useState("12:30");
  const [weekScheduleEnd, setWeekScheduleEnd] = useState("13:30");
  const [weekScheduleClientId, setWeekScheduleClientId] = useState<string>("");
  const [weekScheduleGroupIds, setWeekScheduleGroupIds] = useState<string[]>([]);
  const [weekScheduleError, setWeekScheduleError] = useState("");
  const [weekScheduleDragY, setWeekScheduleDragY] = useState(0);
  const [weekScheduleDragging, setWeekScheduleDragging] = useState(false);
  const weekScheduleDragStartRef = useRef<number>(0);
  const weekScheduleDragYRef = useRef<number>(0);
  const [gridDraft, setGridDraft] = useState<{ dateKey: string; startMin: number; endMin: number } | null>(null);
  const bookingMode = trainerProfile?.bookingMode === "both" ? "both" : "trainer";

  useEffect(() => {
    if (!pendingSession) return;
    setActiveSession(pendingSession);
    setScheduleScreen("session");
    setSessionTab("info");
    onConsumePendingSession?.();
  }, [pendingSession, onConsumePendingSession]);

  useEffect(() => {
    if (!openQuickAddSignal) return;
    if (quickAddHandled === openQuickAddSignal) return;
    setScheduleScreen("list");
    setActiveSession(null);
    setSection("sessions");
    setWeekScheduleMode("client");
    setWeekScheduleDate(selected);
    setShowWeekSchedule(true);
    onQuickAddHandled?.(openQuickAddSignal);
  }, [openQuickAddSignal, quickAddHandled, onQuickAddHandled, selected]);

  useEffect(() => {
    if (!showWeekSchedule) {
      setGridDraft(null);
    }
  }, [showWeekSchedule]);

  useEffect(() => {
    if (!showWeekSchedule) return;
    if (weekScheduleMode !== "client") {
      if (weekScheduleMulti) setWeekScheduleMulti(false);
      if (weekScheduleDates.length) setWeekScheduleDates([]);
      return;
    }
    if (!weekScheduleMulti) {
      if (weekScheduleDates.length) setWeekScheduleDates([]);
      return;
    }
    if (weekScheduleDates.length === 0) {
      setWeekScheduleDates([formatDateKey(weekScheduleDate)]);
    }
  }, [showWeekSchedule, weekScheduleMode, weekScheduleMulti, weekScheduleDates, weekScheduleDate]);

  useEffect(() => {
    if (!weekScheduleDragging) return;
    const handleMove = (event: PointerEvent) => {
      const next = Math.max(0, event.clientY - weekScheduleDragStartRef.current);
      weekScheduleDragYRef.current = next;
      setWeekScheduleDragY(next);
    };
    const handleUp = () => {
      setWeekScheduleDragging(false);
      const shouldClose = weekScheduleDragYRef.current > 120;
      if (shouldClose) {
        setShowWeekSchedule(false);
      }
      weekScheduleDragYRef.current = 0;
      setWeekScheduleDragY(0);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [weekScheduleDragging]);

  useEffect(() => {
    if (!activeSession) return;
    const isOneTime = activeSession.clientUsername === "one_time" || activeSession.type === "one_time";
    const isGroup = activeSession.clientUsername === "group" || activeSession.type === "group";
    setDraftSessionType(activeSession.type ?? "");
    const fallbackPrice =
      clients.find((c) => c.username === activeSession.clientUsername)?.subscriptionPrice ?? "";
    const rawPrice = activeSession.price ?? fallbackPrice ?? "";
    setDraftSessionPrice(rawPrice ? normalizePriceRUB(rawPrice) : "");
    setDraftSessionComment(activeSession.comment ?? "");
    setDraftSessionClientName(activeSession.clientName ?? "");
    setDraftSessionStart(activeSession.start ?? "");
    setDraftSessionEnd(activeSession.end ?? "");
    const fallbackKey = activeSession.dateKey || formatDateKey(sessionStartTime(activeSession));
    setDraftSessionDate(formatDateInputValue(fallbackKey));
    setSessionTimeError("");
    setRepeatError("");
    setRepeatSaving(false);
    const nextRepeat = addDays(sessionStartTime(activeSession), 1);
    setRepeatDate(formatDateInputValue(formatDateKey(nextRepeat)));
    if (isOneTime || isGroup) setSessionTab("info");
  }, [
    activeSession?.id,
    activeSession?.type,
    activeSession?.price,
    activeSession?.comment,
    activeSession?.clientName,
    activeSession?.clientUsername,
    clients,
  ]);

  useEffect(() => {
    if (!groupEditMode) return;
    const onOutside = (event: Event) => {
      if (groupEditJustOpenedRef.current) {
        groupEditJustOpenedRef.current = false;
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("[data-group-remove='true']")) return;
      setGroupEditMode(false);
    };
    document.addEventListener("pointerdown", onOutside, true);
    document.addEventListener("touchstart", onOutside, true);
    return () => {
      document.removeEventListener("pointerdown", onOutside, true);
      document.removeEventListener("touchstart", onOutside, true);
    };
  }, [groupEditMode]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTs(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const saveSessionPatch = async (
    sessionId: string,
    patch: { type?: string; price?: string; comment?: string; clientName?: string }
  ) => {
    if (!token) return;
    try {
      let res = await fetch(`${apiBase}/sessions/${encodeURIComponent(sessionId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(patch),
      });
      if (res.status === 404) {
        const derivedId = sessionId.startsWith(`${trainerTgUserId}_`)
          ? sessionId
          : `${trainerTgUserId}_${sessionId}`;
        if (derivedId !== sessionId) {
          res = await fetch(`${apiBase}/sessions/${encodeURIComponent(derivedId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(patch),
          });
        }
      }
      if (!res.ok) return;
      const data = (await res.json()) as { ok: boolean; session?: any };
      if (!data?.session || !activeSession) return;
      const mapped = mapSessionFromApi(data.session);
      if ((activeSession.participants?.length || 0) > 0 && (mapped.participants?.length || 0) === 0) {
        mapped.participants = activeSession.participants;
      }
      setActiveSession((prev) => (prev && prev.id === mapped.id ? { ...prev, ...mapped } : prev));
      setSessionsByDate((prev) => {
        const dateKey = mapped.dateKey;
        const list = prev[dateKey] ? [...prev[dateKey]] : [];
        const nextList = list.map((item) =>
          item.id === mapped.id
            ? { ...item, ...mapped, participants: mapped.participants?.length ? mapped.participants : item.participants }
            : item
        );
        return { ...prev, [dateKey]: nextList };
      });
    } catch {
      // ignore
    }
  };

  const saveSessionTimePatch = async (sessionId: string, start: string, end: string, dateKey: string) => {
    if (!token) return;
    try {
      let res = await fetch(`${apiBase}/sessions/${encodeURIComponent(sessionId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          start,
          end,
          dateKey,
          tzOffset: new Date().getTimezoneOffset(),
        }),
      });
      if (res.status === 404) {
        const derivedId = sessionId.startsWith(`${trainerTgUserId}_`)
          ? sessionId
          : `${trainerTgUserId}_${sessionId}`;
        if (derivedId !== sessionId) {
          res = await fetch(`${apiBase}/sessions/${encodeURIComponent(derivedId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              start,
              end,
              dateKey,
              tzOffset: new Date().getTimezoneOffset(),
            }),
          });
        }
      }
      if (!res.ok) {
        if (res.status === 409) {
          setSessionTimeError(
            tr("На эту дату и время уже запланирована тренировка.", "A session is already scheduled for this date and time.")
          );
        } else if (res.status === 403) {
          setSessionTimeError(tr("Нельзя менять время начавшейся тренировки.", "You can't edit a started session."));
        } else {
          setSessionTimeError(tr("Не удалось обновить время.", "Failed to update time."));
        }
        return;
      }
      const data = (await res.json()) as { ok: boolean; session?: any };
      if (!data?.session) return;
      const mapped = mapSessionFromApi(data.session);
      setSessionTimeError("");
      setActiveSession((prev) => (prev && prev.id === mapped.id ? { ...prev, ...mapped } : prev));
      setSessionsByDate((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((key) => {
          next[key] = next[key].filter((item) => item.id !== mapped.id);
          if (next[key].length === 0) delete next[key];
        });
        const list = next[mapped.dateKey] ? [...next[mapped.dateKey]] : [];
        list.push(mapped);
        list.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
        next[mapped.dateKey] = list;
        return next;
      });
    } catch {
      setSessionTimeError(tr("Не удалось обновить время.", "Failed to update time."));
    }
  };

  const syncTrainerSessionsOnce = async () => {
    if (!token) return;
    const allSessions = Object.values(sessionsByDate)
      .flat()
      .filter((s) => s.source !== "client");
    const payload = allSessions.map((s) => ({
      id: s.id,
      clientUsername: s.clientUsername,
      clientName: sessionClientLabel(s, tr, clients) || null,
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
      });
    } catch {
      // ignore sync errors
    }
  };

  useEffect(() => {
    if (!hasTgBack) return;
    if (scheduleScreen !== "session" && scheduleScreen !== "groupClient") {
      try {
        WebApp.BackButton.hide();
      } catch {
        // ignore
      }
      return;
    }

    const handler = () => {
      if (scheduleScreen === "groupClient") {
        setScheduleScreen("session");
        return;
      }
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
  const [section, setSection] = useState<"sessions" | "free">("sessions");
  const [scheduleView, setScheduleView] = useState<"list" | "grid">("list");
  const [slotsByDate, setSlotsByDate] = useState<Record<string, TrainingSlot[]>>({});
  const [showFreeSchedule, setShowFreeSchedule] = useState(false);
  const [freeStart, setFreeStart] = useState("");
  const [freeEnd, setFreeEnd] = useState("");
  const [freeIsGroup, setFreeIsGroup] = useState(false);
  const [freeCapacity, setFreeCapacity] = useState("2");
  const [freeError, setFreeError] = useState("");
  const [isCreatingSlot, setIsCreatingSlot] = useState(false);
  const [slotError, setSlotError] = useState("");
  const slotsSigRef = useRef<Record<string, string>>({});
  const [assignForId, setAssignForId] = useState<string | null>(null);
  const [assignClientUsername, setAssignClientUsername] = useState<string>("");
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const todayRef = useRef<HTMLButtonElement | null>(null);
  const selectedRef = useRef<HTMLButtonElement | null>(null);
  const addHourToTime = useCallback((value: string) => {
    const normalized = normalizeTimeInput(value);
    if (!normalized) return "";
    const nextMinutes = (timeToMinutes(normalized) + 60) % (24 * 60);
    const hours = Math.floor(nextMinutes / 60);
    const minutes = nextMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }, []);

  useEffect(() => {
    if (bookingMode !== "both" && section !== "sessions") {
      setSection("sessions");
    }
  }, [bookingMode, section]);

  const applySlots = useCallback(
    (dateKey: string, nextSlots: TrainingSlot[]) => {
      const sig = buildSlotsSignature(nextSlots);
      if (slotsSigRef.current[dateKey] === sig) return;
      slotsSigRef.current[dateKey] = sig;
      setSlotsByDate((prev) => {
        if (nextSlots.length === 0) {
          if (!prev[dateKey]) return prev;
          const next = { ...prev };
          delete next[dateKey];
          return next;
        }
        return { ...prev, [dateKey]: nextSlots };
      });
    },
    [setSlotsByDate]
  );

  useEffect(() => {
    const tick = () => setToday(startOfDay(new Date()));
    tick();
    const id = window.setInterval(tick, 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const next = startOfMonth(selected);
    if (next.getTime() !== monthAnchor.getTime()) {
      setMonthAnchor(next);
    }
  }, [selected, monthAnchor]);

  useEffect(() => {
    const el = sessionCommentRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draftSessionComment, sessionTab, scheduleScreen]);

  const days = useMemo(() => {
    const start = startOfMonth(monthAnchor);
    const end = endOfMonthExclusive(start);
    const out: { key: string; date: Date; dateText: string; weekdayText: string }[] = [];
    for (let cursor = new Date(start); cursor < end; cursor = addDays(cursor, 1)) {
      const date = new Date(cursor);
      out.push({
        key: formatDateKey(date),
        date,
        dateText: formatDateShort(date),
        weekdayText: formatWeekdayShort(date, currentLanguage),
      });
    }
    return out;
  }, [monthAnchor, language]);
  const weekAnchor = useMemo(() => addDays(today, weekOffset * 7), [today, weekOffset]);
  const weekStart = useMemo(() => startOfWeekMonday(weekAnchor), [weekAnchor]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, idx) => addDays(weekStart, idx)), [weekStart]);
  const gridStartHour = 7;
  const gridEndHour = 23;
  const gridRowHeight = 44;
  const gridStepMinutes = 15;
  const gridStepsPerHour = 60 / gridStepMinutes;
  const gridStepHeight = gridRowHeight / gridStepsPerHour;
  const gridRows = gridEndHour - gridStartHour + 1;
  const gridStepCount = (gridEndHour - gridStartHour) * gridStepsPerHour + 1;
  const activeClients = useMemo(
    () => clients.filter((c) => !c.archived && c.status === "active"),
    [clients]
  );
  const formatMonthShort = useCallback(
    (d: Date) => {
      if (language === "en") {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return months[d.getMonth()];
      }
      const months = ["янв", "фев", "март", "апр", "май", "июнь", "июль", "авг", "сент", "окт", "ноя", "дек"];
      const raw = months[d.getMonth()];
      return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : raw;
    },
    [language]
  );
  const monthLabel = useMemo(() => formatMonthShort(monthAnchor), [formatMonthShort, monthAnchor]);
  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, idx) => ({
        value: idx,
        label: formatMonthShort(new Date(2024, idx, 1)),
      })),
    [formatMonthShort]
  );
  const moveMonth = useCallback(
    (delta: number) => {
      const next = startOfMonth(addMonths(monthAnchor, delta));
      const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      const day = Math.min(selected.getDate(), maxDay);
      setMonthAnchor(next);
      setSelected(new Date(next.getFullYear(), next.getMonth(), day));
    },
    [monthAnchor, selected]
  );
  const [gridDrag, setGridDrag] = useState<{
    session: SessionItem;
    dateKey: string;
    startMin: number;
    endMin: number;
    duration: number;
    originDateKey: string;
    originStartMin: number;
    originEndMin: number;
    left: number;
    width: number;
    offsetY: number;
  } | null>(null);
  const gridDragRef = useRef<typeof gridDrag>(null);
  const gridDragIntentRef = useRef<{
    session: SessionItem;
    dateKey: string;
    startMin: number;
    endMin: number;
    duration: number;
    startX: number;
    startY: number;
    offsetY: number;
  } | null>(null);
  const gridDragIgnoreClickRef = useRef(false);
  const scheduleWeekDaysRef = useRef<HTMLDivElement | null>(null);
  const weekDaysRef = useRef<Date[]>(weekDays);

  const minutesToTime = (totalMinutes: number) => {
    const safe = Math.max(0, totalMinutes);
    const h = Math.floor(safe / 60);
    const m = safe % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  useEffect(() => {
    gridDragRef.current = gridDrag;
  }, [gridDrag]);

  useEffect(() => {
    weekDaysRef.current = weekDays;
  }, [weekDays]);

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      const intent = gridDragIntentRef.current;
      const drag = gridDragRef.current;
      if (!intent && !drag) return;

      if (!drag && intent) {
        const dx = event.clientX - intent.startX;
        const dy = event.clientY - intent.startY;
        if (Math.abs(dx) + Math.abs(dy) < 6) return;
        gridDragIgnoreClickRef.current = true;
        const gridRect = scheduleWeekDaysRef.current?.getBoundingClientRect();
        if (!gridRect) return;
        const dayWidth = gridRect.width / 7;
        const colIndex = Math.max(0, Math.min(6, Math.floor((event.clientX - gridRect.left) / dayWidth)));
        const dateKey = formatDateKey(weekDaysRef.current[colIndex] || weekDays[0]);
        setGridDrag({
          session: intent.session,
          dateKey,
          startMin: intent.startMin,
          endMin: intent.endMin,
          duration: intent.duration,
          originDateKey: intent.dateKey,
          originStartMin: intent.startMin,
          originEndMin: intent.endMin,
          left: colIndex * dayWidth,
          width: dayWidth,
          offsetY: intent.offsetY,
        });
        gridDragIntentRef.current = null;
        return;
      }

      if (!drag) return;
      const gridRect = scheduleWeekDaysRef.current?.getBoundingClientRect();
      if (!gridRect) return;
      const dayWidth = gridRect.width / 7;
      const colIndex = Math.max(0, Math.min(6, Math.floor((event.clientX - gridRect.left) / dayWidth)));
      const dateKey = formatDateKey(weekDaysRef.current[colIndex] || weekDays[0]);
      const relativeY = event.clientY - drag.offsetY - gridRect.top;
      const safeY = Math.max(0, Math.min(relativeY - gridRowHeight, gridRowHeight * (gridRows - 1)));
      const stepIndex = Math.round(safeY / gridStepHeight);
      const minStart = gridStartHour * 60;
      const maxStart = gridEndHour * 60 - drag.duration;
      const startMin = Math.min(minStart + stepIndex * gridStepMinutes, maxStart);
      const endMin = startMin + drag.duration;
      setGridDrag((prev) =>
        prev
          ? {
              ...prev,
              dateKey,
              startMin,
              endMin,
              left: colIndex * dayWidth,
              width: dayWidth,
            }
          : prev
      );
    };

    const handleUp = () => {
      const drag = gridDragRef.current;
      gridDragIntentRef.current = null;
      if (!drag) {
        window.setTimeout(() => {
          gridDragIgnoreClickRef.current = false;
        }, 0);
        return;
      }
      setGridDrag(null);
      const { dateKey, startMin, endMin, originDateKey, originStartMin, originEndMin, session } = drag;
      window.setTimeout(() => {
        gridDragIgnoreClickRef.current = false;
      }, 0);
      if (dateKey === originDateKey && startMin === originStartMin && endMin === originEndMin) return;
      const start = minutesToTime(startMin);
      const end = minutesToTime(endMin);
      if (hasSessionOverlap(dateKey, start, end, undefined, session.id)) return;
      void saveSessionTimePatch(session.id, start, end, dateKey);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [gridEndHour, gridRowHeight, gridRows, gridStartHour, gridStepHeight, gridStepMinutes, minutesToTime, weekDays]);

  const hasSessionOverlap = (
    dateKey: string,
    start: string,
    end: string,
    mapOverride?: Record<string, SessionItem[]>,
    excludeId?: string | null
  ) => {
    const startMin = timeToMinutes(start);
    const endMin = timeToMinutes(end);
    if (!startMin && start !== "00:00") return false;
    if (!endMin && end !== "00:00") return false;
    if (endMin <= startMin) return false;
    const source = mapOverride || sessionsByDate;
    const existing = source[dateKey] || [];
    return existing.some((s) => {
      if (excludeId && s.id === excludeId) return false;
      const sStart = timeToMinutes(s.start);
      const sEnd = timeToMinutes(s.end);
      if (sEnd <= sStart) return false;
      return startMin < sEnd && endMin > sStart;
    });
  };

  const refreshSessions = async () => {
    if (!token) return null;
    try {
      const res = await fetch(`${apiBase}/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { ok: boolean; sessions?: any[] };
      if (!data?.sessions) return null;
      const mapped = data.sessions.map((s) => mapSessionFromApi(s));
      const next: Record<string, SessionItem[]> = {};
      mapped.forEach((s) => {
        const list = next[s.dateKey] ? next[s.dateKey].slice() : [];
        list.push(s);
        next[s.dateKey] = list;
      });
      setSessionsByDate(next);
      return next;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (!selectedRef.current || !scrollerRef.current) return;
    const el = selectedRef.current;
    const scroller = scrollerRef.current;
    const id = window.requestAnimationFrame(() => {
      const left = el.offsetLeft - scroller.clientWidth / 2 + el.clientWidth / 2;
      scroller.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [selected, days, scheduleScreen]);

  useEffect(() => {
    if (!showWeekSchedule) return;
    setWeekScheduleError("");
    if (weekScheduleMode === "client" && !weekScheduleClientId) {
      const first = activeClients[0];
      if (first?.id) setWeekScheduleClientId(first.id);
    }
  }, [
    showWeekSchedule,
    weekScheduleDate,
    activeClients,
    weekScheduleClientId,
    weekScheduleGroupIds,
    weekScheduleMode,
  ]);

  useEffect(() => {
    if (bookingMode !== "both" && section === "free") {
      setSection("sessions");
    }
  }, [bookingMode, section]);

  useEffect(() => {
    if (!token || !trainerTgUserId) return;
    const dateKey = formatDateKey(selected);
    let cancelled = false;
    const run = async () => {
      setSlotError((prev) => (prev ? "" : prev));
      try {
        const res = await fetch(
          `${apiBase}/slots?trainerTgUserId=${encodeURIComponent(trainerTgUserId)}&dateKey=${encodeURIComponent(
            dateKey
          )}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) {
          throw new Error(`slots: ${res.status}`);
        }
        const data = (await res.json()) as { ok: boolean; slots?: TrainingSlot[] };
        if (!cancelled) {
          applySlots(dateKey, data.slots || []);
        }
      } catch {
        if (!cancelled) {
          setSlotError(tr("Не удалось загрузить свободные окна.", "Failed to load slots."));
        }
      }
    };
    run();
    const id = window.setInterval(run, 10 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [selected, token, trainerTgUserId, apiBase, tr, applySlots]);

  async function createSlot(
    dateKey: string,
    start: string,
    end: string,
    options?: { isGroup?: boolean; capacity?: number | null }
  ) {
    if (!token) {
      setFreeError(tr("Сначала войдите в аккаунт.", "Please login first."));
      return null;
    }
    try {
      const res = await fetch(`${apiBase}/slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          dateKey,
          start,
          end,
          isGroup: options?.isGroup === true,
          capacity: options?.isGroup ? options.capacity ?? 2 : null,
        }),
      });
      if (!res.ok) {
        throw new Error(`slots create: ${res.status}`);
      }
      const data = (await res.json()) as { ok: boolean; slot?: TrainingSlot };
      const slot = data.slot;
      if (slot) {
        setSlotsByDate((prev) => {
          const list = prev[dateKey] ? [...prev[dateKey]] : [];
          list.push(slot);
          list.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
          return { ...prev, [dateKey]: list };
        });
      }
      return slot || null;
    } catch {
      setFreeError(tr("Не удалось создать окно.", "Failed to create slot."));
      return null;
    }
  }

  async function deleteSlot(slotId: string, dateKey: string) {
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/slots/${encodeURIComponent(slotId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 409) {
          setSlotError(
            tr(
              "Нельзя удалить окно, пока на него уже записались клиенты.",
              "You can't delete a slot that already has booked clients."
            )
          );
          return;
        }
        throw new Error(`slots delete: ${res.status}`);
      }
      setSlotsByDate((prev) => {
        const list = prev[dateKey] ? prev[dateKey].filter((x) => x.id !== slotId) : [];
        if (list.length === 0) {
          const next = { ...prev };
          delete next[dateKey];
          return next;
        }
        return { ...prev, [dateKey]: list };
      });
    } catch {
      setSlotError(tr("Не удалось удалить окно.", "Failed to delete slot."));
    }
  }

  if (scheduleScreen === "groupClient" && groupClientId) {
    const client = clients.find((c) => c.id === groupClientId) || null;
    return (
      <div style={styles.pageContainer}>
        <div style={styles.topBar}>
          {hasTgBack ? (
            <div style={{ width: 36 }} />
          ) : (
            <button
              onClick={() => {
                setScheduleScreen("session");
              }}
              style={styles.backBtnInline}
              aria-label="back"
            >
              <IconArrowLeft />
            </button>
          )}
          <div style={styles.topBarTitle}>
            {client ? getClientLabel(clients, client.username) : tr("Клиент", "Client")}
          </div>
          <div style={{ width: 36 }} />
        </div>
        <div style={styles.clientDetailTabsScroll}>
          <div style={styles.trainerClientTabsWrap}>
            <button
              type="button"
              onClick={() => setGroupClientTab("weights")}
              style={{
                ...styles.clientDetailTab,
                ...styles.trainerClientTabButton,
                ...(groupClientTab === "weights" ? styles.clientDetailTabActive : null),
              }}
            >
              {tr("Статистика упражнений", "Exercise stats")}
            </button>
            <button
              type="button"
              onClick={() => setGroupClientTab("history")}
              style={{
                ...styles.clientDetailTab,
                ...styles.trainerClientTabButton,
                ...(groupClientTab === "history" ? styles.clientDetailTabActive : null),
              }}
            >
              {tr("История тренировок клиента", "Client history")}
            </button>
          </div>
        </div>
        <div style={styles.clientDetailTabsDivider} />
        <div style={styles.clientPanelPlain}>
          {groupClientTab === "weights" ? (
            <ExerciseStatsPanel
              clientId={client?.id ?? null}
              exercises={client?.exercises || []}
              setExercises={(next) => {
                if (!client) return;
                setClients((prev) =>
                  prev.map((c) => (c.id === client.id ? { ...c, exercises: next } : c))
                );
              }}
              onSaveExercises={onSaveExercises}
              token={token}
              apiBase={apiBase}
              embedded
            />
          ) : (
            <div>
              {(historyByClient[client?.username ?? ""] || []).some((s) => isSessionEnded(s, new Date())) ? (
                <div style={styles.sessionHistoryList}>
                  {(historyByClient[client?.username ?? ""] || [])
                    .filter((s) => isSessionEnded(s, new Date()))
                    .slice()
                    .sort((a, b) => {
                      const aEnd = sessionEndTime(a).getTime();
                      const bEnd = sessionEndTime(b).getTime();
                      return bEnd - aEnd;
                    })
                    .map((s, idx) => {
                      return (
                        <div key={`${s.id}-${idx}`} style={styles.sessionHistoryCard}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={styles.sessionHistoryTitle}>{sessionTitle(s, tr)}</div>
                            <div style={styles.sessionHistorySubtitle}>
                              {formatDateShort(parseDateKey(s.dateKey))} • {s.start} — {s.end}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div style={styles.listEmpty}>
                  {tr("Пока нет тренировок.", "No sessions yet.")}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (scheduleScreen === "session" && activeSession) {
    const sessionClient = clients.find((c) => c.username === activeSession.clientUsername) || null;
    const canDeleteByTime = sessionStartTime(activeSession).getTime() > nowTs;
    const canEditTime = canDeleteByTime;
    const isOneTimeSession = activeSession.clientUsername === "one_time" || activeSession.type === "one_time";
    const isGroupSession = activeSession.clientUsername === "group" || activeSession.type === "group";
    const hasExtraSessionTabs = !isOneTimeSession && !isGroupSession;
    const participantClients = (activeSession.participants || [])
      .map((p) => ({
        id: p.clientId || p.clientUsername,
        client: clients.find((c) => c.id === p.clientId || c.username === p.clientUsername) || null,
        name: p.clientName || "",
        username: p.clientUsername || "",
      }))
      .filter((p) => p.id) as {
      id: string;
      client: TrainerClientInvite | null;
      name: string;
      username: string;
    }[];
    const availableGroupClients = clients.filter(
      (c) => !c.archived && c.status === "active" && !participantClients.some((p) => p.client?.id === c.id)
    );
    const linkedGroupSlot = isGroupSession
      ? Object.values(slotsByDate)
          .flat()
          .find((slot) => slot.sessionId === activeSession.id)
      : null;
    const groupHasFreePlaces = isGroupSession
      ? linkedGroupSlot
        ? Number(linkedGroupSlot.bookedCount || 0) < (linkedGroupSlot.capacity ?? 2)
        : false
      : false;
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
        <div style={styles.sessionTabsScroll}>
          <div
            style={{
              ...styles.sessionTabsWrap,
              ...(!hasExtraSessionTabs ? styles.sessionSingleTabWrap : null),
            }}
          >
            <div
              style={{
                ...styles.sessionTabs,
                ...(!hasExtraSessionTabs ? styles.sessionSingleTabList : null),
              }}
            >
            <button
              type="button"
              onClick={() => setSessionTab("info")}
              style={{
                ...styles.sessionTabPill,
                ...(!hasExtraSessionTabs ? styles.sessionSingleTabPill : null),
                ...(sessionTab === "info" ? styles.sessionTabPillActive : null),
              }}
            >
              {tr("Информация о тренировке", "Session info")}
            </button>
            {hasExtraSessionTabs ? (
              <>
                <button
                  type="button"
                  onClick={() => setSessionTab("weights")}
                  style={{
                    ...styles.sessionTabPill,
                    ...(sessionTab === "weights" ? styles.sessionTabPillActive : null),
                  }}
                >
                  {tr("Статистика упражнений", "Exercise stats")}
                </button>
                <button
                  type="button"
                  onClick={() => setSessionTab("history")}
                  style={{
                    ...styles.sessionTabPill,
                    ...(sessionTab === "history" ? styles.sessionTabPillActive : null),
                  }}
                >
                  {tr("История тренировок", "Training history")}
                </button>
              </>
            ) : null}
            </div>
          </div>
        </div>
        <div style={styles.sessionTabsDivider} />
        <div style={styles.clientPanelPlain}>
          {sessionTab === "info" ? (
            <div style={styles.sessionInfoStack}>
              <div style={styles.sessionInfoRow}>
                <div style={styles.sessionCard}>
                  <div style={styles.sessionCardLabel}>
                    {isGroupSession ? tr("Клиенты", "Clients") : tr("Клиент", "Client")}
                  </div>
                  {isOneTimeSession ? (
                    <input
                      value={draftSessionClientName}
                      onChange={(e) => setDraftSessionClientName(e.target.value)}
                      onBlur={() => {
                        if (!activeSession) return;
                        const value = draftSessionClientName.trim();
                        setActiveSession((prev) => (prev ? { ...prev, clientName: value } : prev));
                        setSessionsByDate((prev) => {
                          const dateKey = activeSession.dateKey;
                          const list = prev[dateKey] ? [...prev[dateKey]] : [];
                          const nextList = list.map((item) =>
                            item.id === activeSession.id ? { ...item, clientName: value } : item
                          );
                          return { ...prev, [dateKey]: nextList };
                        });
                        saveSessionPatch(activeSession.id, { clientName: value });
                      }}
                      placeholder={tr("Введите имя клиента", "Enter client name")}
                      style={styles.sessionCardInput}
                    />
                  ) : isGroupSession ? (
                    <div style={styles.groupClientChips}>
                      {(participantClients.length ? participantClients : []).map((p) => {
                        const label = p.client
                          ? getClientLabel(clients, p.client.username)
                          : p.name?.trim()
                            ? p.name
                            : p.username
                              ? `@${p.username.replace(/^@/, "")}`
                              : tr("Клиент", "Client");
                        return (
                          <div key={p.id} style={styles.groupClientChipWrap}>
                            <button
                              type="button"
                              style={styles.groupClientChip}
                              onPointerDown={() => {
                                if (groupPressTimerRef.current) window.clearTimeout(groupPressTimerRef.current);
                                groupPressTimerRef.current = window.setTimeout(() => {
                                  groupEditJustOpenedRef.current = true;
                                  setGroupEditMode(true);
                                }, 450);
                              }}
                              onPointerUp={() => {
                                if (groupPressTimerRef.current) window.clearTimeout(groupPressTimerRef.current);
                              }}
                              onPointerLeave={() => {
                                if (groupPressTimerRef.current) window.clearTimeout(groupPressTimerRef.current);
                              }}
                              onClick={() => {
                                if (groupEditMode) {
                                  if (groupEditJustOpenedRef.current) {
                                    groupEditJustOpenedRef.current = false;
                                    return;
                                  }
                                  setGroupEditMode(false);
                                  return;
                                }
                                if (!p.client) return;
                                setGroupClientId(p.client.id);
                                setGroupClientTab("weights");
                                onLoadHistory?.(p.client);
                                setScheduleScreen("groupClient");
                              }}
                            >
                              {label}
                            </button>
                            {groupEditMode && canDeleteByTime ? (
                              <button
                                type="button"
                                style={styles.groupClientChipRemove}
                                aria-label="remove client"
                                data-group-remove="true"
                                onClick={async (event) => {
                                  event.stopPropagation();
                                  if (!p.client || !token) return;
                                  try {
                                    const res = await fetch(
                                      `${apiBase}/sessions/${encodeURIComponent(activeSession.id)}/group/remove`,
                                      {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                        body: JSON.stringify({ clientId: p.client.id }),
                                      }
                                    );
                                    if (!res.ok) return;
                                    const data = (await res.json()) as { ok: boolean; session?: any };
                                    if (data?.session) {
                                      const mapped = mapSessionFromApi(data.session);
                                      setActiveSession(mapped);
                                      setSessionsByDate((prev) => {
                                        const list = prev[mapped.dateKey] ? [...prev[mapped.dateKey]] : [];
                                        const nextList = list.map((item) =>
                                          item.id === mapped.id ? { ...item, ...mapped } : item
                                        );
                                        return { ...prev, [mapped.dateKey]: nextList };
                                      });
                                      setGroupEditMode(false);
                                    }
                                  } catch {
                                    // ignore
                                  }
                                }}
                              >
                                ×
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                      {canDeleteByTime && groupHasFreePlaces ? (
                        <button
                          type="button"
                          style={styles.groupClientChipAdd}
                          onClick={() => {
                            setGroupAddOpen((v) => !v);
                            if (!groupAddClientId && availableGroupClients[0]?.id) {
                              setGroupAddClientId(availableGroupClients[0].id);
                            }
                          }}
                        >
                          +
                        </button>
                      ) : null}
                      {participantClients.length === 0 ? (
                        <div style={styles.sessionCardValueMuted}>{tr("Нет клиентов", "No clients")}</div>
                      ) : null}
                    </div>
                  ) : (
                    <div style={styles.sessionCardValue}>
                      {sessionClientLabel(activeSession, tr, clients) || "—"}
                    </div>
                  )}
                </div>
                <div style={styles.sessionCard}>
                  <div style={styles.sessionCardLabel}>{tr("Дата", "Date")}</div>
                  {canEditTime ? (
                    <input
                      type="date"
                      value={draftSessionDate}
                      onChange={(e) => {
                        setDraftSessionDate(e.target.value);
                        if (sessionTimeError) setSessionTimeError("");
                      }}
                      onBlur={() => {
                        if (!activeSession) return;
                        if (!draftSessionDate) return;
                        const start = normalizeTimeInput(draftSessionStart);
                        const end = normalizeTimeInput(draftSessionEnd);
                        if (!start || !end) return;
                        const nextKey = normalizeDateKeyInput(draftSessionDate);
                        if (!nextKey) return;
                        if (nextKey === activeSession.dateKey && start === activeSession.start && end === activeSession.end) {
                          return;
                        }
                        if (end <= start) {
                          setSessionTimeError(
                            tr("Время окончания должно быть больше времени начала.", "End time must be after start time.")
                          );
                          return;
                        }
                        if (hasSessionOverlap(nextKey, start, end, undefined, activeSession.id)) {
                          setSessionTimeError(
                            tr("На эту дату и время уже запланирована тренировка.", "A session is already scheduled for this date and time.")
                          );
                          return;
                        }
                        void saveSessionTimePatch(activeSession.id, start, end, nextKey);
                      }}
                      style={styles.sessionCardInput}
                    />
                  ) : (
                    <div style={styles.sessionCardValue}>
                      {formatDateShort(parseDateKey(draftSessionDate || activeSession.dateKey))}
                    </div>
                  )}
                </div>
              </div>
              {isGroupSession && groupAddOpen && canDeleteByTime && groupHasFreePlaces ? (
                <div style={styles.sessionCard}>
                  <div style={styles.sessionCardLabel}>{tr("Добавить клиента", "Add client")}</div>
                  <div style={styles.sessionCardRow}>
                    <select
                      value={groupAddClientId}
                      onChange={(e) => setGroupAddClientId(e.target.value)}
                      style={{ ...styles.sessionCardInput, flex: 1, paddingRight: 12 }}
                    >
                      {availableGroupClients.length === 0 ? (
                        <option value="">{tr("Нет клиентов", "No clients")}</option>
                      ) : (
                        availableGroupClients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {getClientLabel(clients, c.username)}
                          </option>
                        ))
                      )}
                    </select>
                    <button
                      type="button"
                      style={styles.sessionCheckBtn}
                      onClick={async () => {
                        if (!groupAddClientId || !token) return;
                        try {
                          const res = await fetch(
                            `${apiBase}/sessions/${encodeURIComponent(activeSession.id)}/group/add`,
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                              body: JSON.stringify({ clientId: groupAddClientId }),
                            }
                          );
                          if (!res.ok) return;
                          const data = (await res.json()) as { ok: boolean; session?: any };
                          if (data?.session) {
                            const mapped = mapSessionFromApi(data.session);
                            setActiveSession(mapped);
                            setSessionsByDate((prev) => {
                              const list = prev[mapped.dateKey] ? [...prev[mapped.dateKey]] : [];
                              const nextList = list.map((item) =>
                                item.id === mapped.id ? { ...item, ...mapped } : item
                              );
                              return { ...prev, [mapped.dateKey]: nextList };
                            });
                          }
                        } catch {
                          // ignore
                        }
                      }}
                      aria-label="add client"
                    >
                      ✓
                    </button>
                  </div>
                </div>
              ) : null}
              <div style={styles.sessionCard}>
                <div style={styles.sessionCardLabel}>{tr("Время", "Time")}</div>
                <div style={styles.sessionTimeGrid}>
                  <div>
                    <div style={styles.sessionMiniLabel}>{tr("Начало", "Start")}</div>
                    {canEditTime ? (
                      <input
                        type="time"
                        value={draftSessionStart}
                        step={300}
                        onChange={(e) => {
                          const nextStart = e.target.value;
                          setDraftSessionStart(nextStart);
                          const normalized = normalizeTimeInput(nextStart);
                          if (normalized) {
                            const nextMinutes = (timeToMinutes(normalized) + 60) % (24 * 60);
                            const hours = Math.floor(nextMinutes / 60);
                            const minutes = nextMinutes % 60;
                            setDraftSessionEnd(`${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`);
                          }
                          if (sessionTimeError) setSessionTimeError("");
                        }}
                        onBlur={() => {
                          if (!activeSession) return;
                          const start = normalizeTimeInput(draftSessionStart);
                          const end = normalizeTimeInput(draftSessionEnd);
                          if (!start || !end) return;
                          if (start === activeSession.start && end === activeSession.end) return;
                          if (end <= start) {
                            setSessionTimeError(
                              tr("Время окончания должно быть больше времени начала.", "End time must be after start time.")
                            );
                            return;
                          }
                          const nextKey = normalizeDateKeyInput(draftSessionDate) || activeSession.dateKey;
                          if (hasSessionOverlap(nextKey, start, end, undefined, activeSession.id)) {
                            setSessionTimeError(
                              tr("На эту дату и время уже запланирована тренировка.", "A session is already scheduled for this date and time.")
                            );
                            return;
                          }
                          void saveSessionTimePatch(activeSession.id, start, end, nextKey);
                        }}
                        style={styles.sessionCardInput}
                      />
                    ) : (
                      <div style={styles.sessionCardValue}>{activeSession.start}</div>
                    )}
                  </div>
                  <div>
                    <div style={styles.sessionMiniLabel}>{tr("Конец", "End")}</div>
                    {canEditTime ? (
                      <input
                        type="time"
                        value={draftSessionEnd}
                        step={300}
                        onChange={(e) => {
                          setDraftSessionEnd(e.target.value);
                          if (sessionTimeError) setSessionTimeError("");
                        }}
                        onBlur={() => {
                          if (!activeSession) return;
                          const start = normalizeTimeInput(draftSessionStart);
                          const end = normalizeTimeInput(draftSessionEnd);
                          if (!start || !end) return;
                          if (start === activeSession.start && end === activeSession.end) return;
                          if (end <= start) {
                            setSessionTimeError(
                              tr("Время окончания должно быть больше времени начала.", "End time must be after start time.")
                            );
                            return;
                          }
                          const nextKey = normalizeDateKeyInput(draftSessionDate) || activeSession.dateKey;
                          if (hasSessionOverlap(nextKey, start, end, undefined, activeSession.id)) {
                            setSessionTimeError(
                              tr("На эту дату и время уже запланирована тренировка.", "A session is already scheduled for this date and time.")
                            );
                            return;
                          }
                          void saveSessionTimePatch(activeSession.id, start, end, nextKey);
                        }}
                        style={styles.sessionCardInput}
                      />
                    ) : (
                      <div style={styles.sessionCardValue}>{activeSession.end}</div>
                    )}
                  </div>
                </div>
              </div>
              {canEditTime && sessionTimeError ? <div style={styles.errorText}>{sessionTimeError}</div> : null}
              <div style={styles.sessionCard}>
                <div style={styles.sessionCardLabel}>{tr("Тип тренировки", "Session type")}</div>
                {isOneTimeSession ? (
                  <div style={styles.sessionCardValue}>{tr("Разовая тренировка", "One-time session")}</div>
                ) : isGroupSession ? (
                  <div style={styles.sessionCardValue}>{tr("Групповая тренировка", "Group session")}</div>
                ) : (
                  <input
                    value={draftSessionType}
                    onChange={(e) => {
                      setDraftSessionType(e.target.value);
                    }}
                    onBlur={() => {
                      if (!activeSession) return;
                      const value = draftSessionType.trim();
                      setActiveSession((prev) => (prev ? { ...prev, type: value } : prev));
                      setSessionsByDate((prev) => {
                        const dateKey = activeSession.dateKey;
                        const list = prev[dateKey] ? [...prev[dateKey]] : [];
                        const nextList = list.map((item) =>
                          item.id === activeSession.id ? { ...item, type: value } : item
                        );
                        return { ...prev, [dateKey]: nextList };
                      });
                      saveSessionPatch(activeSession.id, { type: value });
                    }}
                    placeholder={tr("Введите тип тренировки", "Enter session type")}
                    style={styles.sessionCardInput}
                  />
                )}
              </div>
              <div style={styles.sessionCard}>
                <div style={styles.sessionCardLabelRow}>
                  <div style={styles.sessionCardLabelWithInfo}>
                    <div style={styles.sessionCardLabel}>
                    {isGroupSession
                      ? tr("Общая стоимость тренировки", "Total session price")
                      : tr("Стоимость тренировки", "Session price")}
                    </div>
                    {isGroupSession ? (
                      <button
                        type="button"
                        style={styles.sessionInfoBadge}
                        onClick={() => setGroupPriceInfoOpen(true)}
                        aria-label={tr("Информация", "Info")}
                      >
                        i
                      </button>
                    ) : null}
                  </div>
                </div>
                <div style={styles.sessionCardRow}>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={draftSessionPrice}
                    onChange={(e) => {
                      const value = normalizePriceRUBWithDelete(e.target.value, draftSessionPrice);
                      setDraftSessionPrice(value);
                    }}
                    onBlur={() => {
                      if (!activeSession) return;
                      const value = draftSessionPrice.trim();
                      setActiveSession((prev) => (prev ? { ...prev, price: value } : prev));
                      setSessionsByDate((prev) => {
                        const dateKey = activeSession.dateKey;
                        const list = prev[dateKey] ? [...prev[dateKey]] : [];
                        const nextList = list.map((item) =>
                          item.id === activeSession.id ? { ...item, price: value } : item
                        );
                        return { ...prev, [dateKey]: nextList };
                      });
                      saveSessionPatch(activeSession.id, { price: value });
                    }}
                    placeholder={tr("Введите стоимость", "Enter price")}
                    style={{ ...styles.sessionCardInput, flex: 1 }}
                  />
                  <button
                    type="button"
                    style={styles.sessionCheckBtn}
                    onClick={() => {
                      (document.activeElement as HTMLElement | null)?.blur?.();
                    }}
                    aria-label="save"
                  >
                    ✓
                  </button>
                </div>
              </div>
              <div style={styles.sessionCard}>
                <div style={styles.sessionCardLabel}>{tr("Комментарий к тренировке", "Session notes")}</div>
                <textarea
                  ref={sessionCommentRef}
                  value={draftSessionComment}
                  onChange={(e) => {
                    setDraftSessionComment(e.target.value);
                  }}
                  onBlur={() => {
                    if (!activeSession) return;
                    const value = draftSessionComment.trim();
                    setActiveSession((prev) => (prev ? { ...prev, comment: value } : prev));
                    setSessionsByDate((prev) => {
                      const dateKey = activeSession.dateKey;
                      const list = prev[dateKey] ? [...prev[dateKey]] : [];
                      const nextList = list.map((item) =>
                        item.id === activeSession.id ? { ...item, comment: value } : item
                      );
                      return { ...prev, [dateKey]: nextList };
                    });
                    saveSessionPatch(activeSession.id, { comment: value });
                  }}
                  placeholder={tr("Введите комментарий", "Enter notes")}
                  rows={3}
                  style={styles.sessionCardTextarea}
                />
              </div>
              <button
                type="button"
                style={styles.sessionPrimaryBtn}
                onClick={() => {
                  setRepeatOpen(true);
                  setRepeatError("");
                }}
              >
                {tr("Повторить тренировку", "Repeat session")}
              </button>
              {canDeleteByTime ? (
                <button
                  type="button"
                  onClick={() => {
                    const doDelete = async () => {
                      if (token) {
                        try {
                          const derivedId = activeSession.id.startsWith(`${trainerTgUserId}_`)
                            ? activeSession.id
                            : `${trainerTgUserId}_${activeSession.id}`;
                        let res = await fetch(`${apiBase}/sessions/${encodeURIComponent(derivedId)}`, {
                          method: "DELETE",
                          headers: { Authorization: `Bearer ${token}` },
                        });
                        if (res.status === 404) {
                          await syncTrainerSessionsOnce();
                          res = await fetch(`${apiBase}/sessions/${encodeURIComponent(derivedId)}`, {
                            method: "DELETE",
                            headers: { Authorization: `Bearer ${token}` },
                          });
                        }
                        if (!res.ok && derivedId !== activeSession.id) {
                          res = await fetch(`${apiBase}/sessions/${encodeURIComponent(activeSession.id)}`, {
                            method: "DELETE",
                            headers: { Authorization: `Bearer ${token}` },
                          });
                        }
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
                          return;
                        }
                      } catch {
                        try {
                          WebApp?.showPopup?.({
                            title: tr("Не удалось удалить", "Delete failed"),
                            message: tr("Проверьте соединение и попробуйте снова.", "Check your connection and try again."),
                            buttons: [{ type: "ok" }],
                          });
                        } catch {
                          // ignore
                        }
                        return;
                      }
                    }
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
                    void createSlot(dateKey, activeSession.start, activeSession.end);
                    setScheduleScreen("list");
                    setActiveSession(null);
                  };
                  void doDelete();
                  }}
                  style={styles.sessionDangerBtn}
                >
                  {tr("Удалить тренировку", "Delete session")}
                </button>
              ) : null}
            </div>
          ) : sessionTab === "weights" && !isOneTimeSession && !isGroupSession ? (
            <ExerciseStatsPanel
              clientId={sessionClient?.id ?? null}
              exercises={sessionClient?.exercises || []}
              setExercises={(next) => {
                if (!sessionClient) return;
                setClients((prev) =>
                  prev.map((c) => (c.id === sessionClient.id ? { ...c, exercises: next } : c))
                );
              }}
              onSaveExercises={onSaveExercises}
              token={token}
              apiBase={apiBase}
              embedded
            />
          ) : sessionTab === "history" && !isOneTimeSession && !isGroupSession ? (
            <div>
              {(historyByClient[activeSession.clientUsername] || []).some((s) => isSessionEnded(s, new Date())) ? (
                <div style={styles.sessionHistoryList}>
                  {(historyByClient[activeSession.clientUsername] || [])
                    .filter((s) => isSessionEnded(s, new Date()))
                    .slice()
                    .sort((a, b) => {
                      const aEnd = sessionEndTime(a).getTime();
                      const bEnd = sessionEndTime(b).getTime();
                      return bEnd - aEnd;
                    })
                    .map((s) => {
                      return (
                        <div key={s.id} style={styles.sessionHistoryCard}>
                          <div style={styles.sessionHistoryTitle}>{sessionTitle(s, tr)}</div>
                          <div style={styles.sessionHistorySubtitle}>
                            {formatDateShort(parseDateKey(s.dateKey))} • {s.start} — {s.end}
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
        {groupPriceInfoOpen && isGroupSession ? (
          <div style={styles.statsInfoOverlay} onClick={() => setGroupPriceInfoOpen(false)}>
            <div style={styles.statsInfoSheet} onClick={(event) => event.stopPropagation()}>
              <button type="button" style={styles.statsInfoClose} onClick={() => setGroupPriceInfoOpen(false)}>
                ×
              </button>
              <div style={styles.statsInfoTitle}>{tr("Общая стоимость тренировки", "Total session price")}</div>
              <div style={styles.statsInfoText}>
                {tr(
                  "Введите общую сумму за групповую тренировку. Она будет автоматически распределена между всеми участниками поровну.",
                  "Enter the total price for a group session. It will be split equally among all participants."
                )}
              </div>
              <div style={styles.statsInfoText}>
                {tr(
                  "Например: 4 клиента и 2000 ₽ — значит по 500 ₽ на клиента.",
                  "Example: 4 clients and 2000 ₽ — 500 ₽ per client."
                )}
              </div>
            </div>
          </div>
        ) : null}
        {repeatOpen ? (
          <div style={styles.statsInfoOverlay} onClick={() => setRepeatOpen(false)}>
            <div style={styles.statsInfoSheet} onClick={(event) => event.stopPropagation()}>
              <div style={styles.statsInfoHandle} />
              <button type="button" style={styles.statsInfoClose} onClick={() => setRepeatOpen(false)}>
                ×
              </button>
              <div style={styles.statsInfoTitle}>{tr("Повторить тренировку", "Repeat session")}</div>
              <div style={{ marginTop: 12 }}>
                <div style={styles.clientDetailFieldLabel}>{tr("Дата", "Date")}</div>
                <input
                  type="date"
                  value={repeatDate}
                  onChange={(e) => {
                    setRepeatDate(e.target.value);
                    if (repeatError) setRepeatError("");
                  }}
                  style={styles.clientDetailInput}
                />
              </div>
              {repeatError ? <div style={{ ...styles.errorText, marginTop: 8 }}>{repeatError}</div> : null}
              <button
                type="button"
                style={{ ...styles.statsInfoAction, marginTop: 14 }}
                disabled={repeatSaving}
                onClick={async () => {
                  if (!activeSession || repeatSaving) return;
                  const dateKey = normalizeDateKeyInput(repeatDate);
                  if (!dateKey) {
                    setRepeatError(tr("Выберите дату.", "Select a date."));
                    return;
                  }
                  const start = normalizeTimeInput(activeSession.start);
                  const end = normalizeTimeInput(activeSession.end);
                  if (!start || !end || end <= start) {
                    setRepeatError(tr("Неверное время тренировки.", "Invalid session time."));
                    return;
                  }
                  const now = new Date();
                  const selectedDay = startOfDay(parseDateKey(dateKey));
                  const todayDay = startOfDay(now);
                  if (selectedDay.getTime() < todayDay.getTime()) {
                    setRepeatError(tr("Нельзя выбрать прошедшую дату.", "Can't select a past date."));
                    return;
                  }
                  if (selectedDay.getTime() === todayDay.getTime()) {
                    const startMin = timeToMinutes(start);
                    const nowMin = now.getHours() * 60 + now.getMinutes();
                    if (startMin <= nowMin) {
                      setRepeatError(tr("Время начала уже прошло.", "Start time has already passed."));
                      return;
                    }
                  }
                  if (hasSessionOverlap(dateKey, start, end)) {
                    const refreshed = await refreshSessions();
                    if (!refreshed || hasSessionOverlap(dateKey, start, end, refreshed)) {
                      setRepeatError(
                        tr("На эту дату и время уже запланирована тренировка.", "A session is already scheduled for this date and time.")
                      );
                      return;
                    }
                  }
                  let payload: any = {};
                  const isOneTime = activeSession.clientUsername === "one_time" || activeSession.type === "one_time";
                  const isGroup = activeSession.clientUsername === "group" || activeSession.type === "group";
                  if (isGroup) {
                    const ids = (activeSession.participants || [])
                      .map((p) => p.clientId)
                      .filter((id) => id);
                    const unique = Array.from(new Set(ids));
                    if (unique.length < 2) {
                      setRepeatError(tr("Недостаточно клиентов для группы.", "Not enough clients for group."));
                      return;
                    }
                    payload = { groupClientIds: unique };
                  } else if (isOneTime) {
                    const name = activeSession.clientName?.trim();
                    if (!name) {
                      setRepeatError(tr("Имя клиента не найдено.", "Client name missing."));
                      return;
                    }
                    payload = { oneTime: true, clientName: name };
                  } else {
                    const client = clients.find((c) => c.username === activeSession.clientUsername);
                    if (!client?.id) {
                      setRepeatError(tr("Клиент не найден.", "Client not found."));
                      return;
                    }
                    payload = { clientId: client.id };
                  }
                  if (!token) {
                    setRepeatError(tr("Сначала войдите в аккаунт.", "Please login first."));
                    return;
                  }
                  setRepeatSaving(true);
                  try {
                    const res = await fetch(`${apiBase}/sessions`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                      body: JSON.stringify({
                        dateKey,
                        start,
                        end,
                        tzOffset: new Date().getTimezoneOffset(),
                        ...payload,
                      }),
                    });
                    if (!res.ok) {
                      if (res.status === 409) {
                        setRepeatError(
                          tr("На эту дату и время уже запланирована тренировка.", "A session is already scheduled for this date and time.")
                        );
                      } else if (res.status === 404) {
                        setRepeatError(tr("Клиент не найден.", "Client not found."));
                      } else if (res.status === 403) {
                        setRepeatError(tr("Нельзя создать тренировку.", "Can't create session."));
                      } else {
                        setRepeatError(tr("Не удалось создать тренировку.", "Failed to create session."));
                      }
                      setRepeatSaving(false);
                      return;
                    }
                    const data = (await res.json()) as { ok: boolean; session?: any };
                    if (!data?.session) throw new Error("session missing");
                    const mapped = mapSessionFromApi(data.session);
                    setSessionsByDate((prev) => {
                      const list = prev[mapped.dateKey] ? [...prev[mapped.dateKey]] : [];
                      list.push(mapped);
                      return { ...prev, [mapped.dateKey]: list };
                    });
                    setRepeatSaving(false);
                    setRepeatOpen(false);
                  } catch {
                    setRepeatSaving(false);
                    setRepeatError(tr("Не удалось создать тренировку.", "Failed to create session."));
                  }
                }}
              >
                {tr("Создать", "Create")}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ ...styles.pageContainer, ...styles.schedulePage }}>
      <div style={styles.scheduleHeaderRow}>
        <div style={styles.scheduleTitleRow}>
          {scheduleView === "grid" ? (
            <div style={styles.scheduleMonthPill}>
              <div style={styles.scheduleMonthLabel}>{formatMonthShort(weekAnchor)}</div>
              <div style={styles.scheduleMonthNav}>
                <button
                  type="button"
                  style={styles.scheduleMonthBtn}
                  onClick={() => setWeekOffset((v) => v - 1)}
                  aria-label={tr("Предыдущая неделя", "Previous week")}
                >
                  ‹
                </button>
                <button
                  type="button"
                  style={styles.scheduleMonthBtn}
                  onClick={() => setWeekOffset((v) => v + 1)}
                  aria-label={tr("Следующая неделя", "Next week")}
                >
                  ›
                </button>
              </div>
            </div>
          ) : (
            <div style={styles.scheduleMonthPill}>
              <div style={styles.scheduleMonthLabel}>{monthLabel}</div>
              <div style={styles.scheduleMonthNav}>
                <button
                  type="button"
                  style={styles.scheduleMonthBtn}
                  onClick={() => moveMonth(-1)}
                  aria-label={tr("Предыдущий месяц", "Previous month")}
                >
                  ‹
                </button>
                <button
                  type="button"
                  style={styles.scheduleMonthBtn}
                  onClick={() => moveMonth(1)}
                  aria-label={tr("Следующий месяц", "Next month")}
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </div>
        {section === "sessions" ? (
          <div style={styles.scheduleViewSwitch}>
            <button
              type="button"
              onClick={() => setScheduleView("list")}
              style={{
                ...styles.scheduleViewSwitchBtn,
                ...(scheduleView === "list" ? styles.scheduleViewSwitchBtnActive : null),
              }}
            >
              {tr("Список", "List")}
            </button>
            <button
              type="button"
              onClick={() => setScheduleView("grid")}
              style={{
                ...styles.scheduleViewSwitchBtn,
                ...(scheduleView === "grid" ? styles.scheduleViewSwitchBtnActive : null),
              }}
            >
              {tr("Таблица", "Table")}
            </button>
          </div>
        ) : null}
      </div>

      {scheduleView === "list" ? (
        <>
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
                  <div style={styles.calendarDayWeek}>{d.weekdayText}</div>
                </button>
              );
            })}
          </div>

          {bookingMode === "both" ? (
            <div style={styles.scheduleDualTabs}>
              <button
                type="button"
                onClick={() => setSection("sessions")}
                style={{
                  ...styles.scheduleDualTab,
                  ...(section === "sessions" ? styles.scheduleDualTabActive : null),
                }}
              >
                {tr("Занятия сегодня", "Today's sessions")}
              </button>
              <button
                type="button"
                onClick={() => setSection("free")}
                style={{
                  ...styles.scheduleDualTab,
                  ...(section === "free" ? styles.scheduleDualTabActive : null),
                }}
              >
                {tr("Свободные окна", "Available slots")}
              </button>
            </div>
          ) : null}
          {showWeekSchedule && scheduleView === "list" ? (
            <div
              style={styles.clientScheduleOverlay}
              onClick={() => setShowWeekSchedule(false)}
            >
              <button
                type="button"
                aria-label="close schedule"
                style={styles.clientScheduleBackdrop}
                onClick={() => setShowWeekSchedule(false)}
              />
              <div
                style={{
                  ...styles.clientScheduleSheet,
                  ...styles.scheduleQuickSheet,
                  transform: weekScheduleDragY ? `translateY(${weekScheduleDragY}px)` : undefined,
                  transition: weekScheduleDragging ? "none" : "transform 180ms ease",
                }}
                onClick={(event) => event.stopPropagation()}
              >
                <div
                  style={styles.scheduleQuickHandle}
                  onPointerDown={(event) => {
                    weekScheduleDragStartRef.current = event.clientY;
                    weekScheduleDragYRef.current = 0;
                    setWeekScheduleDragging(true);
                  }}
                />
                <div style={{ height: 2 }} />

                <div style={styles.scheduleQuickSegment}>
                  <button
                    type="button"
                    onClick={() => setWeekScheduleMode("client")}
                    style={{
                      ...styles.scheduleQuickSegmentBtn,
                      ...(weekScheduleMode === "client" ? styles.scheduleQuickSegmentBtnActive : null),
                    }}
                  >
                    {tr("Тренировка клиента", "Client session")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeekScheduleMode("one_time")}
                    style={{
                      ...styles.scheduleQuickSegmentBtn,
                      ...(weekScheduleMode === "one_time" ? styles.scheduleQuickSegmentBtnActive : null),
                    }}
                  >
                    {tr("Разовая тренировка", "One-time session")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWeekScheduleMode("group");
                      setWeekScheduleGroupIds([]);
                    }}
                    style={{
                      ...styles.scheduleQuickSegmentBtn,
                      ...(weekScheduleMode === "group" ? styles.scheduleQuickSegmentBtnActive : null),
                    }}
                  >
                    {tr("Групповая тренировка", "Group session")}
                  </button>
                </div>

                <div style={styles.scheduleQuickFieldsGrid}>
                  <div style={styles.scheduleQuickField}>
                    <div style={styles.scheduleQuickLabel}>{tr("Месяц", "Month")}</div>
                    <select
                      value={weekScheduleDate.getMonth()}
                      onChange={(e) => {
                        const nextMonth = Number(e.target.value);
                        const year = weekScheduleDate.getFullYear();
                        const day = Math.min(
                          weekScheduleDate.getDate(),
                          new Date(year, nextMonth + 1, 0).getDate()
                        );
                        setWeekScheduleDate(new Date(year, nextMonth, day));
                        if (weekScheduleError) setWeekScheduleError("");
                      }}
                      style={styles.scheduleQuickInput}
                    >
                      {monthOptions.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={styles.scheduleQuickField}>
                    <div style={styles.scheduleQuickLabel}>{tr("Дата", "Date")}</div>
                    <input
                      type="date"
                      value={formatDateInputValue(formatDateKey(weekScheduleDate))}
                      onChange={(e) => {
                        const next = parseDateKey(e.target.value);
                        if (next) {
                          setWeekScheduleDate(next);
                          if (weekScheduleMode === "client" && weekScheduleMulti) {
                            const key = formatDateKey(next);
                            setWeekScheduleDates((prev) => (prev.includes(key) ? prev : [...prev, key]));
                          }
                          if (weekScheduleError) setWeekScheduleError("");
                        }
                      }}
                      style={styles.scheduleQuickInput}
                    />
                  </div>
                  <div style={styles.scheduleQuickField}>
                    <div style={styles.scheduleQuickLabel}>{tr("Начало", "Start")}</div>
                    <input
                      type="time"
                      value={weekScheduleStart}
                      onChange={(e) => {
                        const nextStart = e.target.value;
                        setWeekScheduleStart(nextStart);
                        const nextEnd = addHourToTime(nextStart);
                        if (nextEnd) setWeekScheduleEnd(nextEnd);
                        if (weekScheduleError) setWeekScheduleError("");
                      }}
                      step={300}
                      style={styles.scheduleQuickInput}
                    />
                  </div>
                  <div style={styles.scheduleQuickField}>
                    <div style={styles.scheduleQuickLabel}>{tr("Конец", "End")}</div>
                    <input
                      type="time"
                      value={weekScheduleEnd}
                      onChange={(e) => {
                        setWeekScheduleEnd(e.target.value);
                        if (weekScheduleError) setWeekScheduleError("");
                      }}
                      step={300}
                      style={styles.scheduleQuickInput}
                    />
                  </div>
                  {weekScheduleMode === "client" ? (
                    <div style={{ ...styles.scheduleQuickSegment, ...styles.scheduleQuickFieldFull }}>
                      <button
                        type="button"
                        onClick={() => {
                          setWeekScheduleMulti(false);
                          if (weekScheduleError) setWeekScheduleError("");
                        }}
                        style={{
                          ...styles.scheduleQuickSegmentBtn,
                          ...(weekScheduleMulti ? null : styles.scheduleQuickSegmentBtnActive),
                        }}
                      >
                        {tr("Одна дата", "Single date")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setWeekScheduleMulti(true);
                          if (weekScheduleDates.length === 0) {
                            setWeekScheduleDates([formatDateKey(weekScheduleDate)]);
                          }
                          if (weekScheduleError) setWeekScheduleError("");
                        }}
                        style={{
                          ...styles.scheduleQuickSegmentBtn,
                          ...(weekScheduleMulti ? styles.scheduleQuickSegmentBtnActive : null),
                        }}
                      >
                        {tr("Несколько", "Multiple")}
                      </button>
                    </div>
                  ) : null}
                  {weekScheduleMode === "client" && weekScheduleMulti ? (
                    <div style={{ ...styles.scheduleQuickDateList, ...styles.scheduleQuickFieldFull }}>
                      {weekScheduleDates.map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setWeekScheduleDates((prev) => prev.filter((k) => k !== key))}
                          style={styles.scheduleQuickDatePill}
                          aria-label={tr("Удалить дату", "Remove date")}
                        >
                          {formatDateShort(parseDateKey(key))}
                          <span style={styles.scheduleQuickDateRemove}>×</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {weekScheduleMode === "client" ? (
                    <div style={{ ...styles.scheduleQuickField, ...styles.scheduleQuickFieldFull }}>
                      <div style={styles.scheduleQuickLabel}>{tr("Клиент", "Client")}</div>
                      <select
                        value={weekScheduleClientId}
                        onChange={(e) => {
                          setWeekScheduleClientId(e.target.value);
                          if (weekScheduleError) setWeekScheduleError("");
                        }}
                        style={styles.scheduleQuickInput}
                      >
                        {activeClients.length === 0 ? (
                          <option value="">{tr("Нет клиентов", "No clients")}</option>
                        ) : (
                          activeClients.map((c) => (
                            <option key={c.id} value={c.id}>
                              {getClientLabel(activeClients, c.username)}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  ) : weekScheduleMode === "one_time" ? (
                    <div style={{ ...styles.scheduleQuickField, ...styles.scheduleQuickFieldFull }}>
                      <div style={styles.scheduleQuickLabel}>{tr("Клиент", "Client")}</div>
                      <input
                        value={weekScheduleClientName}
                        onChange={(e) => {
                          setWeekScheduleClientName(e.target.value);
                          if (weekScheduleError) setWeekScheduleError("");
                        }}
                        placeholder={tr("Введите имя клиента", "Enter client name")}
                        style={styles.scheduleQuickInput}
                      />
                    </div>
                  ) : (
                    <div style={{ ...styles.scheduleQuickField, ...styles.scheduleQuickFieldFull }}>
                      <div style={styles.scheduleQuickLabel}>{tr("Клиенты", "Clients")}</div>
                      <div style={styles.scheduleQuickGroupList}>
                        {activeClients.length === 0 ? (
                          <div style={styles.readOnlyValue}>{tr("Нет клиентов", "No clients")}</div>
                        ) : (
                          activeClients.map((c) => {
                            const checked = weekScheduleGroupIds.includes(c.id);
                            return (
                              <label key={c.id} style={styles.groupSelectRow}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    setWeekScheduleGroupIds((prev) =>
                                      prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                                    );
                                    if (weekScheduleError) setWeekScheduleError("");
                                  }}
                                />
                                <span style={{ marginLeft: 8 }}>{getClientLabel(activeClients, c.username)}</span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                  {weekScheduleError ? (
                    <div style={{ ...styles.errorText, ...styles.scheduleQuickFieldFull }}>{weekScheduleError}</div>
                  ) : null}
                  <button
                    type="button"
                    style={{ ...styles.scheduleQuickSaveBtn, ...styles.scheduleQuickFieldFull }}
                    onClick={async () => {
                      const start = normalizeTimeInput(weekScheduleStart);
                      const end = normalizeTimeInput(weekScheduleEnd);
                      if (!start || !end) {
                        setWeekScheduleError(
                          tr("Укажите время в формате ЧЧ:ММ (например 10:00).", "Enter time in HH:MM (e.g., 10:00).")
                        );
                        return;
                      }
                      if (end <= start) {
                        setWeekScheduleError(
                          tr("Время окончания должно быть больше времени начала.", "End time must be after start time.")
                        );
                        return;
                      }
                      const now = new Date();
                      const targetDateKeys =
                        weekScheduleMode === "client" && weekScheduleMulti
                          ? Array.from(new Set(weekScheduleDates))
                          : [formatDateKey(weekScheduleDate)];
                      if (targetDateKeys.length === 0) {
                        setWeekScheduleError(tr("Выберите дату.", "Select a date."));
                        return;
                      }
                      for (const key of targetDateKeys) {
                        const day = parseDateKey(key);
                        const selectedDay = startOfDay(day);
                        const todayDay = startOfDay(now);
                        if (selectedDay.getTime() < todayDay.getTime()) {
                          setWeekScheduleError(
                            tr("Нельзя создавать тренировки в прошедших датах.", "You can't schedule sessions in past dates.")
                          );
                          return;
                        }
                        if (selectedDay.getTime() === todayDay.getTime()) {
                          const startMin = timeToMinutes(start);
                          const nowMinutes = now.getHours() * 60 + now.getMinutes();
                          if (startMin <= nowMinutes) {
                            setWeekScheduleError(
                              tr("Время начала уже прошло.", "Start time has already passed.")
                            );
                            return;
                          }
                        }
                        if (hasSessionOverlap(key, start, end)) {
                          const refreshed = await refreshSessions();
                          if (!refreshed || hasSessionOverlap(key, start, end, refreshed)) {
                            setWeekScheduleError(
                              tr("На эту дату и время уже запланирована тренировка.", "A session is already scheduled for this date and time.")
                            );
                            return;
                          }
                        }
                      }
                      let client: TrainerClientInvite | null = null;
                      let groupClients: TrainerClientInvite[] = [];
                      if (weekScheduleMode === "client") {
                        if (!weekScheduleClientId) {
                          setWeekScheduleError(tr("Выберите клиента.", "Select a client."));
                          return;
                        }
                        client = activeClients.find((c) => c.id === weekScheduleClientId) || null;
                        if (!client) {
                          setWeekScheduleError(tr("Клиент не найден.", "Client not found."));
                          return;
                        }
                      } else if (weekScheduleMode === "one_time") {
                        if (!weekScheduleClientName.trim()) {
                          setWeekScheduleError(tr("Введите имя клиента.", "Enter client name."));
                          return;
                        }
                      } else {
                        if (weekScheduleGroupIds.length < 2) {
                          setWeekScheduleError(tr("Выберите минимум двух клиентов.", "Select at least two clients."));
                          return;
                        }
                        groupClients = activeClients.filter((c) => weekScheduleGroupIds.includes(c.id));
                        if (groupClients.length < 2) {
                          setWeekScheduleError(tr("Клиенты не найдены.", "Clients not found."));
                          return;
                        }
                      }
                      if (!token) {
                        setWeekScheduleError(tr("Сначала войдите в аккаунт.", "Please login first."));
                        return;
                      }
                      try {
                        const payload =
                          weekScheduleMode === "client" && client
                            ? { clientId: client.id }
                            : weekScheduleMode === "one_time"
                              ? { oneTime: true, clientName: weekScheduleClientName.trim() }
                              : { groupClientIds: groupClients.map((c) => c.id) };
                        const createdSessions: SessionItem[] = [];
                        for (const key of targetDateKeys) {
                          const res = await fetch(`${apiBase}/sessions`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                            body: JSON.stringify({
                              dateKey: key,
                              start,
                              end,
                              tzOffset: new Date().getTimezoneOffset(),
                              ...payload,
                            }),
                          });
                          if (!res.ok) {
                            if (res.status === 409) {
                              setWeekScheduleError(
                                tr("На эту дату и время уже запланирована тренировка.", "A session is already scheduled for this date and time.")
                              );
                            } else if (res.status === 404) {
                              setWeekScheduleError(tr("Клиент не найден.", "Client not found."));
                            } else if (res.status === 403) {
                              setWeekScheduleError(
                                tr("Нельзя создать тренировку для этого клиента.", "You can't schedule this client.")
                              );
                            } else {
                              setWeekScheduleError(tr("Не удалось создать тренировку.", "Failed to create session."));
                            }
                            return;
                          }
                          const data = (await res.json()) as { ok: boolean; session?: any };
                          if (!data?.session) throw new Error("session missing");
                          const mapped = mapSessionFromApi(data.session);
                          if (weekScheduleMode === "group" && groupClients.length && (!mapped.participants || mapped.participants.length === 0)) {
                            mapped.participants = groupClients.map((c) => ({
                              clientId: c.id,
                              clientUsername: c.username,
                              clientName: c.fullName || c.clientName || "",
                            }));
                          }
                          createdSessions.push(mapped);
                        }
                        if (createdSessions.length) {
                          setSessionsByDate((prev) => {
                            const next = { ...prev };
                            createdSessions.forEach((mapped) => {
                              const list = next[mapped.dateKey] ? [...next[mapped.dateKey]] : [];
                              list.push(mapped);
                              next[mapped.dateKey] = list;
                            });
                            return next;
                          });
                        }
                        setShowWeekSchedule(false);
                      } catch {
                        setWeekScheduleError(tr("Не удалось создать тренировку.", "Failed to create session."));
                      }
                    }}
                  >
                    {tr("Добавить", "Add")}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {section === "sessions" ? (
        <div style={styles.schedulePanelPlain}>
          {scheduleView === "list" ? (
            (() => {
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
                  {list.map((s) => {
                    const isOneTime = s.clientUsername === "one_time" || s.type === "one_time";
                    const title = sessionTitle(s, tr);
                    const isGroup = s.type === "group" || s.clientUsername === "group";
                    const clientLabel = isOneTime
                      ? s.clientName?.trim() || ""
                      : isGroup
                        ? ""
                        : getClientLabel(clients, s.clientUsername);
                    return (
                      <div
                        key={s.id}
                        style={{ ...styles.sessionBanner, ...(getSessionColorStyle(s.color) || null) }}
                        onClick={() => {
                          setActiveSession(s);
                          setScheduleScreen("session");
                        }}
                      >
                        <div style={styles.sessionBannerLeft}>
                          <div style={styles.sessionBannerTitle}>{title}</div>
                          <div style={styles.sessionBannerTime}>
                            {(() => {
                              const day = parseDateKey(s.dateKey);
                              const weekday = day ? formatWeekdayShort(day, currentLanguage) : "";
                              return `${weekday ? `${weekday} ` : ""}${s.start} — ${s.end}`;
                            })()}
                          </div>
                          {clientLabel ? (
                            <div style={styles.sessionBannerClient}>{clientLabel}</div>
                          ) : null}
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
                    );
                  })}
                </div>
              );
            })()
          ) : (
            <>
              <div
                style={styles.scheduleWeekWrap}
                onPointerDown={(event) => {
                  weekSwipeStartRef.current = { x: event.clientX, y: event.clientY };
                }}
                onPointerUp={(event) => {
                  const start = weekSwipeStartRef.current;
                  weekSwipeStartRef.current = null;
                  if (!start) return;
                  const dx = event.clientX - start.x;
                  const dy = event.clientY - start.y;
                  if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
                  setWeekOffset((v) => v + (dx < 0 ? 1 : -1));
                }}
                onPointerCancel={() => {
                  weekSwipeStartRef.current = null;
                }}
              >
                <div style={styles.scheduleWeekHeader}>
                  <div style={styles.scheduleWeekTimeSpacer} />
                  {weekDays.map((d) => (
                    <div
                      key={formatDateKey(d)}
                      style={{
                        ...styles.scheduleWeekDayHeader,
                        ...(isSameDay(d, today) ? styles.scheduleWeekDayHeaderToday : null),
                      }}
                    >
                      <div style={styles.scheduleWeekDayName}>{formatWeekdayShort(d, language)}</div>
                      <div style={styles.scheduleWeekDayTitle}>{d.getDate()}</div>
                    </div>
                  ))}
                </div>
                <div style={styles.scheduleWeekGrid}>
                  <div style={styles.scheduleWeekTimeCol}>
                    {Array.from({ length: gridRows - 1 }, (_, idx) => {
                      const hour = gridStartHour + idx;
                      return (
                        <div
                          key={hour}
                          style={{
                            ...styles.scheduleWeekTimeLabel,
                            top: (idx + 1) * gridRowHeight,
                          }}
                        >
                          {String(hour).padStart(2, "0")}:00
                        </div>
                      );
                    })}
                  </div>
                  <div ref={scheduleWeekDaysRef} style={styles.scheduleWeekDays}>
                    {gridDrag ? (
                      <div
                        style={{
                          ...styles.scheduleWeekSessionDrag,
                          ...(theme === "dark" ? styles.scheduleWeekSessionDark : null),
                          top:
                            (gridDrag.startMin - gridStartHour * 60) * (gridRowHeight / 60) +
                            gridRowHeight,
                          height: Math.max(28, (gridDrag.endMin - gridDrag.startMin) * (gridRowHeight / 60)),
                          left: gridDrag.left,
                          width: gridDrag.width,
                        }}
                      >
                        <div style={styles.scheduleWeekSessionTitle}>
                          {gridDrag.session.type === "group" || gridDrag.session.clientUsername === "group"
                            ? tr("ГТ", "GT")
                            : sessionClientLabel(gridDrag.session, tr, clients)}
                        </div>
                      </div>
                    ) : null}
                    {weekDays.map((d) => {
                      const dateKey = formatDateKey(d);
                      const daySessions = (sessionsByDate[dateKey] || [])
                        .slice()
                        .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
                      return (
                        <div key={dateKey} style={styles.scheduleWeekDayCol}>
                          <div
                            style={{ ...styles.scheduleWeekDayBody, height: gridRowHeight * gridRows }}
                            onClick={(event) => {
                              const target = event.target as HTMLElement | null;
                              if (target?.closest?.("[data-session='true']")) return;
                              const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
                              const rawY = event.clientY - rect.top;
                              const clampedY = Math.max(0, Math.min(rawY, rect.height));
                              const offsetY = clampedY - gridRowHeight;
                              const safeY = Math.max(0, Math.min(offsetY, gridRowHeight * (gridRows - 1)));
                              const stepIndex = Math.floor(safeY / gridStepHeight);
                              const minutesFromStart = stepIndex * gridStepMinutes;
                              const minStart = gridStartHour * 60;
                              const maxStart = gridEndHour * 60 - 60;
                              const startMinutes = Math.min(minStart + minutesFromStart, maxStart);
                              const endMinutes = startMinutes + 60;
                              setGridDraft({ dateKey, startMin: startMinutes, endMin: endMinutes });
                              setWeekScheduleMode("client");
                              setWeekScheduleDate(d);
                              setWeekScheduleStart(minutesToTime(startMinutes));
                              setWeekScheduleEnd(minutesToTime(endMinutes));
                              setShowWeekSchedule(true);
                            }}
                          >
                            {gridDraft && gridDraft.dateKey === dateKey ? (
                              <div
                                style={{
                                  ...styles.scheduleWeekDraft,
                                  top:
                                    (gridDraft.startMin - gridStartHour * 60) * (gridRowHeight / 60) +
                                    gridRowHeight,
                                  height: Math.max(
                                    28,
                                    (gridDraft.endMin - gridDraft.startMin) * (gridRowHeight / 60)
                                  ),
                                }}
                              />
                            ) : null}
                            {Array.from({ length: gridStepCount }, (_, idx) => {
                              if (idx % gridStepsPerHour !== 0) return null;
                              return (
                                <div
                                  key={idx}
                                  style={{ ...styles.scheduleWeekHourLineTick, top: idx * gridStepHeight }}
                                />
                              );
                            })}
                            {daySessions.map((s) => {
                              const startMin = timeToMinutes(s.start);
                              const endMin = timeToMinutes(s.end);
                              const top =
                                (startMin - gridStartHour * 60) * (gridRowHeight / 60) +
                                gridRowHeight;
                              const height = Math.max(28, (endMin - startMin) * (gridRowHeight / 60));
                              const isDragging = gridDrag?.session.id === s.id;
                              const isEditable = new Date().getTime() < sessionStartTime(s).getTime();
                            return (
                              <button
                                key={s.id}
                                type="button"
                                data-session="true"
                                style={{
                                  ...styles.scheduleWeekSession,
                                  ...(theme === "dark" ? styles.scheduleWeekSessionDark : null),
                                  ...(getSessionColorStyle(s.color) || null),
                                  top,
                                  height,
                                  opacity: isDragging ? 0.2 : 1,
                                  cursor: isEditable ? "grab" : "pointer",
                                }}
                                onPointerDown={(event) => {
                                  if (!isEditable) return;
                                  event.preventDefault();
                                  event.stopPropagation();
                                  const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                  gridDragIntentRef.current = {
                                    session: s,
                                    dateKey,
                                    startMin,
                                    endMin,
                                    duration: endMin - startMin,
                                    startX: event.clientX,
                                    startY: event.clientY,
                                    offsetY: event.clientY - rect.top,
                                  };
                                }}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (gridDragIgnoreClickRef.current) return;
                                  setActiveSession(s);
                                  setScheduleScreen("session");
                                }}
                              >
                                  <div style={styles.scheduleWeekSessionTitle}>
                                    {s.type === "group" || s.clientUsername === "group"
                                      ? tr("ГТ", "GT")
                                      : sessionClientLabel(s, tr, clients)}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              {showWeekSchedule && scheduleView === "grid" ? (
                <div
                  style={styles.clientScheduleOverlay}
                  onClick={() => setShowWeekSchedule(false)}
                >
                  <button
                    type="button"
                    aria-label="close schedule"
                    style={styles.clientScheduleBackdrop}
                    onClick={() => setShowWeekSchedule(false)}
                  />
              <div
                  style={{
                    ...styles.clientScheduleSheet,
                    ...styles.scheduleQuickSheet,
                    transform: weekScheduleDragY ? `translateY(${weekScheduleDragY}px)` : undefined,
                    transition: weekScheduleDragging ? "none" : "transform 180ms ease",
                  }}
                  onClick={(event) => event.stopPropagation()}
                >
                    <div
                      style={styles.scheduleQuickHandle}
                      onPointerDown={(event) => {
                        weekScheduleDragStartRef.current = event.clientY;
                        weekScheduleDragYRef.current = 0;
                        setWeekScheduleDragging(true);
                      }}
                    />
                  <div style={{ height: 2 }} />

                    <div style={styles.scheduleQuickSegment}>
                      <button
                        type="button"
                        onClick={() => setWeekScheduleMode("client")}
                        style={{
                          ...styles.scheduleQuickSegmentBtn,
                          ...(weekScheduleMode === "client" ? styles.scheduleQuickSegmentBtnActive : null),
                        }}
                      >
                        {tr("Тренировка клиента", "Client session")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setWeekScheduleMode("one_time")}
                        style={{
                          ...styles.scheduleQuickSegmentBtn,
                          ...(weekScheduleMode === "one_time" ? styles.scheduleQuickSegmentBtnActive : null),
                        }}
                      >
                        {tr("Разовая тренировка", "One-time session")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setWeekScheduleMode("group");
                          setWeekScheduleGroupIds([]);
                        }}
                        style={{
                          ...styles.scheduleQuickSegmentBtn,
                          ...(weekScheduleMode === "group" ? styles.scheduleQuickSegmentBtnActive : null),
                        }}
                      >
                        {tr("Групповая тренировка", "Group session")}
                      </button>
                    </div>

                    <div style={styles.scheduleQuickFieldsGrid}>
                      <div style={styles.scheduleQuickField}>
                        <div style={styles.scheduleQuickLabel}>{tr("Месяц", "Month")}</div>
                        <select
                          value={weekScheduleDate.getMonth()}
                          onChange={(e) => {
                            const nextMonth = Number(e.target.value);
                            const year = weekScheduleDate.getFullYear();
                            const day = Math.min(
                              weekScheduleDate.getDate(),
                              new Date(year, nextMonth + 1, 0).getDate()
                            );
                            setWeekScheduleDate(new Date(year, nextMonth, day));
                            if (weekScheduleError) setWeekScheduleError("");
                          }}
                          style={styles.scheduleQuickInput}
                        >
                          {monthOptions.map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div style={styles.scheduleQuickField}>
                        <div style={styles.scheduleQuickLabel}>{tr("Дата", "Date")}</div>
                        <input
                          type="date"
                          value={formatDateInputValue(formatDateKey(weekScheduleDate))}
                          onChange={(e) => {
                            const next = parseDateKey(e.target.value);
                            if (next) {
                              setWeekScheduleDate(next);
                              if (weekScheduleMode === "client" && weekScheduleMulti) {
                                const key = formatDateKey(next);
                                setWeekScheduleDates((prev) => (prev.includes(key) ? prev : [...prev, key]));
                              }
                              if (weekScheduleError) setWeekScheduleError("");
                            }
                          }}
                          style={styles.scheduleQuickInput}
                        />
                      </div>
                      <div style={styles.scheduleQuickField}>
                        <div style={styles.scheduleQuickLabel}>{tr("Начало", "Start")}</div>
                        <input
                          type="time"
                          value={weekScheduleStart}
                          onChange={(e) => {
                            setWeekScheduleStart(e.target.value);
                            if (weekScheduleError) setWeekScheduleError("");
                          }}
                          step={300}
                          style={styles.scheduleQuickInput}
                        />
                      </div>
                      <div style={styles.scheduleQuickField}>
                        <div style={styles.scheduleQuickLabel}>{tr("Конец", "End")}</div>
                        <input
                          type="time"
                          value={weekScheduleEnd}
                          onChange={(e) => {
                            setWeekScheduleEnd(e.target.value);
                            if (weekScheduleError) setWeekScheduleError("");
                          }}
                          step={300}
                          style={styles.scheduleQuickInput}
                        />
                      </div>
                      {weekScheduleMode === "client" ? (
                        <div style={{ ...styles.scheduleQuickSegment, ...styles.scheduleQuickFieldFull }}>
                          <button
                            type="button"
                            onClick={() => {
                              setWeekScheduleMulti(false);
                              if (weekScheduleError) setWeekScheduleError("");
                            }}
                            style={{
                              ...styles.scheduleQuickSegmentBtn,
                              ...(weekScheduleMulti ? null : styles.scheduleQuickSegmentBtnActive),
                            }}
                          >
                            {tr("Одна дата", "Single date")}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setWeekScheduleMulti(true);
                              if (weekScheduleDates.length === 0) {
                                setWeekScheduleDates([formatDateKey(weekScheduleDate)]);
                              }
                              if (weekScheduleError) setWeekScheduleError("");
                            }}
                            style={{
                              ...styles.scheduleQuickSegmentBtn,
                              ...(weekScheduleMulti ? styles.scheduleQuickSegmentBtnActive : null),
                            }}
                          >
                            {tr("Несколько", "Multiple")}
                          </button>
                        </div>
                      ) : null}
                      {weekScheduleMode === "client" && weekScheduleMulti ? (
                        <div style={{ ...styles.scheduleQuickDateList, ...styles.scheduleQuickFieldFull }}>
                          {weekScheduleDates.map((key) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setWeekScheduleDates((prev) => prev.filter((k) => k !== key))}
                              style={styles.scheduleQuickDatePill}
                              aria-label={tr("Удалить дату", "Remove date")}
                            >
                              {formatDateShort(parseDateKey(key))}
                              <span style={styles.scheduleQuickDateRemove}>×</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                  {weekScheduleMode === "client" ? (
                    <div style={{ ...styles.scheduleQuickField, ...styles.scheduleQuickFieldFull }}>
                      <div style={styles.scheduleQuickLabel}>{tr("Клиент", "Client")}</div>
                      <select
                        value={weekScheduleClientId}
                        onChange={(e) => {
                          setWeekScheduleClientId(e.target.value);
                          if (weekScheduleError) setWeekScheduleError("");
                        }}
                        style={styles.scheduleQuickInput}
                      >
                            {activeClients.length === 0 ? (
                              <option value="">{tr("Нет клиентов", "No clients")}</option>
                            ) : (
                              activeClients.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {getClientLabel(activeClients, c.username)}
                                </option>
                              ))
                            )}
                          </select>
                        </div>
                      ) : weekScheduleMode === "one_time" ? (
                        <div style={{ ...styles.scheduleQuickField, ...styles.scheduleQuickFieldFull }}>
                          <div style={styles.scheduleQuickLabel}>{tr("Клиент", "Client")}</div>
                          <input
                            value={weekScheduleClientName}
                            onChange={(e) => {
                              setWeekScheduleClientName(e.target.value);
                              if (weekScheduleError) setWeekScheduleError("");
                            }}
                            placeholder={tr("Введите имя клиента", "Enter client name")}
                            style={styles.scheduleQuickInput}
                          />
                        </div>
                      ) : (
                        <div style={{ ...styles.scheduleQuickField, ...styles.scheduleQuickFieldFull }}>
                          <div style={styles.scheduleQuickLabel}>{tr("Клиенты", "Clients")}</div>
                          <div style={styles.scheduleQuickGroupList}>
                            {activeClients.length === 0 ? (
                              <div style={styles.readOnlyValue}>{tr("Нет клиентов", "No clients")}</div>
                            ) : (
                              activeClients.map((c) => {
                                const checked = weekScheduleGroupIds.includes(c.id);
                                return (
                                  <label key={c.id} style={styles.groupSelectRow}>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => {
                                        setWeekScheduleGroupIds((prev) =>
                                          prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                                        );
                                        if (weekScheduleError) setWeekScheduleError("");
                                      }}
                                    />
                                    <span style={{ marginLeft: 8 }}>{getClientLabel(activeClients, c.username)}</span>
                                  </label>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                      {weekScheduleError ? (
                        <div style={{ ...styles.errorText, ...styles.scheduleQuickFieldFull }}>
                          {weekScheduleError}
                        </div>
                      ) : null}
                      <button
                        type="button"
                        style={{ ...styles.scheduleQuickSaveBtn, ...styles.scheduleQuickFieldFull }}
                        onClick={async () => {
                          const start = normalizeTimeInput(weekScheduleStart);
                          const end = normalizeTimeInput(weekScheduleEnd);
                          if (!start || !end) {
                            setWeekScheduleError(
                              tr("Укажите время в формате ЧЧ:ММ (например 10:00).", "Enter time in HH:MM (e.g., 10:00).")
                            );
                            return;
                          }
                          if (end <= start) {
                            setWeekScheduleError(
                              tr("Время окончания должно быть больше времени начала.", "End time must be after start time.")
                            );
                            return;
                          }
                          const now = new Date();
                          const targetDateKeys =
                            weekScheduleMode === "client" && weekScheduleMulti
                              ? Array.from(new Set(weekScheduleDates))
                              : [formatDateKey(weekScheduleDate)];
                          if (targetDateKeys.length === 0) {
                            setWeekScheduleError(tr("Выберите дату.", "Select a date."));
                            return;
                          }
                          for (const key of targetDateKeys) {
                            const day = parseDateKey(key);
                            const selectedDay = startOfDay(day);
                            const todayDay = startOfDay(now);
                            if (selectedDay.getTime() < todayDay.getTime()) {
                              setWeekScheduleError(
                                tr("Нельзя создавать тренировки в прошедших датах.", "You can't schedule sessions in past dates.")
                              );
                              return;
                            }
                            if (selectedDay.getTime() === todayDay.getTime()) {
                              const startMin = timeToMinutes(start);
                              const nowMinutes = now.getHours() * 60 + now.getMinutes();
                              if (startMin <= nowMinutes) {
                                setWeekScheduleError(
                                  tr("Время начала уже прошло.", "Start time has already passed.")
                                );
                                return;
                              }
                            }
                            if (hasSessionOverlap(key, start, end)) {
                              const refreshed = await refreshSessions();
                              if (!refreshed || hasSessionOverlap(key, start, end, refreshed)) {
                                setWeekScheduleError(
                                  tr("На эту дату и время уже запланирована тренировка.", "A session is already scheduled for this date and time.")
                                );
                                return;
                              }
                            }
                          }
                          let client: TrainerClientInvite | null = null;
                          let groupClients: TrainerClientInvite[] = [];
                          if (weekScheduleMode === "client") {
                            if (!weekScheduleClientId) {
                              setWeekScheduleError(tr("Выберите клиента.", "Select a client."));
                              return;
                            }
                            client = activeClients.find((c) => c.id === weekScheduleClientId) || null;
                            if (!client) {
                              setWeekScheduleError(tr("Клиент не найден.", "Client not found."));
                              return;
                            }
                          } else if (weekScheduleMode === "one_time") {
                            if (!weekScheduleClientName.trim()) {
                              setWeekScheduleError(tr("Введите имя клиента.", "Enter client name."));
                              return;
                            }
                          } else {
                            if (weekScheduleGroupIds.length < 2) {
                              setWeekScheduleError(tr("Выберите минимум двух клиентов.", "Select at least two clients."));
                              return;
                            }
                            groupClients = activeClients.filter((c) => weekScheduleGroupIds.includes(c.id));
                            if (groupClients.length < 2) {
                              setWeekScheduleError(tr("Клиенты не найдены.", "Clients not found."));
                              return;
                            }
                          }
                          if (!token) {
                            setWeekScheduleError(tr("Сначала войдите в аккаунт.", "Please login first."));
                            return;
                          }
                          try {
                            const payload =
                              weekScheduleMode === "client" && client
                                ? { clientId: client.id }
                                : weekScheduleMode === "one_time"
                                  ? { oneTime: true, clientName: weekScheduleClientName.trim() }
                                  : { groupClientIds: groupClients.map((c) => c.id) };
                            const createdSessions: SessionItem[] = [];
                            for (const key of targetDateKeys) {
                              const res = await fetch(`${apiBase}/sessions`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                body: JSON.stringify({
                                  dateKey: key,
                                  start,
                                  end,
                                  tzOffset: new Date().getTimezoneOffset(),
                                  ...payload,
                                }),
                              });
                              if (!res.ok) {
                                if (res.status === 409) {
                                  setWeekScheduleError(
                                    tr("На эту дату и время уже запланирована тренировка.", "A session is already scheduled for this date and time.")
                                  );
                                } else if (res.status === 404) {
                                  setWeekScheduleError(tr("Клиент не найден.", "Client not found."));
                                } else if (res.status === 403) {
                                  setWeekScheduleError(
                                    tr("Нельзя создать тренировку для этого клиента.", "You can't schedule this client.")
                                  );
                                } else {
                                  setWeekScheduleError(tr("Не удалось создать тренировку.", "Failed to create session."));
                                }
                                return;
                              }
                              const data = (await res.json()) as { ok: boolean; session?: any };
                              if (!data?.session) throw new Error("session missing");
                              const mapped = mapSessionFromApi(data.session);
                              if (weekScheduleMode === "group" && groupClients.length && (!mapped.participants || mapped.participants.length === 0)) {
                                mapped.participants = groupClients.map((c) => ({
                                  clientId: c.id,
                                  clientUsername: c.username,
                                  clientName: c.fullName || c.clientName || "",
                                }));
                              }
                              createdSessions.push(mapped);
                            }
                            if (createdSessions.length) {
                              setSessionsByDate((prev) => {
                                const next = { ...prev };
                                createdSessions.forEach((mapped) => {
                                  const list = next[mapped.dateKey] ? [...next[mapped.dateKey]] : [];
                                  list.push(mapped);
                                  next[mapped.dateKey] = list;
                                });
                                return next;
                              });
                            }
                            setShowWeekSchedule(false);
                          } catch {
                            setWeekScheduleError(tr("Не удалось создать тренировку.", "Failed to create session."));
                          }
                        }}
                      >
                        {tr("Добавить", "Add")}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <div style={styles.schedulePanelPlain}>
          <button
            type="button"
            onClick={() => {
              setShowFreeSchedule(true);
              setFreeError("");
              setFreeIsGroup(false);
              setFreeCapacity("2");
            }}
            style={styles.scheduleAddWindowBtn}
          >
            {tr("Добавить окно тренировки", "Add session slot")}
          </button>

          {slotError ? <div style={styles.errorText}>{slotError}</div> : null}

          <div style={{ marginTop: 10 }}>
            <div style={styles.freeList}>
              {(slotsByDate[formatDateKey(selected)] || [])
                .slice()
                .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start))
                .map((w) => {
                  const trainerSessions = Object.values(sessionsByDate).flat();
                  const slotDate = parseDateKey(w.dateKey);
                  const [slotHours, slotMinutes] = w.start.split(":").map((value) => parseInt(value, 10));
                  const slotStartAt = slotDate ? new Date(slotDate) : null;
                  if (slotStartAt && !Number.isNaN(slotHours) && !Number.isNaN(slotMinutes)) {
                    slotStartAt.setHours(slotHours, slotMinutes, 0, 0);
                  }
                  const linkedSession = w.sessionId
                    ? (sessionsByDate[w.dateKey] || []).find((session) => session.id === w.sessionId) || null
                    : null;
                  const bookedClientIds = new Set(
                    (linkedSession?.participants || []).map((participant) => participant.clientId).filter(Boolean)
                  );
                  const bookedClientUsernames = new Set(
                    (linkedSession?.participants || [])
                      .map((participant) => participant.clientUsername)
                      .filter(Boolean)
                      .map((username) => username.replace(/^@/, ""))
                  );
                  const assignableClients = clients.filter((c) => {
                    if (!canScheduleClientOnDate(clients, c.username, trainerSessions, slotStartAt)) return false;
                    if (!w.isGroup) return true;
                    if (bookedClientIds.has(c.id)) return false;
                    return !bookedClientUsernames.has(c.username.replace(/^@/, ""));
                  });
                  return (
                    <div key={w.id} style={styles.freeBanner}>
                  <div style={styles.freeBannerLeft}>
                    <div style={styles.freeBannerTitle}>
                      {w.isGroup ? tr("Групповое окно", "Group slot") : tr("Свободное окно", "Available slot")}
                    </div>
                    <div style={styles.freeBannerTime}>
                      {w.start} — {w.end}
                    </div>
                    {w.isGroup ? (
                      <div style={styles.freeBannerMeta}>
                        {tr("Мест", "Spots")}: {Math.max(0, (w.capacity ?? 2) - (w.bookedCount ?? 0))}/
                        {w.capacity ?? 2}
                      </div>
                    ) : null}
                    {assignForId === w.id ? (
                      <div style={styles.assignRow}>
                        <select
                          value={assignClientUsername}
                          onChange={async (e) => {
                            const value = e.target.value || undefined;
                            setAssignClientUsername(e.target.value);
                            const dateKey = formatDateKey(selected);
                            if (value) {
                              if (!canBookSlot(w.dateKey, w.start)) {
                                setFreeError(tr("Окно уже началось.", "The slot has already started."));
                                return;
                              }
                              if (!token) {
                                setFreeError(tr("Сначала войдите в аккаунт.", "Please login first."));
                                return;
                              }
                              if (value === "__one_time__") {
                                const name =
                                  typeof WebApp?.showPopup === "function"
                                    ? window.prompt(tr("Введите имя клиента", "Enter client name")) || ""
                                    : window.prompt(tr("Введите имя клиента", "Enter client name")) || "";
                                if (!name.trim()) {
                                  setAssignClientUsername("");
                                  setAssignForId(null);
                                  return;
                                }
                                try {
                                  const res = await fetch(`${apiBase}/sessions`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                    body: JSON.stringify({
                                      dateKey,
                                      start: w.start,
                                      end: w.end,
                                      tzOffset: new Date().getTimezoneOffset(),
                                      oneTime: true,
                                      clientName: name.trim(),
                                    }),
                                  });
                                  if (!res.ok) {
                                    setFreeError(tr("Не удалось создать тренировку.", "Failed to create session."));
                                    return;
                                  }
                                  const data = (await res.json()) as { ok: boolean; session?: any };
                                  if (!data?.session) {
                                    setFreeError(tr("Не удалось создать тренировку.", "Failed to create session."));
                                    return;
                                  }
                                  const mapped = mapSessionFromApi(data.session);
                                  setSessionsByDate((prev) => {
                                    const list = prev[mapped.dateKey] ? [...prev[mapped.dateKey]] : [];
                                    list.push(mapped);
                                    return { ...prev, [mapped.dateKey]: list };
                                  });
                                  void deleteSlot(w.id, dateKey);
                                } catch {
                                  setFreeError(tr("Не удалось создать тренировку.", "Failed to create session."));
                                  return;
                                } finally {
                                  setAssignClientUsername("");
                                  setAssignForId(null);
                                }
                                return;
                              }
                              const client = clients.find((c) => c.username === value);
                              if (!client || !canScheduleClientOnDate(clients, value, trainerSessions, slotStartAt)) return;
                              try {
                                const res = await fetch(`${apiBase}/slots/${encodeURIComponent(w.id)}/assign`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                  body: JSON.stringify({ clientId: client.id }),
                                });
                                if (!res.ok) {
                                  setFreeError(tr("Не удалось создать тренировку.", "Failed to create session."));
                                  return;
                                }
                                const data = (await res.json()) as { ok: boolean; session?: any; slot?: TrainingSlot | null };
                                if (!data?.session) {
                                  setFreeError(tr("Не удалось создать тренировку.", "Failed to create session."));
                                  return;
                                }
                                const mapped = mapSessionFromApi(data.session);
                                setSessionsByDate((prev) => {
                                  const list = prev[mapped.dateKey] ? [...prev[mapped.dateKey]] : [];
                                  const existingIndex = list.findIndex((item) => item.id === mapped.id);
                                  if (existingIndex >= 0) {
                                    list[existingIndex] = mapped;
                                  } else {
                                    list.push(mapped);
                                  }
                                  return { ...prev, [mapped.dateKey]: list };
                                });
                                const nextSlot = data.slot;
                                setSlotsByDate((prev) => {
                                  const list = prev[dateKey] ? [...prev[dateKey]] : [];
                                  const filtered = list.filter((slot) => slot.id !== w.id);
                                  if (!nextSlot || (nextSlot.capacity ?? 2) <= (nextSlot.bookedCount ?? 0)) {
                                    return filtered.length ? { ...prev, [dateKey]: filtered } : Object.fromEntries(
                                      Object.entries(prev).filter(([key]) => key !== dateKey)
                                    );
                                  }
                                  return {
                                    ...prev,
                                    [dateKey]: [...filtered, nextSlot].sort(
                                      (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)
                                    ),
                                  };
                                });
                              } catch {
                                setFreeError(tr("Не удалось создать тренировку.", "Failed to create session."));
                                return;
                              } finally {
                                setAssignClientUsername("");
                              }
                            }
                            setAssignForId(null);
                          }}
                          style={styles.selectInline}
                          aria-label="assign client"
                        >
                          <option value="">{tr("Выбери клиента", "Choose client")}</option>
                          {assignableClients.map((c) => (
                            <option key={c.id} value={c.username}>
                              {c.fullName?.trim() ? c.fullName : `@${c.username}`}
                            </option>
                          ))}
                          {!w.isGroup ? (
                            <option value="__one_time__">{tr("Разовая тренировка", "One-time session")}</option>
                          ) : null}
                        </select>
                      </div>
                    ) : null}
                  </div>
                  <div style={styles.freeBannerActions}>
                    <button
                      type="button"
                      onClick={() => {
                        if (w.isGroup && assignableClients.length === 0) return;
                        if (!canBookSlot(w.dateKey, w.start)) {
                          setFreeError(tr("Окно уже началось.", "The slot has already started."));
                          return;
                        }
                        setAssignForId((prev) => (prev === w.id ? null : w.id));
                      }}
                      style={styles.freeBannerAdd}
                      aria-label="assign client"
                      title={tr("Записать клиента", "Assign client")}
                      disabled={!canBookSlot(w.dateKey, w.start)}
                    >
                      <span style={styles.iconOnAccent}>
                        <HugeiconsIcon
                          icon={UserAdd02Icon}
                          size={20}
                          strokeWidth={2.2}
                          style={{ color: "#ffffff", stroke: "currentColor" }}
                        />
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const dateKey = formatDateKey(selected);
                        void deleteSlot(w.id, dateKey);
                        setAssignForId((prev) => (prev === w.id ? null : prev));
                      }}
                      style={styles.freeBannerDelete}
                      aria-label="delete free window"
                      title={tr("Удалить", "Delete")}
                    >
                      <span style={styles.iconOnGlass}>
                        <IconTrash size={20} strokeWidth={2} />
                      </span>
                    </button>
                  </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {showFreeSchedule ? (
        <div style={styles.clientScheduleOverlay} onClick={() => setShowFreeSchedule(false)}>
          <button
            type="button"
            aria-label="close free slots"
            style={styles.clientScheduleBackdrop}
            onClick={() => setShowFreeSchedule(false)}
          />
          <div
            style={{ ...styles.clientScheduleSheet, ...styles.scheduleQuickSheet }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={styles.scheduleQuickHandle} />
            <div style={styles.freeScheduleTitleRow}>
              <div style={styles.freeScheduleTitle}>{tr("Добавить окно", "Add slot")}</div>
              <button type="button" onClick={() => setShowFreeSchedule(false)} style={styles.freeScheduleCloseBtn}>
                {tr("Закрыть", "Close")}
              </button>
            </div>

            <div style={styles.scheduleQuickFieldsGrid}>
              <div style={styles.scheduleQuickField}>
                <div style={styles.scheduleQuickLabel}>{tr("Месяц", "Month")}</div>
                <select
                  value={selected.getMonth()}
                  onChange={(e) => {
                    const nextMonth = Number(e.target.value);
                    const year = selected.getFullYear();
                    const day = Math.min(selected.getDate(), new Date(year, nextMonth + 1, 0).getDate());
                    setSelected(new Date(year, nextMonth, day));
                  }}
                  style={styles.scheduleQuickInput}
                >
                  {monthOptions.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.scheduleQuickField}>
                <div style={styles.scheduleQuickLabel}>{tr("Дата", "Date")}</div>
                <input
                  type="date"
                  value={formatDateInputValue(formatDateKey(selected))}
                  onChange={(e) => {
                    const next = parseDateKey(e.target.value);
                    if (next) setSelected(next);
                  }}
                  style={styles.scheduleQuickInput}
                />
              </div>
              <div style={styles.scheduleQuickField}>
                <div style={styles.scheduleQuickLabel}>{tr("Начало", "Start")}</div>
                <input
                  type="time"
                  value={freeStart}
                  onChange={(e) => {
                    const nextStart = e.target.value;
                    setFreeStart(nextStart);
                    const nextEnd = addHourToTime(nextStart);
                    if (nextEnd) setFreeEnd(nextEnd);
                  }}
                  step={300}
                  style={styles.scheduleQuickInput}
                />
              </div>
              <div style={styles.scheduleQuickField}>
                <div style={styles.scheduleQuickLabel}>{tr("Конец", "End")}</div>
                <input
                  type="time"
                  value={freeEnd}
                  onChange={(e) => setFreeEnd(e.target.value)}
                  step={300}
                  style={styles.scheduleQuickInput}
                />
              </div>
              <div style={{ ...styles.scheduleQuickField, ...styles.scheduleQuickFieldFull }}>
                <button
                  type="button"
                  style={styles.groupSlotToggle}
                  onClick={() => setFreeIsGroup((prev) => !prev)}
                >
                  <span style={{ ...styles.groupSlotCheckbox, ...(freeIsGroup ? styles.groupSlotCheckboxActive : null) }}>
                    {freeIsGroup ? <IconCheck size={16} strokeWidth={2.4} /> : null}
                  </span>
                  <span style={styles.groupSlotToggleText}>
                    {tr("Окно для групповой тренировки", "Slot for group training")}
                  </span>
                </button>
              </div>
              {freeIsGroup ? (
                <div style={{ ...styles.scheduleQuickField, ...styles.scheduleQuickFieldFull }}>
                  <div style={styles.scheduleQuickLabel}>{tr("Количество клиентов", "Clients capacity")}</div>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={freeCapacity}
                    onChange={(e) => setFreeCapacity(e.target.value.replace(/[^\d]/g, ""))}
                    placeholder="2"
                    style={styles.scheduleQuickInput}
                  />
                </div>
              ) : null}
              {freeError ? (
                <div style={{ ...styles.errorText, ...styles.scheduleQuickFieldFull }}>{freeError}</div>
              ) : null}
              <button
                type="button"
                disabled={isCreatingSlot}
                style={{ ...styles.scheduleQuickSaveBtn, ...styles.scheduleQuickFieldFull }}
                onClick={async () => {
                  if (isCreatingSlot) return;
                  setIsCreatingSlot(true);
                  const dateKey = formatDateKey(selected);
                  const start = normalizeTimeInput(freeStart);
                  const end = normalizeTimeInput(freeEnd);
                  if (!start || !end) {
                    setFreeError(tr("Укажите время в формате ЧЧ:ММ (например 10:00).", "Enter time in HH:MM (e.g., 10:00)."));
                    setIsCreatingSlot(false);
                    return;
                  }
                  if (end <= start) {
                    setFreeError(tr("Время окончания должно быть больше времени начала.", "End time must be after start time."));
                    setIsCreatingSlot(false);
                    return;
                  }
                  const now = new Date();
                  const selectedDay = startOfDay(selected);
                  const todayDay = startOfDay(now);
                  if (selectedDay.getTime() < todayDay.getTime()) {
                    setFreeError(tr("Нельзя создавать окна в прошедших датах.", "You can't create slots in past dates."));
                    setIsCreatingSlot(false);
                    return;
                  }
                  if (selectedDay.getTime() === todayDay.getTime()) {
                    const startMin = timeToMinutes(start);
                    const nowMin = now.getHours() * 60 + now.getMinutes();
                    if (startMin <= nowMin) {
                      setFreeError(tr("Нельзя создавать окна в прошедшее время.", "You can't create slots in the past time."));
                      setIsCreatingSlot(false);
                      return;
                    }
                  }
                  const startMin = timeToMinutes(start);
                  const endMin = timeToMinutes(end);
                  const existing = slotsByDate[dateKey] || [];
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
                    setIsCreatingSlot(false);
                    return;
                  }
                  let capacity: number | null = null;
                  if (freeIsGroup) {
                    capacity = Number(freeCapacity);
                    if (!Number.isFinite(capacity) || capacity < 2) {
                      setFreeError(
                        tr(
                          "Для группового окна укажите минимум 2 клиента.",
                          "For a group slot, set capacity to at least 2 clients."
                        )
                      );
                      setIsCreatingSlot(false);
                      return;
                    }
                  }
                  const created = await createSlot(dateKey, start, end, {
                    isGroup: freeIsGroup,
                    capacity,
                  });
                  if (!created) {
                    setIsCreatingSlot(false);
                    return;
                  }
                  setShowFreeSchedule(false);
                  setFreeError("");
                  setFreeStart("");
                  setFreeEnd("");
                  setFreeIsGroup(false);
                  setFreeCapacity("2");
                  setIsCreatingSlot(false);
                }}
              >
                {tr("Добавить", "Add")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TrainerClients(props: {
  screen: ClientsScreen;
  setScreen: (s: ClientsScreen) => void;
  invites: TrainerClientInvite[];
  setInvites: React.Dispatch<React.SetStateAction<TrainerClientInvite[]>>;
  historyByClient: Record<string, SessionItem[]>;
  sessionsByDate: Record<string, SessionItem[]>;
  setSessionsByDate: React.Dispatch<React.SetStateAction<Record<string, SessionItem[]>>>;
  token: string;
  apiBase: string;
  trainerTgUserId: string;
  onLoadHistory?: (client: TrainerClientInvite) => void;
  onRefreshClients?: () => void;
  onSaveClientExercises?: (
    clientId: string,
    exercises: { id: string; name: string; weight: string }[]
  ) => Promise<TrainerClientInvite | null> | void;
}) {
  const {
    screen,
    setScreen,
    invites,
    setInvites,
    historyByClient,
    sessionsByDate,
    setSessionsByDate,
    token,
    apiBase,
    trainerTgUserId,
    onLoadHistory,
    onRefreshClients,
    onSaveClientExercises,
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

  async function createLocalClient(fullName: string) {
    if (!token) return null;
    try {
      const res = await fetch(`${apiBase}/clients/local`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fullName }),
      });
      const data = (await res.json()) as { ok: boolean; client?: any };
      if (!res.ok || !data?.client) return null;
      const mapped = mapClientFromApi(data.client);
      setInvites((prev) => [mapped, ...prev]);
      return mapped;
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
        onCreateLocal={createLocalClient}
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
        sessionsByDate={sessionsByDate}
        setSessionsByDate={setSessionsByDate}
        token={token}
        apiBase={apiBase}
        trainerTgUserId={trainerTgUserId}
        onToggleArchive={(target, nextArchived) => {
          updateClient(target.id, { archived: nextArchived });
          setScreen("list");
          setClientsTab(nextArchived ? "archive" : "my");
        }}
        onDeleteClient={(target) => {
          deleteClient(target);
          setScreen("list");
          setClientsTab("my");
        }}
        onSaveExercises={onSaveClientExercises}
        history={historyByClient[client?.username ?? ""] ?? []}
      />
    );
  }

  return (
    <div style={{ ...styles.pageContainer, ...styles.clientsPage }}>
      <div style={styles.clientsTabsRow}>
        <div style={styles.clientsTabs}>
        <button
          type="button"
          onClick={() => setClientsTab("my")}
          style={{
            ...styles.clientsTab,
            ...(clientsTab === "my" ? styles.clientsTabActive : null),
          }}
        >
          {tr("Мои клиенты", "My clients")}
        </button>
        <button
          type="button"
          onClick={() => setClientsTab("pending")}
          style={{
            ...styles.clientsTab,
            ...(clientsTab === "pending" ? styles.clientsTabActive : null),
          }}
        >
          {tr("Добавление клиентов", "Add clients")}
        </button>
        <button
          type="button"
          onClick={() => setClientsTab("archive")}
          style={{
            ...styles.clientsTab,
            ...(clientsTab === "archive" ? styles.clientsTabActive : null),
          }}
        >
          {tr("Архив клиентов", "Client archive")}
        </button>
        </div>
        {clientsTab === "pending" ? (
          <button
            onClick={() => {
              if (limitReached) {
                showLimitWarning();
                return;
              }
              setScreen("add");
            }}
            style={styles.clientsAddBtn}
            aria-label="add client"
          >
            <span style={styles.iconOnAccent}>
              <IconPlus />
            </span>
          </button>
        ) : null}
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
          <div style={{ marginTop: 18 }}>
            <div style={styles.clientsList}>
              {filtered.map((inv) => {
                const trainerSessions = Object.values(sessionsByDate).flat();
                const isLocal = inv.isLocal || inv.username.startsWith("local_");
                const displayName = inv.fullName?.trim()
                  ? inv.fullName
                  : inv.clientName?.trim()
                    ? inv.clientName
                    : isLocal
                      ? tr("Клиент", "Client")
                      : `@${inv.username}`;
                const subscriptionInfo = getClientSubscriptionBookingInfo(inv, trainerSessions);
                const shouldWarn = subscriptionInfo.shouldWarn;
                const subscriptionText =
                  subscriptionInfo.enabled &&
                  subscriptionInfo.available !== null &&
                  subscriptionInfo.total !== null &&
                  !shouldWarn
                    ? tr(
                        `Остаток для записи ${subscriptionInfo.available}/${subscriptionInfo.total}`,
                        `Booking balance ${subscriptionInfo.available}/${subscriptionInfo.total}`
                      )
                    : null;
                return (
                  <div
                    key={inv.id}
                    style={styles.clientsCard}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedClientId(inv.id);
                        setScreen("detail");
                      }}
                      style={styles.clientsCardBtn}
                      aria-label={`open ${inv.username}`}
                    >
                      <div style={styles.clientsRowLeft}>
                        {inv.photoUrl ? (
                          <AvatarCircle
                            name={displayName}
                            photoUrl={inv.photoUrl || ""}
                            size={52}
                          />
                        ) : (
                          <div style={styles.clientsAvatar}>
                            <span style={styles.clientsAvatarText}>{displayName.trim().charAt(0).toUpperCase()}</span>
                          </div>
                        )}
                        <div style={{ textAlign: "left" }}>
                          <div style={styles.clientsName}>{displayName}</div>
                          <div style={styles.rowSubtitle}>
                            {clientsTab === "pending" ? (
                              <span>{tr("Ожидает активации", "Pending activation")}</span>
                            ) : clientsTab === "archive" ? (
                              <span style={{ opacity: 0.7 }}>{tr("Архивирован", "Archived")}</span>
                            ) : shouldWarn ? (
                              <span style={styles.subscriptionWarningText}>
                                {tr("Необходимо продлить абонемент", "Subscription renewal required")}
                              </span>
                            ) : subscriptionText ? (
                              <span style={styles.subscriptionLeftText}>{subscriptionText}</span>
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
  onCreateLocal: (fullName: string) => Promise<TrainerClientInvite | null>;
  existingInvites: TrainerClientInvite[];
}) {
  const { onBack, onCreate, onCreateLocal, existingInvites } = props;
  const tr = useTr();

  const [input, setInput] = useState<string>("@");
  const [error, setError] = useState<string>("");
  const [created, setCreated] = useState<TrainerClientInvite | null>(null);
  const [mode, setMode] = useState<"telegram" | "local">("telegram");
  const [localName, setLocalName] = useState<string>("");
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

  async function createLocalClient() {
    setError("");
    if (limitReached) {
      setError(tr("Достигнут лимит активных клиентов по тарифу.", "Active client limit reached for your plan."));
      showLimitWarning();
      return;
    }
    const name = localName.trim();
    if (!name) {
      setError(tr("Введи ФИО клиента.", "Enter the client's full name."));
      return;
    }
    const result = await onCreateLocal(name);
    if (!result) {
      setError(tr("Не удалось создать клиента. Попробуй позже.", "Failed to create client. Try again."));
      return;
    }
    setCreated(result);
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
          <div style={styles.addClientTabs}>
            <button
              type="button"
              onClick={() => setMode("telegram")}
              style={{
                ...styles.addClientTab,
                ...(mode === "telegram" ? styles.addClientTabActive : null),
              }}
            >
              {tr("Telegram", "Telegram")}
            </button>
            <button
              type="button"
              onClick={() => setMode("local")}
              style={{
                ...styles.addClientTab,
                ...(mode === "local" ? styles.addClientTabActive : null),
              }}
            >
              {tr("Локальный", "Local")}
            </button>
          </div>

          <div style={styles.addClientHint}>
            {mode === "telegram"
              ? tr(
                  "Введи Telegram username клиента (например ",
                  "Enter the client's Telegram username (e.g., "
                )
              : tr(
                  "Введи ФИО клиента. Этот клиент будет доступен только тебе.",
                  "Enter the client's full name. This client will be visible only to you."
                )}
            {mode === "telegram" ? <b>@username</b> : null}
            {mode === "telegram"
              ? tr(
                  "). После этого появится уникальный код, который ты отправишь клиенту.",
                  "). After that you will get a unique code to send to the client."
                )
              : null}
          </div>

          <div style={{ marginTop: 18 }}>
            {mode === "telegram" ? (
              <>
                <div style={styles.fieldLabel}>Username</div>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="@username"
                  style={styles.addClientInput}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </>
            ) : (
              <>
                <div style={styles.fieldLabel}>{tr("ФИО", "Full name")}</div>
                <input
                  value={localName}
                  onChange={(e) => setLocalName(e.target.value)}
                  placeholder={tr("Введите ФИО", "Enter full name")}
                  style={styles.addClientInput}
                />
              </>
            )}
          </div>

          {error ? <div style={styles.errorText}>{error}</div> : null}

          <button onClick={mode === "telegram" ? createInvite : createLocalClient} style={styles.addClientPrimaryBtn}>
            {tr("Добавить", "Add")}
          </button>

          {mode === "local" ? (
            <div style={{ marginTop: 12, opacity: 0.6, fontSize: 12, lineHeight: 1.35 }}>
              {tr(
                "Локальные клиенты не требуют Telegram и не имеют интерфейса клиента.",
                "Local clients don't require Telegram and don't have a client interface."
              )}
            </div>
          ) : null}
        </>
      ) : (
        <>
          {created.isLocal || created.username.startsWith("local_") ? (
            <>
              <div style={{ marginTop: 10, opacity: 0.8, fontSize: 14 }}>
                {tr("Клиент", "Client")}: <b>{created.fullName || tr("Клиент", "Client")}</b>
              </div>
              <div style={styles.codeBox}>
                <div style={{ fontWeight: 800, fontSize: 14, opacity: 0.8 }}>
                  {tr("Клиент добавлен", "Client added")}
                </div>
                <button onClick={onBack} style={{ ...styles.primaryBtn, width: "100%", marginTop: 12 }}>
                  {tr("Готово", "Done")}
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ marginTop: 10, opacity: 0.8, fontSize: 14 }}>
                {tr("Клиент", "Client")}: <b>@{created.username}</b>
              </div>

              <div style={styles.codeBox}>
                <div style={{ fontWeight: 800, fontSize: 14, opacity: 0.8 }}>
                  {tr("Код для клиента", "Client code")}
                </div>
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
        </>
      )}
    </div>
  );
}

function ExerciseStatsPanel(props: {
  clientId: string | null;
  exercises: { id: string; name: string; weight: string }[];
  setExercises: (next: { id: string; name: string; weight: string }[]) => void;
  onSaveExercises?: (
    clientId: string,
    exercises: { id: string; name: string; weight: string }[]
  ) => Promise<TrainerClientInvite | null> | void;
  token?: string;
  apiBase?: string;
  embedded?: boolean;
}) {
  const { clientId, exercises, setExercises, onSaveExercises, token, apiBase, embedded = false } = props;
  const tr = useTr();
  const [showExerciseForm, setShowExerciseForm] = useState(false);
  const [draftExerciseName, setDraftExerciseName] = useState("");
  const [draftExerciseWeight, setDraftExerciseWeight] = useState("");
  const [draftStatsWeight, setDraftStatsWeight] = useState("");
  const [statsWeightError, setStatsWeightError] = useState("");
  const [exerciseError, setExerciseError] = useState("");
  const [weightsStatsOpen, setWeightsStatsOpen] = useState(false);
  const [weightsStatsExercise, setWeightsStatsExercise] = useState<{ id: string; name: string; weight: string } | null>(
    null
  );
  const [exerciseHistoryMap, setExerciseHistoryMap] = useState<Record<string, ExerciseHistoryItem[]>>({});
  const statsSheetRef = useRef<HTMLDivElement | null>(null);
  const statsWeightInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setShowExerciseForm(false);
    setDraftExerciseName("");
    setDraftExerciseWeight("");
    setExerciseError("");
    setWeightsStatsOpen(false);
    setWeightsStatsExercise(null);
  }, [clientId]);

  useEffect(() => {
    setStatsWeightError("");
  }, [weightsStatsExercise?.id]);

  useEffect(() => {
    if (!weightsStatsExercise) return;
    const next = exercises.find((ex) => ex.id === weightsStatsExercise.id);
    if (!next) {
      setWeightsStatsExercise(null);
      return;
    }
    if (next.name !== weightsStatsExercise.name || next.weight !== weightsStatsExercise.weight) {
      setWeightsStatsExercise(next);
    }
  }, [exercises, weightsStatsExercise]);

  const parseWeightValue = (raw: string) => {
    const cleaned = String(raw || "").replace(",", ".");
    const parsed = Number.parseFloat(cleaned.replace(/[^\d.]/g, ""));
    return Number.isFinite(parsed) ? parsed : NaN;
  };

  const ensureExerciseHistory = async (exerciseId: string) => {
    if (!clientId || !token || !apiBase) return;
    try {
      const res = await fetch(
        `${apiBase}/clients/${encodeURIComponent(clientId)}/exercises/${encodeURIComponent(exerciseId)}/history`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return;
      const data = (await res.json()) as { ok: boolean; history?: ExerciseHistoryItem[] };
      if (!data?.history) return;
      setExerciseHistoryMap((prev) => ({ ...prev, [exerciseId]: data.history || [] }));
    } catch {
      // ignore history fetch errors
    }
  };

  const weightHistoryList = useMemo(() => {
    if (!weightsStatsExercise) return [];
    const history = exerciseHistoryMap[weightsStatsExercise.id] || [];
    const byDate = new Map<string, ExerciseHistoryItem>();
    history.forEach((h) => {
      const d = startOfDay(new Date(h.recordedAt));
      const key = formatDateKey(d);
      const prev = byDate.get(key);
      if (!prev || new Date(prev.recordedAt).getTime() < new Date(h.recordedAt).getTime()) {
        byDate.set(key, h);
      }
    });
    return Array.from(byDate.values()).sort(
      (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
    );
  }, [weightsStatsExercise, exerciseHistoryMap]);

  const weightStats = useMemo(() => {
    if (!weightsStatsExercise) return [];
    if (!weightHistoryList.length) return [];
    const chron = weightHistoryList
      .slice()
      .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
    const last = chron.slice(-7);
    const mapped = last.map((h) => {
      const date = new Date(h.recordedAt);
      const v = parseWeightValue(h.value);
      return {
        label: formatDateShort(date),
        value: Number.isFinite(v) ? v : 0,
        date,
        hasValue: Number.isFinite(v),
      };
    });
    if (mapped.length >= 7) return mapped;
    const padding = Array.from({ length: 7 - mapped.length }, () => ({
      label: "",
      value: 0,
      date: null as Date | null,
      hasValue: false,
    }));
    return [...mapped, ...padding];
  }, [weightsStatsExercise, weightHistoryList]);

  const saveStatsWeight = useCallback(async () => {
    if (!clientId || !weightsStatsExercise) return;
    const value = draftStatsWeight.trim();
    if (!value) {
      setStatsWeightError(tr("Укажите рабочий вес.", "Enter the working weight."));
      return;
    }
    const list = exercises ? [...exercises] : [];
    const next = list.map((item) => (item.id === weightsStatsExercise.id ? { ...item, weight: value } : item));
    setExercises(next);
    setWeightsStatsExercise((prev) => (prev ? { ...prev, weight: value } : prev));
    const updated = await onSaveExercises?.(clientId, next);
    if (updated?.exercises) {
      setExercises(updated.exercises);
      const updatedExercise = updated.exercises.find((ex) => ex.id === weightsStatsExercise.id);
      if (updatedExercise) {
        setWeightsStatsExercise(updatedExercise);
      }
    }
    if (value.trim() !== String(weightsStatsExercise.weight || "").trim()) {
      const entry: ExerciseHistoryItem = {
        id: `local_${cryptoId()}`,
        value: value.trim(),
        recordedAt: new Date().toISOString(),
      };
      setExerciseHistoryMap((prev) => {
        const prevList = prev[weightsStatsExercise.id] ? [...prev[weightsStatsExercise.id]] : [];
        return { ...prev, [weightsStatsExercise.id]: [...prevList, entry] };
      });
    }
  }, [clientId, draftStatsWeight, exercises, onSaveExercises, setExercises, tr, weightsStatsExercise]);

  const body = (
    <>
      <button
        type="button"
        style={styles.addWindowBtn}
        onClick={() => {
          setShowExerciseForm(true);
        }}
      >
        {tr("Добавить упражнение", "Add exercise")}
      </button>
      {showExerciseForm ? (
        <div style={styles.exerciseFormOverlay}>
          <button
            type="button"
            aria-label="close add exercise"
            style={styles.exerciseFormBackdrop}
            onClick={() => setShowExerciseForm(false)}
          />
          <div style={styles.exerciseFormSheet}>
            <div style={styles.exerciseFormHandle} />
            <div style={styles.exerciseFormHeader}>
              <div style={styles.exerciseFormTitle}>{tr("Новое упражнение", "New exercise")}</div>
              <button
                type="button"
                style={styles.exerciseFormCloseBtn}
                onClick={() => setShowExerciseForm(false)}
              >
                {tr("Закрыть", "Close")}
              </button>
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={styles.exerciseFormLabel}>{tr("Название упражнения", "Exercise name")}</div>
              <input
                value={draftExerciseName}
                onChange={(e) => {
                  setDraftExerciseName(e.target.value);
                  if (exerciseError) setExerciseError("");
                }}
                placeholder={tr("Например: Жим лёжа", "e.g., Bench press")}
                style={styles.exerciseFormInput}
              />
              <div style={{ marginTop: 12 }}>
                <div style={styles.exerciseFormLabel}>{tr("Вес", "Weight")}</div>
                <input
                  value={draftExerciseWeight}
                  onChange={(e) => {
                    setDraftExerciseWeight(e.target.value);
                    if (exerciseError) setExerciseError("");
                  }}
                  placeholder={tr("Например: 60 кг", "e.g., 60 kg")}
                  style={styles.exerciseFormInput}
                />
              </div>
              {exerciseError ? <div style={styles.errorText}>{exerciseError}</div> : null}
              <button
                type="button"
                onClick={async () => {
                  if (!clientId || !onSaveExercises) {
                    setExerciseError(tr("Нет доступного тренера.", "No available coach."));
                    return;
                  }
                  const name = draftExerciseName.trim();
                  const weight = draftExerciseWeight.trim();
                  if (!name || !weight) {
                    setExerciseError(tr("Заполни название и вес упражнения.", "Enter the exercise name and weight."));
                    return;
                  }
                  const list = exercises ? [...exercises] : [];
                  const next = [...list, { id: localExerciseId(), name, weight }];
                  setExercises(next);
                  const updated = await onSaveExercises?.(clientId, next);
                  if (updated?.exercises) {
                    setExercises(updated.exercises);
                  }
                  setDraftExerciseName("");
                  setDraftExerciseWeight("");
                  setShowExerciseForm(false);
                  setExerciseError("");
                }}
                style={styles.exerciseFormSaveBtn}
              >
                {tr("Сохранить", "Save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {exercises && exercises.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <div style={styles.sectionHeaderSmall}>{tr("Список упражнений", "Exercises list")}</div>
          <div style={styles.exerciseListBlock}>
            {exercises.map((ex, idx) => {
              const isLast = idx === exercises.length - 1;
              return (
                <div
                  key={ex.id}
                  style={{
                    ...styles.exerciseCard,
                    borderBottom: isLast ? "none" : "1px solid var(--border-2)",
                    padding: "12px 0",
                  }}
                  onClick={() => {
                    setWeightsStatsExercise(ex);
                    setWeightsStatsOpen(true);
                    void ensureExerciseHistory(ex.id);
                  }}
                >
                  <div style={styles.exerciseRow}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.exerciseTitle}>{ex.name || tr("Без названия", "Untitled")}</div>
                      <div style={styles.exerciseWeightRow}>
                        <div style={styles.exerciseSubtitle}>
                          {tr("Текущий рабочий вес:", "Current working weight:")}{" "}
                          {ex.weight?.trim() ? ex.weight : tr("не указан", "not set")}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 12, opacity: 0.7, fontSize: 14 }}>
          {tr("Пока нет рабочих весов.", "No working weights yet.")}
        </div>
      )}

      {weightsStatsOpen ? (
        <div style={styles.weightsStatsOverlay}>
          <button
            type="button"
            aria-label="close weights stats"
            style={styles.weightsStatsBackdrop}
            onClick={() => setWeightsStatsOpen(false)}
          />
          <div ref={statsSheetRef} style={styles.weightsStatsSheet}>
            <div style={styles.weightsStatsHandle} />
            <div style={styles.weightsStatsHeader}>
              <div style={styles.weightsStatsTitle}>
                {weightsStatsExercise?.name || tr("Рабочие веса", "Working weights")}
              </div>
              <button
                type="button"
                style={styles.weightsStatsCloseBtn}
                onClick={() => setWeightsStatsOpen(false)}
              >
                {tr("Закрыть", "Close")}
              </button>
            </div>
            <div style={styles.weightsStatsChart}>
              {(() => {
                if (weightStats.length === 0) return null;
                const values = weightStats.filter((p) => p.hasValue).map((p) => p.value);
                const hasValues = values.length > 0;
                const min = hasValues ? Math.min(...values) : 0;
                const max = hasValues ? Math.max(...values) : 1;
                const range = Math.max(1, max - min);
                const width = 320;
                const height = 120;
                const padX = 8;
                const padY = 12;
                const step = (width - padX * 2) / (weightStats.length - 1 || 1);
                const lastValue = hasValues ? values[values.length - 1] : 0;
                const points = weightStats.map((p, idx) => {
                  const x = padX + step * idx;
                  const effectiveValue = p.hasValue ? p.value : hasValues ? lastValue : min;
                  const y = padY + (1 - (effectiveValue - min) / range) * (height - padY * 2);
                  return { x, y, value: p.value, hasValue: p.hasValue };
                });
                const d = points.map((p) => `${p.x},${p.y}`).join(" ");
                return (
                  <div style={styles.weightsStatsLineWrap}>
                    <svg
                      viewBox={`0 0 ${width} ${height}`}
                      width="100%"
                      height="120"
                      role="img"
                      aria-label={tr("График динамики за 7 изменений", "7-change progress chart")}
                    >
                      <polyline
                        points={d}
                        fill="none"
                        stroke="#1F6BFF"
                        strokeWidth="3"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                      {points.map((p, idx) => (
                        <circle
                          key={idx}
                          cx={p.x}
                          cy={p.y}
                          r="4"
                          fill={p.hasValue ? "#1F6BFF" : "var(--border)"}
                          stroke="#fff"
                          strokeWidth="2"
                        />
                      ))}
                    </svg>
                    <div style={styles.weightsStatsLineAxis}>
                      {weightStats.map((p, idx) => (
                        <div key={`${p.label}-${idx}`} style={styles.weightsStatsLineAxisLabel}>
                          {p.label || "dd.mm"}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={styles.weightInlineRow}>
                <div style={styles.fieldLabel}>{tr("Изменить рабочий вес:", "Update working weight:")}</div>
                <div style={styles.weightInlineControls}>
                  <input
                    ref={statsWeightInputRef}
                    inputMode="decimal"
                    pattern="[0-9.,]*"
                    enterKeyHint="done"
                    value={draftStatsWeight}
                    onChange={(e) => {
                      setDraftStatsWeight(e.target.value.replace(/[^0-9.,]/g, ""));
                      if (statsWeightError) setStatsWeightError("");
                    }}
                    onFocus={() => {
                      const el = statsWeightInputRef.current;
                      if (!el) return;
                      window.setTimeout(() => {
                        el.scrollIntoView({ block: "start", behavior: "smooth" });
                      }, 100);
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.currentTarget.blur();
                      void saveStatsWeight();
                    }}
                    placeholder={tr("Вес", "Weight")}
                    style={styles.weightInlineInput}
                  />
                  <button
                    type="button"
                    style={styles.weightInlineSaveBtn}
                    onClick={() => void saveStatsWeight()}
                    aria-label={tr("Сохранить", "Save")}
                    title={tr("Сохранить", "Save")}
                  >
                    ✓
                  </button>
                </div>
              </div>
              {statsWeightError ? <div style={styles.errorText}>{statsWeightError}</div> : null}
            </div>
            <div style={styles.weightsStatsList}>
              {weightHistoryList.length === 0 ? (
                <div style={styles.weightsStatsEmpty}>
                  {tr("Пока нет изменений веса.", "No weight changes yet.")}
                </div>
              ) : (
                weightHistoryList.map((item) => {
                  const label = formatDateShort(new Date(item.recordedAt));
                  const value = parseWeightValue(item.value);
                  return (
                    <div key={item.id} style={styles.weightsStatsListRow}>
                      <div style={styles.weightsStatsListLabel}>{label}</div>
                      <div style={styles.weightsStatsListValue}>
                        {Number.isFinite(value) ? `${value} кг` : "—"}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <button
              type="button"
              style={{ ...styles.saveBtn, ...styles.dangerBtn, marginTop: 16 }}
              onClick={async () => {
                if (!clientId || !weightsStatsExercise) return;
                const message = tr("Удалить упражнение?", "Delete exercise?");
                const doDelete = async () => {
                  const next = (exercises || []).filter((x) => x.id !== weightsStatsExercise.id);
                  setExercises(next);
                  const updated = await onSaveExercises?.(clientId, next);
                  if (updated?.exercises) {
                    setExercises(updated.exercises);
                  }
                  setWeightsStatsOpen(false);
                };
                if (typeof WebApp?.showConfirm === "function") {
                  WebApp.showConfirm(message, (yes) => {
                    if (yes) void doDelete();
                  });
                  return;
                }
                if (window.confirm(message)) void doDelete();
              }}
            >
              {tr("Удалить упражнение", "Delete exercise")}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );

  return embedded ? body : <div style={styles.clientPanelPlain}>{body}</div>;
}

function ClientDetailScreen(props: {
  client: TrainerClientInvite | null;
  onBack: () => void;
  onUpdateClient: (id: string, patch: Partial<TrainerClientInvite>) => void;
  sessionsByDate: Record<string, SessionItem[]>;
  setSessionsByDate: React.Dispatch<React.SetStateAction<Record<string, SessionItem[]>>>;
  token: string;
  apiBase: string;
  trainerTgUserId: string;
  onToggleArchive: (client: TrainerClientInvite, nextArchived: boolean) => void;
  onDeleteClient: (client: TrainerClientInvite) => void;
  history: SessionItem[];
  onSaveExercises?: (
    clientId: string,
    exercises: { id: string; name: string; weight: string }[]
  ) => Promise<TrainerClientInvite | null> | void;
}) {
  const { client, onBack, onUpdateClient, onToggleArchive, onDeleteClient, history, onSaveExercises } = props;
  const { sessionsByDate, setSessionsByDate, token, apiBase } = props;
  const tr = useTr();
  const language = React.useContext(LanguageContext);
  const [tab, setTab] = useState<"info" | "subscription" | "weights" | "history">("info");
  const showOnlyInfo = client?.status === "pending";
  const visibleTab = showOnlyInfo ? "info" : tab;
  const [draftFullName, setDraftFullName] = useState("");
  const [draftHeight, setDraftHeight] = useState("");
  const [draftWeight, setDraftWeight] = useState("");
  const [draftGender, setDraftGender] = useState("");
  const [draftGoal, setDraftGoal] = useState("");
  const [draftComment, setDraftComment] = useState("");
  const [draftSubStart, setDraftSubStart] = useState("");
  const [draftSubEnd, setDraftSubEnd] = useState("");
  const [draftSubPrice, setDraftSubPrice] = useState("");
  const [draftSubTotal, setDraftSubTotal] = useState("");
  const [draftSubLeft, setDraftSubLeft] = useState("");
  const [draftSubEnabled, setDraftSubEnabled] = useState(false);
  const [subscriptionCreateError, setSubscriptionCreateError] = useState("");
  const [draftContactPhone, setDraftContactPhone] = useState("");
  const [draftContactInstagram, setDraftContactInstagram] = useState("");
  const [draftContactOtherSocial, setDraftContactOtherSocial] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleSelected, setScheduleSelected] = useState<Date>(() => startOfDay(new Date()));
  const [scheduleStart, setScheduleStart] = useState("12:30");
  const [scheduleEnd, setScheduleEnd] = useState("13:30");
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleDragY, setScheduleDragY] = useState(0);
  const [scheduleDragging, setScheduleDragging] = useState(false);
  const [selectedSubscriptionHistory, setSelectedSubscriptionHistory] = useState<SubscriptionHistoryItem | null>(null);
  const scheduleDragStartRef = useRef<number>(0);
  const scheduleDragYRef = useRef<number>(0);
  const isLocalClient = Boolean(client?.isLocal || (client?.username || "").startsWith("local_"));
  const goalRef = React.useRef<HTMLTextAreaElement | null>(null);
  const commentRef = React.useRef<HTMLTextAreaElement | null>(null);
  const addHourToTime = useCallback((value: string) => {
    const normalized = normalizeTimeInput(value);
    if (!normalized) return "";
    const nextMinutes = (timeToMinutes(normalized) + 60) % (24 * 60);
    const hours = Math.floor(nextMinutes / 60);
    const minutes = nextMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }, []);
  const formatMonthShort = useCallback(
    (d: Date) => {
      if (language === "en") {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return months[d.getMonth()];
      }
      const months = ["янв", "фев", "март", "апр", "май", "июнь", "июль", "авг", "сент", "окт", "ноя", "дек"];
      const raw = months[d.getMonth()];
      return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : raw;
    },
    [language]
  );
  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, idx) => ({
        value: idx,
        label: formatMonthShort(new Date(2024, idx, 1)),
      })),
    [formatMonthShort]
  );

  useEffect(() => {
    setDraftFullName(client?.fullName ?? "");
    setDraftHeight(client?.height ?? "");
    setDraftWeight(client?.weight ?? "");
    setDraftGender(client?.gender ?? "");
    setDraftGoal(client?.goal ?? "");
    setDraftComment(client?.comment ?? "");
    setDraftSubStart(client?.subscriptionStart ?? "");
    setDraftSubEnd(client?.subscriptionEnd ?? "");
    setDraftSubPrice(client?.subscriptionPrice ?? "");
    setDraftSubTotal(client?.subscriptionTotal ?? "");
    setDraftSubLeft(client?.subscriptionLeft ?? "");
    setDraftSubEnabled(
      typeof client?.subscriptionEnabled === "boolean"
        ? client.subscriptionEnabled
        : Boolean(
            client?.subscriptionStart ||
              client?.subscriptionEnd ||
              client?.subscriptionPrice ||
              client?.subscriptionTotal ||
              client?.subscriptionLeft
          )
    );
    setDraftContactPhone(client?.contactPhone ?? "");
    setDraftContactInstagram(client?.contactInstagram ?? "");
    setDraftContactOtherSocial(client?.contactOtherSocial ?? "");
    if (client?.status === "pending") setTab("info");
  }, [
    client?.id,
    client?.goal,
    client?.comment,
    client?.height,
    client?.weight,
    client?.fullName,
    client?.subscriptionStart,
    client?.subscriptionEnd,
    client?.subscriptionPrice,
    client?.subscriptionTotal,
    client?.subscriptionLeft,
    client?.subscriptionEnabled,
    client?.contactPhone,
    client?.contactInstagram,
    client?.contactOtherSocial,
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

  useEffect(() => {
    if (!scheduleOpen) return;
    setScheduleError("");
    setScheduleSaving(false);
  }, [scheduleOpen]);

  useEffect(() => {
    if (!scheduleDragging) return;
    const handleMove = (event: PointerEvent) => {
      const next = Math.max(0, event.clientY - scheduleDragStartRef.current);
      scheduleDragYRef.current = next;
      setScheduleDragY(next);
    };
    const handleUp = () => {
      setScheduleDragging(false);
      const shouldClose = scheduleDragYRef.current > 120;
      if (shouldClose) {
        setScheduleOpen(false);
      }
      scheduleDragYRef.current = 0;
      setScheduleDragY(0);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [scheduleDragging]);

  const clientSubscriptionInfo = useMemo(
    () => getClientSubscriptionBookingInfo(client, Object.values(sessionsByDate).flat()),
    [client, sessionsByDate]
  );
  const subscriptionSheetSessions = useMemo(
    () =>
      selectedSubscriptionHistory
        ? getSubscriptionSessionDetails(selectedSubscriptionHistory, history, tr)
        : [],
    [selectedSubscriptionHistory, history, tr]
  );

  const maybeCloseSchedule = (planned: boolean) => {
    setScheduleOpen(false);
    if (!planned) return;
    try {
      WebApp?.showPopup?.({
        title: tr("Тренировка запланирована", "Session scheduled"),
        message: tr("Отображается в расписании", "Visible in the schedule"),
        buttons: [{ type: "ok" }],
      });
    } catch {
      // ignore
    }
  };

  const renderReadOnly = (label: string, value?: string) => (
    <div style={{ marginTop: 14 }}>
      <div style={styles.clientDetailFieldLabel}>{label}</div>
      <div style={styles.clientDetailValueBox}>{value && String(value).trim() ? value : "—"}</div>
    </div>
  );


  const saveLocalClientField = (
    field:
      | "fullName"
      | "gender"
      | "height"
      | "weight"
      | "goal"
      | "comment"
      | "contactTelegram"
      | "contactPhone"
      | "contactInstagram"
      | "contactOtherSocial",
    value: string
  ) => {
    if (!client) return;
    const current = (client as any)?.[field] ?? "";
    if (String(current || "").trim() === String(value || "").trim()) return;
    onUpdateClient(client.id, { [field]: value } as Partial<TrainerClientInvite>);
  };

  const toISODate = (dmy: string) => {
    const parsed = parseDateDMY(dmy);
    if (!parsed) return "";
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const fromISODate = (iso: string) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    if (!y || !m || !d) return "";
    return `${d}.${m}.${y}`;
  };

  const saveSubscriptionField = (
    field:
      | "subscriptionEnabled"
      | "subscriptionStart"
      | "subscriptionEnd"
      | "subscriptionPrice"
      | "subscriptionTotal"
      | "subscriptionLeft"
      | "activeSubscriptionHistoryId"
      | "subscriptionHistory",
    value: string | boolean | SubscriptionHistoryItem[]
  ) => {
    if (!client) return;
    const current = (client as any)?.[field] ?? "";
    if (typeof value === "boolean") {
      if (Boolean(current) === value) return;
    } else if (Array.isArray(value)) {
      if (stableStringify(current || []) === stableStringify(value)) return;
    } else if (String(current || "").trim() === String(value || "").trim()) {
      return;
    }
    onUpdateClient(client.id, { [field]: value } as Partial<TrainerClientInvite>);
  };

  const subscriptionHistory = client?.subscriptionHistory || [];
  const handleSubscriptionModeToggle = () => {
    if (!client) return;
    if (!draftSubEnabled) {
      setDraftSubEnabled(true);
      saveSubscriptionField("subscriptionEnabled", true);
      return;
    }
    const message = tr(
      "Выход из режима абонемента приведет к обнулению текущего абонемента.",
      "Leaving subscription mode will reset the current subscription."
    );
    const disableMode = () => {
      setDraftSubEnabled(false);
      setDraftSubStart("");
      setDraftSubEnd("");
      setDraftSubPrice("");
      setDraftSubTotal("");
      setDraftSubLeft("");
      onUpdateClient(client.id, {
        subscriptionEnabled: false,
        subscriptionStart: "",
        subscriptionEnd: "",
        subscriptionPrice: "",
        subscriptionTotal: "",
        subscriptionLeft: "",
        activeSubscriptionHistoryId: "",
      });
    };
    if (typeof WebApp?.showConfirm === "function") {
      WebApp.showConfirm(message, (yes) => {
        if (yes) disableMode();
      });
      return;
    }
    if (window.confirm(message)) disableMode();
  };
  const handleCreateSubscription = () => {
    if (!client) return;
    const start = draftSubStart.trim();
    const end = draftSubEnd.trim();
    const price = normalizePriceRUB(draftSubPrice);
    const total = (draftSubTotal || "").trim();
    const missing: string[] = [];
    if (!start) missing.push(tr("дату начала", "start date"));
    if (!end) missing.push(tr("дату завершения", "end date"));
    if (!price) missing.push(tr("стоимость тренировки", "session price"));
    if (!total) missing.push(tr("количество занятий", "sessions count"));
    if (missing.length) {
      setSubscriptionCreateError(
        `${tr("Необходимо заполнить", "Please fill in")} ${missing.join(", ")}.`
      );
      return;
    }
    const startDate = parseDateDMY(start);
    const endDate = parseDateDMY(end);
    if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
      setSubscriptionCreateError(
        tr(
          "Дата завершения не может быть раньше даты начала.",
          "End date cannot be earlier than start date."
        )
      );
      return;
    }
    setSubscriptionCreateError("");
    setDraftSubPrice(price);
    setDraftSubLeft(total);
    const nextHistory: SubscriptionHistoryItem[] = [
      {
        id: cryptoId(),
        purchasedAt: formatDateShort(new Date()),
        price,
        total,
        start,
        end,
      },
      ...(client.subscriptionHistory || []),
    ];
    onUpdateClient(client.id, {
      subscriptionEnabled: true,
      subscriptionStart: start,
      subscriptionEnd: end,
      subscriptionPrice: price,
      subscriptionTotal: total,
      subscriptionLeft: total,
      activeSubscriptionHistoryId: nextHistory[0].id,
      subscriptionHistory: nextHistory,
    });
  };

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
        <div style={{ width: 36 }} />
      </div>

      <div style={styles.clientDetailHeaderCard}>
        <AvatarCircle name={client?.username || tr("Клиент", "Client")} photoUrl={client?.photoUrl || ""} size={52} />
        <div style={{ minWidth: 0 }}>
          <div style={styles.clientDetailName}>
            {client?.fullName?.trim()
              ? client.fullName
              : client?.username
                ? `@${client.username}`
                : tr("Клиент", "Client")}
          </div>
          <div style={styles.clientDetailStatus}>
            {client?.status === "active" ? tr("Активен", "Active") : tr("Ожидает активации", "Pending activation")}
          </div>
        </div>
      </div>

      <div style={styles.clientDetailActionWrap}>
        <button type="button" style={styles.clientDetailActionBtn} onClick={() => setScheduleOpen(true)}>
          {tr("Записать клиента на тренировку", "Schedule client for a session")}
        </button>
      </div>

      {scheduleOpen ? (
        <div style={styles.clientScheduleOverlay}>
          <button
            type="button"
            aria-label="close schedule"
            style={styles.clientScheduleBackdrop}
            onClick={() => setScheduleOpen(false)}
          />
          <div
            style={{
              ...styles.clientScheduleSheet,
              transform: scheduleDragY ? `translateY(${scheduleDragY}px)` : undefined,
              transition: scheduleDragging ? "none" : "transform 180ms ease",
            }}
          >
            <div
              style={styles.clientScheduleHandle}
              onPointerDown={(event) => {
                scheduleDragStartRef.current = event.clientY;
                scheduleDragYRef.current = 0;
                setScheduleDragging(true);
              }}
            />
            <div style={styles.clientScheduleTitleRow}>
              <div style={styles.clientScheduleTitle}>{tr("Запись на тренировку", "Schedule a session")}</div>
              <button type="button" onClick={() => setScheduleOpen(false)} style={styles.clientScheduleCloseBtn}>
                {tr("Закрыть", "Close")}
              </button>
            </div>

            <div style={styles.scheduleQuickFieldsGrid}>
              <div style={styles.scheduleQuickField}>
                <div style={styles.scheduleQuickLabel}>{tr("Месяц", "Month")}</div>
                <select
                  value={scheduleSelected.getMonth()}
                  onChange={(e) => {
                    const nextMonth = Number(e.target.value);
                    const year = scheduleSelected.getFullYear();
                    const day = Math.min(
                      scheduleSelected.getDate(),
                      new Date(year, nextMonth + 1, 0).getDate()
                    );
                    setScheduleSelected(new Date(year, nextMonth, day));
                    if (scheduleError) setScheduleError("");
                  }}
                  style={styles.scheduleQuickInput}
                >
                  {monthOptions.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.scheduleQuickField}>
                <div style={styles.scheduleQuickLabel}>{tr("Дата", "Date")}</div>
                <input
                  type="date"
                  value={formatDateInputValue(formatDateKey(scheduleSelected))}
                  onChange={(e) => {
                    const next = parseDateKey(e.target.value);
                    if (next) {
                      setScheduleSelected(next);
                      if (scheduleError) setScheduleError("");
                    }
                  }}
                  style={styles.scheduleQuickInput}
                />
              </div>
              <div style={styles.scheduleQuickField}>
                <div style={styles.scheduleQuickLabel}>{tr("Начало", "Start")}</div>
                <input
                  type="time"
                  value={scheduleStart}
                  onChange={(e) => {
                    const nextStart = e.target.value;
                    setScheduleStart(nextStart);
                    const nextEnd = addHourToTime(nextStart);
                    if (nextEnd) setScheduleEnd(nextEnd);
                    if (scheduleError) setScheduleError("");
                  }}
                  step={300}
                  style={styles.scheduleQuickInput}
                />
              </div>
              <div style={styles.scheduleQuickField}>
                <div style={styles.scheduleQuickLabel}>{tr("Конец", "End")}</div>
                <input
                  type="time"
                  value={scheduleEnd}
                  onChange={(e) => {
                    setScheduleEnd(e.target.value);
                    if (scheduleError) setScheduleError("");
                  }}
                  step={300}
                  style={styles.scheduleQuickInput}
                />
              </div>
              {scheduleError ? (
                <div style={{ ...styles.errorText, ...styles.scheduleQuickFieldFull }}>{scheduleError}</div>
              ) : null}
              <button
                type="button"
                style={{ ...styles.clientScheduleSaveBtn, ...styles.scheduleQuickFieldFull }}
                disabled={scheduleSaving}
                onClick={async () => {
                  if (scheduleSaving) return;
                  if (!client) return;
                  const start = normalizeTimeInput(scheduleStart);
                  const end = normalizeTimeInput(scheduleEnd);
                  const targetStartAt = new Date(scheduleSelected);
                  const [targetHours, targetMinutes] = start.split(":").map((value) => parseInt(value, 10));
                  if (!Number.isNaN(targetHours) && !Number.isNaN(targetMinutes)) {
                    targetStartAt.setHours(targetHours, targetMinutes, 0, 0);
                  }
                  if (!canScheduleClientOnDate([client], client.username, Object.values(sessionsByDate).flat(), targetStartAt)) {
                    setScheduleError(
                      tr(
                        "Нельзя создать тренировку: дата не входит в период абонемента или абонемент требует обновления.",
                        "Can't schedule session: the date is outside the subscription period or the subscription must be renewed."
                      )
                    );
                    return;
                  }
                  setScheduleSaving(true);
                  const dateKey = formatDateKey(scheduleSelected);
                  if (!start || !end) {
                    setScheduleError(tr("Укажите время в формате ЧЧ:ММ (например 10:00).", "Enter time in HH:MM (e.g., 10:00)."));
                    setScheduleSaving(false);
                    return;
                  }
                  if (end <= start) {
                    setScheduleError(tr("Время окончания должно быть больше времени начала.", "End time must be after start time."));
                    setScheduleSaving(false);
                    return;
                  }
                  const now = new Date();
                  const selectedDay = startOfDay(scheduleSelected);
                  const todayDay = startOfDay(now);
                  if (selectedDay.getTime() < todayDay.getTime()) {
                    setScheduleError(tr("Нельзя создавать тренировки в прошедших датах.", "You can't schedule sessions in past dates."));
                    setScheduleSaving(false);
                    return;
                  }
                  if (selectedDay.getTime() === todayDay.getTime()) {
                    const startMin = timeToMinutes(start);
                    const nowMin = now.getHours() * 60 + now.getMinutes();
                    if (startMin <= nowMin) {
                      setScheduleError(tr("Время начала должно быть позже текущего.", "Start time must be later than now."));
                      setScheduleSaving(false);
                      return;
                    }
                  }
                  const startMin = timeToMinutes(start);
                  const endMin = timeToMinutes(end);
                  const existingSessions = sessionsByDate[dateKey] || [];
                  const overlapsSession = existingSessions.some((s) => {
                    const sStart = timeToMinutes(s.start);
                    const sEnd = timeToMinutes(s.end);
                    return startMin < sEnd && endMin > sStart;
                  });
                  if (overlapsSession) {
                    setScheduleError(tr("На эту дату и время уже запланирована тренировка.", "A session is already scheduled for this date and time."));
                    setScheduleSaving(false);
                    return;
                  }
                  if (!token) {
                    setScheduleError(tr("Сначала войдите в аккаунт.", "Please login first."));
                    setScheduleSaving(false);
                    return;
                  }

                  try {
                    const res = await fetch(`${apiBase}/sessions`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                      body: JSON.stringify({
                        dateKey,
                        start,
                        end,
                        tzOffset: new Date().getTimezoneOffset(),
                        clientId: client.id,
                      }),
                    });
                    if (!res.ok) {
                      if (res.status === 409) {
                        setScheduleError(
                          tr("На эту дату и время уже запланирована тренировка.", "A session is already scheduled for this date and time.")
                        );
                      } else if (res.status === 404) {
                        setScheduleError(tr("Клиент не найден.", "Client not found."));
                      } else if (res.status === 403) {
                        setScheduleError(tr("Нельзя создать тренировку для этого клиента.", "You can't schedule this client."));
                      } else {
                        setScheduleError(tr("Не удалось создать тренировку.", "Failed to create session."));
                      }
                      setScheduleSaving(false);
                      return;
                    }
                    const data = (await res.json()) as { ok: boolean; session?: any };
                    if (!data?.session) {
                      throw new Error("session missing");
                    }
                    const mapped = mapSessionFromApi(data.session);
                    setSessionsByDate((prev) => {
                      const list = prev[mapped.dateKey] ? [...prev[mapped.dateKey]] : [];
                      list.push(mapped);
                      return { ...prev, [mapped.dateKey]: list };
                    });
                    setScheduleSaving(false);
                    maybeCloseSchedule(true);
                  } catch {
                    setScheduleSaving(false);
                    setScheduleError(tr("Не удалось создать тренировку.", "Failed to create session."));
                  }
                }}
              >
                {tr("Добавить", "Add")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div style={styles.clientDetailTabsScroll}>
        <div style={styles.trainerClientTabsWrap}>
          <button
            type="button"
            onClick={() => setTab("info")}
            style={{
              ...styles.clientDetailTab,
              ...styles.trainerClientTabButton,
              ...(visibleTab === "info" ? styles.clientDetailTabActive : null),
            }}
          >
            {tr("Информация о клиенте", "Client info")}
          </button>
          {!showOnlyInfo ? (
            <>
              <button
                type="button"
                onClick={() => setTab("subscription")}
                style={{
                  ...styles.clientDetailTab,
                  ...styles.trainerClientTabButton,
                  ...(visibleTab === "subscription" ? styles.clientDetailTabActive : null),
                }}
              >
                {tr("Информация об абонементе", "Subscription info")}
              </button>
              <button
                type="button"
                onClick={() => setTab("weights")}
                style={{
                  ...styles.clientDetailTab,
                  ...styles.trainerClientTabButton,
                  ...(visibleTab === "weights" ? styles.clientDetailTabActive : null),
                }}
              >
                {tr("Статистика упражнений", "Exercise stats")}
              </button>
              <button
                type="button"
                onClick={() => setTab("history")}
                style={{
                  ...styles.clientDetailTab,
                  ...styles.trainerClientTabButton,
                  ...(visibleTab === "history" ? styles.clientDetailTabActive : null),
                }}
              >
                {tr("История тренировок", "Training history")}
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div style={styles.clientDetailTabsDivider} />

      {visibleTab === "info" ? (
        <div style={styles.clientPanelPlain}>
          {isLocalClient ? (
            <div style={{ marginTop: 16 }}>
              <div style={styles.clientDetailFieldLabel}>{tr("ФИО клиента", "Client full name")}</div>
              <input
                value={draftFullName}
                onChange={(e) => setDraftFullName(e.target.value)}
                onBlur={() => saveLocalClientField("fullName", draftFullName)}
                placeholder={tr("Введите ФИО", "Enter full name")}
                style={styles.clientDetailInput}
              />
            </div>
          ) : (
            renderReadOnly(tr("ФИО клиента", "Client full name"), client?.fullName)
          )}
          <div style={{ marginTop: 16 }}>
            <div style={styles.clientDetailFieldLabel}>Username</div>
            <div style={styles.clientDetailValueBox}>
              {isLocalClient ? "—" : client?.username ? `@${client.username}` : "—"}
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={styles.clientDetailFieldLabel}>{tr("Инвайт‑код", "Invite code")}</div>
            {isLocalClient ? (
              <div style={styles.clientDetailValueBox}>—</div>
            ) : (
              <div style={styles.clientDetailCopyRow}>
                <div style={styles.clientDetailValueBox}>{client?.code || "—"}</div>
                <button
                  type="button"
                  onClick={() => {
                    if (!client?.code) return;
                    copyText(client.code);
                    WebApp?.showPopup?.({
                      title: tr("Код скопирован", "Code copied"),
                      message: tr(
                        `Код для @${client.username}: ${client.code}`,
                        `Code for @${client.username}: ${client.code}`
                      ),
                      buttons: [{ type: "ok" }],
                    });
                  }}
                  style={styles.clientDetailCopyBtn}
                  aria-label="copy invite code"
                >
                  <IconCopy />
                  <span style={{ fontSize: 13 }}>{tr("Копировать", "Copy")}</span>
                </button>
              </div>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={styles.clientDetailFieldLabel}>{tr("Пол", "Gender")}</div>
            {isLocalClient ? (
              <select
                value={draftGender}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraftGender(v);
                  saveLocalClientField("gender", v);
                }}
                style={styles.clientDetailInput}
              >
                <option value="">{tr("Не выбран", "Not selected")}</option>
                <option value="male">{tr("Мужской", "Male")}</option>
                <option value="female">{tr("Женский", "Female")}</option>
              </select>
            ) : (
              <div style={styles.clientDetailValueBox}>
                {client?.gender === "male"
                  ? tr("Мужской", "Male")
                  : client?.gender === "female"
                    ? tr("Женский", "Female")
                    : "—"}
              </div>
            )}
          </div>

          <div style={styles.metricsRow}>
            <div style={{ flex: 1 }}>
              <div style={styles.clientDetailFieldLabel}>{tr("Рост", "Height")}</div>
              {isLocalClient ? (
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={draftHeight}
                  onChange={(e) => setDraftHeight(e.target.value.replace(/[^\d]/g, ""))}
                  onBlur={() => {
                    const v = normalizeNumberWithUnit(draftHeight, "см");
                    if (v) setDraftHeight(v);
                    saveLocalClientField("height", v);
                  }}
                  placeholder={tr("см", "cm")}
                  style={styles.clientDetailInput}
                />
              ) : (
                <div style={styles.clientDetailValueBox}>
                  {client?.height && String(client.height).trim() ? client.height : "—"}
                </div>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={styles.clientDetailFieldLabel}>{tr("Вес", "Weight")}</div>
              {isLocalClient ? (
                <input
                  inputMode="decimal"
                  pattern="[0-9.,]*"
                  value={draftWeight}
                  onChange={(e) => setDraftWeight(e.target.value.replace(/[^0-9.,]/g, ""))}
                  onBlur={() => {
                    const v = normalizeNumberWithUnit(draftWeight, "кг");
                    if (v) setDraftWeight(v);
                    saveLocalClientField("weight", v);
                  }}
                  placeholder={tr("кг", "kg")}
                  style={styles.clientDetailInput}
                />
              ) : (
                <div style={styles.clientDetailValueBox}>
                  {client?.weight && String(client.weight).trim() ? client.weight : "—"}
                </div>
              )}
            </div>
          </div>

          {isLocalClient ? (
            <>
              <div style={{ marginTop: 16 }}>
                <div style={styles.clientDetailFieldLabel}>{tr("Цель", "Goal")}</div>
                <textarea
                  ref={goalRef}
                  value={draftGoal}
                  onChange={(e) => setDraftGoal(e.target.value)}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = "auto";
                    el.style.height = `${el.scrollHeight}px`;
                  }}
                  onBlur={() => saveLocalClientField("goal", draftGoal)}
                  placeholder={tr("Цель", "Goal")}
                  rows={1}
                  style={styles.clientDetailTextarea}
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={styles.clientDetailFieldLabel}>{tr("Комментарии", "Comments")}</div>
                <textarea
                  ref={commentRef}
                  value={draftComment}
                  onChange={(e) => setDraftComment(e.target.value)}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = "auto";
                    el.style.height = `${el.scrollHeight}px`;
                  }}
                  onBlur={() => saveLocalClientField("comment", draftComment)}
                  placeholder={tr("Комментарий", "Comment")}
                  rows={1}
                  style={styles.clientDetailTextarea}
                />
              </div>
              <div style={{ ...styles.clientDetailTabsDivider, marginTop: 16 }} />
            </>
          ) : (
            <>
              {renderReadOnly(tr("Цель", "Goal"), client?.goal)}
              {renderReadOnly(tr("Комментарии", "Comments"), client?.comment)}
              <div style={{ ...styles.clientDetailTabsDivider, marginTop: 16 }} />
              {renderReadOnly(tr("Номер телефона", "Phone number"), client?.clientProfile?.phone)}
              {renderReadOnly("Instagram", client?.clientProfile?.instagram)}
              {renderReadOnly(tr("Иная социальная сеть", "Other social network"), client?.clientProfile?.otherSocial)}
            </>
          )}
          {isLocalClient ? (
            <>
              <div style={{ marginTop: 16 }}>
                <div style={styles.clientDetailFieldLabel}>{tr("Номер телефона", "Phone number")}</div>
                <input
                  value={draftContactPhone}
                  onChange={(e) => setDraftContactPhone(e.target.value)}
                  onBlur={() => saveLocalClientField("contactPhone", draftContactPhone)}
                  placeholder={tr("Телефон", "Phone")}
                  style={styles.clientDetailInput}
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={styles.clientDetailFieldLabel}>Instagram</div>
                <input
                  value={draftContactInstagram}
                  onChange={(e) => setDraftContactInstagram(e.target.value)}
                  onBlur={() => saveLocalClientField("contactInstagram", draftContactInstagram)}
                  placeholder="Instagram"
                  style={styles.clientDetailInput}
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={styles.clientDetailFieldLabel}>{tr("Иная социальная сеть", "Other social network")}</div>
                <input
                  value={draftContactOtherSocial}
                  onChange={(e) => setDraftContactOtherSocial(e.target.value)}
                  onBlur={() => saveLocalClientField("contactOtherSocial", draftContactOtherSocial)}
                  placeholder={tr("Ссылка или ник", "Link or handle")}
                  style={styles.clientDetailInput}
                />
              </div>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => {
              if (!client) return;
              const nextArchived = !client.archived;
              const message = nextArchived
                ? tr("Переместить клиента в архив?", "Move client to archive?")
                : tr("Разархивировать клиента?", "Unarchive client?");
              const doToggle = () => {
                onToggleArchive(client, nextArchived);
              };
              if (typeof WebApp?.showConfirm === "function") {
                WebApp.showConfirm(message, (yes) => {
                  if (yes) doToggle();
                });
                return;
              }
              if (window.confirm(message)) doToggle();
            }}
            style={
              client?.archived
                ? styles.archiveActionBtn
                : { ...styles.archiveActionBtn, ...styles.archiveActionDangerBtn }
            }
          >
            {client?.archived ? tr("Разархивировать", "Unarchive") : tr("Архивировать", "Archive")}
          </button>
          {client?.archived ? (
            <button
              type="button"
              onClick={() => {
                if (!client) return;
                const message = tr(
                  "Удалить клиента? Он будет отвязан от вашего профиля.",
                  "Delete client? They will be unlinked from your profile."
                );
                const doDelete = () => {
                  onDeleteClient(client);
                };
                if (typeof WebApp?.showConfirm === "function") {
                  WebApp.showConfirm(message, (yes) => {
                    if (yes) doDelete();
                  });
                  return;
                }
                if (window.confirm(message)) doDelete();
              }}
              style={{ ...styles.archiveActionBtn, ...styles.archiveActionDangerBtn, marginTop: 10 }}
            >
              {tr("Удалить клиента", "Delete client")}
            </button>
          ) : null}
        </div>
      ) : visibleTab === "subscription" ? (
        <div style={styles.clientPanelPlain}>
          <button type="button" style={styles.groupSlotToggle} onClick={handleSubscriptionModeToggle}>
            <span
              style={{
                ...styles.groupSlotCheckbox,
                ...(draftSubEnabled ? styles.groupSlotCheckboxActive : null),
              }}
            >
              {draftSubEnabled ? <IconCheck size={16} strokeWidth={2.4} /> : null}
            </span>
            <span style={styles.groupSlotToggleText}>
              {tr("Включить режим абонемента", "Enable subscription mode")}
            </span>
          </button>

          {draftSubEnabled ? (
            <>
              <div style={styles.metricsRow}>
                <div style={{ flex: 1 }}>
                  <div style={styles.clientDetailFieldLabel}>{tr("Дата начала", "Start date")}</div>
                  <input
                    type="date"
                    value={toISODate(draftSubStart)}
                    onChange={(e) => {
                      const next = fromISODate(e.target.value);
                      setDraftSubStart(next);
                      if (subscriptionCreateError) setSubscriptionCreateError("");
                    }}
                    style={styles.clientDetailInput}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={styles.clientDetailFieldLabel}>{tr("Дата завершения", "End date")}</div>
                  <input
                    type="date"
                    value={toISODate(draftSubEnd)}
                    onChange={(e) => {
                      const next = fromISODate(e.target.value);
                      setDraftSubEnd(next);
                      if (subscriptionCreateError) setSubscriptionCreateError("");
                    }}
                    style={styles.clientDetailInput}
                  />
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={styles.clientDetailFieldLabel}>{tr("Стоимость тренировки", "Session price")}</div>
                <div style={styles.inputRow}>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={draftSubPrice}
                    onChange={(e) => {
                      const value = normalizePriceRUBWithDelete(e.target.value, draftSubPrice);
                      setDraftSubPrice(value);
                      if (subscriptionCreateError) setSubscriptionCreateError("");
                    }}
                    placeholder={tr("Введите стоимость", "Enter price")}
                    style={{ ...styles.clientDetailInput, flex: 1 }}
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

              <div style={{ ...styles.metricsRow, marginTop: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.clientDetailFieldLabel}>{tr("Занятий в абонементе", "Sessions in subscription")}</div>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={draftSubTotal}
                    onChange={(e) => {
                      setDraftSubTotal(e.target.value.replace(/[^\d]/g, ""));
                      if (subscriptionCreateError) setSubscriptionCreateError("");
                    }}
                    placeholder={tr("Занятий", "Sessions")}
                    style={styles.clientDetailInput}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.clientDetailFieldLabel}>{tr("Занятий осталось", "Sessions left")}</div>
                  <div style={styles.clientDetailValueBox}>
                    {clientSubscriptionInfo.left !== null
                      ? String(clientSubscriptionInfo.left)
                      : draftSubLeft || client?.subscriptionLeft || "—"}
                  </div>
                </div>
              </div>
              <div style={styles.subscriptionCreateActionRow}>
                <button type="button" style={styles.subscriptionCreateBtn} onClick={handleCreateSubscription}>
                  {tr("Создать абонемент", "Create subscription")}
                </button>
              </div>
              {subscriptionCreateError ? <div style={styles.errorText}>{subscriptionCreateError}</div> : null}
            </>
          ) : null}

          <div style={styles.subscriptionHistoryDivider} />
          <div style={styles.subscriptionHistoryTitle}>{tr("История абонементов", "Subscription history")}</div>
          {subscriptionHistory.length ? (
            <div style={styles.subscriptionHistoryList}>
              {subscriptionHistory.map((item, idx) => {
                const meta = [
                  item.purchasedAt ? `${tr("Дата приобретения", "Purchase date")}: ${item.purchasedAt}` : "",
                  item.price ? `${tr("Стоимость тренировки", "Session price")}: ${item.price}` : "",
                  item.total ? `${tr("Количество занятий", "Sessions")}: ${item.total}` : "",
                  item.start ? `${tr("Дата начала", "Start date")}: ${item.start}` : "",
                  item.end ? `${tr("Дата завершения", "End date")}: ${item.end}` : "",
                ].filter(Boolean);
                return (
                  <button
                    key={item.id || `${idx}`}
                    type="button"
                    style={styles.subscriptionHistoryCardButton}
                    onClick={() => setSelectedSubscriptionHistory(item)}
                  >
                    <div style={styles.subscriptionHistoryCard}>
                    <div style={styles.subscriptionHistoryCardTitle}>
                      {tr("Абонемент", "Subscription")} #{subscriptionHistory.length - idx}
                    </div>
                    <div style={styles.subscriptionHistoryCardMeta}>{meta.join(", ")}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={styles.subscriptionHistoryEmpty}>
              {tr("Пока нет оформленных абонементов.", "No subscriptions yet.")}
            </div>
          )}
          {selectedSubscriptionHistory ? (
            <div style={styles.clientScheduleOverlay}>
              <button
                type="button"
                aria-label="close subscription history"
                style={styles.clientScheduleBackdrop}
                onClick={() => setSelectedSubscriptionHistory(null)}
              />
              <div style={{ ...styles.clientScheduleSheet, ...styles.subscriptionHistorySheet }}>
                <div style={styles.clientScheduleHandle} />
                <div style={styles.clientScheduleTitleRow}>
                  <div style={styles.clientScheduleTitle}>
                    {tr("Тренировки по абонементу", "Subscription sessions")}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedSubscriptionHistory(null)}
                    style={styles.clientScheduleCloseBtn}
                  >
                    {tr("Закрыть", "Close")}
                  </button>
                </div>
                <div style={styles.subscriptionHistorySheetMeta}>
                  {selectedSubscriptionHistory.start && selectedSubscriptionHistory.end
                    ? `${selectedSubscriptionHistory.start} — ${selectedSubscriptionHistory.end}`
                    : selectedSubscriptionHistory.purchasedAt}
                </div>
                {subscriptionSheetSessions.length ? (
                  <div style={styles.subscriptionHistorySheetList}>
                    {subscriptionSheetSessions.map((session) => (
                      <div key={session.id} style={styles.sessionHistoryCard}>
                        <div style={styles.sessionHistoryTitle}>{session.title}</div>
                        <div style={styles.sessionHistorySubtitle}>
                          {session.dateLabel} • {session.timeLabel}
                        </div>
                        <div style={styles.sessionHistorySubtitle}>{session.statusLabel}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={styles.subscriptionHistoryEmpty}>
                    {tr(
                      "Для этого абонемента пока нет тренировок.",
                      "There are no sessions for this subscription yet."
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : visibleTab === "history" ? (
        <div style={styles.clientPanelPlain}>
          {history.filter((s) => isSessionEnded(s, new Date())).length === 0 ? (
            <div style={styles.clientPanelBody}>{tr("Пока нет завершённых тренировок.", "No completed sessions yet.")}</div>
          ) : (
            <div style={styles.sessionHistoryList}>
              {history
                .filter((s) => isSessionEnded(s, new Date()))
                .slice()
                .sort((a, b) => {
                  const aEnd = sessionEndTime(a).getTime();
                  const bEnd = sessionEndTime(b).getTime();
                  return bEnd - aEnd;
                })
                .map((s) => (
                  <div key={s.id} style={styles.sessionHistoryCard}>
                    <div style={styles.sessionHistoryTitle}>{tr("Тренировка", "Session")}</div>
                    <div style={styles.sessionHistorySubtitle}>
                      {formatDateShort(parseDateKey(s.dateKey))} • {s.start} — {s.end}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      ) : (
        <ExerciseStatsPanel
          clientId={client?.id ?? null}
          exercises={client?.exercises || []}
          setExercises={(next) => {
            if (!client) return;
            onUpdateClient(client.id, { exercises: next });
          }}
          onSaveExercises={onSaveExercises}
          token={token}
          apiBase={apiBase}
        />
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
  reminderHours: number;
  setReminderHours: (v: number) => void;
  cancelWindowHours: number;
  setCancelWindowHours: (v: number) => void;
  t: UiText;
  trainerProfile?: TrainerProfile | null;
  onSaveTrainerProfile?: (patch: Partial<TrainerProfile>) => void;
  clientProfile?: ClientProfile | null;
  onSaveClientProfile?: (patch: Partial<ClientProfile>) => void;
  onSaveClientExercises?: (
    clientId: string,
    exercises: { id: string; name: string; weight: string }[]
  ) => Promise<TrainerClientInvite | null> | void;
  token?: string;
  apiBase?: string;
  personalShowSubscription?: boolean;
  personalShowMySubscription?: boolean;
  personalShowExtendedAbout?: boolean;
  personalShowClientBasics?: boolean;
  personalShowClientWeights?: boolean;
  showBookingRow?: boolean;
  showCancellationRow?: boolean;
  showPaymentsSection?: boolean;
  systemExtraRows?: React.ReactNode;
  aboutCardText?: string;
  subscriptionTabLabel?: string;
  subscriptionItems?: TrainerClientInvite[];
  trainerHistory?: SessionItem[];
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
    reminderHours,
    setReminderHours,
    cancelWindowHours,
    setCancelWindowHours,
    trainerProfile,
    onSaveTrainerProfile,
    clientProfile,
    onSaveClientProfile,
    onSaveClientExercises,
    token,
    apiBase,
    personalShowSubscription = true,
    personalShowMySubscription = false,
    personalShowExtendedAbout = true,
    personalShowClientBasics = false,
    personalShowClientWeights = false,
    showBookingRow = true,
    showCancellationRow = true,
    showPaymentsSection = true,
    systemExtraRows,
    subscriptionTabLabel,
    subscriptionItems,
    trainerHistory,
    onDeleteProfile,
  } = props;
  const tr = useTr();
  const resolvedSubscriptionTabLabel = subscriptionTabLabel ?? tr("Моя подписка", "My subscription");
  const [bookingMode, setBookingMode] = useState<"trainer" | "both">("trainer");

  useEffect(() => {
    if (trainerProfile?.bookingMode === "both" || trainerProfile?.bookingMode === "trainer") {
      setBookingMode(trainerProfile.bookingMode);
    }
  }, [trainerProfile?.bookingMode]);

  const handleBookingModeChange = (mode: "trainer" | "both") => {
    setBookingMode(mode);
    onSaveTrainerProfile?.({ bookingMode: mode });
  };
  const handleCancelWindowChange = (hours: number) => {
    setCancelWindowHours(hours);
    onSaveTrainerProfile?.({ cancelWindowHours: hours });
  };

  useEffect(() => {
    if (!showBookingRow && screen === "booking") {
      setScreen("main");
    }
  }, [showBookingRow, screen, setScreen]);

  useEffect(() => {
    if (!showCancellationRow && screen === "cancellation") {
      setScreen("main");
    }
  }, [showCancellationRow, screen, setScreen]);

  useEffect(() => {
    const scrollArea = document.querySelector("[data-scroll-area]") as HTMLElement | null;
    if (scrollArea) {
      scrollArea.scrollTo({ top: 0, behavior: "auto" });
      return;
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [screen]);

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
      showMySubscriptionTab={personalShowMySubscription}
      showExtendedAbout={personalShowExtendedAbout}
      showClientBasics={personalShowClientBasics}
      showClientWeights={personalShowClientWeights}
      subscriptionTabLabel={resolvedSubscriptionTabLabel}
      subscriptionItems={subscriptionItems}
      trainerHistory={trainerHistory}
      clientProfile={clientProfile}
      onSaveClientProfile={onSaveClientProfile}
      onSaveClientExercises={onSaveClientExercises}
      token={token}
      apiBase={apiBase}
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
        setBookingMode={handleBookingModeChange}
        t={t}
      />
    );
  }
  if (screen === "cancellation") {
    return (
      <CancellationWindowScreen
        onBack={() => setScreen("main")}
        value={cancelWindowHours}
        onChange={handleCancelWindowChange}
        language={language}
        t={t}
      />
    );
  }
  if (screen === "reminders") {
    return (
      <RemindersScreen
        onBack={() => setScreen("main")}
        value={reminderHours}
        onChange={setReminderHours}
        language={language}
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
  if (screen === "paymentHistory") {
    return <PaymentHistoryScreen onBack={() => setScreen("main")} />;
  }
  if (screen === "paymentMethods") {
    return <PaymentMethodsScreen onBack={() => setScreen("main")} />;
  }

  return (
    <div style={{ ...styles.pageContainer, ...styles.settingsPage }}>
      <div style={styles.settingsHero}>
        <div style={styles.settingsHeroCard}>
          <AvatarCircle name={name || username || tr("Пользователь", "User")} photoUrl={photoUrl} size={72} />
          <div style={{ minWidth: 0 }}>
            <div style={styles.settingsHeroName}>{name || tr("Пользователь", "User")}</div>
            <div style={styles.settingsHeroHandle}>{username ? `@${username}` : " "}</div>
            <div style={styles.settingsHeroRole}>{roleLabel}</div>
          </div>
        </div>
      </div>

      <button type="button" onClick={() => setScreen("personal")} style={styles.settingsPersonalRow}>
        <div style={styles.settingsPersonalLabel}>{tr("Личная информация", "Personal info")}</div>
        <div style={styles.settingsPersonalPlus}>+</div>
      </button>

      <div style={styles.settingsSectionLabel}>{t.settingsSystem}</div>
      <div style={styles.settingsGroup}>
        {showBookingRow ? (
          <SettingsRowGlass
            icon={<IconUsers />}
            title={t.settingsBooking}
            right={bookingMode === "both" ? t.bookingBoth : t.bookingTrainerOnly}
            onClick={() => setScreen("booking")}
          />
        ) : null}
        {showCancellationRow ? (
          <SettingsRowGlass
            icon={<IconClock />}
            title={t.settingsCancellationPolicy}
            right={formatCancellationLabel(cancelWindowHours, language, t)}
            onClick={() => setScreen("cancellation")}
          />
        ) : null}
        <SettingsRowGlass
          icon={<IconBell />}
          title={t.settingsReminders}
          right={formatReminderLabel(reminderHours, language, t)}
          onClick={() => setScreen("reminders")}
        />
        <SettingsRowGlass
          icon={<IconGlobe />}
          title={t.settingsLanguage}
          right={language === "en" ? t.languageEn : t.languageRu}
          onClick={() => setScreen("language")}
        />
        <SettingsRowGlass
          icon={<IconPalette />}
          title={t.settingsTheme}
          right={theme === "dark" ? t.themeDark : t.themeLight}
          onClick={() => setScreen("theme")}
          isLast
        />
        {systemExtraRows}
      </div>

      <div style={{ height: 18 }} />

      {showPaymentsSection ? (
        <>
          <div style={styles.settingsSectionLabel}>{t.settingsPayments}</div>
          <div style={styles.settingsGroup}>
            <SettingsRowGlass
              icon={<IconCard />}
              title={t.settingsPaymentMethods}
              onClick={() => setScreen("paymentMethods")}
            />
            <SettingsRowGlass
              icon={<IconHistory />}
              title={t.settingsPaymentHistory}
              onClick={() => setScreen("paymentHistory")}
              isLast
            />
          </div>

          <div style={{ height: 18 }} />
        </>
      ) : null}

      <div style={styles.settingsSectionLabel}>{t.settingsUseful}</div>
      <div style={styles.settingsGroup}>
        <SettingsRowGlass
          icon={<IconBox />}
          title={t.settingsHelp}
          onClick={() => {
            const helpUrl = "https://my-fitness-app.gitbook.io/my-fitness-app-docs/";
            if (typeof WebApp?.openLink === "function") {
              WebApp.openLink(helpUrl);
            } else {
              window.open(helpUrl, "_blank");
            }
          }}
        />
        <SettingsRowGlass
          icon={<IconSupport />}
          title={t.settingsSupport}
          onClick={() => alert(tr("Позже добавим поддержку", "Support will be added later."))}
        />
        <SettingsRowGlass
          icon={<IconLock />}
          title={t.settingsPrivacy}
          onClick={() => alert(tr("Позже добавим страницу политики", "Privacy policy page will be added later."))}
          isLast
        />
      </div>
      {onDeleteProfile ? (
        <button type="button" onClick={onDeleteProfile} style={styles.settingsDangerBtn}>
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
    <div style={{ ...styles.pageContainer, ...styles.bookingPage }}>
      <div style={styles.bookingHeader}>
        {typeof WebApp?.BackButton?.show === "function" ? null : (
          <button onClick={onBack} style={styles.backBtnInline} aria-label="back">
            <IconArrowLeft />
          </button>
        )}
        <div style={styles.bookingTitle}>{t.settingsTheme}</div>
      </div>
      <div style={styles.bookingOptionsRow}>
        <button
          type="button"
          onClick={() => setTheme("light")}
          style={{
            ...styles.bookingOptionCard,
            ...(theme === "light" ? styles.bookingOptionCardActive : null),
          }}
        >
          <span
            style={{
              ...styles.bookingOptionText,
              ...(theme === "light" ? styles.bookingOptionTextActive : null),
            }}
          >
            {t.themeLight}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTheme("dark")}
          style={{
            ...styles.bookingOptionCard,
            ...(theme === "dark" ? styles.bookingOptionCardActive : null),
          }}
        >
          <span
            style={{
              ...styles.bookingOptionText,
              ...(theme === "dark" ? styles.bookingOptionTextActive : null),
            }}
          >
            {t.themeDark}
          </span>
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
    <div style={{ ...styles.pageContainer, ...styles.bookingPage }}>
      <div style={styles.bookingHeader}>
        {typeof WebApp?.BackButton?.show === "function" ? null : (
          <button onClick={onBack} style={styles.backBtnInline} aria-label="back">
            <IconArrowLeft />
          </button>
        )}
        <div style={styles.bookingTitle}>{t.settingsBooking}</div>
      </div>
      <div style={styles.bookingOptionsRow}>
        <button
          type="button"
          onClick={() => setBookingMode("trainer")}
          style={{
            ...styles.bookingOptionCard,
            ...(bookingMode === "trainer" ? styles.bookingOptionCardActive : null),
          }}
        >
          <span
            style={{
              ...styles.bookingOptionText,
              ...(bookingMode === "trainer" ? styles.bookingOptionTextActive : null),
            }}
          >
            {t.bookingTrainerOnly}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setBookingMode("both")}
          style={{
            ...styles.bookingOptionCard,
            ...(bookingMode === "both" ? styles.bookingOptionCardActive : null),
          }}
        >
          <span
            style={{
              ...styles.bookingOptionText,
              ...(bookingMode === "both" ? styles.bookingOptionTextActive : null),
            }}
          >
            {t.bookingBoth}
          </span>
        </button>
      </div>
    </div>
  );
}

function RemindersScreen(props: {
  onBack: () => void;
  value: number;
  onChange: (v: number) => void;
  language: "ru" | "en";
  t: UiText;
}) {
  const { onBack, value, onChange, language, t } = props;
  const options = [0, 1, 2, 3, 4, 5, 6, 9, 12];
  return (
    <div style={{ ...styles.pageContainer, ...styles.bookingPage }}>
      <div style={styles.bookingHeader}>
        {typeof WebApp?.BackButton?.show === "function" ? null : (
          <button onClick={onBack} style={styles.backBtnInline} aria-label="back">
            <IconArrowLeft />
          </button>
        )}
        <div style={styles.bookingTitle}>{t.settingsReminders}</div>
      </div>

      <div style={styles.remindersList}>
        {options.map((hours) => {
          const isActive = value === hours;
          return (
            <button
              key={hours}
              type="button"
              onClick={() => onChange(hours)}
              style={{
                ...styles.remindersPill,
                ...(isActive ? styles.remindersPillActive : null),
              }}
            >
              {isActive ? <span style={styles.remindersCheck}>✓</span> : null}
              <span
                style={{
                  ...styles.remindersLabel,
                  ...(isActive ? styles.remindersLabelActive : null),
                }}
              >
                {formatReminderLabel(hours, language, t)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CancellationWindowScreen(props: {
  onBack: () => void;
  value: number;
  onChange: (v: number) => void;
  language: "ru" | "en";
  t: UiText;
}) {
  const { onBack, value, onChange, language, t } = props;
  const options = [0, 0.5, 1, 2, 3, 4, 5, 6, 12, 24];
  return (
    <div style={{ ...styles.pageContainer, ...styles.bookingPage }}>
      <div style={styles.bookingHeader}>
        {typeof WebApp?.BackButton?.show === "function" ? null : (
          <button onClick={onBack} style={styles.backBtnInline} aria-label="back">
            <IconArrowLeft />
          </button>
        )}
        <div style={styles.bookingTitle}>{t.settingsCancellationPolicy}</div>
      </div>
      <div style={styles.settingsScreenHint}>
        {language === "en"
          ? "Example: if training starts at 20:00 and you choose 1 hour, the session is charged at 19:00."
          : "Например: если тренировка начинается в 20:00 и выбрано 1 час, то занятие спишется в 19:00."}
      </div>

      <div style={styles.remindersList}>
        {options.map((hours) => {
          const isActive = value === hours;
          return (
            <button
              key={hours}
              type="button"
              onClick={() => onChange(hours)}
              style={{
                ...styles.remindersPill,
                ...(isActive ? styles.remindersPillActive : null),
              }}
            >
              {isActive ? <span style={styles.remindersCheck}>✓</span> : null}
              <span
                style={{
                  ...styles.remindersLabel,
                  ...(isActive ? styles.remindersLabelActive : null),
                }}
              >
                {formatCancellationLabel(hours, language, t)}
              </span>
            </button>
          );
        })}
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
    <div style={{ ...styles.pageContainer, ...styles.bookingPage }}>
      <div style={styles.bookingHeader}>
        {typeof WebApp?.BackButton?.show === "function" ? null : (
          <button onClick={onBack} style={styles.backBtnInline} aria-label="back">
            <IconArrowLeft />
          </button>
        )}
        <div style={styles.bookingTitle}>{t.languageTitle}</div>
      </div>
      <div style={styles.bookingOptionsRow}>
        <button
          type="button"
          onClick={() => setLanguage("ru")}
          style={{
            ...styles.bookingOptionCard,
            ...(language === "ru" ? styles.bookingOptionCardActive : null),
          }}
        >
          <span
            style={{
              ...styles.bookingOptionText,
              ...(language === "ru" ? styles.bookingOptionTextActive : null),
            }}
          >
            {t.languageRu}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setLanguage("en")}
          style={{
            ...styles.bookingOptionCard,
            ...(language === "en" ? styles.bookingOptionCardActive : null),
          }}
        >
          <span
            style={{
              ...styles.bookingOptionText,
              ...(language === "en" ? styles.bookingOptionTextActive : null),
            }}
          >
            {t.languageEn}
          </span>
        </button>
      </div>
    </div>
  );
}

function PaymentHistoryScreen(props: {
  onBack: () => void;
}) {
  const { onBack } = props;
  const tr = useTr();
  const paymentHistory: Array<{ id: string; date: string; amount: string }> = [];

  return (
    <div style={{ ...styles.pageContainer, ...styles.bookingPage }}>
      <div style={styles.bookingHeader}>
        {typeof WebApp?.BackButton?.show === "function" ? null : (
          <button onClick={onBack} style={styles.backBtnInline} aria-label="back">
            <IconArrowLeft />
          </button>
        )}
        <div style={styles.bookingTitle}>{tr("История оплат", "Payment history")}</div>
      </div>
      <div style={styles.paymentHistoryList}>
        {paymentHistory.length ? (
          paymentHistory.map((item) => (
            <div key={item.id} style={styles.paymentHistoryCard}>
              <div style={styles.paymentHistoryDate}>{item.date}</div>
              <div style={styles.paymentHistoryAmount}>- {item.amount}</div>
            </div>
          ))
        ) : (
          <div style={styles.paymentHistoryEmpty}>
            {tr("Пока нет проведённых оплат.", "No completed payments yet.")}
          </div>
        )}
      </div>
    </div>
  );
}

function PaymentMethodsScreen(props: {
  onBack: () => void;
}) {
  const { onBack } = props;
  const tr = useTr();
  const [editMode, setEditMode] = useState(false);
  const [cards, setCards] = useState<Array<{ id: string; brand: string; masked: string }>>([
    { id: cryptoId(), brand: tr("Банковская карта", "Bank card"), masked: "•••• 2800" },
  ]);

  const removeCard = (id: string) => {
    setCards((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div style={{ ...styles.pageContainer, ...styles.bookingPage }}>
      <div style={styles.paymentMethodsHeader}>
        {typeof WebApp?.BackButton?.show === "function" ? null : (
          <button onClick={onBack} style={styles.backBtnInline} aria-label="back">
            <IconArrowLeft />
          </button>
        )}
        <div style={styles.paymentMethodsTitle}>{tr("Способы оплаты", "Payment methods")}</div>
        <div style={styles.paymentMethodsHeaderRight}>
          <button type="button" onClick={() => setEditMode((prev) => !prev)} style={styles.paymentMethodsEditBtn}>
            {editMode ? tr("Готово", "Done") : tr("Изменить", "Edit")}
          </button>
        </div>
      </div>

      <div style={styles.paymentMethodsStack}>
        {cards.length ? (
          cards.map((item) => (
            <div key={item.id} style={styles.paymentMethodCard}>
              <div style={styles.paymentMethodCardLeft}>
                <div style={styles.paymentMethodIconWrap}>
                  <IconCard />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={styles.paymentMethodBrand}>{item.brand}</div>
                  <div style={styles.paymentMethodMasked}>{item.masked}</div>
                </div>
              </div>
              {editMode ? (
                <button
                  type="button"
                  onClick={() => removeCard(item.id)}
                  style={styles.paymentMethodDeleteBtn}
                  aria-label={tr("Удалить карту", "Remove card")}
                >
                  -
                </button>
              ) : (
                <div style={styles.paymentMethodStatus}>
                  <IconCheck />
                </div>
              )}
            </div>
          ))
        ) : (
          <div style={styles.paymentHistoryEmpty}>
            {tr("Пока не привязана ни одна банковская карта.", "No bank cards linked yet.")}
          </div>
        )}

        <button
          type="button"
          onClick={() => alert(tr("Интеграцию с банком подключим позже", "Bank integration will be added later."))}
          style={styles.paymentMethodAddBtn}
        >
          <div style={styles.paymentMethodAddIcon}>
            <IconCard />
          </div>
          <div style={styles.paymentMethodAddText}>
            {cards.length
              ? tr("Добавить карту", "Add card")
              : tr("Привязать банковскую карту", "Link bank card")}
          </div>
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
  showMySubscriptionTab?: boolean;
  showExtendedAbout?: boolean;
  showClientBasics?: boolean;
  showClientWeights?: boolean;
  subscriptionTabLabel?: string;
  subscriptionItems?: TrainerClientInvite[];
  trainerHistory?: SessionItem[];
  clientProfile?: ClientProfile | null;
  onSaveClientProfile?: (patch: Partial<ClientProfile>) => void;
  onSaveClientExercises?: (
    clientId: string,
    exercises: { id: string; name: string; weight: string }[]
  ) => Promise<TrainerClientInvite | null> | void;
  token?: string;
  apiBase?: string;
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
    trainerHistory,
    clientProfile,
    onSaveClientProfile,
    onSaveClientExercises,
    showMySubscriptionTab = false,
    token,
    apiBase,
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
  const [gender, setGender] = useState("");
  const [clientWeights, setClientWeights] = useState<{ id: string; name: string; weight: string }[]>([]);
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
  const [personalTab, setPersonalTab] = useState<"about" | "contacts" | "mySubscription" | "weights" | "subscription">(
    "about"
  );
  const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(null);

  const subscriptionTrainers = (subscriptionItems || []).filter((c) => !c.archived && c.status === "active");
  const isClientProfile = !!onSaveClientProfile;
  const activeTrainer =
    subscriptionTrainers.find((t) => t.id === selectedTrainerId) || subscriptionTrainers[0] || null;
  const activeTrainerExercises = activeTrainer?.exercises || [];
  const weightsSigRef = useRef<string>("");

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

  useEffect(() => {
    if (!clientProfile) return;
    if (clientProfile.fullName !== undefined) setFio(clientProfile.fullName || "");
    if (clientProfile.gender !== undefined) setGender(clientProfile.gender || "");
    if (clientProfile.height !== undefined) setHeight(clientProfile.height || "");
    if (clientProfile.weight !== undefined) setWeight(clientProfile.weight || "");
    if (clientProfile.goal !== undefined) setAbout(clientProfile.goal || "");
    if (clientProfile.comment !== undefined) setExtraInfo(clientProfile.comment || "");
  }, [clientProfile]);

  useEffect(() => {
    if (!isClientProfile) return;
    const sig = stableStringify(activeTrainerExercises || []);
    if (sig === weightsSigRef.current) return;
    weightsSigRef.current = sig;
    setClientWeights(activeTrainerExercises.map((ex) => ({ ...ex })));
  }, [activeTrainerExercises, isClientProfile]);

  const saveTrainerField = (field: keyof TrainerProfile, value: string) => {
    if (!onSaveTrainerProfile) return;
    const current = trainerProfile?.[field] ?? "";
    if (String(current || "") === String(value || "")) return;
    onSaveTrainerProfile({ [field]: value } as Partial<TrainerProfile>);
  };
  const saveClientField = (field: keyof ClientProfile, value: string) => {
    if (!onSaveClientProfile) return;
    const current = clientProfile?.[field] ?? "";
    if (String(current || "") === String(value || "")) return;
    onSaveClientProfile({ [field]: value } as Partial<ClientProfile>);
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
    if (!showMySubscriptionTab && personalTab === "mySubscription") {
      setPersonalTab("about");
    }
  }, [showMySubscriptionTab, personalTab]);

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
      <div style={styles.clientDetailHeaderCard}>
        <AvatarCircle name={fio || name || username || tr("Пользователь", "User")} photoUrl={photoUrl} size={52} />
        <div style={{ minWidth: 0 }}>
          <div style={styles.clientDetailName}>{fio || name || tr("Пользователь", "User")}</div>
          <div style={styles.clientDetailStatus}>{username ? `@${username}` : ""}</div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={styles.clientDetailTabsScroll}>
          <div style={styles.personalTabsWrap}>
            <button
              type="button"
              onClick={() => setPersonalTab("about")}
              style={{
                ...styles.clientDetailTab,
                ...styles.personalTabButton,
                ...(personalTab === "about" ? styles.clientDetailTabActive : null),
              }}
            >
              {tr("Личная информация", "Personal info")}
            </button>
            <button
              type="button"
              onClick={() => setPersonalTab("contacts")}
              style={{
                ...styles.clientDetailTab,
                ...styles.personalTabButton,
                ...(personalTab === "contacts" ? styles.clientDetailTabActive : null),
              }}
            >
              {tr("Контакты", "Contacts")}
            </button>
            {showMySubscriptionTab ? (
              <button
                type="button"
                onClick={() => setPersonalTab("mySubscription")}
                style={{
                  ...styles.clientDetailTab,
                  ...styles.personalTabButton,
                  ...(personalTab === "mySubscription" ? styles.clientDetailTabActive : null),
                }}
              >
                {tr("Мой абонемент", "My subscription")}
              </button>
            ) : null}
            {showClientWeights ? (
              <button
                type="button"
                onClick={() => setPersonalTab("weights")}
                style={{
                  ...styles.clientDetailTab,
                  ...styles.personalTabButton,
                  ...(personalTab === "weights" ? styles.clientDetailTabActive : null),
                }}
              >
                {tr("Статистика упражнений", "Exercise stats")}
              </button>
            ) : null}
            {showSubscriptionTab ? (
              <button
                type="button"
                onClick={() => setPersonalTab("subscription")}
                style={{
                  ...styles.clientDetailTab,
                  ...styles.personalTabButton,
                  ...(personalTab === "subscription" ? styles.clientDetailTabActive : null),
                }}
              >
                {resolvedSubscriptionTabLabel}
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <div style={{ ...styles.topBarDivider, marginTop: 8 }} />
      {personalTab === "about" ? (
        <div style={styles.clientPanelPlain}>
          <div style={styles.clientDetailFieldLabel}>
            {isClientProfile
              ? tr("ФИО (так будет видеть вас тренер)", "Full name (visible to coach)")
              : tr("ФИО (так будут видеть вас клиенты)", "Full name (visible to clients)")}
          </div>
          <input
            value={fio}
            onChange={(e) => {
              const v = e.target.value;
              setFio(v);
              onUpdateName(v);
            }}
            onBlur={() => {
              if (isClientProfile) {
                saveClientField("fullName", fio);
              } else {
                saveTrainerField("fullName", fio);
              }
            }}
            placeholder={tr("Введите ФИО", "Enter full name")}
            style={styles.clientDetailInput}
          />
          {showClientBasics ? (
            <>
              <div style={{ marginTop: 16 }}>
                <div style={styles.clientDetailFieldLabel}>{tr("Пол", "Gender")}</div>
                <select
                  value={gender}
                  onChange={(e) => {
                    const v = e.target.value;
                    setGender(v);
                    if (isClientProfile) saveClientField("gender", v);
                  }}
                  style={styles.clientDetailInput}
                >
                  <option value="">{tr("Не выбран", "Not selected")}</option>
                  <option value="male">{tr("Мужской", "Male")}</option>
                  <option value="female">{tr("Женский", "Female")}</option>
                </select>
              </div>
              <div style={styles.metricsRow}>
                <div style={{ flex: 1 }}>
                  <div style={styles.clientDetailFieldLabel}>{tr("Рост", "Height")}</div>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={height}
                    onChange={(e) => setHeight(e.target.value.replace(/[^\d]/g, ""))}
                    onBlur={() => {
                      const v = normalizeNumberWithUnit(height, "см");
                      if (v) setHeight(v);
                      if (isClientProfile) saveClientField("height", v);
                    }}
                    placeholder={tr("см", "cm")}
                    style={styles.clientDetailInput}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={styles.clientDetailFieldLabel}>{tr("Вес", "Weight")}</div>
                  <input
                    inputMode="decimal"
                    pattern="[0-9.,]*"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value.replace(/[^0-9.,]/g, ""))}
                    onBlur={() => {
                      const v = normalizeNumberWithUnit(weight, "кг");
                      if (v) setWeight(v);
                      if (isClientProfile) saveClientField("weight", v);
                    }}
                    placeholder={tr("кг", "kg")}
                    style={styles.clientDetailInput}
                  />
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={styles.clientDetailFieldLabel}>{tr("Цель", "Goal")}</div>
                <textarea
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = "auto";
                    el.style.height = `${el.scrollHeight}px`;
                  }}
                  onBlur={() => {
                    if (isClientProfile) saveClientField("goal", about);
                  }}
                  placeholder={tr("Например: сбросить 5 кг", "e.g., lose 5 kg")}
                  rows={1}
                  style={styles.clientDetailTextarea}
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={styles.clientDetailFieldLabel}>{tr("Комментарии", "Comments")}</div>
                <textarea
                  value={extraInfo}
                  onChange={(e) => setExtraInfo(e.target.value)}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = "auto";
                    el.style.height = `${el.scrollHeight}px`;
                  }}
                  onBlur={() => {
                    if (isClientProfile) saveClientField("comment", extraInfo);
                  }}
                  placeholder={tr("Комментарий", "Comment")}
                  rows={1}
                  style={styles.clientDetailTextarea}
                />
              </div>
            </>
          ) : null}
          {showExtendedAbout ? (
            <>
              <div style={{ marginTop: 16 }}>
                <div style={styles.clientDetailFieldLabel}>{tr("Фитнес-клуб", "Fitness club")}</div>
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
                  style={styles.clientDetailTextarea}
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={styles.clientDetailFieldLabel}>{tr("Специаллизация", "Specialization")}</div>
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
                  style={styles.clientDetailTextarea}
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={styles.clientDetailFieldLabel}>{tr("Опыт работы", "Experience")}</div>
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
                  style={styles.clientDetailTextarea}
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={styles.clientDetailFieldLabel}>{tr("О себе", "About")}</div>
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
                  style={styles.clientDetailTextarea}
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={styles.clientDetailFieldLabel}>{tr("Требования к проведению занятий", "Session requirements")}</div>
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
                  style={styles.clientDetailTextarea}
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={styles.clientDetailFieldLabel}>{tr("Дополнительная информация", "Additional info")}</div>
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
                  style={styles.clientDetailTextarea}
                />
              </div>
            </>
          ) : null}
        </div>
      ) : personalTab === "contacts" ? (
        <div style={styles.clientPanelPlain}>
          <div style={styles.clientDetailFieldLabel}>{tr("Номер телефона", "Phone number")}</div>
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
            style={styles.clientDetailTextarea}
          />
          <div style={{ marginTop: 16 }}>
            <div style={styles.clientDetailFieldLabel}>Telegram</div>
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
              style={styles.clientDetailCopyBtn}
              aria-label="copy telegram username"
            >
              <div style={styles.clientDetailPlainValue}>{username ? `@${username}` : "—"}</div>
            </button>
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={styles.clientDetailFieldLabel}>Instagram</div>
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
            style={styles.clientDetailTextarea}
          />
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={styles.clientDetailFieldLabel}>{tr("Иная социальная сеть", "Other social network")}</div>
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
              style={styles.clientDetailTextarea}
            />
          </div>
        </div>
      ) : personalTab === "mySubscription" ? (
        <div style={styles.clientPanelPlain}>
          <div style={styles.subscriptionDetails}>
            <div style={styles.subscriptionDetailsTitle}>{tr("Абонемент", "Subscription")}</div>
            <div style={styles.subscriptionDetailsRow}>
              <div style={styles.subscriptionDetailsLabel}>{tr("Дата начала", "Start date")}</div>
              <div style={styles.subscriptionDetailsValue}>{activeTrainer?.subscriptionStart?.trim() || "—"}</div>
            </div>
            <div style={styles.subscriptionDetailsRow}>
              <div style={styles.subscriptionDetailsLabel}>{tr("Дата завершения", "End date")}</div>
              <div style={styles.subscriptionDetailsValue}>{activeTrainer?.subscriptionEnd?.trim() || "—"}</div>
            </div>
            <div style={styles.subscriptionDetailsRow}>
              <div style={styles.subscriptionDetailsLabel}>{tr("Стоимость тренировки", "Session price")}</div>
              <div style={styles.subscriptionDetailsValue}>{activeTrainer?.subscriptionPrice?.trim() || "—"}</div>
            </div>
            <div style={styles.subscriptionDetailsRow}>
              <div style={styles.subscriptionDetailsLabel}>{tr("Занятий в абонементе", "Sessions in subscription")}</div>
              <div style={styles.subscriptionDetailsValue}>{activeTrainer?.subscriptionTotal?.trim() || "—"}</div>
            </div>
            <div style={styles.subscriptionDetailsRow}>
              <div style={styles.subscriptionDetailsLabel}>{tr("Занятий осталось", "Sessions left")}</div>
              <div style={styles.subscriptionDetailsValue}>
                {activeTrainer?.subscriptionLeft?.trim() || activeTrainer?.subscriptionTotal?.trim() || "—"}
              </div>
            </div>
          </div>
        </div>
      ) : personalTab === "weights" ? (
        <ExerciseStatsPanel
          clientId={activeTrainer?.id ?? null}
          exercises={clientWeights}
          setExercises={setClientWeights}
          onSaveExercises={onSaveClientExercises}
          token={token}
          apiBase={apiBase}
        />
      ) : personalTab === "subscription" ? (
        <div style={styles.clientPanelPlain}>
          {trainerHistory ? (
            trainerHistory.length === 0 ? (
              <div style={styles.clientPanelBody}>{tr("Пока нет завершённых тренировок.", "No completed sessions yet.")}</div>
            ) : (
              <div style={styles.sessionHistoryList}>
                {trainerHistory
                  .slice()
                  .sort((a, b) => sessionEndTime(b).getTime() - sessionEndTime(a).getTime())
                  .map((s) => (
                    <div key={s.id} style={styles.sessionHistoryCard}>
                      <div style={styles.sessionHistoryTitle}>{sessionTitle(s, tr)}</div>
                      <div style={styles.sessionHistorySubtitle}>
                        {formatDateShort(parseDateKey(s.dateKey))} • {s.start} — {s.end}
                      </div>
                      <div style={styles.sessionHistorySubtitle}>
                        {sessionClientLabel(s, tr, subscriptionItems || [])}
                      </div>
                    </div>
                  ))}
              </div>
            )
          ) : subscriptionItems ? (
            subscriptionTrainers.length > 0 ? (
              <>
                <div style={styles.subscriptionTrainerStrip}>
                  {subscriptionTrainers.map((trainer) => {
                    const isActive = trainer.id === selectedTrainerId;
                    const label = getTrainerLabel(trainer, tr);
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
  token: string;
  apiBase: string;
  onRefresh?: () => void;
  onConnected: () => void;
}) {
  const { showTopBar = true, embedded = false, onBack, token, apiBase, onRefresh, onConnected } = props;
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
            if (!token) {
              setMessage(tr("Сначала войдите в аккаунт.", "Please login first."));
              return;
            }
            (async () => {
              try {
                const res = await fetch(`${apiBase}/clients/activate`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ code }),
                });
                if (!res.ok) {
                  setMessage(tr("Код не найден. Проверь правильность.", "Code not found. Check it and try again."));
                  return;
                }
                setMessage("");
                setInviteCode("");
                onConnected();
                onRefresh?.();
                try {
                  localStorage.setItem("clientConnected", "true");
                } catch {
                  // ignore
                }
              } catch {
                setMessage(tr("Не удалось подключиться.", "Failed to connect."));
              }
            })();
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

  const displayName = getTrainerLabel(trainer, tr);
  const profile = trainer.trainerProfile;

  const renderReadOnly = (label: string, value?: string) => (
    <div style={{ marginTop: 16 }}>
      <div style={styles.clientDetailFieldLabel}>{label}</div>
      <div style={styles.clientDetailValueBox}>{value && value.trim() ? value : "—"}</div>
    </div>
  );

  return (
    <div style={{ ...styles.pageContainer, ...styles.clientsPage }}>
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

      <div style={styles.clientDetailHeaderCard}>
        <AvatarCircle name={displayName} photoUrl={trainer.trainerPhotoUrl || ""} size={56} />
        <div style={{ minWidth: 0 }}>
          <div style={styles.clientDetailName}>{displayName}</div>
          <div style={styles.clientDetailStatus}>
            {trainer.trainerUsername ? `@${trainer.trainerUsername}` : ""}
          </div>
        </div>
      </div>

      <div style={styles.clientDetailTabsScroll}>
        <div style={styles.clientDetailTabsWrap}>
          <button
            type="button"
            onClick={() => setTab("about")}
            style={{
              ...styles.clientDetailTab,
              ...(tab === "about" ? styles.clientDetailTabActive : null),
            }}
          >
            {tr("Личная информация", "Personal info")}
          </button>
          <button
            type="button"
            onClick={() => setTab("contacts")}
            style={{
              ...styles.clientDetailTab,
              ...(tab === "contacts" ? styles.clientDetailTabActive : null),
            }}
          >
            {tr("Контакты", "Contacts")}
          </button>
        </div>
      </div>
      <div style={styles.clientDetailTabsDivider} />

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
          {renderReadOnly("Telegram", trainer.trainerUsername ? `@${trainer.trainerUsername}` : "")}
          {renderReadOnly("Instagram", profile?.instagram)}
          {renderReadOnly(tr("Иная социальная сеть", "Other social network"), profile?.otherSocial)}
        </div>
      )}
    </div>
  );
}


function SettingsRowGlass(props: {
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
        ...styles.settingsRow,
        borderBottom: isLast ? "none" : "1px solid rgba(190, 205, 220, 0.6)",
      }}
    >
      <div style={styles.settingsRowLeft}>
        <div style={styles.settingsRowIcon}>{icon}</div>
        <div style={{ textAlign: "left" }}>
          <div style={styles.settingsRowTitle}>{title}</div>
          {subtitle ? <div style={styles.settingsRowSubtitle}>{subtitle}</div> : null}
        </div>
      </div>
      <div style={styles.settingsRowRight}>
        {right ? <div style={styles.settingsRowRightText}>{right}</div> : null}
        {!hideChevron ? (
          <div style={styles.settingsRowChevron}>
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
  style?: React.CSSProperties;
}) {
  const { active, onChange, items, hidden, style } = props;

  return (
    <div style={{ ...styles.bottomNav, ...(style || {}), display: hidden ? "none" : "flex" }}>
      {items.map((it) => {
        const isActive = it.id === active;
        const iconColor = isActive ? "var(--accent)" : "var(--muted)";
        const labelColor = isActive ? "var(--accent)" : "var(--muted)";

        return (
          <button
            key={it.id}
            onClick={() => onChange(it.id)}
            style={styles.navBtn}
          >
            <div
              style={{
                ...styles.navIconWrap,
                ...(isActive ? styles.navIconWrapActive : null),
                color: iconColor,
              }}
            >
              {it.icon}
            </div>
            <div
              style={{
                ...styles.navLabel,
                color: labelColor,
                fontWeight: isActive ? 700 : 600,
              }}
            >
              {it.label}
            </div>
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

function localExerciseId() {
  return `local_${cryptoId()}`;
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

function addMonths(d: Date, delta: number) {
  const out = new Date(d);
  out.setMonth(out.getMonth() + delta);
  return out;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonthExclusive(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
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

function formatMonthYear(d: Date) {
  const months =
    currentLanguage === "en"
      ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      : ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
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

function formatDateInputValue(key: string) {
  if (!key) return "";
  const d = parseDateKey(key);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeDateKeyInput(value: string) {
  if (!value) return "";
  return formatDateKey(parseDateKey(value));
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

function stableStringify(value: any): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

function buildInvitesSignature(list: TrainerClientInvite[]) {
  const normalized = list
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((inv) => ({
      ...inv,
      exercises: inv.exercises
        ? inv.exercises.slice().sort((a, b) => a.id.localeCompare(b.id))
        : [],
    }));
  return stableStringify(normalized);
}

function buildSessionsSignature(map: Record<string, SessionItem[]>) {
  const keys = Object.keys(map).sort();
  const normalized = keys.map((key) => ({
    dateKey: key,
    sessions: (map[key] || [])
      .slice()
      .sort((a, b) => {
        const byStart = a.start.localeCompare(b.start);
        if (byStart !== 0) return byStart;
        const byEnd = a.end.localeCompare(b.end);
        if (byEnd !== 0) return byEnd;
        return a.id.localeCompare(b.id);
      })
      .map((s) => ({
        id: s.id,
        dateKey: s.dateKey,
        start: s.start,
        end: s.end,
        clientUsername: s.clientUsername,
        trainerTgUserId: s.trainerTgUserId ?? null,
        source: s.source ?? null,
        type: s.type ?? null,
        price: s.price ?? null,
        comment: s.comment ?? null,
      })),
  }));
  return stableStringify(normalized);
}

function buildSlotsSignature(list: TrainingSlot[]) {
  const normalized = list
    .slice()
    .sort((a, b) => {
      const byStart = a.start.localeCompare(b.start);
      if (byStart !== 0) return byStart;
      const byEnd = a.end.localeCompare(b.end);
      if (byEnd !== 0) return byEnd;
      return a.id.localeCompare(b.id);
    })
    .map((slot) => ({
      id: slot.id,
      trainerTgUserId: slot.trainerTgUserId,
      dateKey: slot.dateKey,
      start: slot.start,
      end: slot.end,
      isGroup: slot.isGroup ?? false,
      capacity: slot.capacity ?? null,
      bookedCount: slot.bookedCount ?? 0,
      sessionId: slot.sessionId ?? null,
    }));
  return stableStringify(normalized);
}

function parseSubscriptionHistory(raw: any): SubscriptionHistoryItem[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        id: String(item?.id || ""),
        purchasedAt: String(item?.purchasedAt || ""),
        price: item?.price ? String(item.price) : "",
        total: item?.total ? String(item.total) : "",
        start: item?.start ? String(item.start) : "",
        end: item?.end ? String(item.end) : "",
      }))
      .filter((item) => item.id && item.purchasedAt && item.total);
  } catch {
    return [];
  }
}

function mapClientFromApi(c: any): TrainerClientInvite {
  const username = String(c.clientUsername || "");
  const isLocal = Boolean(c.isLocal) || username.startsWith("local_");
  return {
    id: String(c.id),
    username,
    code: String(c.code || ""),
    createdAt: c.createdAt ? new Date(c.createdAt).getTime() : Date.now(),
    status: c.status === "active" ? "active" : "pending",
    isLocal,
    photoUrl: c.photoUrl ? String(c.photoUrl) : "",
    clientName: c.clientName ? String(c.clientName) : undefined,
    trainerTgUserId: c.trainerTgUserId ? String(c.trainerTgUserId) : undefined,
    trainerUsername: c.trainerUsername ? String(c.trainerUsername) : undefined,
    trainerName: c.trainerName ? String(c.trainerName) : undefined,
    trainerPhotoUrl: c.trainerPhotoUrl ? String(c.trainerPhotoUrl) : undefined,
    bookingMode: c.bookingMode === "both" ? "both" : c.bookingMode === "trainer" ? "trainer" : undefined,
    clientProfile: c.clientProfile ?? undefined,
    trainerProfile: c.trainerProfile ?? undefined,
    fullName: c.fullName ?? "",
    gender: c.gender ?? "",
    height: c.height ?? "",
    weight: c.weight ?? "",
    goal: c.goal ?? "",
    comment: c.comment ?? "",
    contactTelegram: c.contactTelegram ?? "",
    contactPhone: c.contactPhone ?? "",
    contactInstagram: c.contactInstagram ?? "",
    contactOtherSocial: c.contactOtherSocial ?? "",
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
    activeSubscriptionHistoryId: c.activeSubscriptionHistoryId ?? "",
    subscriptionEnabled:
      typeof c.subscriptionEnabled === "boolean"
        ? c.subscriptionEnabled
        : Boolean(c.subscriptionStart || c.subscriptionEnd || c.subscriptionPrice || c.subscriptionTotal || c.subscriptionLeft),
    subscriptionHistory: parseSubscriptionHistory(c.subscriptionHistory),
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
    clientName: s.clientName ? String(s.clientName) : undefined,
    trainerTgUserId: s.trainerTgUserId ? String(s.trainerTgUserId) : undefined,
    source: s.source === "client" ? "client" : "trainer",
    type: s.type ? String(s.type) : undefined,
    price: s.price ? String(s.price) : undefined,
    comment: s.comment ? String(s.comment) : undefined,
    color: s.color ? String(s.color) : undefined,
    subscriptionHistoryId: s.subscriptionHistoryId ? String(s.subscriptionHistoryId) : null,
    subscriptionChargedAt: s.subscriptionChargedAt ? String(s.subscriptionChargedAt) : null,
    participants: Array.isArray(s.participants)
      ? s.participants.map((p: any) => ({
          clientId: String(p.clientId || ""),
          clientUsername: String(p.clientUsername || ""),
          clientName: p.clientName ? String(p.clientName) : undefined,
          subscriptionHistoryId: p.subscriptionHistoryId ? String(p.subscriptionHistoryId) : null,
          subscriptionChargedAt: p.subscriptionChargedAt ? String(p.subscriptionChargedAt) : null,
        }))
      : [],
  };
}

function sessionTitle(s: SessionItem, tr: (ru: string, en: string) => string) {
  if (s.type === "group" || s.clientUsername === "group") return tr("Групповая тренировка", "Group session");
  const isOneTime = s.clientUsername === "one_time" || s.type === "one_time";
  if (isOneTime) return tr("Разовая тренировка", "One-time session");
  return s.type?.trim() ? s.type : tr("Тренировка", "Session");
}

function sessionClientLabel(
  s: SessionItem,
  tr: (ru: string, en: string) => string,
  clients: TrainerClientInvite[]
) {
  if (s.type === "group" || s.clientUsername === "group") {
    const count = s.participants?.length || 0;
    if (count > 0) {
      const suffix = count === 1 ? "человек" : count >= 2 && count <= 4 ? "человека" : "человек";
      return tr(`Записано ${count} ${suffix}`, `Enrolled: ${count}`);
    }
    return tr("Групповая тренировка", "Group session");
  }
  const isOneTime = s.clientUsername === "one_time" || s.type === "one_time";
  if (isOneTime) {
    return s.clientName?.trim() ? s.clientName : tr("Разовая тренировка", "One-time session");
  }
  return getClientLabel(clients, s.clientUsername);
}

function getSessionColorStyle(color?: string) {
  if (!color) return null;
  return { background: color, borderColor: color };
}

function getClientLabel(clients: TrainerClientInvite[], username: string) {
  const c = clients.find((x) => x.username === username);
  if (c?.fullName && c.fullName.trim()) return c.fullName;
  if (c?.clientName && c.clientName.trim()) return c.clientName;
  if (c?.isLocal || isLocalClientUsername(username)) return "Клиент";
  return `@${username}`;
}

function isLocalClientUsername(username: string) {
  return username.startsWith("local_");
}

function normalizeUsernameValue(username: string) {
  return String(username || "").replace(/^@/, "");
}

function getTrainerLabel(trainer: TrainerClientInvite, tr: (ru: string, en: string) => string) {
  if (trainer.trainerName && trainer.trainerName.trim()) return trainer.trainerName;
  if (trainer.trainerUsername && trainer.trainerUsername.trim()) return `@${trainer.trainerUsername}`;
  return tr("Тренер", "Coach");
}

function canScheduleClientOnDate(
  clients: TrainerClientInvite[],
  username: string,
  sessions: SessionItem[] = [],
  targetDate?: Date | null
) {
  const c = clients.find((x) => x.username === username);
  if (!c || c.archived) return false;
  if (c.status !== "active") return false;
  if (c.subscriptionEnabled) {
    const start = (c.subscriptionStart || "").trim();
    const end = (c.subscriptionEnd || "").trim();
    const price = (c.subscriptionPrice || "").trim();
    const total = (c.subscriptionTotal || "").trim();
    const left = parseInt(c.subscriptionLeft || "", 10);
    if (!start || !end || !price || !total || Number.isNaN(left) || left <= 0) return false;
    const startDate = parseDateDMY(start);
    const endDate = parseDateDMY(end);
    if (!startDate || !endDate || endDateEnd(endDate).getTime() < Date.now()) return false;
    if (targetDate) {
      const targetTs = targetDate.getTime();
      if (targetTs < startOfDay(startDate).getTime() || targetTs > endDateEnd(endDate).getTime()) return false;
    }
    const reserved = getReservedSubscriptionCount(sessions, c.username);
    return Math.max(0, left - reserved) > 0;
  }
  const left = parseInt(c.subscriptionLeft || "", 10);
  if (!Number.isNaN(left) && left <= 0) return false;
  return true;
}

function sessionStartDateTime(session: SessionItem) {
  const day = parseDateKey(session.dateKey);
  if (!day) return null;
  const [hours, minutes] = session.start.split(":").map((value) => parseInt(value, 10));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  const out = new Date(day);
  out.setHours(hours, minutes, 0, 0);
  return out;
}

function getReservedSubscriptionCount(sessions: SessionItem[], username: string, now = new Date()) {
  const normalizedUsername = normalizeUsernameValue(username);
  return sessions.reduce((count, session) => {
    const startAt = sessionStartDateTime(session);
    if (!startAt || startAt.getTime() <= now.getTime()) return count;
    if (session.clientUsername === normalizedUsername) {
      return session.subscriptionChargedAt ? count : count + 1;
    }
    if (!(session.clientUsername === "group" || session.type === "group")) return count;
    const participant = (session.participants || []).find(
      (item) => normalizeUsernameValue(item.clientUsername) === normalizedUsername
    );
    if (!participant || participant.subscriptionChargedAt) return count;
    return count + 1;
  }, 0);
}

function getClientSubscriptionBookingInfo(
  client: TrainerClientInvite | null | undefined,
  sessions: SessionItem[] = [],
  now = new Date()
) {
  if (!client) {
    return { enabled: false, hasData: false, missingData: false, expired: false, total: null as number | null, left: null as number | null, reserved: 0, available: null as number | null, shouldWarn: false };
  }
  const hasData = Boolean(
    client.subscriptionEnabled ||
      client.subscriptionStart?.trim() ||
      client.subscriptionEnd?.trim() ||
      client.subscriptionPrice?.trim() ||
      client.subscriptionTotal?.trim() ||
      client.subscriptionLeft?.trim()
  );
  if (!client.subscriptionEnabled) {
    return { enabled: false, hasData, missingData: false, expired: false, total: null as number | null, left: null as number | null, reserved: 0, available: null as number | null, shouldWarn: false };
  }
  const total = parseInt(client.subscriptionTotal || "", 10);
  const left = parseInt(client.subscriptionLeft || "", 10);
  const missingData =
    !client.subscriptionStart?.trim() ||
    !client.subscriptionEnd?.trim() ||
    !client.subscriptionPrice?.trim() ||
    !client.subscriptionTotal?.trim() ||
    Number.isNaN(left) ||
    Number.isNaN(total);
  const endDate = client.subscriptionEnd ? parseDateDMY(client.subscriptionEnd) : null;
  const expired = endDate ? endDateEnd(endDate).getTime() < now.getTime() : false;
  const reserved = missingData ? 0 : getReservedSubscriptionCount(sessions, client.username, now);
  const available = missingData || Number.isNaN(left) ? null : Math.max(0, left - reserved);
  const shouldWarn = hasData && (missingData || expired || available === 0);
  return {
    enabled: true,
    hasData,
    missingData,
    expired,
    total: Number.isNaN(total) ? null : total,
    left: Number.isNaN(left) ? null : left,
    reserved,
    available,
    shouldWarn,
  };
}

function getSubscriptionSessionDetails(
  item: SubscriptionHistoryItem,
  sessions: SessionItem[],
  tr: (ru: string, en: string) => string
): SubscriptionSessionDetail[] {
  const tagged = sessions
    .filter((session) => {
      if (session.subscriptionHistoryId === item.id) return true;
      return (session.participants || []).some((participant) => participant.subscriptionHistoryId === item.id);
    })
    .sort((a, b) => sessionStartTime(a).getTime() - sessionStartTime(b).getTime())
    .map((session) => ({
      id: session.id,
      title: sessionTitle(session, tr),
      dateLabel: formatDateShort(parseDateKey(session.dateKey)),
      timeLabel: `${session.start} — ${session.end}`,
      statusLabel: isSessionEnded(session, new Date())
        ? tr("Проведена", "Completed")
        : tr("Запланирована", "Planned"),
    }));
  if (tagged.length) return tagged;

  const startDate = item.start ? parseDateDMY(item.start) : null;
  const endDate = item.end ? parseDateDMY(item.end) : null;
  if (!startDate || !endDate) return [];
  const rangeStart = startOfDay(startDate).getTime();
  const rangeEnd = endDateEnd(endDate).getTime();
  const now = new Date();
  const total = parseInt(item.total || "", 10);

  return sessions
    .filter((session) => {
      const startAt = sessionStartDateTime(session);
      if (!startAt) return false;
      const ts = startAt.getTime();
      return ts >= rangeStart && ts <= rangeEnd;
    })
    .sort((a, b) => sessionStartTime(a).getTime() - sessionStartTime(b).getTime())
    .slice(0, Number.isNaN(total) ? undefined : Math.max(0, total))
    .map((session) => ({
      id: session.id,
      title: sessionTitle(session, tr),
      dateLabel: formatDateShort(parseDateKey(session.dateKey)),
      timeLabel: `${session.start} — ${session.end}`,
      statusLabel: isSessionEnded(session, now)
        ? tr("Проведена", "Completed")
        : tr("Запланирована", "Planned"),
    }));
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

function canBookSlot(dateKey: string, start: string) {
  const day = parseDateKey(dateKey);
  if (!day) return false;
  const [sh, sm] = start.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(sh) || Number.isNaN(sm)) return false;
  const startAt = new Date(day);
  startAt.setHours(sh, sm, 0, 0);
  return Date.now() < startAt.getTime();
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
  const out: { key: string; date: Date; dateText: string; weekdayText: string }[] = [];
  for (let i = -daysBefore; i <= daysAfter; i++) {
    const date = addDays(base, i);
    out.push({
      key: formatDateKey(date),
      date,
      dateText: formatDateShort(date),
      weekdayText: formatWeekdayShort(date, currentLanguage),
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
        --text-primary: #111827;
        --text-secondary: #6b7280;
        --text-accent: #1677ff;
        --font-regular: 500;
        --font-medium: 600;
        --font-strong: 800;
        --border: #e5e7eb;
        --border-2: #ececec;
        --nav-border: #e6e6e6;
        --accent: #1677ff;
        --accent-contrast: #ffffff;
        --success-bg: #eaf7ea;
        --success-text: #1b7f2a;
        --danger: #b42318;
        --notes-page-bg: radial-gradient(120% 90% at 50% 0%, rgba(232, 244, 255, 0.95) 0%, rgba(240, 246, 255, 0.92) 35%, rgba(244, 246, 251, 0.92) 60%, rgba(241, 242, 246, 0.95) 100%);
        --notes-title: #1b1f2a;
        --notes-row-bg: linear-gradient(135deg, rgba(255, 255, 255, 0.8), rgba(227, 238, 255, 0.85));
        --notes-row-border: rgba(255, 255, 255, 0.7);
        --notes-row-shadow: 0 14px 28px rgba(122, 148, 190, 0.22);
        --notes-row-text: #1b1f2a;
        --notes-row-btn-bg: linear-gradient(135deg, rgba(152, 194, 255, 0.55), rgba(196, 222, 255, 0.75));
        --notes-row-btn-border: rgba(255, 255, 255, 0.8);
        --notes-row-btn-shadow: 0 16px 30px rgba(118, 155, 210, 0.28);
        --notes-action: #ffffff;
        --notes-action-shadow: 0 4px 10px rgba(84, 121, 184, 0.45);
        --notes-empty-bg: rgba(255, 255, 255, 0.6);
        --notes-empty-border: rgba(255, 255, 255, 0.7);
        --notes-empty-text: #3f4a5a;
        --trainer-bg-home: radial-gradient(circle at 50% -20%, rgba(120, 170, 210, 0.45), transparent 60%),
          linear-gradient(180deg, #e9eff4 0%, #f3f6fa 40%, #ffffff 100%);
        --trainer-bg-schedule: radial-gradient(circle at 50% -15%, rgba(120, 170, 210, 0.4), transparent 60%),
          linear-gradient(180deg, #e9f0f6 0%, #f4f7fb 45%, #ffffff 100%);
        --trainer-bg-clients: radial-gradient(circle at 50% -15%, rgba(120, 170, 210, 0.35), transparent 60%),
          linear-gradient(180deg, #e9f0f6 0%, #f4f7fb 45%, #ffffff 100%);
        --trainer-bg-add-client: radial-gradient(circle at 50% -10%, rgba(120, 170, 210, 0.4), transparent 60%),
          linear-gradient(180deg, #e9f0f6 0%, #f4f7fb 45%, #ffffff 100%);
        --trainer-bg-settings: radial-gradient(circle at 50% -10%, rgba(120, 170, 210, 0.45), transparent 60%),
          linear-gradient(180deg, #e3edf7 0%, #f1f5fb 45%, #ffffff 100%);
        --glass-hero-bg: linear-gradient(135deg, rgba(160, 205, 245, 0.95), rgba(95, 160, 225, 0.95));
        --glass-hero-border: rgba(160, 190, 225, 0.6);
        --glass-hero-shadow: 0 18px 32px rgba(62, 116, 190, 0.35);
        --home-hero-bg: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(228, 235, 243, 0.9));
        --home-hero-border: rgba(180, 200, 220, 0.65);
        --home-hero-shadow: 0 24px 40px rgba(15, 23, 42, 0.08);
        --glass-card-bg: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(244, 247, 250, 0.96));
        --glass-card-border: rgba(190, 205, 220, 0.7);
        --glass-card-shadow: 0 12px 22px rgba(15, 23, 42, 0.08);
        --glass-pill-bg: rgba(245, 248, 252, 0.9);
        --glass-pill-border: rgba(130, 160, 200, 0.45);
        --glass-pill-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
        --glass-tab-wrap-bg: rgba(240, 245, 250, 0.9);
        --glass-tab-wrap-border: rgba(170, 190, 210, 0.5);
        --glass-tab-active-bg: linear-gradient(135deg, #6f83f6, #7ccfe6);
        --glass-tab-active-shadow: 0 12px 22px rgba(79, 124, 230, 0.35);
        --glass-tab-active-text: #ffffff;
        --glass-btn-bg: linear-gradient(135deg, rgba(229, 242, 252, 0.96), rgba(255, 255, 255, 0.96));
        --glass-btn-border: rgba(190, 205, 220, 0.7);
        --glass-btn-shadow: 0 10px 18px rgba(15, 23, 42, 0.08);
        --glass-sheet-bg: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(244, 247, 250, 0.98));
        --glass-sheet-shadow: 0 -18px 30px rgba(15, 23, 42, 0.18);
        --sheet-handle-bg: rgba(15, 23, 42, 0.16);
        --accent-grad: linear-gradient(135deg, #6f83f6, #7ccfe6);
        --accent-shadow: 0 18px 30px rgba(79, 124, 230, 0.35);
        --accent-soft-bg: linear-gradient(180deg, rgba(217, 232, 245, 0.9), rgba(255, 255, 255, 0.96));
        --accent-soft-border: rgba(156, 186, 216, 0.8);
        --accent-soft-text: #3a4b5f;
        --exercise-card-bg: linear-gradient(135deg, rgba(214, 232, 248, 0.85), rgba(242, 248, 255, 0.95));
        --exercise-card-border: rgba(170, 205, 235, 0.7);
        --exercise-card-shadow: 0 14px 26px rgba(120, 150, 190, 0.18);
        --add-exercise-btn-bg: linear-gradient(135deg, rgba(214, 232, 248, 0.85), rgba(242, 248, 255, 0.95));
        --add-exercise-btn-border: rgba(110, 170, 220, 0.7);
        --add-exercise-btn-text: #1f6bff;
        --add-exercise-btn-shadow: 0 14px 26px rgba(120, 150, 190, 0.18);
        --history-card-bg: linear-gradient(135deg, rgba(214, 232, 248, 0.9), rgba(242, 248, 255, 0.96));
        --history-card-border: rgba(180, 205, 230, 0.7);
        --history-card-shadow: 0 16px 28px rgba(120, 150, 190, 0.2);
        --client-detail-card-bg: linear-gradient(135deg, rgba(214, 232, 248, 0.9), rgba(242, 248, 255, 0.96));
        --client-detail-card-border: rgba(180, 210, 235, 0.7);
        --client-detail-card-shadow: 0 18px 30px rgba(120, 150, 190, 0.2);
        --client-detail-field-bg: linear-gradient(135deg, rgba(230, 242, 255, 0.9), rgba(240, 247, 255, 0.95));
        --client-detail-field-border: rgba(180, 210, 235, 0.7);
        --client-detail-field-shadow: 0 10px 20px rgba(120, 150, 190, 0.18);
        --client-detail-tabs-bg: linear-gradient(180deg, rgba(230, 242, 255, 0.9), rgba(240, 247, 255, 0.95));
        --client-detail-tabs-border: rgba(170, 200, 230, 0.6);
        --client-detail-tabs-shadow: 0 12px 22px rgba(120, 150, 190, 0.2);
        --client-detail-tab-active-bg: linear-gradient(135deg, #7aa7ff, #86d5ff);
        --client-detail-tab-active-shadow: 0 10px 20px rgba(110, 160, 230, 0.35);
        --client-detail-action-bg: linear-gradient(135deg, #6fa3ff, #6cc6ff);
        --client-detail-action-border: rgba(120, 170, 220, 0.6);
        --client-detail-action-shadow: 0 16px 28px rgba(80, 140, 220, 0.35);
        --client-detail-copy-bg: linear-gradient(135deg, rgba(230, 242, 255, 0.9), rgba(240, 247, 255, 0.95));
        --client-detail-copy-border: rgba(180, 210, 235, 0.7);
        --client-detail-copy-shadow: 0 10px 20px rgba(120, 150, 190, 0.18);
        --clients-card-bg: linear-gradient(135deg, rgba(214, 232, 248, 0.6), rgba(242, 248, 255, 0.9));
        --clients-card-border: rgba(170, 205, 235, 0.6);
        --clients-card-shadow: 0 12px 22px rgba(15, 23, 42, 0.08);
        --clients-tab-bg: linear-gradient(180deg, rgba(240, 245, 250, 0.9), rgba(233, 240, 247, 0.95));
        --clients-tab-border: rgba(170, 190, 210, 0.5);
        --clients-tab-shadow: 0 10px 18px rgba(120, 150, 190, 0.14);
        --clients-tab-active-shadow: 0 14px 24px rgba(79, 124, 230, 0.3);
        --bottom-nav-bg: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(242, 244, 246, 0.98));
        --bottom-nav-border: rgba(200, 210, 220, 0.6);
        --bottom-nav-shadow: 0 -18px 36px rgba(15, 23, 42, 0.12);
        --glass-menu-bg: linear-gradient(140deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.65) 45%, rgba(255, 255, 255, 0.5) 100%);
        --glass-menu-border: rgba(255, 255, 255, 0.7);
        --glass-menu-btn-bg: rgba(255, 255, 255, 0.62);
        --glass-menu-btn-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.9), 0 6px 12px rgba(15, 23, 42, 0.08);
        --hero-chip-bg: rgba(255, 255, 255, 0.2);
        --hero-chip-border: rgba(255, 255, 255, 0.35);
        --booking-card-active-text: #ffffff;
        --booking-card-active-text-shadow: 0 6px 14px rgba(35, 80, 140, 0.35);
        --booking-card-bg: linear-gradient(135deg, rgba(255, 255, 255, 0.75), rgba(230, 238, 246, 0.8));
        --booking-card-border: rgba(255, 255, 255, 0.85);
        --booking-card-shadow: 0 18px 30px rgba(120, 150, 190, 0.2);
        --booking-card-active-bg: radial-gradient(circle at 40% 35%, rgba(170, 220, 255, 0.95), rgba(120, 185, 245, 0.9));
        --booking-card-active-border: rgba(130, 190, 235, 0.8);
        --booking-card-active-shadow: 0 22px 36px rgba(90, 150, 220, 0.35);
        --reminder-pill-bg: linear-gradient(135deg, rgba(255, 255, 255, 0.75), rgba(230, 238, 246, 0.82));
        --reminder-pill-border: rgba(255, 255, 255, 0.85);
        --reminder-pill-shadow: 0 16px 26px rgba(120, 150, 190, 0.2);
        --reminder-pill-active-bg: radial-gradient(circle at 40% 35%, rgba(170, 220, 255, 0.95), rgba(120, 185, 245, 0.9));
        --reminder-pill-active-border: rgba(130, 190, 235, 0.8);
        --reminder-pill-active-shadow: 0 20px 32px rgba(90, 150, 220, 0.35);
        --reminder-text: rgba(15, 23, 42, 0.65);
        --reminder-text-active: #ffffff;
        --reminder-text-shadow: 0 4px 12px rgba(35, 80, 140, 0.3);
        --schedule-month-pill-bg: linear-gradient(135deg, rgba(255, 255, 255, 0.78), rgba(230, 238, 246, 0.82));
        --schedule-month-pill-border: rgba(255, 255, 255, 0.85);
        --schedule-month-pill-shadow: 0 16px 26px rgba(120, 150, 190, 0.22);
        --schedule-month-text: rgba(15, 23, 42, 0.8);
        --schedule-month-btn-bg: rgba(255, 255, 255, 0.75);
        --schedule-month-btn-border: rgba(255, 255, 255, 0.9);
        --schedule-month-btn-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.85), 0 6px 12px rgba(120, 150, 190, 0.15);
        --schedule-switch-bg: rgba(255, 255, 255, 0.7);
        --schedule-switch-border: rgba(255, 255, 255, 0.85);
        --schedule-switch-shadow: 0 16px 26px rgba(120, 150, 190, 0.2);
        --schedule-switch-active-bg: radial-gradient(circle at 40% 35%, rgba(170, 220, 255, 0.95), rgba(120, 185, 245, 0.9));
        --schedule-switch-active-shadow: 0 14px 24px rgba(90, 150, 220, 0.3);
        --schedule-grid-wrap-bg: linear-gradient(135deg, rgba(255, 255, 255, 0.82), rgba(230, 238, 246, 0.86));
        --schedule-grid-wrap-border: rgba(255, 255, 255, 0.85);
        --schedule-grid-wrap-shadow: 0 20px 34px rgba(120, 150, 190, 0.22);
        --schedule-grid-header-bg: rgba(255, 255, 255, 0.5);
        --schedule-grid-line: rgba(120, 140, 170, 0.25);
        --schedule-day-active-bg: radial-gradient(circle at 50% 40%, rgba(170, 220, 255, 0.95), rgba(120, 185, 245, 0.9));
        --schedule-day-active-text: #ffffff;
        --schedule-session-bg: radial-gradient(circle at 40% 35%, rgba(170, 220, 255, 0.85), rgba(130, 190, 235, 0.85));
        --schedule-session-border: rgba(150, 200, 240, 0.8);
        --schedule-session-shadow: 0 10px 20px rgba(90, 150, 220, 0.25);
        --session-panel-bg: linear-gradient(180deg, rgba(188, 221, 242, 0.75) 0%, rgba(214, 232, 246, 0.65) 36%, rgba(236, 243, 250, 0.45) 72%, rgba(248, 251, 255, 0.25) 100%);
        --session-tabs-wrap-bg: linear-gradient(180deg, rgba(214, 232, 246, 0.9), rgba(236, 243, 250, 0.9));
        --session-tabs-wrap-border: rgba(160, 190, 215, 0.55);
        --session-tabs-wrap-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 12px 22px rgba(135, 160, 190, 0.18);
        --session-tab-text: #2b3442;
        --session-tab-active-bg: linear-gradient(90deg, #7f92f5 0%, #93c8f0 100%);
        --session-tab-active-shadow: 0 10px 20px rgba(110, 150, 220, 0.35);
        --session-tab-active-text: #ffffff;
        --session-divider: rgba(160, 190, 215, 0.45);
        --session-card-bg: #f7f9fc;
        --session-card-border: #d4dce9;
        --session-card-shadow: 0 10px 20px rgba(160, 175, 195, 0.12);
        --session-card-label: #2b3442;
        --session-mini-label: #6b7280;
        --session-card-value: #1f2937;
        --session-card-muted: #9aa3af;
        --session-check-bg: #f7f9fc;
        --session-check-border: #cbd6e6;
        --session-check-text: #1f2937;
        --session-info-bg: #f7f9fc;
        --session-info-border: #cbd6e6;
        --session-info-text: #1f2937;
        --session-primary-bg: linear-gradient(180deg, #c3ddf7 0%, #8fb7e8 100%);
        --session-primary-border: #bcd3ef;
        --session-primary-shadow: 0 16px 28px rgba(115, 150, 205, 0.28);
        --session-danger-bg: #d45656;
        --session-danger-border: #d46a6a;
        --session-danger-shadow: 0 10px 20px rgba(212, 86, 86, 0.25);
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
        --text-primary: #f0f3f7;
        --text-secondary: #b1bccb;
        --text-accent: #66afff;
        --font-regular: 500;
        --font-medium: 600;
        --font-strong: 800;
        --border: #323a4a;
        --border-2: #2b3242;
        --nav-border: #2a3140;
        --accent: #66afff;
        --accent-contrast: #0e1420;
        --success-bg: #1c3a28;
        --success-text: #7ee29c;
        --danger: #ff8a8a;
        --notes-page-bg: radial-gradient(120% 90% at 50% 0%, rgba(34, 48, 70, 0.95) 0%, rgba(24, 33, 48, 0.92) 45%, rgba(20, 26, 36, 0.95) 100%);
        --notes-title: #e7ecf4;
        --notes-row-bg: linear-gradient(135deg, rgba(31, 42, 60, 0.9), rgba(24, 32, 46, 0.9));
        --notes-row-border: rgba(255, 255, 255, 0.08);
        --notes-row-shadow: 0 16px 28px rgba(0, 0, 0, 0.35);
        --notes-row-text: #e7ecf4;
        --notes-row-btn-bg: linear-gradient(135deg, rgba(72, 110, 180, 0.6), rgba(46, 76, 134, 0.65));
        --notes-row-btn-border: rgba(120, 150, 210, 0.25);
        --notes-row-btn-shadow: 0 16px 30px rgba(10, 20, 40, 0.55);
        --notes-action: #ffffff;
        --notes-action-shadow: 0 4px 10px rgba(18, 30, 60, 0.6);
        --notes-empty-bg: rgba(20, 26, 36, 0.6);
        --notes-empty-border: rgba(120, 150, 210, 0.2);
        --notes-empty-text: #b8c2d2;
        --trainer-bg-home: radial-gradient(circle at 50% -20%, rgba(80, 120, 170, 0.3), transparent 60%),
          linear-gradient(180deg, #1b2432 0%, #151b24 45%, #0f141c 100%);
        --trainer-bg-schedule: radial-gradient(circle at 50% -15%, rgba(70, 110, 160, 0.25), transparent 60%),
          linear-gradient(180deg, #182231 0%, #141a24 45%, #0f141c 100%);
        --trainer-bg-clients: radial-gradient(circle at 50% -15%, rgba(70, 110, 160, 0.22), transparent 60%),
          linear-gradient(180deg, #182231 0%, #141a24 45%, #0f141c 100%);
        --trainer-bg-add-client: radial-gradient(circle at 50% -10%, rgba(70, 110, 160, 0.25), transparent 60%),
          linear-gradient(180deg, #182231 0%, #141a24 45%, #0f141c 100%);
        --trainer-bg-settings: radial-gradient(circle at 50% -10%, rgba(80, 120, 170, 0.28), transparent 60%),
          linear-gradient(180deg, #192434 0%, #141a24 45%, #0f141c 100%);
        --glass-hero-bg: linear-gradient(135deg, rgba(36, 48, 70, 0.95), rgba(26, 36, 54, 0.95));
        --glass-hero-border: rgba(120, 150, 200, 0.25);
        --glass-hero-shadow: 0 24px 40px rgba(0, 0, 0, 0.35);
        --home-hero-bg: linear-gradient(135deg, rgba(36, 48, 70, 0.95), rgba(26, 36, 54, 0.95));
        --home-hero-border: rgba(120, 150, 200, 0.25);
        --home-hero-shadow: 0 24px 40px rgba(0, 0, 0, 0.35);
        --glass-card-bg: linear-gradient(180deg, rgba(32, 42, 60, 0.9), rgba(24, 32, 46, 0.9));
        --glass-card-border: rgba(120, 150, 200, 0.25);
        --glass-card-shadow: 0 12px 22px rgba(0, 0, 0, 0.35);
        --glass-pill-bg: rgba(28, 38, 54, 0.9);
        --glass-pill-border: rgba(120, 150, 200, 0.25);
        --glass-pill-shadow: 0 8px 18px rgba(0, 0, 0, 0.28);
        --glass-tab-wrap-bg: rgba(26, 36, 52, 0.9);
        --glass-tab-wrap-border: rgba(120, 150, 200, 0.25);
        --glass-tab-active-bg: linear-gradient(135deg, #4f7bff, #5bb7ff);
        --glass-tab-active-shadow: 0 12px 22px rgba(60, 120, 220, 0.35);
        --glass-tab-active-text: #ffffff;
        --glass-btn-bg: linear-gradient(135deg, rgba(36, 48, 70, 0.9), rgba(30, 40, 58, 0.9));
        --glass-btn-border: rgba(120, 150, 200, 0.25);
        --glass-btn-shadow: 0 10px 18px rgba(0, 0, 0, 0.35);
        --glass-sheet-bg: linear-gradient(180deg, rgba(30, 40, 56, 0.98), rgba(20, 28, 40, 0.98));
        --glass-sheet-shadow: 0 -18px 30px rgba(0, 0, 0, 0.5);
        --sheet-handle-bg: rgba(255, 255, 255, 0.18);
        --accent-grad: linear-gradient(135deg, #5d7bff, #5bb7ff);
        --accent-shadow: 0 18px 30px rgba(40, 90, 180, 0.45);
        --accent-soft-bg: linear-gradient(180deg, rgba(47, 74, 120, 0.5), rgba(28, 40, 58, 0.65));
        --accent-soft-border: rgba(90, 120, 180, 0.55);
        --accent-soft-text: #d6e2f5;
        --exercise-card-bg: linear-gradient(135deg, rgba(44, 60, 88, 0.9), rgba(34, 46, 68, 0.9));
        --exercise-card-border: rgba(120, 150, 200, 0.35);
        --exercise-card-shadow: 0 14px 26px rgba(0, 0, 0, 0.45);
        --add-exercise-btn-bg: linear-gradient(135deg, rgba(44, 60, 88, 0.9), rgba(34, 46, 68, 0.9));
        --add-exercise-btn-border: rgba(120, 170, 220, 0.5);
        --add-exercise-btn-text: #8fb7ff;
        --add-exercise-btn-shadow: 0 14px 26px rgba(0, 0, 0, 0.45);
        --history-card-bg: linear-gradient(135deg, rgba(44, 60, 88, 0.9), rgba(34, 46, 68, 0.9));
        --history-card-border: rgba(120, 150, 200, 0.35);
        --history-card-shadow: 0 16px 28px rgba(0, 0, 0, 0.5);
        --client-detail-card-bg: linear-gradient(135deg, rgba(44, 60, 88, 0.9), rgba(34, 46, 68, 0.9));
        --client-detail-card-border: rgba(120, 150, 200, 0.35);
        --client-detail-card-shadow: 0 18px 30px rgba(0, 0, 0, 0.5);
        --client-detail-field-bg: linear-gradient(135deg, rgba(36, 48, 70, 0.9), rgba(28, 38, 56, 0.9));
        --client-detail-field-border: rgba(120, 150, 200, 0.35);
        --client-detail-field-shadow: 0 10px 20px rgba(0, 0, 0, 0.4);
        --client-detail-tabs-bg: linear-gradient(180deg, rgba(32, 42, 60, 0.9), rgba(26, 34, 48, 0.9));
        --client-detail-tabs-border: rgba(120, 150, 200, 0.35);
        --client-detail-tabs-shadow: 0 12px 22px rgba(0, 0, 0, 0.45);
        --client-detail-tab-active-bg: linear-gradient(135deg, #5d7bff, #5bb7ff);
        --client-detail-tab-active-shadow: 0 10px 20px rgba(40, 90, 180, 0.45);
        --client-detail-action-bg: linear-gradient(135deg, #5d7bff, #5bb7ff);
        --client-detail-action-border: rgba(120, 170, 220, 0.5);
        --client-detail-action-shadow: 0 16px 28px rgba(0, 0, 0, 0.5);
        --client-detail-copy-bg: linear-gradient(135deg, rgba(36, 48, 70, 0.9), rgba(28, 38, 56, 0.9));
        --client-detail-copy-border: rgba(120, 150, 200, 0.35);
        --client-detail-copy-shadow: 0 10px 20px rgba(0, 0, 0, 0.4);
        --clients-card-bg: linear-gradient(135deg, rgba(56, 72, 98, 0.9), rgba(42, 56, 78, 0.94));
        --clients-card-border: rgba(152, 186, 225, 0.45);
        --clients-card-shadow: 0 16px 28px rgba(0, 0, 0, 0.42);
        --clients-tab-bg: linear-gradient(180deg, rgba(28, 38, 54, 0.96), rgba(24, 32, 46, 0.96));
        --clients-tab-border: rgba(92, 116, 150, 0.55);
        --clients-tab-shadow: 0 10px 18px rgba(0, 0, 0, 0.3);
        --clients-tab-active-shadow: 0 14px 24px rgba(22, 52, 104, 0.4);
        --bottom-nav-bg: linear-gradient(180deg, rgba(28, 34, 44, 0.98), rgba(18, 22, 30, 0.98));
        --bottom-nav-border: rgba(70, 85, 110, 0.6);
        --bottom-nav-shadow: 0 -18px 36px rgba(0, 0, 0, 0.45);
        --glass-menu-bg: linear-gradient(140deg, rgba(30, 40, 56, 0.9) 0%, rgba(24, 32, 46, 0.8) 45%, rgba(20, 28, 40, 0.75) 100%);
        --glass-menu-border: rgba(120, 150, 200, 0.2);
        --glass-menu-btn-bg: rgba(30, 40, 56, 0.7);
        --glass-menu-btn-shadow: inset 0 1px 2px rgba(120, 150, 200, 0.08), 0 6px 12px rgba(0, 0, 0, 0.35);
        --hero-chip-bg: rgba(255, 255, 255, 0.08);
        --hero-chip-border: rgba(255, 255, 255, 0.18);
        --booking-card-active-text: #ffffff;
        --booking-card-active-text-shadow: 0 6px 14px rgba(8, 20, 40, 0.55);
        --booking-card-bg: linear-gradient(135deg, rgba(36, 46, 64, 0.85), rgba(26, 34, 48, 0.9));
        --booking-card-border: rgba(120, 150, 200, 0.25);
        --booking-card-shadow: 0 18px 30px rgba(0, 0, 0, 0.4);
        --booking-card-active-bg: radial-gradient(circle at 40% 35%, rgba(90, 140, 220, 0.9), rgba(60, 100, 180, 0.85));
        --booking-card-active-border: rgba(120, 170, 230, 0.6);
        --booking-card-active-shadow: 0 22px 36px rgba(20, 40, 80, 0.55);
        --reminder-pill-bg: linear-gradient(135deg, rgba(36, 46, 64, 0.85), rgba(26, 34, 48, 0.9));
        --reminder-pill-border: rgba(120, 150, 200, 0.25);
        --reminder-pill-shadow: 0 16px 26px rgba(0, 0, 0, 0.45);
        --reminder-pill-active-bg: radial-gradient(circle at 40% 35%, rgba(90, 140, 220, 0.9), rgba(60, 100, 180, 0.85));
        --reminder-pill-active-border: rgba(120, 170, 230, 0.6);
        --reminder-pill-active-shadow: 0 20px 32px rgba(20, 40, 80, 0.6);
        --reminder-text: rgba(230, 235, 245, 0.75);
        --reminder-text-active: #ffffff;
        --reminder-text-shadow: 0 4px 12px rgba(8, 20, 40, 0.55);
        --schedule-month-pill-bg: linear-gradient(135deg, rgba(36, 46, 64, 0.85), rgba(26, 34, 48, 0.9));
        --schedule-month-pill-border: rgba(120, 150, 200, 0.25);
        --schedule-month-pill-shadow: 0 16px 26px rgba(0, 0, 0, 0.45);
        --schedule-month-text: rgba(230, 235, 245, 0.8);
        --schedule-month-btn-bg: rgba(30, 40, 56, 0.75);
        --schedule-month-btn-border: rgba(120, 150, 200, 0.3);
        --schedule-month-btn-shadow: inset 0 1px 2px rgba(120, 150, 200, 0.08), 0 6px 12px rgba(0, 0, 0, 0.35);
        --schedule-switch-bg: rgba(30, 40, 56, 0.8);
        --schedule-switch-border: rgba(120, 150, 200, 0.3);
        --schedule-switch-shadow: 0 16px 26px rgba(0, 0, 0, 0.45);
        --schedule-switch-active-bg: radial-gradient(circle at 40% 35%, rgba(90, 140, 220, 0.9), rgba(60, 100, 180, 0.85));
        --schedule-switch-active-shadow: 0 14px 24px rgba(20, 40, 80, 0.5);
        --schedule-grid-wrap-bg: linear-gradient(135deg, rgba(36, 46, 64, 0.85), rgba(26, 34, 48, 0.9));
        --schedule-grid-wrap-border: rgba(120, 150, 200, 0.25);
        --schedule-grid-wrap-shadow: 0 20px 34px rgba(0, 0, 0, 0.55);
        --schedule-grid-header-bg: rgba(30, 40, 56, 0.6);
        --schedule-grid-line: rgba(120, 150, 190, 0.25);
        --schedule-day-active-bg: radial-gradient(circle at 50% 40%, rgba(90, 140, 220, 0.9), rgba(60, 100, 180, 0.85));
        --schedule-day-active-text: #ffffff;
        --schedule-session-bg: radial-gradient(circle at 40% 35%, rgba(90, 140, 220, 0.85), rgba(60, 100, 180, 0.85));
        --schedule-session-border: rgba(120, 170, 230, 0.6);
        --schedule-session-shadow: 0 10px 20px rgba(20, 40, 80, 0.5);
        --session-panel-bg: linear-gradient(180deg, rgba(36, 48, 70, 0.85) 0%, rgba(28, 38, 56, 0.75) 40%, rgba(22, 30, 44, 0.55) 80%, rgba(18, 24, 34, 0.35) 100%);
        --session-tabs-wrap-bg: linear-gradient(180deg, rgba(36, 48, 70, 0.9), rgba(28, 38, 56, 0.9));
        --session-tabs-wrap-border: rgba(120, 150, 200, 0.35);
        --session-tabs-wrap-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 12px 22px rgba(0, 0, 0, 0.35);
        --session-tab-text: #e5e9f0;
        --session-tab-active-bg: linear-gradient(90deg, #6f7fe8 0%, #7cb4e8 100%);
        --session-tab-active-shadow: 0 10px 20px rgba(45, 90, 150, 0.45);
        --session-tab-active-text: #ffffff;
        --session-divider: rgba(120, 150, 190, 0.35);
        --session-card-bg: #262c36;
        --session-card-border: #384254;
        --session-card-shadow: 0 12px 22px rgba(0, 0, 0, 0.45);
        --session-card-label: #e3e8f0;
        --session-mini-label: #a9b3c2;
        --session-card-value: #f4f7fb;
        --session-card-muted: #9aa6b6;
        --session-check-bg: #2c3340;
        --session-check-border: #475268;
        --session-check-text: #f4f7fb;
        --session-info-bg: #2c3340;
        --session-info-border: #475268;
        --session-info-text: #f4f7fb;
        --session-primary-bg: linear-gradient(180deg, #6fa0e8 0%, #4f7fd6 100%);
        --session-primary-border: #5f8fda;
        --session-primary-shadow: 0 16px 28px rgba(35, 70, 120, 0.45);
        --session-danger-bg: #c94d4d;
        --session-danger-border: #d36060;
        --session-danger-shadow: 0 10px 20px rgba(201, 77, 77, 0.35);
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
      .role-invite-input::placeholder { color: rgba(255, 255, 255, 0.85); }
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
  return <HugeiconsIcon icon={Home08Icon} size={22} strokeWidth={1.9} />;
}

function IconCalendar() {
  return <HugeiconsIcon icon={Calendar04Icon} size={22} strokeWidth={1.9} />;
}

function IconUsers() {
  return <HugeiconsIcon icon={UserMultiple02Icon} size={22} strokeWidth={1.9} />;
}

function IconSettings() {
  return <HugeiconsIcon icon={Settings01Icon} size={22} strokeWidth={1.9} />;
}

function IconPlus({ size = 30, strokeWidth = 2.6 }: IconProps) {
  return (
    <SvgIcon size={size} strokeWidth={strokeWidth}>
      <path d="M12 5v14M5 12h14" />
    </SvgIcon>
  );
}


function IconUser({ size = 22, strokeWidth = 1.9 }: IconProps) {
  return (
    <SvgIcon size={size} strokeWidth={strokeWidth}>
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

function IconClock() {
  return (
    <SvgIcon>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.8 2" />
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

function IconCopy() {
  return (
    <SvgIcon size={18} strokeWidth={2}>
      <rect x="9" y="9" width="10" height="10" rx="2" />
      <path d="M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" />
    </SvgIcon>
  );
}

function IconTrash({ size = 22, strokeWidth = 2.1 }: IconProps) {
  return (
    <SvgIcon size={size} strokeWidth={strokeWidth}>
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 14h10l1-14" />
      <path d="M9 7V4h6v3" />
    </SvgIcon>
  );
}

function IconPencil({ size = 22, strokeWidth = 2.1 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12.7 4.6l6.7 6.7M4 20l4.9-1.1 9.7-9.7a2 2 0 0 0 0-2.8l-1-1a2 2 0 0 0-2.8 0L5.1 15.1 4 20z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCheck({ size = 18, strokeWidth = 2.2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M5 12.5l4 4 10-10"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCard({ size = 22, strokeWidth = 1.9 }: IconProps) {
  return (
    <SvgIcon size={size} strokeWidth={strokeWidth}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
      <path d="M7.5 15h4" />
    </SvgIcon>
  );
}

function IconHistory({ size = 22, strokeWidth = 1.9 }: IconProps) {
  return (
    <SvgIcon size={size} strokeWidth={strokeWidth}>
      <path d="M12 7v5l3 2" />
      <path d="M3.5 12a8.5 8.5 0 1 0 2.2-5.7" />
      <path d="M3 5.5h4v4" />
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
    color: "var(--text-primary)",
    fontWeight: "var(--font-regular)",
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
    fontWeight: "var(--font-medium)",
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
    fontWeight: "var(--font-strong)",
    letterSpacing: -0.25,
    marginTop: 6,
    color: "var(--text-primary)",
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
    borderRadius: 18,
    border: "1px solid var(--glass-btn-border)",
    background: "var(--glass-btn-bg)",
    cursor: "pointer",
    fontWeight: "var(--font-medium)",
    width: "100%",
    color: "var(--text-primary)",
    boxShadow: "var(--glass-btn-shadow)",
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
    color: "var(--text-secondary)",
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
  settingsHero: {
    marginTop: 6,
  },
  settingsHeroCard: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "16px",
    borderRadius: 22,
    border: "1px solid var(--glass-hero-border)",
    background: "var(--glass-hero-bg)",
    boxShadow: "var(--glass-hero-shadow)",
    color: "#fff",
  },
  settingsHeroName: {
    fontSize: 22,
    fontWeight: "var(--font-strong)",
    letterSpacing: -0.3,
    color: "#fff",
    lineHeight: 1.1,
  },
  settingsHeroHandle: {
    marginTop: 4,
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.9)",
  },
  settingsHeroRole: {
    marginTop: 8,
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 12px",
    borderRadius: 999,
    background: "var(--hero-chip-bg)",
    border: "1px solid var(--hero-chip-border)",
    fontSize: 12,
    fontWeight: 700,
    color: "#fff",
  },
  settingsPersonalRow: {
    marginTop: 14,
    width: "100%",
    borderRadius: 22,
    border: "1px solid var(--glass-card-border)",
    background: "var(--glass-card-bg)",
    boxShadow: "var(--glass-card-shadow)",
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    cursor: "pointer",
  },
  settingsPersonalLabel: {
    fontSize: 16,
    fontWeight: "var(--font-strong)",
    color: "var(--text-primary)",
  },
  settingsPersonalPlus: {
    width: 36,
    height: 36,
    borderRadius: 999,
    border: "1px solid var(--glass-card-border)",
    background: "var(--glass-card-bg)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    color: "var(--text)",
  },
  settingsSectionLabel: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: "var(--font-medium)",
    color: "var(--text-secondary)",
  },
  settingsGroup: {
    marginTop: 8,
    borderRadius: 20,
    border: "1px solid var(--glass-card-border)",
    background: "var(--glass-card-bg)",
    boxShadow: "var(--glass-card-shadow)",
    overflow: "hidden",
  },
  settingsRow: {
    width: "100%",
    border: "none",
    background: "transparent",
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    cursor: "pointer",
  },
  settingsRowLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  settingsRowIcon: {
    width: 28,
    height: 28,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--muted)",
  },
  settingsRowTitle: {
    fontSize: 15,
    fontWeight: "var(--font-medium)",
    color: "var(--text-primary)",
  },
  settingsRowSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: "var(--text-secondary)",
  },
  settingsRowRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flex: "0 0 auto",
  },
  settingsRowRightText: {
    fontSize: 13,
    color: "var(--text-secondary)",
    fontWeight: "var(--font-medium)",
  },
  settingsRowChevron: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--muted)",
  },
  settingsDangerBtn: {
    marginTop: 18,
    width: "100%",
    padding: "14px 16px",
    borderRadius: 999,
    border: "1px solid rgba(248, 113, 113, 0.5)",
    background: "linear-gradient(135deg, rgba(248, 113, 113, 0.9), rgba(239, 68, 68, 0.9))",
    color: "#fff",
    fontWeight: "var(--font-strong)",
    fontSize: 16,
    cursor: "pointer",
    boxShadow: "0 16px 26px rgba(239, 68, 68, 0.35)",
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
    padding: 20,
    borderRadius: 24,
    border: "1px solid rgba(110, 135, 220, 0.5)",
    background: "var(--accent-grad)",
    boxShadow: "var(--accent-shadow)",
    color: "#fff",
  },
  rolePage: {
    minHeight: "100vh",
    background: "var(--accent-grad)",
  },
  roleInviteInput: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 999,
    border: "1px solid rgba(255, 255, 255, 0.65)",
    background: "rgba(255, 255, 255, 0.2)",
    padding: "12px 16px",
    fontSize: 16,
    outline: "none",
    color: "#ffffff",
    boxShadow: "0 12px 22px rgba(30, 60, 140, 0.18)",
  },
  roleInviteBtn: {
    marginTop: 10,
    width: "100%",
    height: 52,
    borderRadius: 999,
    borderColor: "rgba(255, 255, 255, 0.6)",
    background: "rgba(255, 255, 255, 0.3)",
    color: "#ffffff",
    fontWeight: 800,
    fontSize: 16,
    boxShadow: "0 16px 28px rgba(30, 60, 140, 0.25)",
  },
  roleInviteTitle: {
    fontSize: 22,
    fontWeight: "var(--font-strong)",
    color: "#ffffff",
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  roleInviteIntro: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.88)",
    marginTop: 0,
    lineHeight: 1.4,
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
    fontWeight: 700,
    color: "rgba(255, 255, 255, 0.9)",
  },
  roleName: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: 800,
    color: "#fff",
    letterSpacing: -0.3,
  },
  roleIntro: {
    marginTop: 12,
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.92)",
    lineHeight: 1.4,
  },
  roleButtons: {
    marginTop: 16,
    display: "grid",
    gap: 10,
  },
  roleBtnPrimary: {
    background: "rgba(255, 255, 255, 0.2)",
    color: "#fff",
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  roleBtnSecondary: {
    background: "rgba(255, 255, 255, 0.2)",
    color: "#fff",
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  roleNote: {
    marginTop: 12,
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.82)",
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
    fontWeight: "var(--font-strong)",
    color: "var(--text-primary)",
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
    fontWeight: "var(--font-medium)",
    marginBottom: 10,
    letterSpacing: -0.2,
    color: "var(--text-primary)",
    lineHeight: 1.3,
  },
  sectionHeaderSmall: {
    fontSize: 16,
    fontWeight: "var(--font-strong)",
    letterSpacing: -0.15,
    marginBottom: 8,
    color: "var(--text-primary)",
  },

  listBlock: {
    borderTop: "1px solid var(--border-2)",
    borderBottom: "1px solid var(--border-2)",
  },
  clientsList: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  clientsCard: {
    borderRadius: 24,
    border: "1px solid var(--clients-card-border)",
    background: "var(--clients-card-bg)",
    boxShadow: "var(--clients-card-shadow)",
    padding: "8px 10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  clientsCardBtn: {
    flex: 1,
    border: "none",
    background: "transparent",
    padding: "12px 8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    cursor: "pointer",
    minWidth: 0,
  },
  clientsRowLeft: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    minWidth: 0,
  },
  clientsName: {
    fontWeight: 700,
    fontSize: 18,
    color: "var(--text)",
    letterSpacing: -0.2,
    lineHeight: 1.2,
  },
  clientsAvatar: {
    width: 52,
    height: 52,
    borderRadius: "50%",
    background: "var(--accent-grad)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "var(--accent-shadow)",
    color: "#ffffff",
    fontWeight: 800,
    fontSize: 22,
    flex: "0 0 auto",
  },
  clientsAvatarText: {
    lineHeight: 1,
  },
  exerciseListBlock: {
    border: "none",
    borderRadius: 18,
    background: "transparent",
    padding: 0,
    boxShadow: "none",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  rowWrap: {
    display: "flex",
    alignItems: "stretch",
    gap: 10,
  },
  exerciseCard: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    borderRadius: 22,
    background: "var(--exercise-card-bg)",
    padding: "14px 16px",
    border: "1px solid var(--exercise-card-border)",
    boxShadow: "var(--exercise-card-shadow)",
    cursor: "pointer",
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
    fontWeight: "var(--font-medium)",
    fontSize: 15,
    color: "var(--text-primary)",
    letterSpacing: -0.1,
    lineHeight: 1.25,
  },
  exerciseTitle: {
    fontWeight: 700,
    fontSize: 16,
    color: "var(--text)",
    letterSpacing: -0.1,
    lineHeight: 1.25,
    paddingLeft: 6,
  },
  exerciseSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: "var(--muted)",
    lineHeight: 1.35,
    paddingLeft: 6,
  },
  weightInlineRow: {
    display: "flex",
    alignItems: "flex-start",
    flexDirection: "column",
    gap: 12,
  },
  weightInlineControls: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
  },
  weightInlineInput: {
    flex: 1,
    width: "100%",
    height: 48,
    borderRadius: 999,
    border: "1px solid var(--glass-pill-border)",
    background: "var(--glass-pill-bg)",
    padding: "0 18px",
    textAlign: "left",
    fontSize: 16,
    fontWeight: 700,
    color: "var(--text)",
    boxShadow: "var(--glass-pill-shadow)",
  },
  weightInlineSaveBtn: {
    width: 48,
    height: 48,
    borderRadius: 999,
    border: "none",
    background: "var(--accent-grad)",
    color: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "var(--accent-shadow)",
  },
  rowSubtitle: {
    marginTop: 2,
    fontSize: 13,
    opacity: 0.75,
    lineHeight: 1.35,
    color: "var(--text-secondary)",
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
    color: "var(--text-secondary)",
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
    alignItems: "center",
    gap: 10,
  },
  exerciseWeightRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
  },
  exerciseInput: {
    border: "1px solid rgba(15, 23, 42, 0.28)",
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 15,
    background: "transparent",
    color: "var(--text)",
    flex: 1,
    minWidth: 0,
    boxShadow: "none",
  },
  exerciseTrashBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    border: "1px solid rgba(15, 23, 42, 0.32)",
    background: "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flex: "0 0 auto",
    color: "var(--text)",
    fontSize: 18,
    fontWeight: 700,
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
  backBtnSpacer: {
    width: 36,
    height: 36,
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
  homeWorkPage: {
    background: "var(--trainer-bg-home)",
  },
  schedulePage: {
    background: "var(--trainer-bg-schedule)",
  },
  clientsPage: {
    background: "var(--trainer-bg-clients)",
  },
  addClientPage: {
    background: "var(--trainer-bg-add-client)",
  },
  settingsPage: {
    background: "var(--trainer-bg-settings)",
  },
  bookingPage: {
    minHeight: "100vh",
    background: "var(--trainer-bg-settings)",
    paddingTop: 26,
    paddingBottom: 120,
  },
  bookingHeader: {
    position: "relative",
    minHeight: 44,
    marginBottom: 28,
  },
  bookingTitle: {
    fontSize: 40,
    fontWeight: 400,
    letterSpacing: -0.9,
    lineHeight: 1.05,
    color: "var(--text)",
    textAlign: "left",
    paddingLeft: 2,
  },
  settingsScreenHint: {
    marginTop: 10,
    color: "var(--muted)",
    fontSize: 16,
    lineHeight: 1.45,
    maxWidth: 640,
  },
  bookingOptionsRow: {
    marginTop: 28,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 22,
    alignItems: "center",
  },
  bookingOptionCard: {
    border: "1px solid var(--booking-card-border)",
    background: "var(--booking-card-bg)",
    boxShadow: "var(--booking-card-shadow)",
    borderRadius: 44,
    minHeight: 210,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "18px 16px",
    cursor: "pointer",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
  },
  bookingOptionCardActive: {
    borderColor: "var(--booking-card-active-border)",
    background: "var(--booking-card-active-bg)",
    boxShadow: "var(--booking-card-active-shadow)",
  },
  bookingOptionText: {
    fontSize: 21,
    fontWeight: 500,
    color: "var(--text)",
    textAlign: "center",
    lineHeight: 1.2,
  },
  bookingOptionTextActive: {
    color: "var(--booking-card-active-text)",
    textShadow: "var(--booking-card-active-text-shadow)",
  },
  remindersList: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    marginTop: 6,
  },
  remindersPill: {
    width: "100%",
    borderRadius: 999,
    border: "1px solid var(--reminder-pill-border)",
    background: "var(--reminder-pill-bg)",
    boxShadow: "var(--reminder-pill-shadow)",
    padding: "16px 20px",
    fontSize: 20,
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    cursor: "pointer",
    position: "relative",
  },
  remindersPillActive: {
    background: "var(--reminder-pill-active-bg)",
    borderColor: "var(--reminder-pill-active-border)",
    boxShadow: "var(--reminder-pill-active-shadow)",
  },
  remindersCheck: {
    position: "absolute",
    left: 18,
    fontSize: 26,
    fontWeight: 700,
    color: "var(--reminder-text-active)",
    textShadow: "var(--reminder-text-shadow)",
  },
  remindersLabel: {
    color: "var(--reminder-text)",
    textShadow: "none",
  },
  remindersLabelActive: {
    color: "var(--reminder-text-active)",
    textShadow: "var(--reminder-text-shadow)",
  },
  paymentHistoryList: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    marginTop: 10,
  },
  paymentHistoryCard: {
    borderRadius: 24,
    border: "1px solid var(--glass-card-border)",
    background: "var(--glass-card-bg)",
    boxShadow: "var(--glass-card-shadow)",
    padding: "18px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  paymentHistoryDate: {
    fontSize: 18,
    fontWeight: "var(--font-medium)",
    color: "var(--text-primary)",
    letterSpacing: -0.2,
  },
  paymentHistoryAmount: {
    fontSize: 18,
    fontWeight: "var(--font-strong)",
    color: "var(--text-primary)",
    letterSpacing: -0.2,
    whiteSpace: "nowrap",
  },
  paymentHistoryEmpty: {
    borderRadius: 24,
    border: "1px solid var(--glass-card-border)",
    background: "var(--glass-card-bg)",
    boxShadow: "var(--glass-card-shadow)",
    padding: "20px 18px",
    fontSize: 16,
    color: "var(--text-secondary)",
    lineHeight: 1.45,
  },
  paymentMethodsHeader: {
    minHeight: 44,
    marginBottom: 28,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  paymentMethodsTitle: {
    fontSize: 18,
    fontWeight: "var(--font-strong)",
    color: "var(--text-primary)",
    letterSpacing: -0.3,
    textAlign: "left",
    flex: 1,
    minWidth: 0,
    paddingLeft: 48,
  },
  paymentMethodsHeaderRight: {
    display: "flex",
    justifyContent: "flex-end",
    flex: "0 0 auto",
  },
  paymentMethodsEditBtn: {
    height: 36,
    border: "1px solid var(--glass-card-border)",
    background: "var(--glass-card-bg)",
    color: "var(--accent)",
    fontSize: 15,
    fontWeight: "var(--font-medium)",
    cursor: "pointer",
    padding: "0 14px",
    borderRadius: 999,
    boxShadow: "var(--glass-card-shadow)",
  },
  paymentMethodsStack: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    marginTop: 6,
  },
  paymentMethodCard: {
    borderRadius: 26,
    border: "1px solid var(--glass-card-border)",
    background: "var(--glass-card-bg)",
    boxShadow: "var(--glass-card-shadow)",
    padding: "18px 18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  paymentMethodCardLeft: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    minWidth: 0,
  },
  paymentMethodIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    background: "var(--accent-soft)",
    color: "var(--accent)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
  },
  paymentMethodBrand: {
    fontSize: 16,
    fontWeight: "var(--font-medium)",
    color: "var(--text-primary)",
    lineHeight: 1.2,
  },
  paymentMethodMasked: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: "var(--font-strong)",
    color: "var(--text-primary)",
    letterSpacing: 0.4,
  },
  paymentMethodStatus: {
    width: 42,
    height: 42,
    borderRadius: "50%",
    background: "var(--accent-grad)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "var(--accent-shadow)",
    flex: "0 0 auto",
  },
  paymentMethodDeleteBtn: {
    width: 42,
    height: 42,
    borderRadius: "50%",
    border: "none",
    background: "linear-gradient(135deg, rgba(255, 110, 110, 0.96), rgba(239, 68, 68, 0.96))",
    color: "#fff",
    fontSize: 26,
    lineHeight: "42px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "0 16px 24px rgba(239, 68, 68, 0.28)",
    flex: "0 0 auto",
    padding: 0,
  },
  paymentMethodAddBtn: {
    width: "100%",
    borderRadius: 26,
    border: "1px solid var(--glass-card-border)",
    background: "var(--glass-card-bg)",
    boxShadow: "var(--glass-card-shadow)",
    padding: "18px 18px",
    display: "flex",
    alignItems: "center",
    gap: 14,
    cursor: "pointer",
    textAlign: "left",
  },
  paymentMethodAddIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    background: "var(--accent-grad)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "var(--accent-shadow)",
    flex: "0 0 auto",
  },
  paymentMethodAddText: {
    fontSize: 18,
    fontWeight: "var(--font-medium)",
    color: "var(--text-primary)",
    letterSpacing: -0.2,
  },
  homeIntroWork: {
    gap: 16,
  },
  homeAvatarRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  homeHero: {
    padding: "14px",
    borderRadius: 26,
    border: "1px solid var(--home-hero-border)",
    background: "var(--home-hero-bg)",
    boxShadow: "var(--home-hero-shadow)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  homeHeroTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  homeHeroText: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  homeHeroTitle: {
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: -0.2,
    color: "var(--text)",
  },
  homeHeroSubtitle: {
    fontSize: 14,
    color: "var(--muted)",
  },
  homeNotesBtn: {
    border: "1px solid var(--glass-pill-border)",
    background: "var(--glass-pill-bg)",
    color: "var(--text)",
    padding: "6px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "var(--glass-pill-shadow)",
  },
  homeStatusPill: {
    padding: "6px 12px",
    borderRadius: 999,
    border: "1px solid var(--glass-pill-border)",
    background: "var(--glass-pill-bg)",
    fontSize: 12,
    fontWeight: 700,
    boxShadow: "var(--glass-pill-shadow)",
  },
  homeTabs: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: 6,
    borderRadius: 999,
    border: "1px solid var(--glass-tab-wrap-border)",
    background: "var(--glass-tab-wrap-bg)",
  },
  homeTab: {
    flex: 1,
    border: "none",
    background: "transparent",
    padding: "8px 10px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
    color: "var(--muted)",
    cursor: "pointer",
    letterSpacing: -0.1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  homeTabActive: {
    background: "var(--glass-tab-active-bg)",
    color: "var(--glass-tab-active-text)",
    boxShadow: "var(--glass-tab-active-shadow)",
  },
  homeStatusChip: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(77, 163, 255, 0.25)",
    background: "rgba(77, 163, 255, 0.08)",
    fontSize: 12,
    fontWeight: 700,
  },
  homeStatusChipButton: {
    cursor: "pointer",
    appearance: "none",
    font: "inherit",
    color: "inherit",
  },
  notesScreen: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
  },
  notesPage: {
    minHeight: "100vh",
    background: "var(--notes-page-bg)",
    paddingTop: 26,
    paddingBottom: 120,
  },
  notesTopBar: {
    justifyContent: "center",
    marginBottom: 18,
  },
  notesTitle: {
    fontFamily: "inherit",
    fontSize: 24,
    fontWeight: "var(--font-strong)",
    letterSpacing: -0.2,
    color: "var(--notes-title)",
    paddingLeft: 0,
    paddingRight: 0,
  },
  notesTopBarDivider: {
    height: 0,
    background: "transparent",
    marginBottom: 8,
  },
  notesList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    paddingBottom: 20,
  },
  notesRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 18px",
    borderRadius: 999,
    border: "1px solid var(--notes-row-border)",
    background: "var(--notes-row-bg)",
    boxShadow: "var(--notes-row-shadow)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    color: "var(--notes-row-text)",
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: -0.1,
    textAlign: "left",
    width: "100%",
    boxSizing: "border-box",
  },
  notesSwipeWrap: {
    position: "relative",
    width: "100%",
  },
  notesSwipeActions: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "0 6px",
  },
  notesSwipeBtn: {
    width: 56,
    height: 48,
    borderRadius: 999,
    border: "1px solid rgba(255, 255, 255, 0.45)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    boxShadow: "0 10px 20px rgba(15, 23, 42, 0.12)",
  },
  notesSwipeEdit: {
    background: "var(--accent-grad)",
    boxShadow: "var(--accent-shadow)",
  },
  notesSwipeDelete: {
    background: "linear-gradient(135deg, rgba(244, 97, 97, 0.95), rgba(220, 80, 80, 0.95))",
    boxShadow: "0 12px 22px rgba(220, 80, 80, 0.35)",
  },
  notesSwipeRow: {
    position: "relative",
    zIndex: 1,
    transition: "transform 0.12s ease",
    touchAction: "pan-y",
  },
  notesTaskToggle: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    border: "2px solid rgba(84, 192, 198, 0.8)",
    background: "transparent",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    opacity: 1,
    visibility: "visible",
  },
  notesTaskToggleActive: {
    background: "rgba(84, 192, 198, 0.25)",
    borderColor: "rgba(84, 192, 198, 1)",
  },
  notesTaskDone: {
    opacity: 0.6,
    textDecoration: "line-through",
  },
  notesRowButton: {
    cursor: "pointer",
    background: "var(--notes-row-btn-bg)",
    borderColor: "var(--notes-row-btn-border)",
    boxShadow: "var(--notes-row-btn-shadow)",
  },
  notesRowTitle: {
    opacity: 0.92,
  },
  notesRowAction: {
    fontSize: 22,
    fontWeight: 700,
    color: "var(--notes-action)",
    textShadow: "var(--notes-action-shadow)",
  },
  notesRowActionDisabled: {
    opacity: 0.5,
  },
  notesInput: {
    flex: 1,
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: -0.2,
    color: "var(--notes-row-text)",
    opacity: 1,
  },
  notesEmpty: {
    padding: "12px 16px",
    borderRadius: 18,
    border: "1px solid var(--notes-empty-border)",
    background: "var(--notes-empty-bg)",
    color: "var(--notes-empty-text)",
    fontSize: 14,
  },
  notesError: {
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid rgba(239, 68, 68, 0.3)",
    background: "rgba(255, 235, 235, 0.7)",
    color: "#b91c1c",
    fontSize: 13,
  },
  homeGreeting: {
    padding: "12px 16px",
    borderRadius: 18,
    border: "1px solid var(--glass-card-border)",
    background: "var(--glass-card-bg)",
    boxShadow: "var(--glass-card-shadow)",
    color: "var(--text-primary)",
    fontSize: 17,
    fontWeight: "var(--font-medium)",
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
    padding: "12px 14px 14px",
    borderRadius: 18,
    border: "1px solid var(--glass-card-border)",
    background: "var(--glass-card-bg)",
    boxShadow: "var(--glass-card-shadow)",
  },
  homeNextBlockWork: {
    marginTop: 8,
  },
  homeNextCardWork: {
    padding: "18px 18px 16px",
    borderRadius: 26,
    border: "1px solid rgba(110, 135, 220, 0.5)",
    background: "var(--accent-grad)",
    boxShadow: "var(--accent-shadow)",
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
    textAlign: "left",
    cursor: "pointer",
    display: "block",
    color: "#fff",
  },
  homeNextHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  homeNextLabel: {
    fontSize: 14,
    fontWeight: 700,
    color: "rgba(255, 255, 255, 0.9)",
  },
  homeNextStatusPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 999,
    background: "var(--glass-pill-bg)",
    fontSize: 12,
    fontWeight: 700,
  },
  homeNextStatusDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
  },
  homeNextTimeWork: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: -0.4,
  },
  homeNextMetaWork: {
    marginTop: 6,
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.9)",
  },
  homeNextTitle: {
    fontSize: 14,
    fontWeight: "var(--font-medium)",
    color: "var(--text-secondary)",
    marginBottom: 8,
  },
  homeNextCard: {
    padding: "12px 14px",
    borderRadius: 18,
    border: "1px solid var(--glass-card-border)",
    background: "var(--glass-card-bg)",
    boxShadow: "var(--glass-card-shadow)",
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
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
    fontWeight: "var(--font-strong)",
    color: "var(--text-primary)",
  },
  homeNextStatus: {
    fontSize: 12,
    fontWeight: "var(--font-medium)",
    letterSpacing: -0.1,
  },
  homeNextMeta: {
    marginTop: 6,
    fontSize: 14,
    color: "var(--text-secondary)",
  },
  homeNextEmpty: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px dashed var(--glass-card-border)",
    color: "var(--text-secondary)",
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
    color: "var(--text-secondary)",
  },
  homeNextContactLink: {
    border: "none",
    background: "transparent",
    padding: 0,
    color: "var(--text-accent)",
    fontSize: 14,
    fontWeight: "var(--font-strong)",
    cursor: "pointer",
  },
  homeTodayBlock: {
    marginTop: 10,
    padding: "12px 14px 14px",
    borderRadius: 18,
    border: "1px solid var(--glass-card-border)",
    background: "var(--glass-card-bg)",
    boxShadow: "var(--glass-card-shadow)",
  },
  homeStatsBlock: {
    marginTop: 16,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  homeStatsTitle: {
    fontSize: 18,
    fontWeight: "var(--font-strong)",
    letterSpacing: -0.2,
    color: "var(--text-primary)",
  },
  homeStatsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  homeStatsCard: {
    padding: "14px 16px",
    borderRadius: 18,
    border: "1px solid var(--glass-card-border)",
    background: "var(--glass-card-bg)",
    boxShadow: "var(--glass-card-shadow)",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  homeStatsLabel: {
    fontSize: 12,
    fontWeight: "var(--font-medium)",
    color: "var(--text-secondary)",
  },
  homeStatsValue: {
    fontSize: 24,
    fontWeight: "var(--font-strong)",
    color: "var(--text-primary)",
  },
  homeTodayCard: {
    padding: "12px 14px",
    borderRadius: 18,
    border: "1px solid var(--glass-card-border)",
    background: "var(--glass-card-bg)",
    boxShadow: "var(--glass-card-shadow)",
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
    fontWeight: "var(--font-medium)",
    color: "var(--text-secondary)",
    textAlign: "center",
  },
  homeTodayRowValues: {
    marginTop: 6,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    columnGap: 16,
    fontSize: 20,
    fontWeight: "var(--font-strong)",
    color: "var(--text-primary)",
    textAlign: "center",
  },
  homeWeekBlock: {
    marginTop: 10,
    padding: "12px 14px 14px",
    borderRadius: 18,
    border: "1px solid var(--glass-card-border)",
    background: "var(--glass-card-bg)",
    boxShadow: "var(--glass-card-shadow)",
    textAlign: "left",
  },
  homeWeekBlockWork: {
    marginTop: 16,
  },
  homeWeekCardWork: {
    padding: "14px 16px",
    borderRadius: 20,
    border: "1px solid var(--glass-card-border)",
    background: "var(--glass-card-bg)",
    boxShadow: "var(--glass-card-shadow)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  homeWeekLabelWork: {
    fontSize: 14,
    fontWeight: 700,
    color: "var(--text)",
  },
  homeWeekValueWork: {
    fontSize: 22,
    fontWeight: 800,
    color: "var(--text)",
  },
  homeWeekCard: {
    marginTop: 6,
    padding: "12px 14px",
    borderRadius: 18,
    border: "1px solid var(--glass-card-border)",
    background: "var(--glass-card-bg)",
    boxShadow: "var(--glass-card-shadow)",
    textAlign: "center",
  },
  homeWeekValue: {
    fontSize: 22,
    fontWeight: "var(--font-strong)",
    color: "var(--text-primary)",
  },
  homeSubscriptionBlock: {
    marginTop: 12,
    padding: "12px",
    borderRadius: 22,
    border: "1px solid var(--glass-card-border)",
    background: "var(--glass-card-bg)",
    boxShadow: "var(--glass-card-shadow)",
  },
  homeSubscriptionRow: {
    marginTop: 6,
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid var(--glass-card-border)",
    background: "var(--glass-card-bg)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  homeSubscriptionLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--muted)",
  },
  homeSubscriptionValue: {
    fontSize: 14,
    fontWeight: 800,
    color: "var(--text)",
  },
  statsBlock: {
    marginTop: 12,
    display: "flex",
    flexDirection: "column",
    gap: 14,
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
    width: 34,
    height: 34,
    borderRadius: 999,
    border: "1px solid var(--glass-btn-border)",
    background: "var(--glass-btn-bg)",
    color: "var(--text)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontSize: 14,
    boxShadow: "var(--glass-btn-shadow)",
  },
  statsInfo: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    border: "1px solid var(--glass-btn-border)",
    color: "var(--muted)",
    background: "var(--glass-btn-bg)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "var(--glass-btn-shadow)",
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
    background: "var(--glass-sheet-bg)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: "12px 18px 22px",
    border: "1px solid var(--glass-card-border)",
    boxShadow: "var(--glass-sheet-shadow)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    position: "relative",
    minHeight: "34vh",
  },
  statsInfoHandle: {
    width: 52,
    height: 6,
    borderRadius: 999,
    background: "var(--sheet-handle-bg)",
    margin: "4px auto 14px",
  },
  statsInfoClose: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: "50%",
    border: "1px solid var(--glass-btn-border)",
    background: "var(--glass-btn-bg)",
    color: "var(--muted)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    cursor: "pointer",
  },
  statsInfoTitle: {
    fontSize: 20,
    fontWeight: "var(--font-strong)",
    color: "var(--text-primary)",
    marginTop: 0,
  },
  statsInfoTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 20,
    fontWeight: "var(--font-strong)",
    color: "var(--text-primary)",
    marginTop: 0,
  },
  statsInfoText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 1.5,
    color: "var(--text-secondary)",
  },
  statsInfoAction: {
    marginTop: 18,
    width: "100%",
    height: 52,
    padding: "0 16px",
    borderRadius: 999,
    border: "1px solid rgba(120, 170, 220, 0.6)",
    background: "var(--accent-grad)",
    color: "#ffffff",
    fontWeight: "var(--font-strong)",
    fontSize: 16,
    cursor: "pointer",
    boxShadow: "var(--accent-shadow)",
  },
  statsRangeMenu: {
    position: "absolute",
    top: 36,
    right: 0,
    background: "var(--glass-sheet-bg)",
    border: "1px solid var(--glass-card-border)",
    borderRadius: 12,
    padding: 6,
    boxShadow: "var(--glass-card-shadow)",
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
    background: "rgba(111, 131, 246, 0.16)",
    color: "#3654c6",
  },
  statsControls: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  statsModeGroup: {
    display: "flex",
    gap: 6,
    padding: 6,
    borderRadius: 999,
    border: "1px solid var(--glass-card-border)",
    background: "var(--glass-card-bg)",
    boxShadow: "var(--glass-card-shadow)",
  },
  statsModeBtn: {
    padding: "6px 14px",
    borderRadius: 999,
    border: "none",
    background: "transparent",
    fontWeight: 700,
    color: "var(--text)",
    cursor: "pointer",
  },
  statsModeBtnActive: {
    background: "var(--glass-tab-active-bg)",
    color: "#ffffff",
    boxShadow: "var(--glass-tab-active-shadow)",
  },
  statsDatePicker: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  statsDateBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    border: "1px solid var(--glass-btn-border)",
    background: "var(--glass-btn-bg)",
    fontSize: 18,
    cursor: "pointer",
    color: "var(--text)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
    padding: 0,
    boxShadow: "var(--glass-btn-shadow)",
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
    borderRadius: 18,
    border: "1px solid var(--glass-card-border)",
    background: "var(--glass-card-bg)",
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    boxShadow: "var(--glass-card-shadow)",
  },
  statsSummaryRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    width: "100%",
  },
  statsSummaryGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    flex: 1,
  },
  statsSummarySide: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    alignItems: "center",
    justifyContent: "flex-start",
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
    borderRadius: 22,
    border: "1px solid var(--glass-card-border)",
    background: "var(--glass-card-bg)",
    padding: "16px 14px 12px",
    position: "relative",
    boxShadow: "var(--glass-card-shadow)",
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
    background: "rgba(180, 195, 210, 0.6)",
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
    border: "2px solid rgba(160, 175, 195, 0.45)",
    background: "rgba(200, 215, 235, 0.2)",
  },
  statsBarShellActive: {
    width: 22,
    borderRadius: 14,
    border: "2px solid rgba(120, 150, 190, 0.6)",
    position: "relative",
    overflow: "hidden",
    boxSizing: "border-box",
    background: "rgba(200, 215, 235, 0.25)",
  },
  statsBarFill: {
    position: "absolute",
    left: 0,
    bottom: 0,
    width: "100%",
    minHeight: 6,
    borderRadius: 12,
    background: "linear-gradient(180deg, #8ec7ff, #4f7bff)",
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
    borderRadius: 18,
    border: "1px solid var(--glass-card-border)",
    background: "var(--glass-card-bg)",
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    boxShadow: "var(--glass-card-shadow)",
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
    borderRadius: 999,
    border: "1px solid var(--glass-btn-border)",
    background: "var(--glass-btn-bg)",
    color: "var(--text-primary)",
    fontWeight: "var(--font-medium)",
    fontSize: 14,
    cursor: "pointer",
    whiteSpace: "nowrap",
    boxShadow: "var(--glass-btn-shadow)",
  },
  financeSheet: {
    width: "100%",
    maxWidth: 520,
    background: "var(--glass-sheet-bg)",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: "14px 18px 18px",
    boxShadow: "var(--glass-sheet-shadow)",
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
    border: "1px solid var(--glass-card-border)",
    background: "var(--glass-card-bg)",
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
  clientStatsBlock: {
    marginTop: 10,
    borderRadius: 20,
    border: "1px solid var(--glass-card-border)",
    background: "var(--glass-card-bg)",
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    boxShadow: "var(--glass-card-shadow)",
  },
  clientStatsHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  clientStatsControls: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  clientStatsTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "var(--text)",
  },
  clientStatsModeGroup: {
    display: "flex",
    alignItems: "center",
    borderRadius: 999,
    border: "1px solid var(--glass-pill-border)",
    background: "var(--glass-pill-bg)",
    overflow: "hidden",
  },
  clientStatsModeBtn: {
    padding: "6px 10px",
    border: "none",
    background: "transparent",
    color: "var(--muted)",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  clientStatsModeBtnActive: {
    background: "var(--glass-tab-active-bg)",
    color: "#fff",
  },
  clientStatsMonthPicker: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  clientStatsMonthBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    border: "1px solid var(--glass-btn-border)",
    background: "var(--glass-btn-bg)",
    color: "var(--text)",
    fontSize: 18,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "var(--glass-btn-shadow)",
  },
  clientStatsMonthLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: "var(--text)",
    minWidth: 90,
    textAlign: "center",
  },
  clientStatsList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  clientStatsRow: {
    display: "grid",
    gridTemplateColumns: "minmax(90px, 1.2fr) 3fr 32px",
    alignItems: "center",
    gap: 10,
  },
  clientStatsName: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  clientStatsBarTrack: {
    height: 10,
    borderRadius: 999,
    background: "rgba(180, 205, 235, 0.45)",
    overflow: "hidden",
  },
  clientStatsBarFill: {
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #4f7bff, #6fd0ff)",
  },
  clientStatsCount: {
    fontSize: 13,
    fontWeight: 700,
    color: "var(--muted)",
    textAlign: "right",
  },
  clientStatsEmpty: {
    fontSize: 13,
    color: "var(--muted)",
  },
  tariffToggleWrap: {
    marginTop: 8,
  },
  tariffToggle: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 6,
    padding: 6,
    borderRadius: 999,
    border: "1px solid var(--glass-card-border)",
    background: "var(--glass-card-bg)",
    boxShadow: "var(--glass-card-shadow)",
  },
  tariffToggleBtn: {
    padding: "8px 10px",
    borderRadius: 999,
    border: "none",
    background: "transparent",
    color: "var(--muted)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  tariffToggleBtnActive: {
    background: "var(--glass-btn-bg)",
    color: "var(--text)",
    boxShadow: "var(--glass-btn-shadow)",
  },
  tariffScroller: {
    marginTop: 10,
    display: "flex",
    gap: 12,
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
    scrollSnapType: "x proximity",
    paddingBottom: 6,
    paddingRight: 6,
  },
  tariffCard: {
    minWidth: "78%",
    width: "78%",
    flex: "0 0 auto",
    padding: "14px 14px 16px",
    borderRadius: 20,
    border: "1px solid var(--glass-card-border)",
    background: "var(--glass-card-bg)",
    boxShadow: "var(--glass-card-shadow)",
    boxSizing: "border-box",
    scrollSnapAlign: "start",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
  },
  tariffBadge: {
    padding: "6px 12px",
    borderRadius: 999,
    color: "var(--text)",
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: 0.2,
    background: "var(--glass-btn-bg)",
  },
  tariffPrice: {
    fontSize: 24,
    fontWeight: 800,
    color: "var(--accent)",
  },
  tariffPriceRow: {
    marginTop: 10,
    display: "flex",
    alignItems: "baseline",
    gap: 10,
    flexWrap: "wrap",
  },
  tariffPriceStrike: {
    fontSize: 12,
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
    background: "rgba(120, 165, 230, 0.7)",
    flex: "0 0 auto",
  },
  tariffChoose: {
    marginTop: 12,
    alignSelf: "stretch",
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid var(--glass-btn-border)",
    background: "var(--glass-btn-bg)",
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
  clientDetailHeaderCard: {
    marginTop: 6,
    marginBottom: 14,
    padding: "14px 16px",
    borderRadius: 26,
    border: "1px solid var(--client-detail-card-border)",
    background: "var(--client-detail-card-bg)",
    boxShadow: "var(--client-detail-card-shadow)",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    textAlign: "left",
  },
  clientDetailName: {
    fontWeight: "var(--font-strong)",
    fontSize: 18,
    color: "var(--text-primary)",
    letterSpacing: -0.2,
    lineHeight: 1.2,
  },
  clientDetailStatus: {
    fontSize: 13,
    color: "var(--text-secondary)",
    marginTop: 2,
  },
  clientTabsScroll: {
    marginTop: 8,
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
  },
  clientDetailTabsScroll: {
    marginTop: 10,
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
  },
  sessionTabsScroll: {
    marginTop: 0,
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
  },
  sessionPanelBg: {
    marginTop: 10,
    padding: "14px 12px 16px",
    borderRadius: 26,
    background: "var(--session-panel-bg)",
  },
  sessionTabsWrap: {
    padding: 6,
    borderRadius: 999,
    border: "1px solid var(--session-tabs-wrap-border)",
    background: "var(--session-tabs-wrap-bg)",
    boxShadow: "var(--session-tabs-wrap-shadow)",
    minWidth: "max-content",
  },
  sessionSingleTabWrap: {
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
  },
  sessionTabs: {
    display: "flex",
    gap: 8,
    minWidth: "max-content",
  },
  sessionSingleTabList: {
    width: "100%",
    minWidth: 0,
  },
  sessionTabPill: {
    height: 40,
    borderRadius: 999,
    border: "1px solid transparent",
    background: "transparent",
    cursor: "pointer",
    fontWeight: "var(--font-medium)",
    fontSize: 13,
    color: "var(--session-tab-text)",
    padding: "0 16px",
    whiteSpace: "nowrap",
  },
  sessionSingleTabPill: {
    flex: 1,
    width: "100%",
  },
  sessionTabPillActive: {
    background: "var(--session-tab-active-bg)",
    color: "var(--session-tab-active-text)",
    boxShadow: "var(--session-tab-active-shadow)",
  },
  sessionTabsDivider: {
    marginTop: 14,
    borderBottom: "1px solid var(--session-divider)",
  },
  clientPrimaryActionWrap: {
    marginTop: 6,
    marginBottom: 6,
  },
  clientPrimaryActionDivider: {
    borderBottom: "1px solid var(--border-2)",
  },
  clientPrimaryActionBtn: {
    marginTop: 10,
    marginBottom: 10,
    width: "100%",
    padding: "13px 16px",
    borderRadius: 14,
    border: "1px solid rgba(0, 0, 0, 0.06)",
    background: "linear-gradient(135deg, #1F6BFF 0%, #2F8CFF 100%)",
    color: "var(--accent-contrast)",
    fontWeight: "var(--font-strong)",
    fontSize: 15,
    boxShadow: "0 10px 20px rgba(31, 107, 255, 0.18)",
    cursor: "pointer",
  },
  clientDetailActionWrap: {
    marginTop: 4,
    marginBottom: 10,
  },
  clientDetailActionBtn: {
    width: "100%",
    height: 52,
    borderRadius: 999,
    border: "1px solid var(--client-detail-action-border)",
    background: "var(--client-detail-action-bg)",
    color: "#ffffff",
    fontWeight: "var(--font-strong)",
    fontSize: 15,
    boxShadow: "var(--client-detail-action-shadow)",
    cursor: "pointer",
  },
  clientScheduleOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 40,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  clientScheduleBackdrop: {
    position: "absolute",
    inset: 0,
    border: "none",
    background: "rgba(15, 23, 42, 0.35)",
    cursor: "pointer",
  },
  clientScheduleSheet: {
    position: "relative",
    width: "100%",
    maxWidth: 520,
    height: "68vh",
    background: "var(--glass-sheet-bg)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: "12px 18px 22px",
    boxSizing: "border-box",
    border: "1px solid var(--glass-card-border)",
    boxShadow: "var(--glass-sheet-shadow)",
    overflowY: "auto",
    overscrollBehavior: "contain",
    WebkitOverflowScrolling: "touch",
    touchAction: "pan-y",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
  },
  clientScheduleHandle: {
    width: 52,
    height: 6,
    borderRadius: 999,
    background: "rgba(15, 23, 42, 0.16)",
    margin: "4px auto 14px",
  },
  clientScheduleTitleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  clientScheduleTitle: {
    fontSize: 20,
    fontWeight: "var(--font-strong)",
    color: "var(--text-primary)",
  },
  clientScheduleCloseBtn: {
    border: "none",
    background: "transparent",
    color: "var(--muted)",
    fontWeight: 600,
    cursor: "pointer",
    padding: 6,
  },
  freeScheduleTitleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  freeScheduleTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: "var(--text)",
  },
  freeScheduleCloseBtn: {
    border: "none",
    background: "transparent",
    color: "var(--muted)",
    fontWeight: 700,
    cursor: "pointer",
    padding: 4,
  },
  clientScheduleFields: {
    marginTop: 6,
  },
  clientScheduleInput: {
    width: 140,
    boxSizing: "border-box",
    borderRadius: 18,
    border: "1px solid var(--glass-card-border)",
    padding: "10px 12px",
    outline: "none",
    fontSize: 16,
    background: "var(--glass-card-bg)",
    color: "var(--text)",
    boxShadow: "var(--glass-card-shadow)",
  },
  clientScheduleSaveBtn: {
    marginTop: 18,
    width: "100%",
    height: 52,
    borderRadius: 999,
    border: "1px solid rgba(120, 170, 220, 0.6)",
    background: "var(--accent-grad)",
    cursor: "pointer",
    fontWeight: "var(--font-strong)",
    fontSize: 16,
    color: "#fff",
    boxShadow: "var(--accent-shadow)",
  },
  scheduleQuickSheet: {
    height: "74vh",
    background: "var(--glass-sheet-bg)",
    border: "1px solid var(--glass-card-border)",
    boxShadow: "var(--glass-sheet-shadow)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: "8px 18px 22px",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
  },
  scheduleQuickHandle: {
    width: 52,
    height: 6,
    borderRadius: 999,
    background: "linear-gradient(90deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0.2))",
    margin: "6px auto 12px",
  },
  scheduleQuickSectionLabel: {
    marginTop: 4,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.3,
    textTransform: "uppercase",
    color: "var(--muted)",
  },
  scheduleQuickCalendarStrip: {
    display: "flex",
    gap: 12,
    overflowX: "auto",
    paddingLeft: 2,
    paddingRight: 2,
    paddingBottom: 10,
    WebkitOverflowScrolling: "touch",
  },
  scheduleQuickDay: {
    flex: "0 0 74px",
    minWidth: 74,
    borderRadius: 22,
    border: "1px solid var(--glass-pill-border)",
    padding: "12px 10px",
    background: "var(--glass-pill-bg)",
    boxShadow: "var(--glass-pill-shadow)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
    color: "var(--text)",
  },
  scheduleQuickDayActive: {
    borderColor: "var(--accent-soft-border)",
    background: "var(--accent-soft-bg)",
    color: "var(--accent-soft-text)",
  },
  scheduleQuickDaySelected: {
    background: "var(--schedule-day-active-bg)",
    borderColor: "var(--accent-soft-border)",
    color: "var(--schedule-day-active-text)",
    boxShadow: "var(--schedule-switch-active-shadow)",
  },
  scheduleQuickDayPast: {
    opacity: 0.45,
  },
  scheduleQuickDayDate: {
    fontSize: 16,
    fontWeight: 800,
    letterSpacing: -0.2,
  },
  scheduleQuickDayWeek: {
    fontSize: 12,
    fontWeight: 600,
    textTransform: "lowercase",
    opacity: 0.7,
  },
  scheduleQuickSegment: {
    display: "flex",
    gap: 6,
    padding: 6,
    width: "100%",
    marginLeft: -5,
    marginRight: 0,
    borderRadius: 999,
    border: "1px solid var(--glass-tab-wrap-border)",
    background: "var(--glass-tab-wrap-bg)",
    boxShadow: "var(--glass-card-shadow)",
  },
  scheduleQuickSegmentBtn: {
    flex: 1,
    border: "none",
    background: "transparent",
    color: "var(--text)",
    fontWeight: 700,
    fontSize: 12,
    padding: "10px 12px",
    borderRadius: 999,
    cursor: "pointer",
  },
  scheduleQuickSegmentBtnActive: {
    background: "var(--glass-tab-active-bg)",
    color: "var(--glass-tab-active-text)",
    boxShadow: "var(--glass-tab-active-shadow)",
  },
  scheduleQuickFields: {
    marginTop: 8,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    paddingLeft: 2,
    paddingRight: 2,
  },
  scheduleQuickFieldsGrid: {
    marginTop: 8,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    paddingLeft: 2,
    paddingRight: 2,
  },
  scheduleQuickTimeRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  scheduleQuickField: {
    display: "flex",
    flexDirection: "column",
  },
  scheduleQuickFieldFull: {
    gridColumn: "1 / -1",
  },
  scheduleQuickDateList: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  scheduleQuickDatePill: {
    border: "1px solid var(--glass-pill-border)",
    background: "var(--glass-pill-bg)",
    color: "var(--text)",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
    boxShadow: "var(--glass-pill-shadow)",
  },
  scheduleQuickDateRemove: {
    fontSize: 14,
    lineHeight: 1,
    opacity: 0.7,
  },
  prepayPage: {
    background: "var(--bg)",
    minHeight: "auto",
    paddingTop: 12,
    paddingBottom: "calc(env(safe-area-inset-bottom) + 16px + var(--keyboard-inset))",
  },
  prepayTitle: {
    fontSize: 22,
    fontWeight: "var(--font-strong)",
    color: "var(--text-primary)",
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  prepayCard: {
    borderRadius: 24,
    border: "1px solid var(--glass-card-border)",
    background: "var(--glass-card-bg)",
    boxShadow: "var(--glass-card-shadow)",
    padding: "12px 16px",
  },
  prepayRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 0",
  },
  prepayLabel: {
    fontSize: 14,
    fontWeight: "var(--font-strong)",
    color: "var(--text-primary)",
  },
  prepaySubLabel: {
    marginTop: 4,
    fontSize: 12,
    color: "var(--muted)",
  },
  prepayValue: {
    fontSize: 16,
    fontWeight: "var(--font-strong)",
    color: "var(--text-primary)",
  },
  prepayTotal: {
    fontSize: 18,
    fontWeight: 800,
    color: "var(--text-primary)",
  },
  prepayPayBtn: {
    marginTop: 18,
    width: "100%",
    height: 54,
    borderRadius: 999,
    border: "1px solid rgba(130, 165, 215, 0.7)",
    background: "var(--accent-grad)",
    color: "#fff",
    fontSize: 17,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "var(--accent-shadow)",
  },
  prepayNote: {
    marginTop: 10,
    fontSize: 11,
    color: "var(--muted)",
    lineHeight: 1.35,
  },
  promoRow: {
    display: "flex",
    gap: 8,
    width: "100%",
    boxSizing: "border-box",
    marginTop: 6,
    marginBottom: 6,
  },
  promoInput: {
    flex: 1,
    minWidth: 0,
    borderRadius: 999,
    border: "1px solid var(--glass-pill-border)",
    background: "var(--glass-pill-bg)",
    boxShadow: "var(--glass-pill-shadow)",
    padding: "11px 14px",
    fontSize: 14,
    outline: "none",
    color: "var(--text-primary)",
  },
  promoApplyBtn: {
    padding: "11px 14px",
    borderRadius: 999,
    border: "1px solid rgba(130, 165, 215, 0.7)",
    background: "var(--accent-grad)",
    color: "#fff",
    fontWeight: 800,
    fontSize: 14,
    whiteSpace: "nowrap",
    flexShrink: 0,
    cursor: "pointer",
    boxShadow: "var(--accent-shadow)",
  },
  promoError: {
    color: "#DC2626",
    fontSize: 12,
    marginBottom: 6,
  },
  promoSuccess: {
    color: "#16A34A",
    fontSize: 12,
    marginBottom: 6,
  },
  scheduleQuickLabel: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.3,
    textTransform: "uppercase",
    color: "var(--muted)",
    marginBottom: 6,
  },
  scheduleQuickInput: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 999,
    border: "1px solid var(--glass-pill-border)",
    padding: "12px 16px",
    outline: "none",
    fontSize: 16,
    background: "var(--glass-pill-bg)",
    color: "var(--text)",
    boxShadow: "var(--glass-pill-shadow)",
  },
  scheduleQuickGroupList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: 12,
    borderRadius: 18,
    border: "1px solid var(--glass-pill-border)",
    background: "var(--glass-pill-bg)",
    boxShadow: "var(--glass-pill-shadow)",
    maxHeight: 180,
    overflowY: "auto",
  },
  scheduleQuickColorButton: {
    width: "100%",
    border: "1px solid var(--glass-pill-border)",
    borderRadius: 999,
    padding: "12px 16px",
    fontSize: 15,
    fontWeight: 700,
    background: "var(--glass-pill-bg)",
    color: "var(--text)",
    cursor: "pointer",
    boxShadow: "var(--glass-pill-shadow)",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    justifyContent: "space-between",
  },
  scheduleQuickColorMenu: {
    position: "absolute",
    top: "100%",
    left: 0,
    marginTop: 8,
    background: "var(--glass-card-bg)",
    border: "1px solid var(--glass-card-border)",
    borderRadius: 16,
    boxShadow: "var(--glass-card-shadow)",
    padding: 8,
    zIndex: 5,
    minWidth: 220,
  },
  scheduleQuickSaveBtn: {
    marginTop: 8,
    width: "100%",
    height: 54,
    borderRadius: 999,
    border: "1px solid rgba(130, 165, 215, 0.7)",
    background: "var(--accent-grad)",
    color: "#ffffff",
    fontWeight: 800,
    fontSize: 18,
    cursor: "pointer",
    boxShadow: "var(--accent-shadow)",
  },
  weightsStatsOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 41,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  exerciseFormOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 42,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  exerciseFormBackdrop: {
    position: "absolute",
    inset: 0,
    border: "none",
    background: "rgba(15, 23, 42, 0.35)",
    cursor: "pointer",
  },
  exerciseFormSheet: {
    position: "relative",
    width: "100%",
    maxWidth: 520,
    height: "52vh",
    background: "var(--glass-sheet-bg)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: "12px 18px 22px",
    boxSizing: "border-box",
    border: "1px solid var(--glass-card-border)",
    boxShadow: "var(--glass-sheet-shadow)",
    overflowY: "auto",
  },
  exerciseFormHandle: {
    width: 52,
    height: 6,
    borderRadius: 999,
    background: "rgba(15, 23, 42, 0.16)",
    margin: "4px auto 14px",
  },
  exerciseFormHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  exerciseFormTitle: {
    fontSize: 20,
    fontWeight: "var(--font-strong)",
    color: "var(--text-primary)",
  },
  exerciseFormCloseBtn: {
    border: "none",
    background: "transparent",
    color: "var(--muted)",
    fontWeight: 600,
    cursor: "pointer",
    padding: 6,
  },
  exerciseFormLabel: {
    fontSize: 14,
    fontWeight: "var(--font-medium)",
    marginBottom: 6,
    color: "var(--text-secondary)",
  },
  exerciseFormInput: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 18,
    border: "1px solid var(--glass-card-border)",
    padding: "12px 14px",
    outline: "none",
    fontSize: 16,
    background: "var(--glass-card-bg)",
    color: "var(--text)",
    boxShadow: "var(--glass-card-shadow)",
  },
  exerciseFormSaveBtn: {
    marginTop: 18,
    width: "100%",
    height: 50,
    borderRadius: 999,
    border: "1px solid rgba(120, 170, 220, 0.6)",
    background: "var(--accent-grad)",
    cursor: "pointer",
    fontWeight: "var(--font-strong)",
    fontSize: 16,
    color: "#fff",
    boxShadow: "var(--accent-shadow)",
  },
  weightsStatsBackdrop: {
    position: "absolute",
    inset: 0,
    border: "none",
    background: "rgba(15, 23, 42, 0.35)",
    cursor: "pointer",
  },
  weightsStatsSheet: {
    position: "relative",
    width: "100%",
    maxWidth: 520,
    height: "72vh",
    background: "var(--glass-sheet-bg)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: "12px 18px 22px",
    boxSizing: "border-box",
    border: "1px solid var(--glass-card-border)",
    boxShadow: "var(--glass-sheet-shadow)",
    overflowY: "auto",
  },
  weightsStatsHandle: {
    width: 52,
    height: 6,
    borderRadius: 999,
    background: "linear-gradient(90deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0.2))",
    margin: "6px auto 14px",
  },
  weightsStatsHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  weightsStatsTitle: {
    fontSize: 22,
    fontWeight: "var(--font-strong)",
    color: "var(--text-primary)",
  },
  weightsStatsCloseBtn: {
    border: "1px solid var(--glass-pill-border)",
    background: "var(--glass-pill-bg)",
    color: "var(--text)",
    fontWeight: 700,
    cursor: "pointer",
    padding: "8px 16px",
    borderRadius: 999,
    boxShadow: "var(--glass-pill-shadow)",
  },
  weightsStatsHint: {
    marginTop: 6,
    fontSize: 12,
    color: "var(--muted)",
  },
  weightsStatsChart: {
    marginTop: 12,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  weightsStatsLineWrap: {
    padding: "16px 12px 10px",
    borderRadius: 22,
    border: "1px solid var(--glass-card-border)",
    background: "var(--glass-card-bg)",
    boxShadow: "var(--glass-card-shadow)",
  },
  weightsStatsLineAxis: {
    marginTop: 8,
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 4,
    paddingTop: 8,
    borderTop: "1px solid rgba(120, 150, 190, 0.25)",
  },
  weightsStatsLineAxisLabel: {
    fontSize: 11,
    textAlign: "center",
    color: "var(--muted)",
  },
  weightsStatsBarRow: {
    display: "grid",
    gridTemplateColumns: "92px 1fr 52px",
    alignItems: "center",
    gap: 10,
  },
  weightsStatsBarLabel: {
    fontSize: 12,
    color: "var(--muted)",
  },
  weightsStatsBarTrack: {
    height: 10,
    borderRadius: 999,
    background: "var(--surface-2)",
    overflow: "hidden",
  },
  weightsStatsBarFill: {
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #1F6BFF 0%, #49A0FF 100%)",
  },
  weightsStatsBarValue: {
    fontSize: 12,
    fontWeight: 700,
    color: "var(--text)",
    textAlign: "right",
  },
  weightsStatsList: {
    marginTop: 16,
    borderRadius: 18,
    border: "none",
    background: "transparent",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  weightsStatsEmpty: {
    padding: "12px 12px",
    fontSize: 13,
    color: "var(--muted)",
  },
  weightsStatsListRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    borderRadius: 18,
    border: "1px solid var(--glass-pill-border)",
    background: "var(--glass-pill-bg)",
    boxShadow: "var(--glass-pill-shadow)",
  },
  weightsStatsListLabel: {
    fontSize: 14,
    color: "var(--text)",
  },
  weightsStatsListValue: {
    fontSize: 16,
    fontWeight: 800,
    color: "var(--text)",
  },
  sessionHistoryList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  sessionHistoryCard: {
    borderRadius: 18,
    padding: "12px 14px",
    border: "1px solid var(--history-card-border)",
    background: "var(--history-card-bg)",
    boxShadow: "var(--history-card-shadow)",
  },
  sessionHistoryTitle: {
    fontWeight: "var(--font-medium)",
    fontSize: 16,
    color: "var(--text-primary)",
    letterSpacing: -0.2,
  },
  sessionHistorySubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "var(--text-secondary)",
    opacity: 0.75,
  },
  clientTabs: {
    display: "flex",
    gap: 10,
    minWidth: "max-content",
  },
  clientDetailTabsWrap: {
    display: "flex",
    gap: 6,
    padding: 6,
    borderRadius: 999,
    border: "1px solid var(--client-detail-tabs-border)",
    background: "var(--client-detail-tabs-bg)",
    boxShadow: "var(--client-detail-tabs-shadow)",
    width: "100%",
    boxSizing: "border-box",
  },
  clientTabsDivider: {
    marginTop: 12,
    borderBottom: "1px solid var(--border-2)",
  },
  clientDetailTabsDivider: {
    marginTop: 12,
    borderBottom: "1px solid var(--client-detail-tabs-border)",
  },
  clientTab: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    cursor: "pointer",
    fontWeight: "var(--font-medium)",
    fontSize: 13,
    color: "var(--text-primary)",
    padding: "0 10px",
  },
  clientDetailTab: {
    height: 40,
    borderRadius: 999,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontWeight: "var(--font-medium)",
    fontSize: 13,
    color: "var(--text-primary)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
    flex: 1,
    padding: "0 12px",
    whiteSpace: "nowrap",
  },
  clientTabActive: {
    background: "var(--accent)",
    color: "var(--accent-contrast)",
    borderColor: "var(--accent)",
  },
  clientDetailTabActive: {
    background: "var(--client-detail-tab-active-bg)",
    color: "#ffffff",
    boxShadow: "var(--client-detail-tab-active-shadow)",
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
  clientDetailFieldLabel: {
    fontSize: 12,
    fontWeight: "var(--font-medium)",
    letterSpacing: 0.3,
    textTransform: "uppercase",
    color: "var(--text-secondary)",
    marginBottom: 6,
  },
  clientDetailValueBox: {
    padding: "12px 16px",
    minHeight: 46,
    boxSizing: "border-box",
    borderRadius: 18,
    border: "1px solid var(--client-detail-field-border)",
    background: "var(--client-detail-field-bg)",
    boxShadow: "var(--client-detail-field-shadow)",
    color: "var(--text)",
    fontSize: 14,
    display: "flex",
    alignItems: "center",
  },
  clientDetailInput: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 18,
    border: "1px solid var(--client-detail-field-border)",
    padding: "12px 16px",
    outline: "none",
    fontSize: 14,
    background: "var(--client-detail-field-bg)",
    color: "var(--text)",
    boxShadow: "var(--client-detail-field-shadow)",
  },
  clientDetailTextarea: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 18,
    border: "1px solid var(--client-detail-field-border)",
    padding: "12px 16px",
    outline: "none",
    fontSize: 14,
    background: "var(--client-detail-field-bg)",
    color: "var(--text)",
    resize: "none",
    overflow: "hidden",
    minHeight: 42,
    lineHeight: 1.35,
    boxShadow: "var(--client-detail-field-shadow)",
  },
  clientDetailCopyRow: {
    marginTop: 6,
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  clientDetailCopyBtn: {
    border: "1px solid var(--client-detail-copy-border)",
    background: "var(--client-detail-copy-bg)",
    borderRadius: 18,
    padding: "10px 14px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "var(--text-primary)",
    boxShadow: "none",
    fontWeight: "var(--font-medium)",
  },
  clientDetailPlainValue: {
    fontSize: 14,
    color: "var(--text-primary)",
    fontWeight: "var(--font-medium)",
  },
  sessionInfoStack: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  sessionInfoRow: {
    display: "flex",
    gap: 12,
    alignItems: "stretch",
    flexWrap: "wrap",
  },
  sessionCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 20,
    border: "1px solid var(--session-card-border)",
    background: "var(--session-card-bg)",
    boxShadow: "var(--session-card-shadow)",
    padding: "12px 14px",
  },
  sessionCardRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    justifyContent: "space-between",
  },
  sessionCardLabelRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    marginBottom: 6,
  },
  sessionCardLabelWithInfo: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  },
  sessionCardLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "var(--session-card-label)",
    opacity: 0.9,
    letterSpacing: -0.1,
  },
  sessionMiniLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "var(--session-mini-label)",
    opacity: 1,
    marginBottom: 4,
  },
  sessionCardValue: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: 700,
    color: "var(--session-card-value)",
    lineHeight: 1.2,
  },
  sessionCardValueMuted: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: 600,
    color: "var(--session-card-muted)",
  },
  sessionCardInput: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 10,
    border: "none",
    padding: 0,
    outline: "none",
    fontSize: 20,
    fontWeight: 700,
    background: "transparent",
    color: "var(--session-card-value)",
    marginTop: 6,
    lineHeight: 1.2,
    textAlign: "left",
  },
  sessionCardTextarea: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 10,
    border: "none",
    padding: 0,
    outline: "none",
    fontSize: 15,
    fontWeight: 600,
    background: "transparent",
    color: "var(--session-card-value)",
    resize: "none",
    overflow: "hidden",
    marginTop: 6,
    lineHeight: 1.4,
  },
  sessionTimeGrid: {
    marginTop: 6,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    alignItems: "start",
  },
  sessionCheckBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    border: "2px solid var(--session-check-border)",
    background: "var(--session-check-bg)",
    color: "var(--session-check-text)",
    fontSize: 20,
    fontWeight: 800,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  sessionInfoBadge: {
    width: 22,
    height: 22,
    borderRadius: 999,
    border: "1px solid var(--session-info-border)",
    background: "var(--session-info-bg)",
    color: "var(--session-info-text)",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  sessionPrimaryBtn: {
    marginTop: 6,
    width: "100%",
    height: 54,
    borderRadius: 18,
    border: "1px solid var(--session-primary-border)",
    background: "var(--session-primary-bg)",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: 17,
    cursor: "pointer",
    boxShadow: "var(--session-primary-shadow)",
  },
  sessionDangerBtn: {
    marginTop: 14,
    width: "100%",
    height: 54,
    borderRadius: 18,
    border: "1px solid var(--session-danger-border)",
    background: "var(--session-danger-bg)",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: 17,
    cursor: "pointer",
    boxShadow: "var(--session-danger-shadow)",
  },
  clientPanelBody: {
    opacity: 0.7,
    fontSize: 14,
    lineHeight: 1.35,
  },

  fieldLabel: {
    fontSize: 13,
    fontWeight: "var(--font-medium)",
    marginBottom: 6,
    color: "var(--text-secondary)",
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
  addClientInput: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 22,
    border: "1px solid var(--glass-card-border)",
    padding: "14px 16px",
    outline: "none",
    fontSize: 16,
    background: "var(--glass-card-bg)",
    color: "var(--text)",
    boxShadow: "var(--glass-card-shadow)",
  },
  addClientHint: {
    opacity: 0.8,
    fontSize: 14,
    lineHeight: 1.45,
    marginTop: 8,
    textAlign: "center",
  },
  addClientPrimaryBtn: {
    marginTop: 18,
    width: "100%",
    padding: "14px 16px",
    borderRadius: 999,
    border: "1px solid rgba(130, 165, 215, 0.7)",
    background: "var(--accent-grad)",
    color: "#ffffff",
    fontWeight: 800,
    fontSize: 18,
    cursor: "pointer",
    boxShadow: "var(--accent-shadow)",
  },
  inputCompact: {
    width: 120,
    boxSizing: "border-box",
    borderRadius: 12,
    border: "1px solid var(--border)",
    padding: "10px 12px",
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
  subscriptionHistoryDivider: {
    marginTop: 18,
    borderBottom: "1px solid var(--client-detail-tabs-border)",
  },
  subscriptionCreateActionRow: {
    marginTop: 14,
    display: "flex",
    justifyContent: "flex-start",
  },
  subscriptionCreateBtn: {
    minWidth: 220,
    maxWidth: "100%",
    height: 46,
    padding: "0 24px",
    borderRadius: 999,
    border: "1px solid var(--client-detail-action-border)",
    background: "var(--client-detail-action-bg)",
    color: "#ffffff",
    fontWeight: "var(--font-strong)",
    fontSize: 15,
    boxShadow: "var(--client-detail-action-shadow)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  subscriptionHistoryTitle: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: "var(--font-strong)",
    color: "var(--text-primary)",
    textAlign: "left",
  },
  subscriptionHistoryList: {
    marginTop: 12,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  subscriptionHistoryCard: {
    borderRadius: 20,
    border: "1px solid var(--glass-card-border)",
    background: "var(--glass-card-bg)",
    boxShadow: "var(--glass-card-shadow)",
    padding: "14px 16px",
  },
  subscriptionHistoryCardButton: {
    padding: 0,
    border: "none",
    background: "transparent",
    textAlign: "left",
    cursor: "pointer",
  },
  subscriptionHistoryCardTitle: {
    fontSize: 16,
    fontWeight: "var(--font-strong)",
    color: "var(--text-primary)",
    marginBottom: 6,
  },
  subscriptionHistoryCardMeta: {
    fontSize: 13,
    lineHeight: 1.45,
    color: "var(--text-secondary)",
  },
  subscriptionHistoryEmpty: {
    marginTop: 12,
    fontSize: 14,
    color: "var(--text-secondary)",
  },
  subscriptionHistorySheet: {
    minHeight: 0,
    maxHeight: 420,
    overflow: "hidden",
  },
  subscriptionHistorySheetMeta: {
    marginTop: -4,
    marginBottom: 14,
    fontSize: 14,
    color: "var(--text-secondary)",
  },
  subscriptionHistorySheetList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    maxHeight: 232,
    overflowY: "auto",
    paddingRight: 4,
  },
  inputRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  inlineCheckBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    border: "1px solid rgba(120, 170, 220, 0.7)",
    background: "linear-gradient(135deg, #6fa3ff, #6cc6ff)",
    color: "#ffffff",
    fontSize: 20,
    fontWeight: 800,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 12px 22px rgba(80, 140, 220, 0.35)",
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
  archiveActionBtn: {
    marginTop: 18,
    width: "100%",
    height: 54,
    borderRadius: 999,
    border: "1px solid var(--glass-pill-border)",
    background: "var(--glass-pill-bg)",
    boxShadow: "var(--glass-pill-shadow)",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 16,
    color: "var(--text-primary)",
  },
  archiveActionDangerBtn: {
    background: "linear-gradient(135deg, #eb575c, #ff6f74)",
    borderColor: "rgba(235, 87, 92, 0.6)",
    color: "#ffffff",
    boxShadow: "0 16px 28px rgba(235, 87, 92, 0.28)",
  },
  dangerBtn: {
    background: "#e5484d",
    borderColor: "#e5484d",
    color: "#fff",
  },
  subscriptionWarningText: {
    color: "#e5484d",
    fontWeight: 600,
  },
  neutralBtn: {
    background: "#fff",
    borderColor: "#d7dbe5",
    color: "#111",
  },

  errorText: {
    marginTop: 10,
    color: "var(--danger)",
    fontSize: 13,
    lineHeight: 1.35,
  },

  emptyState: {
    marginTop: 18,
    padding: "18px 20px",
    border: "1px solid var(--glass-card-border)",
    borderRadius: 22,
    background: "var(--glass-card-bg)",
    boxShadow: "var(--glass-card-shadow)",
  },

  calendarStrip: {
    marginTop: 12,
    display: "flex",
    gap: 10,
    overflowX: "auto",
    paddingBottom: 8,
    WebkitOverflowScrolling: "touch",
  },
  calendarDay: {
    flex: "0 0 calc((100% - 32px) / 5)",
    minWidth: "calc((100% - 32px) / 5)",
    borderRadius: 22,
    border: "1px solid var(--glass-card-border)",
    padding: "14px 8px",
    background: "var(--glass-card-bg)",
    boxShadow: "var(--glass-card-shadow)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
    color: "var(--text)",
  },
  calendarDayActive: {
    background: "var(--accent-soft-bg)",
    borderColor: "var(--accent-soft-border)",
    color: "var(--accent-soft-text)",
  },
  calendarDaySelected: {
    background: "var(--accent-grad)",
    borderColor: "rgba(111, 131, 246, 0.7)",
    color: "#ffffff",
    boxShadow: "var(--accent-shadow)",
  },
  calendarDayPast: {
    opacity: 0.45,
  },
  calendarDayWeek: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "lowercase",
    color: "currentColor",
    opacity: 0.7,
  },
  calendarDayDate: {
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: -0.2,
  },
  scheduleTabs: {
    marginTop: 14,
    display: "flex",
    gap: 6,
    width: "100%",
    padding: 6,
    borderRadius: 999,
    border: "1px solid var(--glass-tab-wrap-border)",
    background: "var(--glass-tab-wrap-bg)",
    boxShadow: "var(--glass-card-shadow)",
  },
  scheduleDualTabs: {
    marginTop: 14,
    display: "flex",
    gap: 6,
    width: "100%",
    padding: 6,
    borderRadius: 999,
    border: "1px solid var(--schedule-switch-border)",
    background: "var(--schedule-switch-bg)",
    boxShadow: "var(--schedule-switch-shadow)",
  },
  clientsTabsRow: {
    marginTop: 4,
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
  },
  clientsTabs: {
    flex: 1,
    display: "flex",
    gap: 12,
  },
  clientsAddBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    border: "1px solid var(--glass-btn-border)",
    background: "var(--accent-grad)",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "var(--accent-shadow)",
    fontSize: 18,
  },
  iconOnAccent: {
    color: "#ffffff",
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  iconOnGlass: {
    color: "var(--text-primary)",
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  clientsTab: {
    flex: 1,
    minHeight: 52,
    borderRadius: 22,
    border: "1px solid var(--clients-tab-border)",
    background: "var(--clients-tab-bg)",
    boxShadow: "var(--clients-tab-shadow)",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
    color: "var(--muted)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "8px 10px",
    lineHeight: 1.2,
  },
  clientsTabActive: {
    background: "var(--accent-grad)",
    color: "#ffffff",
    borderColor: "rgba(111, 131, 246, 0.7)",
    boxShadow: "var(--clients-tab-active-shadow)",
  },
  trainerSelectTabs: {
    marginTop: 6,
    display: "flex",
    gap: 6,
    width: "100%",
    padding: 6,
    borderRadius: 999,
    border: "1px solid var(--clients-tab-border)",
    background: "var(--clients-tab-bg)",
    boxShadow: "var(--clients-tab-shadow)",
  },
  trainerSelectTab: {
    flex: 1,
    height: 40,
    borderRadius: 999,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontWeight: "var(--font-medium)",
    fontSize: 13,
    color: "var(--text-secondary)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
  },
  trainerSelectTabActive: {
    background: "var(--accent-grad)",
    color: "#ffffff",
    boxShadow: "var(--clients-tab-active-shadow)",
  },
  addClientTabs: {
    marginTop: 16,
    display: "flex",
    gap: 8,
    width: "100%",
    padding: 6,
    borderRadius: 999,
    border: "1px solid var(--glass-tab-wrap-border)",
    background: "var(--glass-tab-wrap-bg)",
    boxShadow: "var(--glass-card-shadow)",
  },
  addClientTab: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    border: "none",
    background: "transparent",
    color: "var(--muted)",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  addClientTabActive: {
    background: "var(--accent-grad)",
    color: "#ffffff",
    boxShadow: "var(--accent-shadow)",
  },
  scheduleModeScroll: {
    display: "flex",
    gap: 10,
    marginBottom: 12,
    overflowX: "auto",
    overflowY: "hidden",
    WebkitOverflowScrolling: "touch",
    paddingBottom: 4,
  },
  scheduleModeStack: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: 12,
  },
  personalTabsRow: {
    marginTop: 14,
    display: "flex",
    gap: 10,
    width: "100%",
    overflowX: "auto",
    overflowY: "hidden",
    WebkitOverflowScrolling: "touch",
    paddingBottom: 4,
    scrollSnapType: "x proximity",
  },
  personalTabsWrap: {
    display: "flex",
    gap: 6,
    padding: 6,
    borderRadius: 999,
    border: "1px solid var(--client-detail-tabs-border)",
    background: "var(--client-detail-tabs-bg)",
    boxShadow: "var(--client-detail-tabs-shadow)",
    minWidth: "max-content",
    width: "max-content",
    boxSizing: "border-box",
  },
  trainerClientTabsWrap: {
    display: "flex",
    gap: 6,
    padding: 6,
    borderRadius: 999,
    border: "1px solid var(--client-detail-tabs-border)",
    background: "var(--client-detail-tabs-bg)",
    boxShadow: "var(--client-detail-tabs-shadow)",
    minWidth: "max-content",
    width: "max-content",
    boxSizing: "border-box",
  },
  scheduleViewTabs: {
    display: "flex",
    gap: 10,
    marginBottom: 12,
  },
  scheduleViewTab: {
    flex: 1,
    height: 38,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
    color: "var(--text)",
    padding: "0 10px",
  },
  scheduleViewTabActive: {
    background: "var(--accent)",
    color: "var(--accent-contrast)",
    borderColor: "var(--accent)",
  },
  scheduleViewSwitch: {
    display: "inline-flex",
    width: "fit-content",
    maxWidth: "fit-content",
    gap: 4,
    padding: 3,
    borderRadius: 999,
    border: "1px solid var(--schedule-switch-border)",
    background: "var(--schedule-switch-bg)",
    boxShadow: "var(--schedule-switch-shadow)",
    flex: "0 0 auto",
  },
  scheduleViewSwitchBtn: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: "7px 14px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    color: "var(--text)",
  },
  scheduleViewSwitchBtnActive: {
    background: "var(--schedule-switch-active-bg)",
    color: "#ffffff",
    boxShadow: "var(--schedule-switch-active-shadow)",
  },
  scheduleTab: {
    flex: 1,
    height: 40,
    borderRadius: 999,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontWeight: "var(--font-medium)",
    fontSize: 13,
    color: "var(--text-secondary)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
  },
  personalTabButton: {
    flex: "0 0 auto",
    padding: "0 14px",
    minWidth: "max-content",
    whiteSpace: "nowrap",
    scrollSnapAlign: "start",
  },
  trainerClientTabButton: {
    flex: "0 0 auto",
    padding: "0 14px",
    minWidth: "max-content",
    whiteSpace: "nowrap",
  },
  scheduleTabActive: {
    background: "var(--glass-tab-active-bg)",
    color: "var(--glass-tab-active-text)",
    boxShadow: "var(--glass-tab-active-shadow)",
  },
  scheduleDualTab: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 14,
    color: "var(--text)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
  },
  scheduleDualTabActive: {
    background: "var(--schedule-switch-active-bg)",
    color: "#ffffff",
    boxShadow: "var(--schedule-switch-active-shadow)",
  },
  groupSelectList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    maxHeight: 180,
    overflowY: "auto",
  },
  groupSelectRow: {
    display: "flex",
    alignItems: "center",
    fontSize: 14,
    color: "var(--text)",
  },
  groupClientChips: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  groupClientChip: {
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text)",
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  groupClientChipWrap: {
    position: "relative",
    display: "inline-flex",
  },
  groupClientChipRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text)",
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: "1",
    cursor: "pointer",
  },
  groupClientChipAdd: {
    borderRadius: 999,
    border: "1px dashed var(--border)",
    background: "transparent",
    color: "var(--text)",
    padding: "6px 12px",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
  },
  scheduleTabsDivider: {
    height: 1,
    background: "var(--glass-tab-wrap-border)",
    marginTop: 12,
  },
  schedulePanel: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    border: "1px solid var(--border-2)",
    background: "var(--surface)",
  },
  schedulePanelPlain: {
    marginTop: 12,
    padding: 0,
    borderRadius: 0,
    border: "none",
    background: "transparent",
  },
  scheduleWeekWrap: {
    borderRadius: 28,
    border: "1px solid var(--schedule-grid-wrap-border)",
    background: "var(--schedule-grid-wrap-bg)",
    boxShadow: "var(--schedule-grid-wrap-shadow)",
    overflow: "hidden",
    width: "100%",
    boxSizing: "border-box",
    position: "relative",
    padding: 10,
  },
  scheduleWeekHeader: {
    display: "grid",
    gridTemplateColumns: "44px repeat(7, 1fr)",
    borderBottom: "1px solid var(--schedule-grid-line)",
    background: "var(--schedule-grid-header-bg)",
    borderRadius: 18,
    overflow: "hidden",
  },
  scheduleWeekTimeSpacer: {
    borderRight: "1px solid var(--schedule-grid-line)",
  },
  scheduleWeekDayHeader: {
    padding: "10px 4px",
    textAlign: "center",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text)",
    borderRight: "1px solid var(--schedule-grid-line)",
  },
  scheduleWeekDayHeaderToday: {
    background: "var(--schedule-day-active-bg)",
    color: "var(--schedule-day-active-text)",
    borderRadius: 14,
    margin: "4px 4px",
  },
  scheduleWeekDayTitle: {
    whiteSpace: "nowrap",
  },
  scheduleWeekDayName: {
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    color: "var(--muted)",
    lineHeight: 1.1,
    marginBottom: 2,
  },
  scheduleWeekGrid: {
    display: "grid",
    gridTemplateColumns: "44px 1fr",
  },
  scheduleWeekTimeCol: {
    borderRight: "1px solid var(--schedule-grid-line)",
    position: "relative",
    background: "transparent",
  },
  scheduleWeekTimeLabel: {
    position: "absolute",
    left: 0,
    right: 0,
    fontSize: 12,
    color: "var(--schedule-month-text)",
    padding: "0 6px",
    boxSizing: "border-box",
    transform: "translateY(-6px)",
  },
  scheduleWeekDays: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
  },
  scheduleWeekDayCol: {
    borderRight: "1px solid var(--schedule-grid-line)",
  },
  scheduleWeekDayBody: {
    position: "relative",
  },
  scheduleWeekHourLineTick: {
    position: "absolute",
    left: -10,
    right: 0,
    height: 1,
    background: "var(--schedule-grid-line)",
  },
  scheduleWeekHourLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    background: "var(--schedule-grid-line)",
  },
  scheduleWeekSession: {
    position: "absolute",
    left: 0,
    right: 0,
    borderRadius: 14,
    border: "1px solid var(--schedule-session-border)",
    background: "var(--schedule-session-bg)",
    color: "var(--text)",
    padding: "6px 6px",
    textAlign: "left",
    cursor: "pointer",
    boxShadow: "var(--schedule-session-shadow)",
  },
  scheduleWeekSessionDrag: {
    position: "absolute",
    borderRadius: 14,
    border: "1px solid var(--schedule-session-border)",
    background: "var(--schedule-session-bg)",
    color: "var(--text)",
    padding: "6px 6px",
    textAlign: "left",
    zIndex: 5,
    pointerEvents: "none",
  },
  scheduleWeekDraft: {
    position: "absolute",
    left: 4,
    right: 4,
    border: "2px solid #1F6BFF",
    borderRadius: 12,
    background: "transparent",
    zIndex: 1,
    pointerEvents: "none",
  },
  scheduleWeekSessionDark: {
    border: "1px solid var(--schedule-session-border)",
    background: "var(--schedule-session-bg)",
  },
  scheduleWeekSessionTitle: {
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 1.1,
    wordBreak: "break-all",
    color: "var(--schedule-month-text)",
  },
  scheduleWeekSessionTime: {
    fontSize: 10,
    opacity: 0.75,
    marginTop: 2,
  },
  scheduleHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  scheduleTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  scheduleMonthPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid var(--schedule-month-pill-border)",
    background: "var(--schedule-month-pill-bg)",
    boxShadow: "var(--schedule-month-pill-shadow)",
  },
  scheduleMonthLabel: {
    fontSize: 16,
    fontWeight: 600,
    color: "var(--schedule-month-text)",
    letterSpacing: -0.2,
  },
  scheduleMonthNav: {
    display: "flex",
    gap: 6,
  },
  scheduleMonthBtn: {
    width: 26,
    height: 26,
    borderRadius: 999,
    border: "1px solid var(--schedule-month-btn-border)",
    background: "var(--schedule-month-btn-bg)",
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 700,
    color: "var(--schedule-month-text)",
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "var(--schedule-month-btn-shadow)",
  },
  trainerSelectWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    width: "100%",
  },
  trainerSelectLabel: {
    fontSize: 11,
    fontWeight: "var(--font-medium)",
    letterSpacing: 0.2,
    textTransform: "uppercase",
    color: "var(--text-secondary)",
    whiteSpace: "nowrap",
  },
  trainerSelect: {
    border: "1px solid rgba(22, 119, 255, 0.35)",
    borderRadius: 14,
    padding: "8px 12px",
    fontSize: 14,
    fontWeight: 700,
    background: "rgba(22, 119, 255, 0.08)",
    color: "var(--text)",
    cursor: "pointer",
    maxWidth: 220,
    boxShadow: "0 1px 0 rgba(17, 24, 39, 0.04)",
  },
  selectCompact: {
    border: "1px solid rgba(22, 119, 255, 0.35)",
    borderRadius: 14,
    padding: "10px 12px",
    fontSize: 14,
    fontWeight: 700,
    background: "rgba(22, 119, 255, 0.08)",
    color: "var(--text)",
    cursor: "pointer",
    boxShadow: "0 1px 0 rgba(17, 24, 39, 0.04)",
    width: "fit-content",
    maxWidth: "100%",
  },
  colorSelectWrap: {
    position: "relative",
    display: "inline-flex",
    flexDirection: "column",
    gap: 6,
  },
  colorSelectButton: {
    border: "1px solid rgba(22, 119, 255, 0.35)",
    borderRadius: 14,
    padding: "10px 12px",
    fontSize: 14,
    fontWeight: 700,
    background: "rgba(22, 119, 255, 0.08)",
    color: "var(--text)",
    cursor: "pointer",
    boxShadow: "0 1px 0 rgba(17, 24, 39, 0.04)",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    minWidth: 200,
    justifyContent: "space-between",
  },
  colorSelectChevron: {
    fontSize: 12,
    opacity: 0.7,
  },
  colorSelectMenu: {
    position: "absolute",
    top: "100%",
    left: 0,
    marginTop: 6,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    boxShadow: "0 12px 24px rgba(15, 23, 42, 0.18)",
    padding: 6,
    zIndex: 5,
    minWidth: 220,
    maxHeight: 260,
    overflowY: "auto",
  },
  colorSelectItem: {
    width: "100%",
    border: "none",
    background: "transparent",
    padding: "8px 10px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    cursor: "pointer",
    fontSize: 14,
    color: "var(--text)",
    textAlign: "left",
  },
  colorSwatchSquare: {
    width: 16,
    height: 16,
    borderRadius: 2,
    flex: "0 0 auto",
  },
  addWindowBtn: {
    width: "100%",
    height: 54,
    borderRadius: 999,
    border: "2px solid var(--add-exercise-btn-border)",
    background: "var(--add-exercise-btn-bg)",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 16,
    color: "var(--add-exercise-btn-text)",
    marginBottom: 12,
    boxShadow: "var(--add-exercise-btn-shadow)",
  },
  scheduleAddWindowBtn: {
    width: "100%",
    height: 54,
    borderRadius: 999,
    border: "2px solid rgba(120, 170, 220, 0.6)",
    background: "var(--glass-pill-bg)",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 16,
    color: "var(--accent)",
    marginBottom: 12,
    boxShadow: "0 12px 22px rgba(120, 150, 190, 0.22)",
  },
  schedulePanelTitle: {
    fontWeight: "var(--font-strong)",
    fontSize: 15,
    letterSpacing: -0.2,
    color: "var(--text-primary)",
  },
  schedulePanelBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 1.35,
    color: "var(--text-secondary)",
  },
  sessionList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  sessionBanner: {
    position: "relative",
    padding: "14px 16px 14px 18px",
    borderRadius: 22,
    border: "1px solid var(--glass-card-border)",
    borderLeft: "4px solid var(--accent-soft-border)",
    background: "var(--glass-card-bg)",
    boxShadow: "var(--glass-card-shadow)",
    color: "var(--text-primary)",
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
    fontWeight: "var(--font-strong)",
    fontSize: 14,
    color: "var(--text-primary)",
  },
  sessionBannerTime: {
    marginTop: 6,
    fontSize: 14,
    color: "var(--text-secondary)",
  },
  sessionBannerClient: {
    marginTop: 6,
    fontSize: 13,
    color: "var(--text-secondary)",
  },
  sessionBannerStatus: {
    position: "absolute",
    top: 12,
    right: 12,
    fontSize: 12,
    fontWeight: "var(--font-medium)",
    color: "var(--text-accent)",
    background: "var(--glass-pill-bg)",
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid var(--glass-pill-border)",
    boxShadow: "var(--glass-pill-shadow)",
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
    padding: 14,
    borderRadius: 22,
    border: "1px solid var(--glass-card-border)",
    background: "var(--glass-card-bg)",
    boxShadow: "var(--glass-card-shadow)",
    color: "var(--text-primary)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  freeBannerLeft: {
    minWidth: 0,
  },
  freeBannerTitle: {
    fontWeight: "var(--font-strong)",
    fontSize: 15,
    color: "var(--text-primary)",
  },
  freeBannerTime: {
    marginTop: 6,
    fontSize: 13,
    color: "var(--text-secondary)",
  },
  freeBannerMeta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: 700,
    color: "var(--accent)",
  },
  freeBannerDelete: {
    width: 38,
    height: 38,
    borderRadius: 999,
    border: "1px solid var(--glass-pill-border)",
    background: "var(--glass-pill-bg)",
    cursor: "pointer",
    color: "var(--text-primary)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
    boxShadow: "var(--glass-pill-shadow)",
  },
  freeBannerActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flex: "0 0 auto",
  },
  freeBannerAdd: {
    width: 38,
    height: 38,
    borderRadius: 999,
    border: "none",
    background: "var(--accent-grad)",
    cursor: "pointer",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
    boxShadow: "var(--accent-shadow)",
  },
  assignRow: {
    marginTop: 8,
  },
  groupSlotToggle: {
    width: "100%",
    border: "1px solid var(--glass-pill-border)",
    background: "var(--glass-pill-bg)",
    boxShadow: "var(--glass-pill-shadow)",
    borderRadius: 20,
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    gap: 12,
    cursor: "pointer",
    color: "var(--text-primary)",
  },
  groupSlotCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 8,
    border: "1px solid var(--glass-pill-border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
    color: "#ffffff",
    background: "transparent",
  },
  groupSlotCheckboxActive: {
    background: "var(--accent-grad)",
    borderColor: "rgba(120, 170, 220, 0.6)",
    boxShadow: "var(--accent-shadow)",
  },
  groupSlotToggleText: {
    fontSize: 14,
    fontWeight: "var(--font-medium)",
    color: "var(--text-primary)",
    textAlign: "left",
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
    height: 88,
    background: "var(--bottom-nav-bg)",
    borderTop: "1px solid var(--bottom-nav-border)",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    boxShadow: "var(--bottom-nav-shadow)",
    display: "flex",
    justifyContent: "space-around",
    paddingTop: 10,
    paddingBottom: "calc(env(safe-area-inset-bottom) + 14px)",
    paddingLeft: 16,
    paddingRight: 16,
    boxSizing: "border-box",
    zIndex: 10,
    backdropFilter: "blur(14px)",
  },
  navBtn: {
    flex: 1,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: "14px 6px 6px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  navIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
  },
  navIconWrapActive: {
    background: "transparent",
    boxShadow: "none",
    color: "var(--accent)",
  },
  navLabel: {
    fontSize: 12,
    marginTop: 6,
    letterSpacing: -0.1,
  },
  navLabelActive: {
    color: "var(--accent)",
    fontWeight: 700,
  },
  navAddBtn: {
    width: 74,
    height: 74,
    borderRadius: 999,
    border: "none",
    background: "var(--accent-grad)",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "var(--accent-shadow)",
    marginTop: -24,
  },
  addMenuOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.35)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    paddingBottom: 6,
    zIndex: 30,
  },
  addMenuGlass: {
    width: "92vw",
    maxWidth: 420,
    borderRadius: 999,
    padding: "12px 12px",
    background: "var(--glass-menu-bg)",
    border: "1px solid var(--glass-menu-border)",
    boxShadow: "0 16px 32px rgba(15, 23, 42, 0.2)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
  },
  addMenuGlassRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    alignItems: "center",
    gap: 6,
  },
  addMenuGlassBtn: {
    border: "none",
    background: "var(--glass-menu-btn-bg)",
    color: "var(--text)",
    fontSize: 11,
    fontWeight: 700,
    lineHeight: 1.2,
    textAlign: "center",
    padding: "10px 6px",
    minHeight: 40,
    borderRadius: 999,
    cursor: "pointer",
    boxShadow: "var(--glass-menu-btn-shadow)",
  },
};
