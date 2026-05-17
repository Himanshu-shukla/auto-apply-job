export async function generateAIResponse<T = unknown>(
  systemPrompt: string,
  userPrompt: string,
  schema?: Record<string, unknown>
): Promise<T | string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: schema
            ? `${userPrompt}\n\nReturn valid JSON matching this shape:\n${JSON.stringify(schema, null, 2)}`
            : userPrompt
        }
      ],
      temperature: 0.4,
      response_format: schema ? { type: "json_object" } : undefined
    })
  });

  if (!response.ok) {
    console.warn("AI request failed", response.status, await response.text());
    return null;
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  if (!schema) return content;

  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}
