"use client";

import { useState } from "react";
import { Card } from "./ui";
import { Plus, Trash2 } from "lucide-react";
import type {
  JobVsBusiness,
  ProCon,
  JobPosting,
  DecisionEntry,
} from "@/lib/store";

export default function JobVsBusinessClient({
  initialComparison,
  initialProsCons,
  initialPostings,
  initialJournal,
}: {
  initialComparison: JobVsBusiness | null;
  initialProsCons: ProCon[];
  initialPostings: JobPosting[];
  initialJournal: DecisionEntry[];
}) {
  const [comparison, setComparison] = useState<Partial<JobVsBusiness>>(
    initialComparison || {}
  );
  const [prosCons, setProsCons] = useState<ProCon[]>(initialProsCons);
  const [postings, setPostings] = useState<JobPosting[]>(initialPostings);
  const [journal, setJournal] = useState<DecisionEntry[]>(initialJournal);
  const [showNewProCon, setShowNewProCon] = useState<string | null>(null);
  const [newProConText, setNewProConText] = useState("");
  const [showNewPosting, setShowNewPosting] = useState(false);
  const [newPostingForm, setNewPostingForm] = useState({
    company_name: "",
    role_title: "",
    salary: "",
    link: "",
    notes: "",
  });
  const [showNewJournal, setShowNewJournal] = useState(false);
  const [newJournalForm, setNewJournalForm] = useState({
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const handleComparisonChange = async (key: string, value: string | number) => {
    const updated = { ...comparison, [key]: value };
    setComparison(updated);

    // Save to DB
    const body: any = {
      [key]:
        key === "businessMonthlyIncome"
          ? "business_monthly_income"
          : key === "jobSalaryAnnual"
            ? "job_salary_annual"
            : key === "benefitsValue"
              ? "benefits_value"
              : key === "businessHoursPerWeek"
                ? "business_hours_per_week"
                : key === "jobHoursPerWeek"
                  ? "job_hours_per_week"
                  : key,
    };
    const fieldName = Object.keys(body)[0];
    await fetch("/api/job-vs-business", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [fieldName]: value }),
    });
  };

  const addProCon = async (type: ProCon["type"]) => {
    if (!newProConText.trim()) return;
    const res = await fetch("/api/pros-cons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, text: newProConText.trim(), sort: 0 }),
    });
    if (res.ok) {
      const data = await res.json();
      setProsCons([...prosCons, data]);
      setNewProConText("");
      setShowNewProCon(null);
    }
  };

  const deleteProCon = async (id: string) => {
    await fetch(`/api/pros-cons/${id}`, { method: "DELETE" });
    setProsCons(prosCons.filter((p) => p.id !== id));
  };

  const addPosting = async () => {
    if (!newPostingForm.company_name.trim() || !newPostingForm.role_title.trim())
      return;
    const res = await fetch("/api/job-postings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_name: newPostingForm.company_name,
        role_title: newPostingForm.role_title,
        salary: newPostingForm.salary || null,
        link: newPostingForm.link || null,
        status: "Interested",
        notes: newPostingForm.notes || null,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setPostings([data, ...postings]);
      setNewPostingForm({
        company_name: "",
        role_title: "",
        salary: "",
        link: "",
        notes: "",
      });
      setShowNewPosting(false);
    }
  };

  const updatePostingStatus = async (id: string, status: JobPosting["status"]) => {
    await fetch(`/api/job-postings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setPostings(
      postings.map((p) => (p.id === id ? { ...p, status } : p))
    );
  };

  const deletePosting = async (id: string) => {
    await fetch(`/api/job-postings/${id}`, { method: "DELETE" });
    setPostings(postings.filter((p) => p.id !== id));
  };

  const addJournalEntry = async () => {
    if (!newJournalForm.notes.trim()) return;
    const res = await fetch("/api/decision-journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entry_date: newJournalForm.date,
        notes: newJournalForm.notes,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setJournal([data, ...journal]);
      setNewJournalForm({
        date: new Date().toISOString().split("T")[0],
        notes: "",
      });
      setShowNewJournal(false);
    }
  };

  const deleteJournalEntry = async (id: string) => {
    await fetch(`/api/decision-journal/${id}`, { method: "DELETE" });
    setJournal(journal.filter((j) => j.id !== id));
  };

  const businessMonthly = comparison.businessMonthlyIncome || 0;
  const jobAnnual = comparison.jobSalaryAnnual || 0;
  const jobMonthly = jobAnnual / 12;
  const benefitsMonthly = (comparison.benefitsValue || 0) / 12;

  return (
    <div className="space-y-6 pb-8">
      {/* Side-by-side Comparison */}
      <Card>
        <h2 className="font-medium mb-4">Income & Hours Comparison</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted block mb-1">Business - Monthly Income</label>
            <input
              type="number"
              value={comparison.businessMonthlyIncome || 0}
              onChange={(e) =>
                handleComparisonChange("businessMonthlyIncome", Number(e.target.value))
              }
              className="w-full px-3 py-2 border border-border rounded-lg bg-card"
            />
          </div>
          <div>
            <label className="text-sm text-muted block mb-1">Job - Annual Salary</label>
            <input
              type="number"
              value={comparison.jobSalaryAnnual || 0}
              onChange={(e) =>
                handleComparisonChange("jobSalaryAnnual", Number(e.target.value))
              }
              className="w-full px-3 py-2 border border-border rounded-lg bg-card"
            />
          </div>
          <div>
            <label className="text-sm text-muted block mb-1">Job - Benefits Value (Annual)</label>
            <input
              type="number"
              value={comparison.benefitsValue || 0}
              onChange={(e) =>
                handleComparisonChange("benefitsValue", Number(e.target.value))
              }
              className="w-full px-3 py-2 border border-border rounded-lg bg-card"
            />
          </div>
          <div>
            <label className="text-sm text-muted block mb-1">Business - Hours/Week</label>
            <input
              type="number"
              step="0.5"
              value={comparison.businessHoursPerWeek || 0}
              onChange={(e) =>
                handleComparisonChange("businessHoursPerWeek", Number(e.target.value))
              }
              className="w-full px-3 py-2 border border-border rounded-lg bg-card"
            />
          </div>
          <div>
            <label className="text-sm text-muted block mb-1">Job - Hours/Week</label>
            <input
              type="number"
              step="0.5"
              value={comparison.jobHoursPerWeek || 0}
              onChange={(e) =>
                handleComparisonChange("jobHoursPerWeek", Number(e.target.value))
              }
              className="w-full px-3 py-2 border border-border rounded-lg bg-card"
            />
          </div>
        </div>

        {/* Quick Comparison View */}
        <div className="mt-6 pt-6 border-t border-border grid grid-cols-2 gap-4">
          <div>
            <div className="text-[12px] text-muted mb-1">Business Monthly</div>
            <div className="font-medium">${businessMonthly.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[12px] text-muted mb-1">Job (Monthly + Benefits)</div>
            <div className="font-medium">
              ${(jobMonthly + benefitsMonthly).toLocaleString("en-US", {
                maximumFractionDigits: 0,
              })}
            </div>
          </div>
          {comparison.businessHoursPerWeek ? (
            <div>
              <div className="text-[12px] text-muted mb-1">Business $/Hour</div>
              <div className="font-medium">
                $
                {(
                  (businessMonthly * 12) /
                  (comparison.businessHoursPerWeek * 52)
                ).toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </div>
            </div>
          ) : null}
          {comparison.jobHoursPerWeek ? (
            <div>
              <div className="text-[12px] text-muted mb-1">Job $/Hour</div>
              <div className="font-medium">
                $
                {(
                  jobAnnual / (comparison.jobHoursPerWeek * 52)
                ).toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      {/* Pros & Cons */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Business Pros */}
          <Card>
            <h3 className="font-medium mb-3 text-sm">Business Pros</h3>
            <div className="space-y-2 mb-3">
              {prosCons
                .filter((p) => p.type === "business_pro")
                .map((p) => (
                  <div key={p.id} className="flex items-start justify-between gap-2 text-sm">
                    <span className="flex-1">{p.text}</span>
                    <button
                      onClick={() => deleteProCon(p.id)}
                      className="text-muted hover:text-text p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
            </div>
            {showNewProCon !== "business_pro" ? (
              <button
                onClick={() => setShowNewProCon("business_pro")}
                className="text-xs text-good flex items-center gap-1 hover:underline"
              >
                <Plus size={14} /> Add pro
              </button>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Enter a pro..."
                  value={newProConText}
                  onChange={(e) => setNewProConText(e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-border rounded bg-card"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => addProCon("business_pro")}
                    className="flex-1 px-2 py-1 text-xs rounded bg-good text-card"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowNewProCon(null);
                      setNewProConText("");
                    }}
                    className="flex-1 px-2 py-1 text-xs rounded border border-border"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </Card>

          {/* Business Cons */}
          <Card>
            <h3 className="font-medium mb-3 text-sm">Business Cons</h3>
            <div className="space-y-2 mb-3">
              {prosCons
                .filter((p) => p.type === "business_con")
                .map((p) => (
                  <div key={p.id} className="flex items-start justify-between gap-2 text-sm">
                    <span className="flex-1">{p.text}</span>
                    <button
                      onClick={() => deleteProCon(p.id)}
                      className="text-muted hover:text-text p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
            </div>
            {showNewProCon !== "business_con" ? (
              <button
                onClick={() => setShowNewProCon("business_con")}
                className="text-xs text-good flex items-center gap-1 hover:underline"
              >
                <Plus size={14} /> Add con
              </button>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Enter a con..."
                  value={newProConText}
                  onChange={(e) => setNewProConText(e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-border rounded bg-card"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => addProCon("business_con")}
                    className="flex-1 px-2 py-1 text-xs rounded bg-good text-card"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowNewProCon(null);
                      setNewProConText("");
                    }}
                    className="flex-1 px-2 py-1 text-xs rounded border border-border"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Job Pros */}
          <Card>
            <h3 className="font-medium mb-3 text-sm">Job Pros</h3>
            <div className="space-y-2 mb-3">
              {prosCons
                .filter((p) => p.type === "job_pro")
                .map((p) => (
                  <div key={p.id} className="flex items-start justify-between gap-2 text-sm">
                    <span className="flex-1">{p.text}</span>
                    <button
                      onClick={() => deleteProCon(p.id)}
                      className="text-muted hover:text-text p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
            </div>
            {showNewProCon !== "job_pro" ? (
              <button
                onClick={() => setShowNewProCon("job_pro")}
                className="text-xs text-good flex items-center gap-1 hover:underline"
              >
                <Plus size={14} /> Add pro
              </button>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Enter a pro..."
                  value={newProConText}
                  onChange={(e) => setNewProConText(e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-border rounded bg-card"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => addProCon("job_pro")}
                    className="flex-1 px-2 py-1 text-xs rounded bg-good text-card"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowNewProCon(null);
                      setNewProConText("");
                    }}
                    className="flex-1 px-2 py-1 text-xs rounded border border-border"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </Card>

          {/* Job Cons */}
          <Card>
            <h3 className="font-medium mb-3 text-sm">Job Cons</h3>
            <div className="space-y-2 mb-3">
              {prosCons
                .filter((p) => p.type === "job_con")
                .map((p) => (
                  <div key={p.id} className="flex items-start justify-between gap-2 text-sm">
                    <span className="flex-1">{p.text}</span>
                    <button
                      onClick={() => deleteProCon(p.id)}
                      className="text-muted hover:text-text p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
            </div>
            {showNewProCon !== "job_con" ? (
              <button
                onClick={() => setShowNewProCon("job_con")}
                className="text-xs text-good flex items-center gap-1 hover:underline"
              >
                <Plus size={14} /> Add con
              </button>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Enter a con..."
                  value={newProConText}
                  onChange={(e) => setNewProConText(e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-border rounded bg-card"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => addProCon("job_con")}
                    className="flex-1 px-2 py-1 text-xs rounded bg-good text-card"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowNewProCon(null);
                      setNewProConText("");
                    }}
                    className="flex-1 px-2 py-1 text-xs rounded border border-border"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Job Postings Tracker */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium">Job Postings Tracker</h2>
          <button
            onClick={() => setShowNewPosting(!showNewPosting)}
            className="text-xs text-good flex items-center gap-1"
          >
            <Plus size={14} /> Add
          </button>
        </div>

        {showNewPosting && (
          <div className="mb-4 p-3 border border-border rounded-lg space-y-2 bg-tint">
            <input
              type="text"
              placeholder="Company name"
              value={newPostingForm.company_name}
              onChange={(e) =>
                setNewPostingForm({ ...newPostingForm, company_name: e.target.value })
              }
              className="w-full px-2 py-1 text-sm border border-border rounded bg-card"
            />
            <input
              type="text"
              placeholder="Role / Title"
              value={newPostingForm.role_title}
              onChange={(e) =>
                setNewPostingForm({ ...newPostingForm, role_title: e.target.value })
              }
              className="w-full px-2 py-1 text-sm border border-border rounded bg-card"
            />
            <input
              type="text"
              placeholder="Salary (optional)"
              value={newPostingForm.salary}
              onChange={(e) =>
                setNewPostingForm({ ...newPostingForm, salary: e.target.value })
              }
              className="w-full px-2 py-1 text-sm border border-border rounded bg-card"
            />
            <input
              type="text"
              placeholder="Link (optional)"
              value={newPostingForm.link}
              onChange={(e) =>
                setNewPostingForm({ ...newPostingForm, link: e.target.value })
              }
              className="w-full px-2 py-1 text-sm border border-border rounded bg-card"
            />
            <textarea
              placeholder="Notes (optional)"
              value={newPostingForm.notes}
              onChange={(e) =>
                setNewPostingForm({ ...newPostingForm, notes: e.target.value })
              }
              className="w-full px-2 py-1 text-sm border border-border rounded bg-card"
              rows={2}
            />
            <div className="flex gap-2">
              <button
                onClick={addPosting}
                className="flex-1 px-2 py-1 text-xs rounded bg-good text-card"
              >
                Add Posting
              </button>
              <button
                onClick={() => setShowNewPosting(false)}
                className="flex-1 px-2 py-1 text-xs rounded border border-border"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {postings.map((posting) => (
            <div key={posting.id} className="p-3 border border-border rounded-lg">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1">
                  <div className="font-medium text-sm">{posting.companyName}</div>
                  <div className="text-xs text-muted">{posting.roleTitle}</div>
                  {posting.salary && (
                    <div className="text-xs text-muted">{posting.salary}</div>
                  )}
                </div>
                <button
                  onClick={() => deletePosting(posting.id)}
                  className="text-muted hover:text-text p-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex gap-2 flex-wrap mb-2">
                {["Interested", "Applied", "Interview", "Offer", "Rejected"].map(
                  (status) => (
                    <button
                      key={status}
                      onClick={() =>
                        updatePostingStatus(
                          posting.id,
                          status as JobPosting["status"]
                        )
                      }
                      className={`text-xs px-2 py-1 rounded transition-colors ${
                        posting.status === status
                          ? "bg-good text-card"
                          : "border border-border hover:bg-tint"
                      }`}
                    >
                      {status}
                    </button>
                  )
                )}
              </div>
              {posting.notes && (
                <div className="text-xs text-muted mb-2">Note: {posting.notes}</div>
              )}
              {posting.link && (
                <a
                  href={posting.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-good hover:underline"
                >
                  View posting →
                </a>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Decision Journal */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium">Decision Journal</h2>
          <button
            onClick={() => setShowNewJournal(!showNewJournal)}
            className="text-xs text-good flex items-center gap-1"
          >
            <Plus size={14} /> Add
          </button>
        </div>

        {showNewJournal && (
          <div className="mb-4 p-3 border border-border rounded-lg space-y-2 bg-tint">
            <input
              type="date"
              value={newJournalForm.date}
              onChange={(e) =>
                setNewJournalForm({ ...newJournalForm, date: e.target.value })
              }
              className="w-full px-2 py-1 text-sm border border-border rounded bg-card"
            />
            <textarea
              placeholder="What's on your mind?"
              value={newJournalForm.notes}
              onChange={(e) =>
                setNewJournalForm({ ...newJournalForm, notes: e.target.value })
              }
              className="w-full px-2 py-1 text-sm border border-border rounded bg-card"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                onClick={addJournalEntry}
                className="flex-1 px-2 py-1 text-xs rounded bg-good text-card"
              >
                Add Entry
              </button>
              <button
                onClick={() => setShowNewJournal(false)}
                className="flex-1 px-2 py-1 text-xs rounded border border-border"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {journal.map((entry) => (
            <div key={entry.id} className="p-3 border border-border rounded-lg">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="text-xs text-muted font-medium">
                  {new Date(entry.entryDate).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </div>
                <button
                  onClick={() => deleteJournalEntry(entry.id)}
                  className="text-muted hover:text-text p-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="text-sm whitespace-pre-wrap">{entry.notes}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
