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
const WEBAPP_URL = process.env.WEBAPP_URL ?? "https://app.fitminiapp.tech/";

if (!TELEGRAM_BOT_TOKEN) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN in backend/.env");
}
if (!JWT_SECRET) {
  throw new Error("Missing JWT_SECRET in backend/.env");
}

// ✅ Fix TS: from here they are guaranteed strings
const BOT_TOKEN: string = TELEGRAM_BOT_TOKEN;
const SECRET: string = JWT_SECRET;

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
    },
    create: {
      tgUserId: BigInt(tgUser.id),
      username: tgUser.username ?? null,
      firstName: tgUser.first_name ?? null,
      lastName: tgUser.last_name ?? null,
      role: null,
    },
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
      role: dbUser.role, // null | "trainer" | "client"
      theme: dbUser.theme,
      language: dbUser.language,
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

  const data: Record<string, any> = {};
  if (theme === "light" || theme === "dark") data.theme = theme;
  if (language === "ru" || language === "en") data.language = language;

  if (Object.keys(data).length === 0) {
    return reply.code(400).send({ message: "Nothing to update" });
  }

  const updated = await prisma.user.update({
    where: { id: dbUser.id },
    data,
  });

  return { ok: true, theme: updated.theme, language: updated.language };
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

  return { ok: true, clients: list.map((c: any) => serializeClient(c)) };
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
  if (existing) return { ok: true, existing: true, client: serializeClient(existing) };

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

  return { ok: true, client: serializeClient(created) };
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
  if (!client || client.trainerTgUserId !== dbUser.tgUserId) {
    return reply.code(404).send({ message: "Client not found" });
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

  return { ok: true, client: serializeClient(updated) };
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
  if (!client || client.trainerTgUserId !== dbUser.tgUserId) {
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

  return {
    ok: true,
    trainers: trainers.map((c: any) => {
      const base = serializeClient(c);
      const userId = userIdByTg.get(String(c.trainerTgUserId));
      const bookingMode = userId ? modeByUserId.get(userId) : null;
      const user = userByTg.get(String(c.trainerTgUserId));
      const trainerUsername = user?.username || null;
      const trainerName =
        (userId ? nameByUserId.get(userId) : null) ||
        [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
        null;
      return { ...base, bookingMode, trainerUsername, trainerName };
    }),
  };
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
  const remindAt = new Date(startAt.getTime() - 60 * 60 * 1000);
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
      const remindAt = new Date(startAt.getTime() - 60 * 60 * 1000);
      const id = `${dbUser.tgUserId.toString()}_${s.id}`;
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
