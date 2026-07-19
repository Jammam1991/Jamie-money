import { Check, CalendarDays, Folder } from "lucide-react";
import { Card, PageTitle } from "@/components/ui";
import { divorce, money } from "@/lib/data";

export default function DivorcePage() {
  return (
    <div>
      <PageTitle>Divorce</PageTitle>

      <div className="space-y-3">
        <Card>
          <p className="text-[13px] text-muted">Support you pay</p>
          <p className="text-2xl font-medium">
            {money(divorce.support.amount)}
            <span className="text-[13px] font-normal text-muted">/mo</span>
          </p>
          {divorce.support.paidThisMonth ? (
            <p className="mt-1 flex items-center gap-1 text-[13px] text-good">
              <Check size={15} />
              Paid this month · next {divorce.support.nextDate}
            </p>
          ) : (
            <p className="mt-1 text-[13px] text-muted">Next: {divorce.support.nextDate}</p>
          )}
        </Card>

        <Card>
          <p className="text-[13px] text-muted">Lawyer costs so far</p>
          <p className="text-xl font-medium">{money(divorce.lawyerCostsSoFar)}</p>
        </Card>

        <Card>
          <p className="mb-1.5 text-[13px] text-muted">What&apos;s being split</p>
          {divorce.split.map((s) => (
            <div key={s.item} className="flex justify-between py-1 text-[15px]">
              <span>{s.item}</span>
              <span className="text-muted">{s.note}</span>
            </div>
          ))}
        </Card>

        <Card>
          <p className="mb-1.5 text-[13px] text-muted">Key dates</p>
          {divorce.keyDates.map((d) => (
            <div key={d.label} className="flex justify-between py-1 text-[15px]">
              <span className="flex items-center gap-2">
                <CalendarDays size={16} className="text-muted" />
                {d.label}
              </span>
              <span>{d.date}</span>
            </div>
          ))}
        </Card>

        <Card>
          <p className="flex items-center gap-2 text-[15px]" style={{ color: "var(--good)" }}>
            <Folder size={17} />
            Documents ({divorce.documentsCount})
          </p>
        </Card>
      </div>
    </div>
  );
}
