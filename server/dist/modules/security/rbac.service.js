"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rbacService = void 0;
const prisma_1 = require("../../config/prisma");
const CORE_PERMISSIONS = [
    "ai.config.read",
    "ai.config.write",
    "ai.provider.disable",
    "billing.refund.create",
    "billing.ledger.read",
    "users.ban",
    "security.audit.read",
    "jobs.dlq.read",
    "jobs.dlq.retry",
    "ops.metrics.read",
    "ops.metrics.write",
    "ops.alerts.read",
    "ops.alerts.write",
    "security.role.manage",
];
const ROLE_PERMISSION_MAP = {
    USER: [],
    MODERATOR: ["security.audit.read"],
    ADMIN: [
        "ai.config.read",
        "ai.config.write",
        "ai.provider.disable",
        "billing.refund.create",
        "billing.ledger.read",
        "jobs.dlq.read",
        "jobs.dlq.retry",
        "ops.metrics.read",
        "ops.metrics.write",
        "ops.alerts.read",
        "ops.alerts.write",
    ],
    SUPERADMIN: [...CORE_PERMISSIONS],
};
const ensureRbacBootstrap = async () => {
    for (const roleName of ["USER", "MODERATOR", "ADMIN", "SUPERADMIN"]) {
        await prisma_1.prisma.role.upsert({
            where: { name: roleName },
            create: { name: roleName },
            update: {},
        });
    }
    for (const key of CORE_PERMISSIONS) {
        await prisma_1.prisma.permission.upsert({
            where: { key },
            create: { key },
            update: {},
        });
    }
    for (const [roleName, permissions] of Object.entries(ROLE_PERMISSION_MAP)) {
        const role = await prisma_1.prisma.role.findUnique({ where: { name: roleName } });
        for (const key of permissions) {
            const permission = await prisma_1.prisma.permission.findUnique({ where: { key } });
            if (!role || !permission)
                continue;
            await prisma_1.prisma.rolePermission.upsert({
                where: {
                    roleId_permissionId: {
                        roleId: role.id,
                        permissionId: permission.id,
                    },
                },
                create: {
                    roleId: role.id,
                    permissionId: permission.id,
                },
                update: {},
            });
        }
    }
    const superAdminRole = await prisma_1.prisma.role.findUnique({
        where: { name: "SUPERADMIN" },
    });
    if (superAdminRole) {
        const existing = await prisma_1.prisma.userRole.findFirst({
            where: { roleId: superAdminRole.id },
            select: { id: true },
        });
        if (!existing) {
            const firstUser = await prisma_1.prisma.user.findFirst({
                orderBy: { createdAt: "asc" },
                select: { id: true },
            });
            if (firstUser) {
                await prisma_1.prisma.userRole.upsert({
                    where: {
                        userId_roleId: {
                            userId: firstUser.id,
                            roleId: superAdminRole.id,
                        },
                    },
                    create: {
                        userId: firstUser.id,
                        roleId: superAdminRole.id,
                    },
                    update: {},
                });
            }
        }
    }
};
const getUserPermissions = async (userId) => {
    const rows = await prisma_1.prisma.userRole.findMany({
        where: { userId },
        include: {
            role: {
                include: {
                    permissions: {
                        include: {
                            permission: true,
                        },
                    },
                },
            },
        },
    });
    const keys = new Set();
    for (const row of rows) {
        for (const rp of row.role.permissions) {
            keys.add(rp.permission.key);
        }
    }
    return keys;
};
const userHasPermission = async (userId, permissionKey) => {
    const keys = await getUserPermissions(userId);
    return keys.has(permissionKey);
};
const getUserRoles = async (userId) => {
    const rows = await prisma_1.prisma.userRole.findMany({
        where: { userId },
        include: { role: true },
    });
    return rows.map((row) => row.role.name);
};
const userHasRole = async (userId, roleName) => {
    const roles = await getUserRoles(userId);
    return roles.includes(roleName);
};
const listUsersWithRoles = async (input) => {
    const limit = Math.max(1, Math.min(200, input?.limit ?? 100));
    const query = input?.query?.trim();
    const users = await prisma_1.prisma.user.findMany({
        where: query
            ? {
                OR: [
                    { username: { contains: query, mode: "insensitive" } },
                    { phone: { contains: query, mode: "insensitive" } },
                    { name: { contains: query, mode: "insensitive" } },
                ],
            }
            : undefined,
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
            id: true,
            username: true,
            name: true,
            phone: true,
            createdAt: true,
            userRoles: {
                include: {
                    role: true,
                },
            },
        },
    });
    return users.map((user) => ({
        id: user.id,
        username: user.username,
        name: user.name,
        phone: user.phone,
        createdAt: user.createdAt,
        roles: user.userRoles.map((row) => row.role.name),
    }));
};
const assignRole = async (input) => {
    const role = await prisma_1.prisma.role.findUnique({
        where: { name: input.role },
    });
    if (!role)
        throw new Error(`Role not found: ${input.role}`);
    return prisma_1.prisma.userRole.upsert({
        where: {
            userId_roleId: {
                userId: input.userId,
                roleId: role.id,
            },
        },
        create: {
            userId: input.userId,
            roleId: role.id,
        },
        update: {},
    });
};
const revokeRole = async (input) => {
    const role = await prisma_1.prisma.role.findUnique({
        where: { name: input.role },
    });
    if (!role)
        return { removed: false };
    await prisma_1.prisma.userRole.deleteMany({
        where: {
            userId: input.userId,
            roleId: role.id,
        },
    });
    return { removed: true };
};
exports.rbacService = {
    ensureRbacBootstrap,
    getUserPermissions,
    userHasPermission,
    getUserRoles,
    userHasRole,
    listUsersWithRoles,
    assignRole,
    revokeRole,
};
