import { MediaKind } from "@prisma/client";
import { prisma } from "../../config/prisma";

type StorageUsageBreakdown = {
  imagesMb: number;
  videosMb: number;
  audioMb: number;
  documentsMb: number;
};

const toMb = (bytes: number) => Math.round((bytes / (1024 * 1024)) * 100) / 100;

const getStorageUsage = async (userId: string) => {
  const grouped = await prisma.messageMedia.groupBy({
    by: ["kind"],
    where: { uploaderId: userId },
    _sum: {
      sizeBytes: true,
    },
  });

  const bytesByKind = grouped.reduce<Record<MediaKind, number>>(
    (acc, item) => {
      acc[item.kind] = item._sum.sizeBytes ?? 0;
      return acc;
    },
    {
      IMAGE: 0,
      VIDEO: 0,
      AUDIO: 0,
      DOCUMENT: 0,
    }
  );

  const breakdown: StorageUsageBreakdown = {
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

export const storageService = {
  getStorageUsage,
};

