"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaService = void 0;
const prisma_1 = require("../../config/prisma");
const chatEncryption_service_1 = require("../../security/chatEncryption.service");
const messageCrypto_1 = require("../../security/messageCrypto");
const chat_service_1 = require("../chat/chat.service");
const getChatMedia = async (userId, chatId, filter) => {
    await chat_service_1.chatService.assertParticipant(userId, chatId);
    const toSafeMediaMessages = async (messages) => {
        const dekEntries = await Promise.all(Array.from(new Set(messages.map((message) => message.chatId))).map(async (id) => {
            const value = await (0, chatEncryption_service_1.getChatDek)(id);
            return [id, value?.dek ?? null];
        }));
        const dekByChatId = new Map(dekEntries);
        return messages.map((message) => {
            const { cipherText: _cipherText, iv: _iv, authTag: _authTag, algo: _algo, encVersion: _encVersion, ...safeMessage } = message;
            if (message.deletedForEveryone) {
                return {
                    ...safeMessage,
                    content: null,
                    decryptError: false,
                };
            }
            const dek = dekByChatId.get(message.chatId);
            if (!dek) {
                return {
                    ...safeMessage,
                    content: message.content ?? message.text ?? null,
                    decryptError: false,
                };
            }
            if (message.cipherText && message.iv && message.authTag) {
                try {
                    return {
                        ...safeMessage,
                        content: (0, messageCrypto_1.decryptText)({
                            cipherTextB64: message.cipherText,
                            ivB64: message.iv,
                            authTagB64: message.authTag,
                            algo: "A256GCM",
                        }, dek),
                        decryptError: false,
                    };
                }
                catch {
                    return {
                        ...safeMessage,
                        content: null,
                        decryptError: true,
                    };
                }
            }
            return {
                ...safeMessage,
                content: message.content ?? message.text ?? null,
                decryptError: false,
            };
        });
    };
    if (filter === "ALL_MEDIA") {
        const participantChats = await prisma_1.prisma.chatParticipant.findMany({
            where: { userId },
            select: { chatId: true },
        });
        const chatIds = participantChats.map((item) => item.chatId);
        if (chatIds.length === 0) {
            return [];
        }
        const messages = await prisma_1.prisma.message.findMany({
            where: {
                chatId: { in: chatIds },
                mediaUrl: { not: null },
                deletedForEveryone: false,
                hiddenBy: {
                    none: { userId },
                },
            },
            orderBy: { createdAt: "desc" },
            include: {
                sender: {
                    select: {
                        id: true,
                        username: true,
                        name: true,
                        avatar: true,
                    },
                },
            },
        });
        return toSafeMediaMessages(messages);
    }
    const messages = await prisma_1.prisma.message.findMany({
        where: {
            chatId,
            mediaUrl: { not: null },
            deletedForEveryone: false,
            hiddenBy: {
                none: { userId },
            },
        },
        orderBy: { createdAt: "desc" },
        include: {
            sender: {
                select: {
                    id: true,
                    username: true,
                    name: true,
                    avatar: true,
                },
            },
        },
    });
    return toSafeMediaMessages(messages);
};
exports.mediaService = {
    getChatMedia,
};
