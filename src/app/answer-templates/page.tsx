"use client";

import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

const types = [
  ["notice_period", "Notice period"],
  ["salary_expectation", "Salary expectation"],
  ["relocation", "Relocation"],
  ["work_authorization", "Work authorization"],
  ["introduction", "Introduction"],
  ["why_hire_me", "Why hire me"],
  ["why_interested", "Why interested"],
  ["experience", "Experience"],
  ["custom", "Custom"]
];

export default function AnswerTemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [draft, setDraft] = useState({ label: "", questionType: "notice_period", answer: "" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    const response = await fetch("/api/answer-templates");
    const data = await response.json();
    setTemplates(data.templates ?? []);
  }

  async function createTemplate() {
    setMessage("");
    const response = await fetch("/api/answer-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft)
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Could not save template.");
      return;
    }
    setDraft({ label: "", questionType: "notice_period", answer: "" });
    await loadTemplates();
  }

  async function updateTemplate(template: any) {
    await fetch(`/api/answer-templates/${template.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(template)
    });
    await loadTemplates();
  }

  async function deleteTemplate(id: string) {
    await fetch(`/api/answer-templates/${id}`, { method: "DELETE" });
    await loadTemplates();
  }

  return (
    <>
      <PageHeader title="Answer Templates" subtitle="Save reusable responses for custom application questions and extension-assisted answers." />
      {message ? <p className="mb-4 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-800">{message}</p> : null}

      <section className="panel mb-6 p-5">
        <h2 className="mb-4 text-base font-semibold text-ink">New Template</h2>
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <input className="field" placeholder="Label" value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} />
          <select className="field" value={draft.questionType} onChange={(event) => setDraft({ ...draft, questionType: event.target.value })}>
            {types.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <textarea
          className="field mt-3 min-h-28"
          placeholder="Saved answer"
          value={draft.answer}
          onChange={(event) => setDraft({ ...draft, answer: event.target.value })}
        />
        <button className="btn-primary mt-3" onClick={createTemplate}>
          <Plus size={16} />
          Add Template
        </button>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {templates.map((template) => (
          <article key={template.id} className="panel p-5">
            <div className="grid gap-3 md:grid-cols-[1fr_190px]">
              <input
                className="field"
                value={template.label}
                onChange={(event) => setTemplates((current) => current.map((item) => (item.id === template.id ? { ...item, label: event.target.value } : item)))}
              />
              <select
                className="field"
                value={template.questionType}
                onChange={(event) => setTemplates((current) => current.map((item) => (item.id === template.id ? { ...item, questionType: event.target.value } : item)))}
              >
                {types.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              className="field mt-3 min-h-28"
              value={template.answer}
              onChange={(event) => setTemplates((current) => current.map((item) => (item.id === template.id ? { ...item, answer: event.target.value } : item)))}
            />
            <div className="mt-3 flex gap-2">
              <button className="btn-secondary" onClick={() => updateTemplate(template)}>
                <Save size={16} />
                Save
              </button>
              <button className="btn-secondary" onClick={() => deleteTemplate(template.id)}>
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
