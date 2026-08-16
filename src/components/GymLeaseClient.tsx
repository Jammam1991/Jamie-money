"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, MapPin, Phone, Mail } from "lucide-react";
import { Card, PageTitle, Tint } from "@/components/ui";
import {
  currentLeaseYear,
  daysUntilLeaseEnd,
  type CurrentLease,
  type LeaseOpportunity,
} from "@/lib/gymLease";

const DEAL_TYPE_LABELS: Record<LeaseOpportunity["deal_type"], string> = {
  lease: "Lease",
  sublease: "Sublease",
  purchase: "Buy",
};

const STATUS_LABELS: Record<LeaseOpportunity["status"], string> = {
  new: "New",
  shortlist: "Shortlist",
  touring: "Touring",
  negotiating: "Negotiating",
  signed: "Signed",
  passed: "Passed",
};

function money(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

export default function GymLeaseClient({
  lease,
  opportunities,
  problem,
}: {
  lease: CurrentLease;
  opportunities: LeaseOpportunity[];
  problem: string | null;
}) {
  // The current lease has its own row in the gym dashboard's lease board, but
  // it's shown above as the static Current Lease Summary — listing it again
  // here would double it up as if it were a candidate to move into.
  const candidates = opportunities.filter((o) => !o.is_current);
  const ourOptions = candidates.filter(
    (o) => o.status === "shortlist" || o.status === "negotiating",
  );
  const marketComps = candidates.filter(
    (o) => o.status === "new" || o.status === "touring",
  );

  return (
    <div className="space-y-4">
      <PageTitle>Gym Lease</PageTitle>

      <CurrentLeaseCard lease={lease} />

      <div>
        <p className="mb-2 text-[13px] font-medium text-muted">Our Options</p>
        <div className="space-y-3">
          <RenewOption lease={lease} />
          {ourOptions.map((o) => (
            <OpportunityCard key={o.id} o={o} showFit={false} />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[13px] font-medium text-muted">Market Comps</p>
        {marketComps.length === 0 ? (
          <Card>
            <p className="text-[13px] text-muted">
              {problem ? problem : "Nothing new on the market right now."}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {marketComps.map((o) => (
              <OpportunityCard key={o.id} o={o} showFit />
            ))}
          </div>
        )}
      </div>

      {problem && marketComps.length > 0 && (
        <p className="text-[12px] text-muted">{problem}</p>
      )}

      <Link
        href="/"
        className="flex items-center justify-center gap-1 py-2 text-[14px] text-muted"
      >
        <ChevronLeft size={16} />
        Back to My Cash
      </Link>
    </div>
  );
}

function CurrentLeaseCard({ lease }: { lease: CurrentLease }) {
  const [open, setOpen] = useState(false);
  const year = currentLeaseYear();
  const currentRent = lease.rentSchedule.find((r) => r.year === year)?.monthly ?? null;
  const daysLeft = daysUntilLeaseEnd();

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div>
          <p className="text-[15px] font-medium">Current Lease</p>
          <p className="mt-1 text-[13px] text-muted">
            {lease.address}, {lease.city}
          </p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-xl font-semibold">{money(currentRent)}/mo rent</span>
            <span className="text-[13px] text-muted">+ {money(lease.camMonthly)}/mo CAM</span>
          </div>
          <p className="mt-1 text-[12px] text-muted">
            {lease.endDate}
            {daysLeft >= 0 ? ` · ${daysLeft.toLocaleString("en-US")} days left` : " · expired"}
          </p>
        </div>
        <ChevronDown
          size={18}
          className={`mt-1 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          <Facts
            rows={[
              ["Landlord", lease.landlord],
              ["Tenant", lease.tenant],
              ["Term", `${lease.startDate} → ${lease.endDate}`],
              ["Permitted use", lease.permittedUse],
              ["Required hours", lease.requiredHours],
              ["Security deposit", money(lease.securityDeposit)],
              ["Payment method", lease.paymentMethod],
              ["Bounced ACH fee", money(lease.bouncedAchFee)],
              ["Holdover rent", lease.holdoverRent],
              ["Required insurance", lease.requiredInsurance],
            ]}
          />

          <div>
            <p className="text-[12px] font-medium text-muted">Rent schedule</p>
            <div className="mt-1.5 space-y-1">
              {lease.rentSchedule.map((r) => (
                <div
                  key={r.year}
                  className="flex items-baseline justify-between text-[13px]"
                >
                  <span className={r.year === year ? "font-medium" : "text-muted"}>
                    {r.label}
                    {r.year === year && " (current)"}
                  </span>
                  <span className={r.year === year ? "font-medium" : ""}>
                    {money(r.monthly)}/mo
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[12px] font-medium text-muted">CAM (operating costs)</p>
            <div className="mt-1.5 flex items-baseline justify-between text-[13px]">
              <span>Current estimate</span>
              <span className="font-medium">{money(lease.camMonthly)}/mo</span>
            </div>
            <p className="mt-1.5 text-[12px] text-muted">{lease.camDescription}</p>
          </div>

          <div>
            <p className="text-[12px] font-medium text-muted">Late fee rules</p>
            <p className="mt-1 text-[13px]">{lease.lateFee}</p>
          </div>

          <div>
            <p className="text-[12px] font-medium text-muted">Counts as default</p>
            <ul className="mt-1 space-y-0.5 text-[13px]">
              {lease.defaultTriggers.map((t) => (
                <li key={t}>· {t}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}

function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="space-y-1.5">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-3 text-[13px]">
          <dt className="shrink-0 text-muted">{label}</dt>
          <dd className="text-right">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function RenewOption({ lease }: { lease: CurrentLease }) {
  const year = currentLeaseYear();
  const currentRent = lease.rentSchedule.find((r) => r.year === year)?.monthly ?? null;
  const total = currentRent != null ? currentRent + lease.camMonthly : null;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[14px] font-medium">Renew here</p>
          <p className="text-[12px] text-muted">
            {lease.address}, {lease.city}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-tint px-2 py-0.5 text-[11px] font-medium text-muted">
          No offer on file
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-xl font-semibold">{money(total)}/mo</span>
        <span className="text-[12px] text-muted">
          {money(currentRent)} rent + {money(lease.camMonthly)} CAM
        </span>
      </div>
      <Tint className="mt-3">
        <p className="text-[12px] text-muted">Pros</p>
        <p className="mt-0.5 text-[13px]">
          Already built out, no move cost, staff and clients already know it.
        </p>
      </Tint>
      <Tint className="mt-2">
        <p className="text-[12px] text-muted">Cons</p>
        <p className="mt-0.5 text-[13px]">
          Rent has climbed every year of this lease. No renewal terms from the landlord yet —
          the next number could be higher still.
        </p>
      </Tint>
    </Card>
  );
}

function OpportunityCard({ o, showFit }: { o: LeaseOpportunity; showFit: boolean }) {
  const price =
    o.deal_type === "purchase" ? o.purchase_price : o.base_rent_monthly;
  const priceLabel = o.deal_type === "purchase" ? "asking" : "asking/mo";

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium">{o.name}</p>
          {o.address && (
            <p className="mt-0.5 flex items-center gap-1 text-[12px] text-muted">
              <MapPin size={12} className="shrink-0" />
              <span className="truncate">
                {o.address}
                {o.city ? `, ${o.city}` : ""}
              </span>
            </p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-tint px-2 py-0.5 text-[11px] font-medium text-muted">
          {STATUS_LABELS[o.status]}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-xl font-semibold">
          {money(price)} {priceLabel}
        </span>
        {o.economics.effectiveMonthly != null && (
          <span className="text-[12px] text-muted">
            {money(o.economics.effectiveMonthly)}/mo true cost
          </span>
        )}
        {o.size_sqft != null && (
          <span className="text-[12px] text-muted">
            {o.size_sqft.toLocaleString("en-US")} sq ft
          </span>
        )}
        <span className="text-[12px] text-muted">{DEAL_TYPE_LABELS[o.deal_type]}</span>
      </div>

      {showFit && o.fit.pct != null && (
        <p className="mt-1.5 text-[12px] text-muted">
          Fits {o.fit.met} of {o.fit.known} checks ({Math.round(o.fit.pct)}%)
        </p>
      )}

      {(o.pros || o.cons) && (
        <div className="mt-3 space-y-2">
          {o.pros && (
            <Tint>
              <p className="text-[12px] text-muted">Pros</p>
              <p className="mt-0.5 text-[13px]">{o.pros}</p>
            </Tint>
          )}
          {o.cons && (
            <Tint>
              <p className="text-[12px] text-muted">Cons</p>
              <p className="mt-0.5 text-[13px]">{o.cons}</p>
            </Tint>
          )}
        </div>
      )}

      {(o.broker_name || o.broker_company || o.broker_phone || o.broker_email) && (
        <div className="mt-3 border-t border-border pt-2 text-[12px] text-muted">
          {(o.broker_name || o.broker_company) && (
            <p>
              {o.broker_name}
              {o.broker_name && o.broker_company ? " · " : ""}
              {o.broker_company}
            </p>
          )}
          <div className="mt-1 flex flex-wrap gap-3">
            {o.broker_phone && (
              <span className="flex items-center gap-1">
                <Phone size={11} /> {o.broker_phone}
              </span>
            )}
            {o.broker_email && (
              <span className="flex items-center gap-1">
                <Mail size={11} /> {o.broker_email}
              </span>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
