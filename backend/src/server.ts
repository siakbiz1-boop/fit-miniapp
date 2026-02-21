import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import { validate } from "@tma.js/init-data-node";

// --------------------
// Config
// --------------------
const PORT = Number(process.env.PORT ?? 3001);
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const JWT_SECRET = process.env.JWT_SECRET;
const WEBAPP_URL = (process.env.WEBAPP_URL ?? "https://app.fitminiapp.tech/")
  .replace(/^WEBAPP_URL\s*=\s*/i, "")
  .replace(/^["']|["']$/g, "")
  .trim();

if (!TELEGRAM_BOT_TOKEN) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN in backend/.env");
}
if (!JWT_SECRET) {
  throw new Error("Missing JWT_SECRET in backend/.env");
}

// ✅ Fix TS: from here they are guaranteed strings
const BOT_TOKEN: string = TELEGRAM_BOT_TOKEN;
const SECRET: string = JWT_SECRET;
const FAR_FUTURE = new Date(8640000000000000);

// --------------------
// Prisma + Fastify
// --------------------
const prisma = new PrismaClient();
const prismaAny = prisma as any;
const app = Fastify({ logger: true });

await app.register(cors, {
  origin: "*",
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

// --------------------
// JWT (HS256) helpers
// --------------------
function base64url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signJwt(payload: Record<string, any>, secret: string, expiresInSec = 60 * 60 * 24 * 30) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + expiresInSec };

  const headerPart = base64url(JSON.stringify(header));
  const payloadPart = base64url(JSON.stringify(fullPayload));
  const data = `${headerPart}.${payloadPart}`;

  const signature = crypto.createHmac("sha256", secret).update(data).digest();
  const sigPart = base64url(signature);

  return `${data}.${sigPart}`;
}

function verifyJwt(token: string, secret: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false as const, reason: "bad token format" };

  const [headerPart, payloadPart, sigPart] = parts;
  const data = `${headerPart}.${payloadPart}`;

  const expected = base64url(crypto.createHmac("sha256", secret).update(data).digest());
  if (expected !== sigPart) return { ok: false as const, reason: "bad signature" };

  const payloadJson = Buffer.from(payloadPart.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  const payload = JSON.parse(payloadJson);

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp < now) {
    return { ok: false as const, reason: "token expired" };
  }

  return { ok: true as const, payload };
}

// --------------------
// Telegram user parsing
// --------------------
function parseTelegramUserFromInitData(initData: string) {
  const qs = initData.trim().replace(/^\?/, "");
  const params = new URLSearchParams(qs);
  const userStr = params.get("user");
  if (!userStr) return null;

  try {
    return JSON.parse(userStr) as {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
      language_code?: string;
      photo_url?: string;
    };
  } catch {
    return null;
  }
}

function normalizeUsername(raw: string) {
  const v = (raw || "").trim();
  const cleaned = v.startsWith("@") ? v.slice(1) : v;
  return cleaned.replace(/\s+/g, "");
}

function generateInviteCode(len = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function parseDateKey(value: string) {
  const parts = String(value || "").split("-").map((x) => parseInt(x, 10));
  if (parts.length < 3) return null;
  const [y, m, d] = parts;
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function computeRemindAt(startAt: Date, hours: number | null | undefined) {
  if (!hours || hours <= 0) return FAR_FUTURE;
  return new Date(startAt.getTime() - hours * 60 * 60 * 1000);
}

function serializeClient(client: any) {
  if (!client) return client;
  return {
    ...client,
    trainerTgUserId: client.trainerTgUserId?.toString?.() ?? client.trainerTgUserId,
    clientTgUserId: client.clientTgUserId?.toString?.() ?? client.clientTgUserId,
  };
}

function serializeSession(session: any) {
  if (!session) return session;
  return {
    ...session,
    trainerTgUserId: session.trainerTgUserId?.toString?.() ?? session.trainerTgUserId,
  };
}

function serializeSlot(slot: any) {
  if (!slot) return slot;
  return {
    ...slot,
    trainerTgUserId: slot.trainerTgUserId?.toString?.() ?? slot.trainerTgUserId,
  };
}

function buildProfilePayload(profile: any) {
  if (!profile) return null;
  return {
    fitnessClub: profile.fitnessClub ?? null,
    specialization: profile.specialization ?? null,
    experience: profile.experience ?? null,
    about: profile.about ?? null,
    requirements: profile.requirements ?? null,
    extraInfo: profile.extraInfo ?? null,
    phone: profile.phone ?? null,
    instagram: profile.instagram ?? null,
    otherSocial: profile.otherSocial ?? null,
  };
}

// --------------------
// Auth helper: get DB user from JWT
// --------------------
async function getAuthUser(req: any, reply: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    reply.code(401).send({ message: "Missing Authorization: Bearer <token>" });
    return null;
  }

  const token = auth.slice("Bearer ".length);
  const result = verifyJwt(token, SECRET);
  if (!result.ok) {
    reply.code(401).send({ message: `Invalid token: ${result.reason}` });
    return null;
  }

  const tgUserId = result.payload?.tgUserId;
  if (!tgUserId) {
    reply.code(401).send({ message: "Invalid token payload (tgUserId missing)" });
    return null;
  }

  const dbUser = await prisma.user.findUnique({
    where: { tgUserId: BigInt(tgUserId) },
  });

  if (!dbUser) {
    reply.code(404).send({ message: "User not found in DB" });
    return null;
  }

  return dbUser;
}

// --------------------
// Telegram reminders
// --------------------
async function sendTelegramReminder(params: {
  chatId: string;
  startTime: string;
  endTime: string;
  clientName: string;
}) {
  const { chatId, startTime, endTime, clientName } = params;
  const text = [
    "Напоминание о тренировке",
    `У Вас запланирована тренировка на ${startTime}-${endTime}`,
    `Клиент: ${clientName}`,
    "Подробности о тренировке смотри в приложении",
  ].join("\n");

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: {
        inline_keyboard: [[{ text: "Открыть приложение", web_app: { url: WEBAPP_URL } }]],
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Telegram sendMessage failed: ${res.status} ${errText}`);
  }
}

async function sendTelegramReminderToClient(params: {
  chatId: string;
  startTime: string;
  endTime: string;
  trainerName: string;
}) {
  const { chatId, startTime, endTime, trainerName } = params;
  const text = [
    "Напоминание о тренировке ⚠️",
    "",
    `У вас запланирована тренировка на ${startTime}-${endTime}`,
    `Тренер: ${trainerName}`,
    "Информацию о тренировке в приложении",
  ].join("\n");

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: {
        inline_keyboard: [[{ text: "Открыть приложение", web_app: { url: WEBAPP_URL } }]],
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Telegram sendMessage failed: ${res.status} ${errText}`);
  }
}

async function tickReminders() {
  const now = new Date();
  const due = await prismaAny.trainingSession.findMany({
    where: {
      remindAt: { lte: now },
      remindedAt: null,
      startAt: { gt: now },
    },
    take: 50,
  });

  for (const session of due) {
    try {
      const claimed = await prismaAny.trainingSession.updateMany({
        where: {
          id: session.id,
          remindedAt: null,
          remindAt: { lte: now },
          startAt: { gt: now },
        },
        data: { remindedAt: now },
      });
      if (claimed.count === 0) continue;

      const chatId = session.trainerTgUserId.toString();
      const clientName = session.clientName?.trim() || `@${session.clientUsername}`;
      await sendTelegramReminder({
        chatId,
        startTime: session.startTime,
        endTime: session.endTime,
        clientName,
      });

      try {
        const clientLink = await prismaAny.trainerClient.findFirst({
          where: {
            trainerTgUserId: session.trainerTgUserId,
            clientUsername: session.clientUsername,
            status: "active",
            clientTgUserId: { not: null },
          },
        });
        if (clientLink?.clientTgUserId) {
          const trainerUser = await prisma.user.findUnique({
            where: { tgUserId: session.trainerTgUserId },
          });
          const trainerLabel =
            (trainerUser?.username
              ? `@${String(trainerUser.username).replace(/^@/, "")}`
              : `${trainerUser?.firstName ?? ""} ${trainerUser?.lastName ?? ""}`.trim()) ||
            "Тренер";
          await sendTelegramReminderToClient({
            chatId: clientLink.clientTgUserId.toString(),
            startTime: session.startTime,
            endTime: session.endTime,
            trainerName: trainerLabel,
          });
        }
      } catch (err) {
        app.log.error({ err, sessionId: session.id }, "Failed to send client reminder");
      }
    } catch (err) {
      try {
        await prismaAny.trainingSession.updateMany({
          where: { id: session.id, remindedAt: now },
          data: { remindedAt: null },
        });
      } catch {
        // ignore rollback errors
      }
      app.log.error({ err, sessionId: session.id }, "Failed to send reminder");
    }
  }
}

// --------------------
// Routes
// --------------------
app.get("/health", async () => {
  await prisma.$queryRaw`SELECT 1`;
  return { ok: true };
});

// Telegram login: validate initData -> upsert user -> return JWT
app.post("/auth/telegram", async (req, reply) => {
  const body = req.body as any;
  const initData = body?.initData;

  if (!initData || typeof initData !== "string") {
    return reply.code(400).send({ message: "initData required" });
  }

  try {
    // ✅ validate signature from Telegram
    // expiresIn: 0 -> do not expire on dev
    validate(initData, BOT_TOKEN, { expiresIn: 0 });
  } catch (e: any) {
    req.log.warn({ err: e }, "Telegram initData validation failed");
    return reply.code(401).send({ message: "initData invalid" });
  }

  const tgUser = parseTelegramUserFromInitData(initData);
  if (!tgUser?.id) {
    return reply.code(400).send({ message: "user missing in initData" });
  }

  // ✅ create/update user in DB
  await prisma.user.upsert({
    where: { tgUserId: BigInt(tgUser.id) },
    update: {
      username: tgUser.username ?? null,
      firstName: tgUser.first_name ?? null,
      lastName: tgUser.last_name ?? null,
      photoUrl: tgUser.photo_url ?? null,
    } as any,
    create: {
      tgUserId: BigInt(tgUser.id),
      username: tgUser.username ?? null,
      firstName: tgUser.first_name ?? null,
      lastName: tgUser.last_name ?? null,
      photoUrl: tgUser.photo_url ?? null,
      role: null,
    } as any,
  });

  // ✅ issue JWT
  const token = signJwt(
    {
      tgUserId: tgUser.id, // store as number in JWT
      username: tgUser.username ?? null,
      firstName: tgUser.first_name ?? null,
      lastName: tgUser.last_name ?? null,
    },
    SECRET
  );

  return { token };
});

// Debug: verify JWT and return payload
app.get("/me", async (req, reply) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.code(401).send({ message: "Missing Authorization: Bearer <token>" });
  }

  const token = auth.slice("Bearer ".length);
  const result = verifyJwt(token, SECRET);

  if (!result.ok) {
    return reply.code(401).send({ message: `Invalid token: ${result.reason}` });
  }

  return { ok: true, user: result.payload };
});

// Return profile from DB (includes role)
app.get("/profile", async (req, reply) => {
  const dbUser = await getAuthUser(req, reply);
  if (!dbUser) return;

  return {
    ok: true,
    user: {
      tgUserId: dbUser.tgUserId.toString(),
      username: dbUser.username,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      photoUrl: (dbUser as any).photoUrl ?? null,
      role: dbUser.role, // null | "trainer" | "client"
      theme: dbUser.theme,
      language: dbUser.language,
      reminderHours: (dbUser as any).reminderHours ?? 1,
    },
  };
});

// Update user preferences (theme/language)
app.patch("/profile/preferences", async (req, reply) => {
  const dbUser = await getAuthUser(req, reply);
  if (!dbUser) return;

  const body = req.body as any;
  const theme = body?.theme;
  const language = body?.language;
  const reminderHours = body?.reminderHours;

  const data: Record<string, any> = {};
  if (theme === "light" || theme === "dark") data.theme = theme;
  if (language === "ru" || language === "en") data.language = language;
  if (typeof reminderHours === "number") {
    const allowed = new Set([0, 1, 2, 3, 4, 5, 6, 9, 12]);
    if (allowed.has(reminderHours)) data.reminderHours = reminderHours;
  }

  if (Object.keys(data).length === 0) {
    return reply.code(400).send({ message: "Nothing to update" });
  }

  const updated = await prisma.user.update({
    where: { id: dbUser.id },
    data,
  });

  if (data.reminderHours !== undefined && dbUser.role === "trainer") {
    const hours = data.reminderHours;
    const now = new Date();
    const farFuture = new Date(8640000000000000);
    const futureSessions = await prismaAny.trainingSession.findMany({
      where: {
        trainerTgUserId: dbUser.tgUserId,
        startAt: { gt: now },
        remindedAt: null,
      },
      select: { id: true, startAt: true },
    });
    const updates = futureSessions.map((s: any) => ({
      id: s.id,
      remindAt: hours > 0 ? new Date(s.startAt.getTime() - hours * 60 * 60 * 1000) : farFuture,
    }));
    if (updates.length) {
      await prisma.$transaction(
        updates.map((u: { id: string; remindAt: Date }) =>
          prismaAny.trainingSession.update({
            where: { id: u.id },
            data: { remindAt: u.remindAt },
          })
        )
      );
    }
  }

  return {
    ok: true,
    theme: updated.theme,
    language: updated.language,
    reminderHours: (updated as any).reminderHours ?? 1,
  };
});

// Delete profile (trainer/client) and related data
app.delete("/profile", async (req, reply) => {
  const dbUser = await getAuthUser(req, reply);
  if (!dbUser) return;

  if (dbUser.role === "trainer") {
    await prismaAny.trainerClient.deleteMany({
      where: { trainerTgUserId: dbUser.tgUserId },
    });
    await prismaAny.trainingSlot.deleteMany({
      where: { trainerTgUserId: dbUser.tgUserId },
    });
    await prismaAny.trainerProfile.deleteMany({
      where: { userId: dbUser.id },
    });
    await prisma.user.delete({ where: { id: dbUser.id } });
    return { ok: true };
  }

  const usernames = new Set<string>();
  if (dbUser.username) usernames.add(dbUser.username.replace(/^@/, ""));
  const relations = await prismaAny.trainerClient.findMany({
    where: { clientTgUserId: dbUser.tgUserId },
    select: { clientUsername: true },
  });
  relations.forEach((r: any) => {
    if (r?.clientUsername) usernames.add(String(r.clientUsername));
  });

  await prismaAny.trainerClient.deleteMany({
    where: {
      OR: [
        { clientTgUserId: dbUser.tgUserId },
        ...(dbUser.username ? [{ clientUsername: dbUser.username.replace(/^@/, "") }] : []),
      ],
    },
  });

  if (usernames.size > 0) {
    await prismaAny.trainingSession.deleteMany({
      where: { clientUsername: { in: Array.from(usernames) } },
    });
  }

  await prisma.user.delete({ where: { id: dbUser.id } });
  return { ok: true };
});

// Set role: trainer/client
app.post("/role", async (req, reply) => {
  const dbUser = await getAuthUser(req, reply);
  if (!dbUser) return;

  const body = req.body as any;
  const role = body?.role;

  if (role !== "trainer" && role !== "client") {
    return reply.code(400).send({ message: 'role must be "trainer" or "client"' });
  }

  const updated = await prisma.user.update({
    where: { id: dbUser.id },
    data: { role },
  });

  return { ok: true, role: updated.role };
});

// For testing: reset role -> will show role selection again
app.post("/role/reset", async (req, reply) => {
  const dbUser = await getAuthUser(req, reply);
  if (!dbUser) return;

  await prisma.user.update({
    where: { id: dbUser.id },
    data: { role: null },
  });

  return { ok: true };
});

// --------------------
// Clients
// --------------------
app.get("/clients", async (req, reply) => {
  const dbUser = await getAuthUser(req, reply);
  if (!dbUser) return;

  const list = await prismaAny.trainerClient.findMany({
    where: { trainerTgUserId: dbUser.tgUserId },
    orderBy: { createdAt: "desc" },
    include: { exercises: true },
  });

  const clientTgIds = Array.from(new Set(list.map((c: any) => c.clientTgUserId)))
    .filter((id: any) => id !== null && id !== undefined)
    .map((id: any) => (typeof id === "bigint" ? id : BigInt(String(id))));
  const users = clientTgIds.length
    ? await prisma.user.findMany({ where: { tgUserId: { in: clientTgIds } } })
    : [];
  const userIdByTg = new Map(users.map((u) => [u.tgUserId.toString(), u.id]));
  const profiles = users.length
    ? await prismaAny.trainerProfile.findMany({ where: { userId: { in: users.map((u) => u.id) } } })
    : [];
  const profileByUserId = new Map(profiles.map((p: any) => [p.userId, p]));
  const userByTg = new Map(users.map((u) => [u.tgUserId.toString(), u]));

  return {
    ok: true,
    clients: list.map((c: any) => {
      const base = serializeClient(c);
      const userId = c.clientTgUserId ? userIdByTg.get(String(c.clientTgUserId)) : null;
      const profile = userId ? profileByUserId.get(userId) : null;
      const user = c.clientTgUserId ? userByTg.get(String(c.clientTgUserId)) : null;
      const clientName = user
        ? [user.firstName, user.lastName].filter(Boolean).join(" ") || null
        : null;
      const clientPhotoUrl = (user as any)?.photoUrl || null;
      return { ...base, clientName, photoUrl: clientPhotoUrl, clientProfile: buildProfilePayload(profile) };
    }),
  };
});

app.post("/clients", async (req, reply) => {
  const dbUser = await getAuthUser(req, reply);
  if (!dbUser) return;

  const body = req.body as any;
  const username = normalizeUsername(body?.username || "");
  if (!/^[a-zA-Z0-9_]{5,32}$/.test(username)) {
    return reply.code(400).send({ message: "Invalid username" });
  }

  const existing = await prismaAny.trainerClient.findUnique({
    where: { trainerTgUserId_clientUsername: { trainerTgUserId: dbUser.tgUserId, clientUsername: username } },
    include: { exercises: true },
  });
  if (existing) {
    let clientName: string | null = null;
    if (existing.clientTgUserId) {
      const user = await prisma.user.findUnique({ where: { tgUserId: existing.clientTgUserId } });
      if (user) clientName = [user.firstName, user.lastName].filter(Boolean).join(" ") || null;
    }
    return { ok: true, existing: true, client: { ...serializeClient(existing), clientName } };
  }

  let code = generateInviteCode(8);
  for (let i = 0; i < 5; i++) {
    const collision = await prismaAny.trainerClient.findUnique({
      where: { trainerTgUserId_code: { trainerTgUserId: dbUser.tgUserId, code } },
    });
    if (!collision) break;
    code = generateInviteCode(8);
  }

  const created = await prismaAny.trainerClient.create({
    data: {
      trainerTgUserId: dbUser.tgUserId,
      clientUsername: username,
      code,
      status: "pending",
      fullName: body?.fullName ? String(body.fullName) : null,
    },
    include: { exercises: true },
  });

  let clientName: string | null = null;
  let clientPhotoUrl: string | null = null;
  if (created.clientTgUserId) {
    const user = await prisma.user.findUnique({ where: { tgUserId: created.clientTgUserId } });
    if (user) {
      clientName = [user.firstName, user.lastName].filter(Boolean).join(" ") || null;
      clientPhotoUrl = (user as any)?.photoUrl || null;
    }
  }
  return { ok: true, client: { ...serializeClient(created), clientName, photoUrl: clientPhotoUrl, clientProfile: null } };
});

app.patch("/clients/:id", async (req, reply) => {
  const dbUser = await getAuthUser(req, reply);
  if (!dbUser) return;

  const id = String((req.params as any)?.id || "");
  const body = req.body as any;
  if (!id) return reply.code(400).send({ message: "id required" });

  const client = await prismaAny.trainerClient.findUnique({
    where: { id },
  });
  if (!client) {
    return reply.code(404).send({ message: "Client not found" });
  }
  if (dbUser.role === "trainer") {
    if (client.trainerTgUserId !== dbUser.tgUserId) {
      return reply.code(404).send({ message: "Client not found" });
    }
  } else if (dbUser.role === "client") {
    const username = (dbUser.username || "").replace(/^@/, "");
    if (!username || client.clientUsername !== username) {
      return reply.code(404).send({ message: "Client not found" });
    }
  } else {
    return reply.code(403).send({ message: "Forbidden" });
  }

  const updated = await prismaAny.trainerClient.update({
    where: { id },
    data: {
      status: body?.status,
      archived: body?.archived,
      fullName: body?.fullName,
      height: body?.height,
      weight: body?.weight,
      goal: body?.goal,
      comment: body?.comment,
      subscriptionStart: body?.subscriptionStart,
      subscriptionEnd: body?.subscriptionEnd,
      subscriptionPrice: body?.subscriptionPrice,
      subscriptionTotal: body?.subscriptionTotal,
      subscriptionLeft: body?.subscriptionLeft,
    },
    include: { exercises: true },
  });

  let clientProfile = null;
  if (updated.clientTgUserId) {
    const user = await prisma.user.findUnique({ where: { tgUserId: updated.clientTgUserId } });
    if (user) {
      const profile = await prismaAny.trainerProfile.findUnique({ where: { userId: user.id } });
      clientProfile = buildProfilePayload(profile);
      const clientName = [user.firstName, user.lastName].filter(Boolean).join(" ") || null;
      const clientPhotoUrl = (user as any)?.photoUrl || null;
      return { ok: true, client: { ...serializeClient(updated), clientName, photoUrl: clientPhotoUrl, clientProfile } };
    }
  }

  return { ok: true, client: { ...serializeClient(updated), clientProfile } };
});

app.post("/clients/:id/exercises", async (req, reply) => {
  const dbUser = await getAuthUser(req, reply);
  if (!dbUser) return;

  const id = String((req.params as any)?.id || "");
  const body = req.body as any;
  if (!id) return reply.code(400).send({ message: "id required" });

  const client = await prismaAny.trainerClient.findUnique({
    where: { id },
  });
  if (!client) {
    return reply.code(404).send({ message: "Client not found" });
  }
  const isTrainerOwner = client.trainerTgUserId === dbUser.tgUserId;
  const isClientOwner = client.clientTgUserId === dbUser.tgUserId;
  if (!isTrainerOwner && !isClientOwner) {
    return reply.code(404).send({ message: "Client not found" });
  }

  const exercises = Array.isArray(body?.exercises) ? body.exercises : [];
  const normalized = exercises
    .map((ex: any) => ({
      id: ex?.id ? String(ex.id) : null,
      name: String(ex?.name || "").trim(),
      weight: String(ex?.weight || "").trim(),
    }))
    .filter((ex: any) => ex.name && ex.weight);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.clientExercise.findMany({ where: { clientId: id } });
    const keepIds = new Set(normalized.map((ex: any) => ex.id).filter(Boolean));
    const toDelete = existing.filter((ex) => !keepIds.has(ex.id)).map((ex) => ex.id);
    if (toDelete.length) {
      await tx.clientExercise.deleteMany({ where: { id: { in: toDelete } } });
    }
    for (const ex of normalized) {
      if (ex.id) {
        await tx.clientExercise.update({
          where: { id: ex.id },
          data: { name: ex.name, weight: ex.weight },
        });
      } else {
        await tx.clientExercise.create({
          data: { clientId: id, name: ex.name, weight: ex.weight },
        });
      }
    }
  });

  const next = await prismaAny.trainerClient.findUnique({
    where: { id },
    include: { exercises: true },
  });

  return { ok: true, client: serializeClient(next) };
});

app.delete("/clients/:id", async (req, reply) => {
  const dbUser = await getAuthUser(req, reply);
  if (!dbUser) return;

  const id = String((req.params as any)?.id || "");
  if (!id) return reply.code(400).send({ message: "id required" });

  const client = await prismaAny.trainerClient.findUnique({ where: { id } });
  if (!client || client.trainerTgUserId !== dbUser.tgUserId) {
    return reply.code(404).send({ message: "Client not found" });
  }

  await prismaAny.trainerClient.delete({ where: { id } });
  return { ok: true };
});

app.get("/clients/:id/sessions", async (req, reply) => {
  const dbUser = await getAuthUser(req, reply);
  if (!dbUser) return;

  const id = String((req.params as any)?.id || "");
  if (!id) return reply.code(400).send({ message: "id required" });

  const client = await prismaAny.trainerClient.findUnique({ where: { id } });
  if (!client || client.trainerTgUserId !== dbUser.tgUserId) {
    return reply.code(404).send({ message: "Client not found" });
  }

  const sessions = await prismaAny.trainingSession.findMany({
    where: {
      trainerTgUserId: dbUser.tgUserId,
      clientUsername: client.clientUsername,
    },
    orderBy: { startAt: "desc" },
  });

  return { ok: true, sessions: sessions.map((s: any) => serializeSession(s)) };
});

// --------------------
// Trainer profile
// --------------------
app.get("/profile/trainer", async (req, reply) => {
  const dbUser = await getAuthUser(req, reply);
  if (!dbUser) return;

  let profile = await prismaAny.trainerProfile.findUnique({
    where: { userId: dbUser.id },
  });
  if (!profile) {
    profile = await prismaAny.trainerProfile.create({
      data: { userId: dbUser.id },
    });
  }
  return { ok: true, profile };
});

app.patch("/profile/trainer", async (req, reply) => {
  const dbUser = await getAuthUser(req, reply);
  if (!dbUser) return;

  const body = req.body as any;
  const data = {
    fullName: body?.fullName,
    fitnessClub: body?.fitnessClub,
    specialization: body?.specialization,
    experience: body?.experience,
    about: body?.about,
    requirements: body?.requirements,
    extraInfo: body?.extraInfo,
    phone: body?.phone,
    instagram: body?.instagram,
    otherSocial: body?.otherSocial,
    bookingMode: body?.bookingMode === "both" || body?.bookingMode === "trainer" ? body.bookingMode : undefined,
  };

  const profile = await prismaAny.trainerProfile.upsert({
    where: { userId: dbUser.id },
    create: { userId: dbUser.id, ...data },
    update: data,
  });

  return { ok: true, profile };
});

// --------------------
// Client activation & booking
// --------------------
app.post("/clients/activate", async (req, reply) => {
  const dbUser = await getAuthUser(req, reply);
  if (!dbUser) return;

  const body = req.body as any;
  const code = String(body?.code || "").trim().toUpperCase();
  if (!code) return reply.code(400).send({ message: "code required" });
  const incomingUsername = normalizeUsername(dbUser.username || "").toLowerCase();
  if (!incomingUsername) {
    return reply.code(400).send({ message: "username required" });
  }

  const record = await prismaAny.trainerClient.findFirst({
    where: { code },
  });
  if (!record) return reply.code(404).send({ message: "code not found" });
  if (normalizeUsername(record.clientUsername || "").toLowerCase() !== incomingUsername) {
    return reply.code(403).send({ message: "username mismatch" });
  }

  const updated = await prismaAny.trainerClient.update({
    where: { id: record.id },
    data: {
      status: "active",
      archived: false,
      clientTgUserId: dbUser.tgUserId,
      clientUsername: record.clientUsername || incomingUsername,
    },
    include: { exercises: true },
  });

  return { ok: true, client: serializeClient(updated) };
});

// Client profile (basic fields shared with trainer)
app.patch("/client/profile", async (req, reply) => {
  const dbUser = await getAuthUser(req, reply);
  if (!dbUser) return;

  const body = req.body as any;
  const data: Record<string, any> = {};
  if (body?.fullName !== undefined) data.fullName = String(body.fullName || "");
  if (body?.height !== undefined) data.height = String(body.height || "");
  if (body?.weight !== undefined) data.weight = String(body.weight || "");
  if (body?.goal !== undefined) data.goal = String(body.goal || "");
  if (body?.comment !== undefined) data.comment = String(body.comment || "");

  if (Object.keys(data).length === 0) {
    return reply.code(400).send({ message: "Nothing to update" });
  }

  await prismaAny.trainerClient.updateMany({
    where: { clientTgUserId: dbUser.tgUserId },
    data,
  });

  return { ok: true };
});

app.get("/client/trainers", async (req, reply) => {
  const dbUser = await getAuthUser(req, reply);
  if (!dbUser) return;

  const username = dbUser.username || "";
  const trainers = await prismaAny.trainerClient.findMany({
    where: {
      status: "active",
      archived: false,
      OR: [
        { clientTgUserId: dbUser.tgUserId },
        ...(username ? [{ clientUsername: username.replace(/^@/, "") }] : []),
      ],
    },
    include: { exercises: true },
  });

  const trainerIds = Array.from(new Set(trainers.map((c: any) => c.trainerTgUserId)))
    .filter((id: any) => id !== null && id !== undefined)
    .map((id: any) => (typeof id === "bigint" ? id : BigInt(String(id))));
  const users = await prisma.user.findMany({
    where: { tgUserId: { in: trainerIds } },
  });
  const userIdByTg = new Map(users.map((u) => [u.tgUserId.toString(), u.id]));
  const userByTg = new Map(users.map((u) => [u.tgUserId.toString(), u]));
  const profiles = await prismaAny.trainerProfile.findMany({
    where: { userId: { in: users.map((u) => u.id) } },
  });
  const modeByUserId = new Map(profiles.map((p: any) => [p.userId, p.bookingMode]));
  const nameByUserId = new Map(profiles.map((p: any) => [p.userId, p.fullName]));
  const profileByUserId = new Map(profiles.map((p: any) => [p.userId, p]));

  return {
    ok: true,
    trainers: trainers.map((c: any) => {
      const base = serializeClient(c);
      const userId = userIdByTg.get(String(c.trainerTgUserId));
      const bookingMode = userId ? modeByUserId.get(userId) : null;
      const user = userByTg.get(String(c.trainerTgUserId));
      const trainerUsername = user?.username || null;
      const trainerPhotoUrl = (user as any)?.photoUrl || null;
      const trainerName =
        (userId ? nameByUserId.get(userId) : null) ||
        [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
        null;
      const profile = userId ? (profileByUserId.get(userId) as any) : null;
      const trainerProfile = profile
        ? {
            fitnessClub: profile.fitnessClub ?? null,
            specialization: profile.specialization ?? null,
            experience: profile.experience ?? null,
            about: profile.about ?? null,
            requirements: profile.requirements ?? null,
            extraInfo: profile.extraInfo ?? null,
            phone: profile.phone ?? null,
            instagram: profile.instagram ?? null,
            otherSocial: profile.otherSocial ?? null,
          }
        : null;
      return { ...base, bookingMode, trainerUsername, trainerName, trainerPhotoUrl, trainerProfile };
    }),
  };
});

// Client deletes a session (allowed only when trainer bookingMode is "both")
app.delete("/client/sessions/:id", async (req, reply) => {
  const dbUser = await getAuthUser(req, reply);
  if (!dbUser) return;

  const id = String((req.params as any)?.id || "");
  if (!id) return reply.code(400).send({ message: "id required" });

  const session = await prismaAny.trainingSession.findUnique({ where: { id } });
  if (!session) return reply.code(404).send({ message: "session not found" });

  const normalizedUsername = dbUser.username ? dbUser.username.replace(/^@/, "") : "";
  const ownsByUsername = normalizedUsername && session.clientUsername === normalizedUsername;
  const relation = await prismaAny.trainerClient.findFirst({
    where: { trainerTgUserId: session.trainerTgUserId, clientTgUserId: dbUser.tgUserId },
  });
  if (!ownsByUsername && !relation) {
    return reply.code(403).send({ message: "forbidden" });
  }

  const trainer = await prisma.user.findUnique({ where: { tgUserId: session.trainerTgUserId } });
  const profile = trainer
    ? await prismaAny.trainerProfile.findUnique({ where: { userId: trainer.id } })
    : null;
  const bookingMode = profile?.bookingMode || "trainer";
  if (bookingMode !== "both") {
    return reply.code(403).send({ message: "booking disabled" });
  }

  const startAt = new Date(session.startAt);
  const dateKey = `${startAt.getFullYear()}-${String(startAt.getMonth() + 1).padStart(2, "0")}-${String(
    startAt.getDate()
  ).padStart(2, "0")}`;
  const existingSlot = await prismaAny.trainingSlot.findFirst({
    where: {
      trainerTgUserId: session.trainerTgUserId,
      dateKey,
      start: session.startTime,
      end: session.endTime,
    },
  });
  if (!existingSlot) {
    await prismaAny.trainingSlot.create({
      data: {
        trainerTgUserId: session.trainerTgUserId,
        dateKey,
        start: session.startTime,
        end: session.endTime,
      },
    });
  }

  await prismaAny.trainingSession.delete({ where: { id } });
  return { ok: true };
});

app.get("/slots", async (req, reply) => {
  const dbUser = await getAuthUser(req, reply);
  if (!dbUser) return;

  const trainerTgUserIdParam = (req.query as any)?.trainerTgUserId;
  const trainerTgUserId = trainerTgUserIdParam
    ? BigInt(trainerTgUserIdParam)
    : dbUser.tgUserId;
  const dateKey = (req.query as any)?.dateKey as string | undefined;

  const slots = await prismaAny.trainingSlot.findMany({
    where: {
      trainerTgUserId,
      ...(dateKey ? { dateKey } : {}),
    },
    orderBy: [{ dateKey: "asc" }, { start: "asc" }],
  });

  return { ok: true, slots: slots.map((s: any) => serializeSlot(s)) };
});

app.post("/slots", async (req, reply) => {
  const dbUser = await getAuthUser(req, reply);
  if (!dbUser) return;

  const body = req.body as any;
  const dateKey = String(body?.dateKey || "");
  const start = String(body?.start || "");
  const end = String(body?.end || "");
  if (!dateKey || !start || !end) {
    return reply.code(400).send({ message: "dateKey/start/end required" });
  }

  const existing = await prismaAny.trainingSlot.findFirst({
    where: { trainerTgUserId: dbUser.tgUserId, dateKey, start, end },
  });
  if (existing) {
    return { ok: true, slot: serializeSlot(existing) };
  }

  const slot = await prismaAny.trainingSlot.create({
    data: { trainerTgUserId: dbUser.tgUserId, dateKey, start, end },
  });

  return { ok: true, slot: serializeSlot(slot) };
});

app.delete("/slots/:id", async (req, reply) => {
  const dbUser = await getAuthUser(req, reply);
  if (!dbUser) return;

  const id = String((req.params as any)?.id || "");
  if (!id) return reply.code(400).send({ message: "id required" });

  const slot = await prismaAny.trainingSlot.findUnique({ where: { id } });
  if (!slot || slot.trainerTgUserId !== dbUser.tgUserId) {
    return reply.code(404).send({ message: "slot not found" });
  }

  await prismaAny.trainingSlot.delete({ where: { id } });
  return { ok: true };
});

app.post("/book", async (req, reply) => {
  const dbUser = await getAuthUser(req, reply);
  if (!dbUser) return;

  const body = req.body as any;
  let trainerTgUserId: bigint;
  try {
    trainerTgUserId = BigInt(body?.trainerTgUserId);
  } catch {
    return reply.code(400).send({ message: "trainerTgUserId invalid" });
  }
  const dateKey = String(body?.dateKey || "");
  const start = String(body?.start || "");
  const end = String(body?.end || "");
  if (!trainerTgUserId || !dateKey || !start || !end) {
    return reply.code(400).send({ message: "trainerTgUserId/dateKey/start/end required" });
  }

  const relation = await prismaAny.trainerClient.findFirst({
    where: {
      trainerTgUserId,
      status: "active",
      archived: false,
      OR: [
        { clientTgUserId: dbUser.tgUserId },
        ...(dbUser.username ? [{ clientUsername: dbUser.username.replace(/^@/, "") }] : []),
      ],
    },
  });
  if (!relation) return reply.code(403).send({ message: "client not connected to trainer" });

  const trainer = await prisma.user.findUnique({ where: { tgUserId: trainerTgUserId } });
  const profile = trainer
    ? await prismaAny.trainerProfile.findUnique({ where: { userId: trainer.id } })
    : null;
  const bookingMode = profile?.bookingMode || "trainer";
  if (bookingMode !== "both") {
    return reply.code(403).send({ message: "booking disabled" });
  }

  const slot = await prismaAny.trainingSlot.findFirst({
    where: { trainerTgUserId, dateKey, start, end },
  });
  if (!slot) return reply.code(404).send({ message: "slot not found" });

  const day = parseDateKey(dateKey);
  if (!day) return reply.code(400).send({ message: "dateKey invalid" });
  const [sh, sm] = start.split(":").map((x) => parseInt(x, 10));
  const [eh, em] = end.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(sh) || Number.isNaN(sm) || Number.isNaN(eh) || Number.isNaN(em)) {
    return reply.code(400).send({ message: "time invalid" });
  }
  const startAt = new Date(day);
  startAt.setHours(sh, sm, 0, 0);
  const endAt = new Date(day);
  endAt.setHours(eh, em, 0, 0);
  if (Date.now() >= startAt.getTime()) {
    return reply.code(403).send({ message: "slot already started" });
  }
  const reminderHours = (trainer as any)?.reminderHours ?? 1;
  const remindAt = computeRemindAt(startAt, reminderHours);
  const id = `${trainerTgUserId.toString()}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const session = await prismaAny.trainingSession.create({
    data: {
      id,
      trainerTgUserId,
      clientUsername: relation.clientUsername,
      clientName: relation.fullName || null,
      startAt,
      endAt,
      startTime: start,
      endTime: end,
      type: null,
      source: "client",
      remindAt,
    },
  });

  await prismaAny.trainingSlot.delete({ where: { id: slot.id } });

  return { ok: true, session: serializeSession(session) };
});

// Trainer sessions (include client-created)
app.get("/sessions", async (req, reply) => {
  const dbUser = await getAuthUser(req, reply);
  if (!dbUser) return;

  const sessions = await prismaAny.trainingSession.findMany({
    where: { trainerTgUserId: dbUser.tgUserId },
    orderBy: { startAt: "asc" },
  });
  return { ok: true, sessions: sessions.map((s: any) => serializeSession(s)) };
});

// Delete trainer session (including client-created)
app.delete("/sessions/:id", async (req, reply) => {
  const dbUser = await getAuthUser(req, reply);
  if (!dbUser) return;

  const id = String((req.params as any)?.id || "");
  if (!id) return reply.code(400).send({ message: "id required" });

  const tryDelete = async (sessionId: string) => {
    const session = await prismaAny.trainingSession.findUnique({ where: { id: sessionId } });
    if (!session || session.trainerTgUserId !== dbUser.tgUserId) return false;
    await prismaAny.trainingSession.delete({ where: { id: sessionId } });
    return true;
  };

  const prefix = `${dbUser.tgUserId.toString()}_`;
  if (await tryDelete(id)) return { ok: true };
  if (id.startsWith(prefix)) {
    const suffix = id.split(prefix).filter(Boolean).pop();
    if (suffix) {
      const normalized = `${prefix}${suffix}`;
      if (normalized !== id && (await tryDelete(normalized))) return { ok: true };
    }
  }
  return reply.code(404).send({ message: "session not found" });
});

// Update trainer session info (type/price/comment)
app.patch("/sessions/:id", async (req, reply) => {
  const dbUser = await getAuthUser(req, reply);
  if (!dbUser) return;

  const id = String((req.params as any)?.id || "");
  if (!id) return reply.code(400).send({ message: "id required" });

  const body = req.body as any;
  const data: any = {};
  if (body?.type !== undefined) data.type = body.type;
  if (body?.price !== undefined) data.price = body.price;
  if (body?.comment !== undefined) data.comment = body.comment;

  if (Object.keys(data).length === 0) {
    return reply.code(400).send({ message: "Nothing to update" });
  }

  const tryUpdate = async (sessionId: string) => {
    const session = await prismaAny.trainingSession.findUnique({ where: { id: sessionId } });
    if (!session || session.trainerTgUserId !== dbUser.tgUserId) return null;
    const updated = await prismaAny.trainingSession.update({
      where: { id: sessionId },
      data,
    });
    return updated;
  };

  const updated = await tryUpdate(id);
  if (updated) return { ok: true, session: serializeSession(updated) };

  const prefix = `${dbUser.tgUserId.toString()}_`;
  if (id.startsWith(prefix)) {
    const suffix = id.split(prefix).filter(Boolean).pop();
    if (suffix) {
      const normalized = `${prefix}${suffix}`;
      if (normalized !== id) {
        const updatedNormalized = await tryUpdate(normalized);
        if (updatedNormalized) return { ok: true, session: serializeSession(updatedNormalized) };
      }
    }
  }

  return reply.code(404).send({ message: "session not found" });
});

// Client sessions
app.get("/client/sessions", async (req, reply) => {
  const dbUser = await getAuthUser(req, reply);
  if (!dbUser) return;

  const username = dbUser.username || "";
  if (!username) return { ok: true, sessions: [] };

  const sessions = await prismaAny.trainingSession.findMany({
    where: { clientUsername: username.replace(/^@/, "") },
    orderBy: { startAt: "asc" },
  });
  return { ok: true, sessions: sessions.map((s: any) => serializeSession(s)) };
});

// Sync trainer sessions for reminders
app.post("/sessions/sync", async (req, reply) => {
  const dbUser = await getAuthUser(req, reply);
  if (!dbUser) return;

  const body = req.body as any;
  if (!Array.isArray(body?.sessions)) {
    return reply.code(400).send({ message: "sessions[] required" });
  }

  const normalized = body.sessions
    .map((s: any) => {
      const startAt = new Date(s?.startAt);
      const endAt = new Date(s?.endAt);
      if (!s?.id || !s?.clientUsername || Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
        return null;
      }
      const reminderHours = (dbUser as any)?.reminderHours ?? 1;
      const remindAt = computeRemindAt(startAt, reminderHours);
      const rawId = String(s.id);
      const prefix = `${dbUser.tgUserId.toString()}_`;
      const id = rawId.startsWith(prefix) ? rawId : `${prefix}${rawId}`;
      return {
        id,
        trainerTgUserId: dbUser.tgUserId,
        clientUsername: String(s.clientUsername).replace(/^@/, ""),
        clientName: s.clientName ? String(s.clientName) : null,
        startAt,
        endAt,
        startTime: String(s.startTime ?? ""),
        endTime: String(s.endTime ?? ""),
        type: s.type ? String(s.type) : null,
        source: "trainer",
        remindAt,
      };
    })
    .filter(Boolean) as Array<{
    id: string;
    trainerTgUserId: bigint;
    clientUsername: string;
    clientName: string | null;
    startAt: Date;
    endAt: Date;
    startTime: string;
    endTime: string;
    type: string | null;
    remindAt: Date;
  }>;

  const ids = normalized.map((s) => s.id);
  const existing = (await prismaAny.trainingSession.findMany({
    where: {
      trainerTgUserId: dbUser.tgUserId,
      ...(ids.length ? { id: { in: ids } } : {}),
    },
  })) as Array<any>;
  const existingById = new Map(existing.map((s: any) => [s.id, s]));

  const ops = normalized.map((s) =>
    prismaAny.trainingSession.upsert({
      where: { id: s.id },
      update: {
        clientUsername: s.clientUsername,
        clientName: s.clientName,
        startAt: s.startAt,
        endAt: s.endAt,
        startTime: s.startTime,
        endTime: s.endTime,
        type: s.type,
        source: "trainer",
        remindAt: s.remindAt,
        remindedAt: (() => {
          const prev = existingById.get(s.id);
          if (!prev) return null;
          return prev.remindAt.getTime() === s.remindAt.getTime() ? prev.remindedAt : null;
        })(),
      },
      create: s,
    })
  );

  ops.push(
    prismaAny.trainingSession.deleteMany({
      where: {
        trainerTgUserId: dbUser.tgUserId,
        source: "trainer",
        ...(ids.length ? { id: { notIn: ids } } : {}),
      },
    })
  );

  await prisma.$transaction(ops);
  return { ok: true, count: normalized.length };
});

// --------------------
// Start
// --------------------
await app.listen({ port: PORT, host: "0.0.0.0" });
app.log.info(`Server running on http://localhost:${PORT}`);

// Background reminders
setInterval(() => {
  tickReminders().catch((err) => app.log.error({ err }, "Reminder tick failed"));
}, 60 * 1000);
