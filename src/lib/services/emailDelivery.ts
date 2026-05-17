export type EmailDeliveryInput = {
  to: string;
  cc?: string[];
  subject: string;
  body: string;
  replyTo?: string | null;
};

export async function deliverEmail(input: EmailDeliveryInput): Promise<{ provider: string; messageId: string; loggedOnly: boolean }> {
  const provider = (process.env.EMAIL_PROVIDER ?? "log").toLowerCase();
  if (provider === "resend") return sendWithResend(input);
  if (provider === "sendgrid") return sendWithSendGrid(input);
  return {
    provider: "log",
    messageId: `log_${Date.now()}`,
    loggedOnly: true
  };
}

async function sendWithResend(input: EmailDeliveryInput) {
  const apiKey = requireEnv("RESEND_API_KEY");
  const from = requireEnv("EMAIL_FROM");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [input.to],
      cc: input.cc?.length ? input.cc : undefined,
      subject: input.subject,
      text: input.body,
      reply_to: input.replyTo || undefined
    })
  });
  if (!response.ok) throw new Error(`Resend delivery failed: ${await response.text()}`);
  const data = await response.json();
  return { provider: "resend", messageId: data.id ?? `resend_${Date.now()}`, loggedOnly: false };
}

async function sendWithSendGrid(input: EmailDeliveryInput) {
  const apiKey = requireEnv("SENDGRID_API_KEY");
  const from = requireEnv("EMAIL_FROM");
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: input.to }], cc: input.cc?.map((email) => ({ email })) }],
      from: { email: from },
      reply_to: input.replyTo ? { email: input.replyTo } : undefined,
      subject: input.subject,
      content: [{ type: "text/plain", value: input.body }]
    })
  });
  if (!response.ok) throw new Error(`SendGrid delivery failed: ${await response.text()}`);
  return { provider: "sendgrid", messageId: response.headers.get("x-message-id") ?? `sendgrid_${Date.now()}`, loggedOnly: false };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the configured email provider.`);
  return value;
}
