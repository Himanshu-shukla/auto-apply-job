"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  useEffect(() => {
    fetch("/api/audit-logs").then(async (response) => setLogs((await response.json()).logs ?? []));
  }, []);
  return (
    <>
      <PageHeader title="Audit Logs" subtitle="Debug trail for imports, generated content, approvals, sends, follow-ups, and blocked automation." />
      <div className="space-y-3">
        {logs.length ? logs.map((log) => (
          <article key={log.id} className="panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-ink">{log.action.replaceAll("_", " ")}</h2>
                <p className="text-sm text-slate-600">{log.entityType} {log.entityId ? `· ${log.entityId}` : ""}</p>
              </div>
              <span className="text-xs text-slate-500">{log.createdAt.slice(0, 19).replace("T", " ")}</span>
            </div>
            <pre className="mt-3 overflow-auto rounded-md bg-slate-50 p-3 text-xs text-slate-600">{JSON.stringify(log.metadata, null, 2)}</pre>
          </article>
        )) : <div className="panel p-8 text-center text-sm text-slate-600">No audit logs yet.</div>}
      </div>
    </>
  );
}
