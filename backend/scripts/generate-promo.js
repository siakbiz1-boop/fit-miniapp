import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const key = process.argv[i];
  if (!key?.startsWith("--")) continue;
  const value = process.argv[i + 1];
  if (!value || value.startsWith("--")) {
    args.set(key, true);
    i -= 1;
  } else {
    args.set(key, value);
  }
}

const planId = String(args.get("--plan-id") || "").trim();
const planName = String(args.get("--plan-name") || "").trim();
const months = Number(args.get("--months"));
const count = Math.max(1, Number(args.get("--count") || 1));
const length = Math.max(6, Number(args.get("--length") || 10));

if (!planId || !planName || !Number.isFinite(months)) {
  // eslint-disable-next-line no-console
  console.log(
    'Usage: node backend/scripts/generate-promo.js --plan-id ultimate --plan-name "Ultimate" --months 12 [--count 1] [--length 10]'
  );
  process.exit(1);
}

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const generateCode = (len) => {
  let out = "";
  for (let i = 0; i < len; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
};

const created = [];
for (let i = 0; i < count; i += 1) {
  let code = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    code = generateCode(length);
    const exists = await prisma.promoCode.findUnique({ where: { code } });
    if (!exists) break;
    code = "";
  }
  if (!code) {
    // eslint-disable-next-line no-console
    console.log("Failed to generate unique code, try again.");
    process.exit(1);
  }
  await prisma.promoCode.create({
    data: {
      code,
      planId,
      planName,
      months,
      grantsFree: true,
    },
  });
  created.push(code);
}

// eslint-disable-next-line no-console
console.log(`Created ${created.length} promo code(s):`);
created.forEach((code) => {
  // eslint-disable-next-line no-console
  console.log(code);
});

await prisma.$disconnect();
