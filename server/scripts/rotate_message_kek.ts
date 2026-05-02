import { prisma } from "../src/config/prisma";
import { env } from "../src/config/env";
import crypto from "crypto";
import { unwrapDek } from "../src/security/messageCrypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

const parseArgs = () => {
  const args = process.argv.slice(2);
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = args[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
};

const main = async () => {
  const args = parseArgs();
  const toKekId = String(args.toKekId ?? "").trim() || env.MESSAGE_KEK_ID;
  const dryRun = Boolean(args.dryRun);
  const batchSize = Math.max(1, Number(args.batchSize ?? 200));

  if (!env.MESSAGE_KEK_MAP[toKekId]) {
    throw new Error(`Target KEK '${toKekId}' was not found in MESSAGE_KEK_MAP`);
  }

  let rotated = 0;
  let scanned = 0;
  let cursorId: string | null = null;

  while (true) {
    const rows = await prisma.chat.findMany({
      where: {
        dekWrapped: { not: null },
      },
      select: {
        id: true,
        dekWrapped: true,
        dekKekId: true,
      },
      orderBy: {
        id: "asc",
      },
      take: batchSize,
      ...(cursorId
        ? {
            skip: 1,
            cursor: { id: cursorId },
          }
        : {}),
    });

    if (rows.length === 0) break;
    scanned += rows.length;

    for (const row of rows) {
      cursorId = row.id;
      if (!row.dekWrapped) continue;
      if ((row.dekKekId ?? env.MESSAGE_KEK_ID) === toKekId) continue;

      const dek = unwrapDek(row.dekWrapped, row.dekKekId);
      const toKek = Buffer.from(env.MESSAGE_KEK_MAP[toKekId], "base64");
      const iv = crypto.randomBytes(IV_BYTES);
      const cipher = crypto.createCipheriv(ALGO, toKek, iv);
      const ciphertext = Buffer.concat([cipher.update(dek), cipher.final()]);
      const authTag = cipher.getAuthTag();
      const rewrapped = Buffer.concat([iv, ciphertext, authTag]).toString("base64");

      if (!dryRun) {
        await prisma.chat.updateMany({
          where: {
            id: row.id,
            dekWrapped: row.dekWrapped,
            dekKekId: row.dekKekId,
          },
          data: {
            dekWrapped: rewrapped,
            dekKekId: toKekId,
          },
        });
      }
      rotated += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        toKekId,
        dryRun,
        scanned,
        rotated,
      },
      null,
      2
    )
  );
};

void main()
  .catch((error) => {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
