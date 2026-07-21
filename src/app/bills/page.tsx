"use client";

import { useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { Card, PageTitle } from "@/components/ui";
import { money } from "@/lib/data";
import { useEffect } from "react";
import type { Bill } from "@/lib/data";

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBills() {
      const response = await fetch("/api/bills");
      const data = await response.json();
      setBills(data);
      setLoading(false);
    }
    loadBills();
  }, []);

  if (loading) {
    return (
      <div>
        <PageTitle>Bills</PageTitle>
        <p className="text-[13px] text-muted">Loading...</p>
      </div>
    );
  }

  const totalMonthly = bills
    .filter((b) => b.frequency === "monthly")
    .reduce((sum, b) => sum + b.amount, 0);

  return (
    <div>
      <PageTitle>Bills</PageTitle>

      <div className="mb-4 rounded-2xl bg-tint p-4">
        <p className="text-[13px] text-muted">Monthly total</p>
        <p className="text-2xl font-medium">{money(totalMonthly)}</p>
      </div>

      <div className="space-y-2">
        {bills.map((bill) => (
          <Card key={bill.id} className="p-0 overflow-hidden">
            <button
              onClick={() => setExpandedId(expandedId === bill.id ? null : bill.id)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-tint transition-colors"
            >
              <div>
                <p className="font-medium">{bill.name}</p>
                <p className="text-[13px] text-muted">{bill.frequency}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-medium">{money(bill.amount)}</span>
                <ChevronDown
                  size={18}
                  className="text-muted transition-transform"
                  style={{
                    transform: expandedId === bill.id ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                />
              </div>
            </button>

            {expandedId === bill.id && (
              <div className="border-t border-border bg-tint p-4 space-y-3">
                {bill.dueDate && (
                  <div className="flex justify-between text-[13px]">
                    <span className="text-muted">Due date</span>
                    <span>{bill.dueDate}</span>
                  </div>
                )}
                <button className="w-full py-2 px-3 rounded-lg bg-card border border-border text-[13px] font-medium hover:bg-tint transition-colors">
                  Edit
                </button>
                <button className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-card border border-border text-[13px] font-medium hover:bg-red-50 transition-colors text-red-600">
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
