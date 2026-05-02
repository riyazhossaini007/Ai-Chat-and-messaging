import { Router } from "express";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { decryptText, encryptText, unwrapDek } from "../security/messageCrypto";

export const healthRouter = Router();

healthRouter.get("/health/encryption", async (req, res) => {
  try {
    const token = req.header("x-health-token");
    if (!token || token !== env.HEALTH_TOKEN) {
      return res.status(401).json({ ok: false });
    }

    const chat = await prisma.chat.findFirst({
      where: {
        dekWrapped: { not: null },
      },
      select: {
        id: true,
        dekWrapped: true,
        dekKekId: true,
        encVersion: true,
      },
      orderBy: {
        lastMessageAt: "desc",
      },
    });

    if (!chat?.dekWrapped) {
      return res.status(200).json({
        ok: true,
        mode: "phase1-at-rest",
        unwrap: "skipped_no_chat_key_yet",
        cryptoRoundtrip: "ok",
        ts: new Date().toISOString(),
      });
    }

    const dek = unwrapDek(chat.dekWrapped, chat.dekKekId);
    const probe = `health-probe:${chat.id}`;
    const encrypted = encryptText(probe, dek);
    const decrypted = decryptText(encrypted, dek);
    const ok = decrypted === probe;

    return res.status(ok ? 200 : 500).json({
      ok,
      mode: "phase1-at-rest",
      unwrap: ok ? "ok" : "failed",
      cryptoRoundtrip: ok ? "ok" : "failed",
      chatIdSampled: chat.id,
      kekIdUsed: chat.dekKekId ?? env.MESSAGE_KEK_ID,
      encVersion: chat.encVersion ?? 1,
      ts: new Date().toISOString(),
    });
  } catch {
    return res.status(500).json({
      ok: false,
      mode: "phase1-at-rest",
      unwrap: "failed",
      cryptoRoundtrip: "failed",
      error: "ENCRYPTION_HEALTHCHECK_FAILED",
      ts: new Date().toISOString(),
    });
  }
});
