import { prisma } from "../src/config/prisma";
import { getOrCreateChatDek } from "../src/security/chatEncryption.service";
import { encryptText } from "../src/security/messageCrypto";

type CliOptions = {
  batch: number;
  dryRun: boolean;
  nullifyPlaintext: boolean;
};

const parseBool = (value: string | undefined, defaultValue: boolean) => {
  if (value === undefined) return defaultValue;
  return value.trim().toLowerCase() === "true";
};

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const getArg = (name: string) =>
    args.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];

  const batch = Number(getArg("batch") ?? "1000");
  const dryRun = parseBool(getArg("dry-run"), true);
  const nullifyPlaintext = parseBool(getArg("nullify-plaintext"), false);

  if (!Number.isFinite(batch) || batch < 1) {
    throw new Error("--batch must be a positive integer");
  }

  return {
    batch: Math.floor(batch),
    dryRun,
    nullifyPlaintext,
  };
};

const run = async () => {
  const options = parseArgs();
  let cursorId: string | null = null;
  let scanned = 0;
  let eligible = 0;
  let migrated = 0;

  console.log(
    `[migrate_plaintext_messages] start batch=${options.batch} dryRun=${options.dryRun} nullifyPlaintext=${options.nullifyPlaintext}`
  );

  while (true) {
    const rows = await prisma.message.findMany({
      where: {
        cipherText: null,
        deletedForEveryone: false,
        OR: [{ content: { not: null } }, { text: { not: null } }],
      },
      orderBy: { id: "asc" },
      take: options.batch,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      select: {
        id: true,
        chatId: true,
        content: true,
        text: true,
      },
    });

    if (rows.length === 0) break;
    scanned += rows.length;

    for (const row of rows) {
      const plainText = row.content ?? row.text;
      if (!plainText) continue;
      eligible += 1;

      const { dek, encVersion } = await getOrCreateChatDek(row.chatId);
      const encrypted = encryptText(plainText, dek);

      if (!options.dryRun) {
        await prisma.message.update({
          where: { id: row.id },
          data: {
            cipherText: encrypted.cipherTextB64,
            iv: encrypted.ivB64,
            authTag: encrypted.authTagB64,
            algo: encrypted.algo,
            encVersion,
            ...(options.nullifyPlaintext ? { content: null, text: null } : {}),
          },
        });
      }

      migrated += 1;
    }

    cursorId = rows[rows.length - 1]?.id ?? null;
    console.log(
      `[migrate_plaintext_messages] scanned=${scanned} eligible=${eligible} migrated=${migrated}`
    );
  }

  console.log(
    `[migrate_plaintext_messages] done scanned=${scanned} eligible=${eligible} migrated=${migrated} dryRun=${options.dryRun}`
  );
};

run()
  .catch((error) => {
    console.error("[migrate_plaintext_messages] failed", {
      message: error instanceof Error ? error.message : "unknown error",
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
