import { prisma } from "@/lib/prisma";

export async function createNotification(input: {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
}) {
  return (prisma as any).notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link ?? null
    }
  });
}

export async function listNotifications(userId: string) {
  return (prisma as any).notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100
  });
}

export async function markNotificationRead(userId: string, id: string) {
  return (prisma as any).notification.updateMany({
    where: { id, userId },
    data: { readAt: new Date() }
  });
}
