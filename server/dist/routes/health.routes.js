"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../config/prisma");
const env_1 = require("../config/env");
const messageCrypto_1 = require("../security/messageCrypto");
exports.healthRouter = (0, express_1.Router)();
exports.healthRouter.get("/health/encryption", async (req, res) => {
    try {
        const token = req.header("x-health-token");
        if (!token || token !== env_1.env.HEALTH_TOKEN) {
            return res.status(401).json({ ok: false });
        }
        const chat = await prisma_1.prisma.chat.findFirst({
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
        const dek = (0, messageCrypto_1.unwrapDek)(chat.dekWrapped, chat.dekKekId);
        const probe = `health-probe:${chat.id}`;
        const encrypted = (0, messageCrypto_1.encryptText)(probe, dek);
        const decrypted = (0, messageCrypto_1.decryptText)(encrypted, dek);
        const ok = decrypted === probe;
        return res.status(ok ? 200 : 500).json({
            ok,
            mode: "phase1-at-rest",
            unwrap: ok ? "ok" : "failed",
            cryptoRoundtrip: ok ? "ok" : "failed",
            chatIdSampled: chat.id,
            kekIdUsed: chat.dekKekId ?? env_1.env.MESSAGE_KEK_ID,
            encVersion: chat.encVersion ?? 1,
            ts: new Date().toISOString(),
        });
    }
    catch {
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
