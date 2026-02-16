import crypto from "node:crypto";

function sha256(data: string | Buffer) {
  return crypto.createHash("sha256").update(data).digest();
}

function hmacSha256Hex(key: Buffer, data: string) {
  return crypto.createHmac("sha256", key).update(data).digest("hex");
}

export function verifyInitData(initData: string, botToken: string, maxAgeSeconds = 24 * 60 * 60) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) throw new Error("initData missing hash");

  const pairs: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key === "hash") continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const secretKey = sha256(botToken); // Telegram rule for WebApp
  const computedHash = hmacSha256Hex(secretKey, dataCheckString);

  if (computedHash !== hash) throw new Error("initData hash mismatch");

  const authDateStr = params.get("auth_date");
  if (!authDateStr) throw new Error("initData missing auth_date");

  const authDate = Number(authDateStr);
  const now = Math.floor(Date.now() / 1000);

  if (!Number.isFinite(authDate)) throw new Error("auth_date invalid");
  if (now - authDate > maxAgeSeconds) throw new Error("initData expired");

  const userStr = params.get("user");
  if (!userStr) throw new Error("initData missing user");

  const user = JSON.parse(userStr) as {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
    photo_url?: string;
  };

  return { user, authDate };
}
