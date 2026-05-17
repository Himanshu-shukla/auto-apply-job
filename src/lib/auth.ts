import { prisma } from "@/lib/prisma";

export async function getDemoUser() {
  return prisma.user.upsert({
    where: { email: "demo@jobcopilot.local" },
    update: {},
    create: {
      email: "demo@jobcopilot.local",
      name: "Demo User",
      passwordHash: "clerk-placeholder"
    }
  });
}
