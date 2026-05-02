"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storageService = void 0;
const prisma_1 = require("../../config/prisma");
const toMb = (bytes) => Math.round((bytes / (1024 * 1024)) * 100) / 100;
const getStorageUsage = async (userId) => {
    const grouped = await prisma_1.prisma.messageMedia.groupBy({
        by: ["kind"],
        where: { uploaderId: userId },
        _sum: {
            sizeBytes: true,
        },
    });
    const bytesByKind = grouped.reduce((acc, item) => {
        acc[item.kind] = item._sum.sizeBytes ?? 0;
        return acc;
    }, {
        IMAGE: 0,
        VIDEO: 0,
        AUDIO: 0,
        DOCUMENT: 0,
    });
    const breakdown = {
        imagesMb: toMb(bytesByKind.IMAGE),
        videosMb: toMb(bytesByKind.VIDEO),
        audioMb: toMb(bytesByKind.AUDIO),
        documentsMb: toMb(bytesByKind.DOCUMENT),
    };
    return {
        totalMb: toMb(bytesByKind.IMAGE + bytesByKind.VIDEO + bytesByKind.AUDIO + bytesByKind.DOCUMENT),
        breakdown,
    };
};
exports.storageService = {
    getStorageUsage,
};
