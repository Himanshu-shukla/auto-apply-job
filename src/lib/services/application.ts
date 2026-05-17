import type { Application, ApplicationStatus } from "@/generated/prisma/client";

export type ApplicationHistoryEntry = {
  from: ApplicationStatus;
  to: ApplicationStatus;
  note: string;
  at: string;
};

export function nextApplicationHistory(
  application: Pick<Application, "history" | "status">,
  nextStatus: ApplicationStatus,
  note?: string
): ApplicationHistoryEntry[] {
  const previous = Array.isArray(application.history) ? (application.history as ApplicationHistoryEntry[]) : [];
  return [
    ...previous,
    {
      from: application.status,
      to: nextStatus,
      note: note || "",
      at: new Date().toISOString()
    }
  ];
}
