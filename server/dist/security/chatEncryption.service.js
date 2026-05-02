"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChatDek = exports.getOrCreateChatDek = void 0;
const prisma_1 = require("../config/prisma");
const messageCrypto_1 = require("./messageCrypto");
const getOrCreateChatDek = async (chatId) => {
    const chat = await prisma_1.prisma.chat.findUnique({
        where: { id: chatId },
        select: {
            id: true,
            dekWrapped: true,
            dekKekId: true,
            encVersion: true,
        },
    });
    if (!chat) {
        throw new Error("Chat not found");
    }
    if (chat.dekWrapped) {
        return {
            dek: (0, messageCrypto_1.unwrapDek)(chat.dekWrapped, chat.dekKekId),
            encVersion: chat.encVersion,
        };
    }
    const dek = (0, messageCrypto_1.generateDek)();
    const wrapped = (0, messageCrypto_1.wrapDek)(dek);
    await prisma_1.prisma.chat.updateMany({
        where: { id: chatId, dekWrapped: null },
        data: {
            dekWrapped: wrapped.dekWrappedB64,
            dekKekId: wrapped.kekId,
            encVersion: 1,
        },
    });
    const refreshed = await prisma_1.prisma.chat.findUnique({
        where: { id: chatId },
        select: {
            dekWrapped: true,
            dekKekId: true,
            encVersion: true,
        },
    });
    if (!refreshed?.dekWrapped) {
        throw new Error("Failed to initialize chat encryption key");
    }
    return {
        dek: (0, messageCrypto_1.unwrapDek)(refreshed.dekWrapped, refreshed.dekKekId),
        encVersion: refreshed.encVersion,
    };
};
exports.getOrCreateChatDek = getOrCreateChatDek;
const getChatDek = async (chatId) => {
    const chat = await prisma_1.prisma.chat.findUnique({
        where: { id: chatId },
        select: {
            dekWrapped: true,
            dekKekId: true,
            encVersion: true,
        },
    });
    if (!chat?.dekWrapped) {
        return null;
    }
    return {
        dek: (0, messageCrypto_1.unwrapDek)(chat.dekWrapped, chat.dekKekId),
        encVersion: chat.encVersion,
    };
};
exports.getChatDek = getChatDek;
