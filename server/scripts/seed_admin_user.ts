import { prisma } from "../src/config/prisma";
import { hashPassword } from "../src/utils/hash";
import { rbacService } from "../src/modules/security/rbac.service";

const main = async () => {
  const username = process.env.ADMIN_SEED_USERNAME?.trim() || "admin";
  const phone = process.env.ADMIN_SEED_PHONE?.trim() || "+10000000000";
  const password = process.env.ADMIN_SEED_PASSWORD?.trim() || "Admin123!";
  const name = process.env.ADMIN_SEED_NAME?.trim() || "Admin";

  await rbacService.ensureRbacBootstrap();

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { phone },
    update: {
      username,
      name,
      passwordHash,
      role: "ADMIN" as any,
      status: "ACTIVE" as any,
    },
    create: {
      username,
      name,
      phone,
      passwordHash,
      isVerified: true,
      role: "ADMIN" as any,
      status: "ACTIVE" as any,
    },
    select: { id: true, username: true, phone: true },
  });

  await rbacService.assignRole({ userId: user.id, role: "ADMIN" });
  console.log(JSON.stringify({ ok: true, user, passwordHint: password }, null, 2));
};

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });

