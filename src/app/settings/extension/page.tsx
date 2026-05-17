"use client";

import { useState } from "react";
import { Copy, KeyRound, PlugZap, ShieldCheck, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export default function ExtensionSettingsPage() {
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function createToken() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/extension/token/create", { method: "POST" });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setMessage(data.error ?? "Could not create token.");
      return;
    }
    setToken(data.token);
    setMessage("Token generated. Copy it now; it will not be shown again.");
  }

  async function revokeTokens() {
    setBusy(true);
    const response = await fetch("/api/extension/token/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    const data = await response.json();
    setBusy(false);
    setToken("");
    setMessage(response.ok ? `Revoked ${data.revoked ?? 0} active token(s).` : data.error ?? "Could not revoke tokens.");
  }

  return (
    <>
      <PageHeader title="Extension Setup" subtitle="Connect the local Chrome extension to your web app profile with a revocable API token." />

      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <section className="panel p-5">
          <div className="mb-4 flex items-center gap-2">
            <KeyRound size={18} className="text-teal-700" />
            <h2 className="text-base font-semibold text-ink">API Token</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={createToken} disabled={busy}>
              <PlugZap size={16} />
              Generate Token
            </button>
            <button className="btn-secondary" onClick={revokeTokens} disabled={busy}>
              <Trash2 size={16} />
              Revoke Active Tokens
            </button>
          </div>
          {message ? <p className="mt-4 rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-900">{message}</p> : null}
          {token ? (
            <div className="mt-4">
              <label className="label" htmlFor="extension-token">
                Extension token
              </label>
              <div className="mt-2 flex gap-2">
                <input id="extension-token" className="field font-mono text-xs" value={token} readOnly />
                <button className="btn-secondary shrink-0" onClick={() => navigator.clipboard.writeText(token)}>
                  <Copy size={16} />
                  Copy
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="panel p-5">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck size={18} className="text-teal-700" />
            <h2 className="text-base font-semibold text-ink">Local Chrome Setup</h2>
          </div>
          <ol className="space-y-3 text-sm leading-6 text-slate-700">
            <li>1. Open Chrome extensions and enable Developer mode.</li>
            <li>2. Click Load unpacked and select the repository's extension folder.</li>
            <li>3. Open the Job Copilot extension popup, paste the API token, and connect.</li>
            <li>4. Use Autofill only after previewing selected fields. Submit applications manually.</li>
          </ol>
        </section>
      </div>
    </>
  );
}
