"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Bath,
  BedDouble,
  ChevronDown,
  ExternalLink,
  Images,
  Loader2,
  Ruler,
  Search,
  Settings2,
  Sparkles,
} from "lucide-react";
import { analyzeHomeSituation, findHomes, getHomePhotos } from "@/lib/actions";
import { money } from "@/lib/data";
import { homeBuyingMath, paymentForPrice, taxRateFor, type HomeBuyingInputs } from "@/lib/homeBuying";
import { fitFor, type Fit, type HomeAnalysis, type HomePlan, type HomeProfile } from "@/lib/homePlan";
import type { Listing } from "@/lib/listings";

// ── The top of Home Buying: what makes sense, and real houses that fit ──────
// Claude's read on his situation sets the price and the monthly payment; the
// listings are coloured against them. Every listing's payment runs through the
// same math as the calculator underneath, with the down payment he picks here.

const FIT_STYLE: Record<Fit, { label: string; color: string; bg: string }> = {
  fits: { label: "Fits your plan", color: "var(--good)", bg: "var(--good-bg)" },
  stretch: { label: "A stretch", color: "var(--warn)", bg: "var(--warn-bg)" },
  over: { label: "Too much", color: "var(--neg)", bg: "#fbe9e7" },
};

const VERDICT: Record<HomeAnalysis["verdict"], { label: string; emoji: string; color: string }> = {
  ready: { label: "Ready to look", emoji: "🏡", color: "var(--good)" },
  almost: { label: "Almost there", emoji: "🛠️", color: "var(--warn)" },
  not_yet: { label: "Not yet", emoji: "⏳", color: "var(--neg)" },
};

const DOWN_CHOICES = [3, 3.5, 5, 10, 15, 20, 25];

function zipFrom(place: string): string {
  return place.match(/\b\d{5}\b/)?.[0] ?? "";
}

export default function HomeFinder({
  plan,
  inputs,
  listingsOn,
  claudeOn,
}: {
  plan: HomePlan;
  inputs: HomeBuyingInputs;
  listingsOn: boolean;
  claudeOn: boolean;
}) {
  const [analysis, setAnalysis] = useState<HomeAnalysis | null>(plan.analysis);
  const [analyzedAt, setAnalyzedAt] = useState<string | null>(plan.analyzedAt);
  const [editing, setEditing] = useState(!plan.analysis);

  // The numbers listings are judged against: Claude's if he has them, the
  // calculator's otherwise (its whole-payment ceiling as the max, a bit under
  // that as comfortable — unless he's said what feels comfortable himself).
  const calc = useMemo(() => homeBuyingMath(inputs), [inputs]);
  const maxMonthly = analysis?.maxMonthly || calc.afterTax.monthlyTotal;
  const comfortable = analysis?.comfortableMonthly || plan.profile.comfortMonthly || maxMonthly * 0.85;
  const suggestedMax = analysis?.maxPrice || calc.afterTax.homeValue;

  return (
    <div className="space-y-4">
      <PlanCard
        analysis={analysis}
        analyzedAt={analyzedAt}
        claudeOn={claudeOn}
        onEdit={() => setEditing((v) => !v)}
        editing={editing}
      />
      {editing && (
        <SituationForm
          initial={plan.profile}
          claudeOn={claudeOn}
          onDone={(a, at) => {
            setAnalysis(a);
            setAnalyzedAt(at);
            setEditing(false);
          }}
        />
      )}
      <Finder
        inputs={inputs}
        listingsOn={listingsOn}
        comfortable={comfortable}
        maxMonthly={maxMonthly}
        suggestedMax={suggestedMax}
        defaultDown={analysis?.downPaymentPct || inputs.downPct}
      />
    </div>
  );
}

// ── Claude's read ────────────────────────────────────────────────────────────

function PlanCard({
  analysis,
  analyzedAt,
  claudeOn,
  editing,
  onEdit,
}: {
  analysis: HomeAnalysis | null;
  analyzedAt: string | null;
  claudeOn: boolean;
  editing: boolean;
  onEdit: () => void;
}) {
  const v = analysis ? VERDICT[analysis.verdict] : null;
  return (
    <section
      className="overflow-hidden rounded-3xl p-5 text-white shadow-sm"
      style={{ background: "linear-gradient(135deg, #2b1d52 0%, #6d28d9 60%, #8b5cf6 100%)" }}
    >
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-white/80" />
        <span className="flex-1 text-[12px] font-medium uppercase tracking-wider text-white/75">Claude&apos;s read on your situation</span>
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[12px] font-medium hover:bg-white/25"
        >
          <Settings2 size={13} />
          {editing ? "Close" : "Your situation"}
        </button>
      </div>

      {analysis && v ? (
        <>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[12px] font-semibold" style={{ color: v.color }}>
            {v.emoji} {v.label}
          </div>
          <h2 className="mt-2 text-[20px] font-semibold leading-snug">{analysis.headline}</h2>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Big label="Comfortable" monthly={analysis.comfortableMonthly} price={analysis.comfortablePrice} />
            <Big label="Most ever" monthly={analysis.maxMonthly} price={analysis.maxPrice} />
          </div>
          <p className="mt-4 text-[14px] leading-relaxed text-white/90">{analysis.summary}</p>
          {analysis.nextSteps.length > 0 && (
            <details className="mt-3 rounded-2xl bg-white/10 px-4 py-3">
              <summary className="cursor-pointer text-[13px] font-medium">What to do next</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] text-white/90">
                {analysis.nextSteps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </details>
          )}
          {analysis.watchOuts.length > 0 && (
            <details className="mt-2 rounded-2xl bg-white/10 px-4 py-3">
              <summary className="cursor-pointer text-[13px] font-medium">Watch out for</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-white/90">
                {analysis.watchOuts.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </details>
          )}
          {analyzedAt && (
            <p className="mt-3 text-[11px] text-white/60">
              Looked at {new Date(analyzedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}. A guide, not a loan approval.
            </p>
          )}
        </>
      ) : (
        <p className="mt-3 text-[15px] leading-relaxed text-white/90">
          {claudeOn
            ? "Tell Claude a little about your situation and it'll work out a price and a monthly payment that make sense for you — then the houses below get sorted by what fits."
            : "Claude isn't switched on yet. Houses below are judged against the calculator's numbers until it is."}
        </p>
      )}
    </section>
  );
}

function Big({ label, monthly, price }: { label: string; monthly: number; price: number }) {
  return (
    <div className="rounded-2xl bg-white/12 px-3 py-2.5" style={{ background: "rgba(255,255,255,0.12)" }}>
      <div className="text-[11px] uppercase tracking-wider text-white/70">{label}</div>
      <div className="text-[20px] font-semibold tabular-nums">
        {money(monthly)}
        <span className="text-[12px] font-normal text-white/70">/mo</span>
      </div>
      <div className="text-[12px] text-white/75">homes up to {money(price)}</div>
    </div>
  );
}

// ── His situation, in his words ──────────────────────────────────────────────

function SituationForm({
  initial,
  claudeOn,
  onDone,
}: {
  initial: HomeProfile;
  claudeOn: boolean;
  onDone: (a: HomeAnalysis, at: string) => void;
}) {
  const [p, setP] = useState(() => ({
    savedForDown: initial.savedForDown?.toString() ?? "",
    creditScore: initial.creditScore?.toString() ?? "",
    monthlyTakeHome: initial.monthlyTakeHome?.toString() ?? "",
    divorceMonthly: initial.divorceMonthly?.toString() ?? "",
    comfortMonthly: initial.comfortMonthly?.toString() ?? "",
    timeline: initial.timeline,
    notes: initial.notes,
  }));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (k: keyof typeof p) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setP((d) => ({ ...d, [k]: e.target.value }));
  const n = (s: string) => (s.trim() === "" ? null : Number(s.replace(/[^0-9.]/g, "")));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await analyzeHomeSituation({
        savedForDown: n(p.savedForDown),
        creditScore: n(p.creditScore),
        monthlyTakeHome: n(p.monthlyTakeHome),
        divorceMonthly: n(p.divorceMonthly),
        comfortMonthly: n(p.comfortMonthly),
        timeline: p.timeline,
        notes: p.notes,
      });
      if (res.ok) onDone(res.analysis, res.analyzedAt);
      else setError(res.error);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-3xl border border-border bg-card p-5">
      <div>
        <h3 className="text-[16px] font-semibold">Your situation</h3>
        <p className="text-[13px] text-muted">
          Claude already sees your bills, debts, the divorce and your massage income from the app. Add what it can&apos;t know. Skip anything you&apos;re not sure of.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Saved for a down payment" prefix="$" value={p.savedForDown} onChange={set("savedForDown")} />
        <Field label="Credit score" value={p.creditScore} onChange={set("creditScore")} placeholder="e.g. 680" />
        <Field label="Take-home each month" prefix="$" value={p.monthlyTakeHome} onChange={set("monthlyTakeHome")} />
        <Field label="Divorce payments / month" prefix="$" value={p.divorceMonthly} onChange={set("divorceMonthly")} />
        <Field label="Comfortable housing payment" prefix="$" value={p.comfortMonthly} onChange={set("comfortMonthly")} placeholder="per month" />
        <Field label="When do you want to buy?" value={p.timeline} onChange={set("timeline")} placeholder="e.g. next year" inputMode="text" />
      </div>
      <label className="block">
        <span className="text-[13px] font-medium">Anything else Claude should know</span>
        <textarea
          value={p.notes}
          onChange={set("notes")}
          rows={4}
          maxLength={4000}
          placeholder="How steady is the income? Anything changing soon (car paid off, divorce final)? Must-haves in a home?"
          className="mt-1 w-full rounded-2xl border border-border bg-bg px-3 py-2.5 text-[15px] outline-none focus:border-[var(--muted)]"
        />
      </label>
      {error && <p className="text-[13px] text-warn">{error}</p>}
      <button
        type="submit"
        disabled={pending || !claudeOn}
        className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[15px] font-semibold text-white disabled:opacity-50"
        style={{ background: "linear-gradient(135deg, #6d28d9, #8b5cf6)" }}
      >
        {pending ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
        {pending ? "Claude is thinking… up to a minute" : "Save & ask Claude"}
      </button>
    </form>
  );
}

function Field({
  label,
  prefix,
  inputMode = "decimal",
  ...rest
}: {
  label: string;
  prefix?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  inputMode?: "decimal" | "text";
}) {
  return (
    <label className="block min-w-0">
      <span className="block truncate text-[12px] text-muted">{label}</span>
      <span className="mt-1 flex items-center rounded-xl border border-border bg-bg px-3 focus-within:border-[var(--muted)]">
        {prefix && <span className="text-muted">{prefix}</span>}
        <input {...rest} inputMode={inputMode} className="min-w-0 flex-1 bg-transparent py-2 text-[15px] outline-none" />
      </span>
    </label>
  );
}

// ── Real houses ──────────────────────────────────────────────────────────────

function Finder({
  inputs,
  listingsOn,
  comfortable,
  maxMonthly,
  suggestedMax,
  defaultDown,
}: {
  inputs: HomeBuyingInputs;
  listingsOn: boolean;
  comfortable: number;
  maxMonthly: number;
  suggestedMax: number;
  defaultDown: number;
}) {
  const [zip, setZip] = useState(zipFrom(inputs.place));
  const [beds, setBeds] = useState(0);
  const [maxPrice, setMaxPrice] = useState(() => String(Math.round((suggestedMax || 500_000) * 1.1 / 5000) * 5000));
  const [downPct, setDownPct] = useState(() =>
    DOWN_CHOICES.reduce((a, b) => (Math.abs(b - defaultDown) < Math.abs(a - defaultDown) ? b : a), DOWN_CHOICES[0])
  );
  const [results, setResults] = useState<Listing[] | null>(null);
  const [searchedZip, setSearchedZip] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function search(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await findHomes({ zip, maxPrice: Number(maxPrice.replace(/[^0-9]/g, "")), minBeds: beds });
      if (res.ok) {
        setResults(res.listings);
        setSearchedZip(zip);
      } else setError(res.error);
    });
  }

  const priced = useMemo(() => {
    if (!results) return [];
    const taxRate = taxRateFor(searchedZip, inputs);
    const order: Record<Fit, number> = { fits: 0, stretch: 1, over: 2 };
    return results
      .map((l) => {
        const pay = paymentForPrice(l.price, inputs, taxRate, { downPct, hoaMonthly: l.hoaMonthly });
        return { listing: l, pay, fit: fitFor(pay.monthlyTotal, comfortable, maxMonthly) };
      })
      .sort((a, b) => order[a.fit] - order[b.fit] || b.listing.price - a.listing.price);
  }, [results, searchedZip, inputs, downPct, comfortable, maxMonthly]);

  const counts = priced.reduce<Record<Fit, number>>((c, p) => ({ ...c, [p.fit]: c[p.fit] + 1 }), { fits: 0, stretch: 0, over: 0 });

  return (
    <section className="space-y-3">
      <form onSubmit={search} className="space-y-3 rounded-3xl border border-border bg-card p-5">
        <h3 className="text-[16px] font-semibold">Find homes</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="block">
            <span className="text-[12px] text-muted">ZIP code</span>
            <input
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
              inputMode="numeric"
              placeholder="e.g. 91356"
              className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 text-[15px] outline-none focus:border-[var(--muted)]"
            />
          </label>
          <label className="block">
            <span className="text-[12px] text-muted">Up to</span>
            <span className="mt-1 flex items-center rounded-xl border border-border bg-bg px-3 focus-within:border-[var(--muted)]">
              <span className="text-muted">$</span>
              <input
                value={Number(maxPrice.replace(/[^0-9]/g, "") || 0).toLocaleString("en-US")}
                onChange={(e) => setMaxPrice(e.target.value.replace(/[^0-9]/g, ""))}
                inputMode="numeric"
                className="min-w-0 flex-1 bg-transparent py-2 text-[15px] outline-none"
              />
            </span>
          </label>
          <label className="block">
            <span className="text-[12px] text-muted">Bedrooms</span>
            <select
              value={beds}
              onChange={(e) => setBeds(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 text-[15px] outline-none"
            >
              <option value={0}>Any</option>
              {[1, 2, 3, 4, 5].map((b) => (
                <option key={b} value={b}>
                  {b}+
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[12px] text-muted">Down payment</span>
            <select
              value={downPct}
              onChange={(e) => setDownPct(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 text-[15px] outline-none"
            >
              {DOWN_CHOICES.map((d) => (
                <option key={d} value={d}>
                  {d}%
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="submit"
          disabled={pending || zip.length !== 5 || !listingsOn}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[15px] font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--good)" }}
        >
          {pending ? <Loader2 size={17} className="animate-spin" /> : <Search size={17} />}
          {pending ? "Searching Zillow…" : "Show me homes"}
        </button>
        {!listingsOn && (
          <p className="text-[13px] text-muted">Home search isn&apos;t switched on yet — Admin needs to add the Zillow data key.</p>
        )}
        {error && <p className="text-[13px] text-warn">{error}</p>}
        <p className="text-[12px] text-muted">
          Monthly costs include the loan, property tax, insurance, mortgage insurance (under 20% down) and HOA when Zillow lists it. Fits = under {money(comfortable)}/mo · stretch = up to {money(maxMonthly)}/mo.
        </p>
      </form>

      {results && (
        <>
          <div className="flex flex-wrap gap-2 text-[12px]">
            {(Object.keys(FIT_STYLE) as Fit[]).map((f) => (
              <span key={f} className="rounded-full px-3 py-1 font-medium" style={{ color: FIT_STYLE[f].color, background: FIT_STYLE[f].bg }}>
                {counts[f]} {FIT_STYLE[f].label.toLowerCase()}
              </span>
            ))}
          </div>
          {priced.length === 0 ? (
            <p className="rounded-3xl border border-border bg-card p-5 text-center text-[14px] text-muted">
              No homes for sale in {searchedZip} under that price. Try a higher price or a nearby ZIP.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {priced.map(({ listing, pay, fit }) => (
                <ListingCard key={listing.zpid} listing={listing} pay={pay} fit={fit} downPct={downPct} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ListingCard({
  listing,
  pay,
  fit,
  downPct,
}: {
  listing: Listing;
  pay: ReturnType<typeof paymentForPrice>;
  fit: Fit;
  downPct: number;
}) {
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<string[]>(listing.photos);
  const [loadingPhotos, startPhotos] = useTransition();
  const style = FIT_STYLE[fit];

  function morePhotos() {
    startPhotos(async () => {
      const got = await getHomePhotos(listing.zpid);
      if (got.length) setPhotos(got);
    });
  }

  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-card">
      <div className="relative aspect-[4/3] bg-tint">
        {listing.photo ? (
          // Zillow's own photo server; next/image would need it allow-listed and
          // would re-host every photo through this app for nothing.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.photo} alt={listing.address} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-[13px] text-muted">No photo</div>
        )}
        <span className="absolute left-3 top-3 rounded-full px-3 py-1 text-[12px] font-semibold shadow-sm" style={{ color: style.color, background: style.bg }}>
          {style.label}
        </span>
      </div>
      <div className="p-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[20px] font-semibold tabular-nums">{money(listing.price)}</span>
          <span className="text-right">
            <span className="text-[18px] font-semibold tabular-nums" style={{ color: style.color }}>
              {money(pay.monthlyTotal)}
            </span>
            <span className="text-[12px] text-muted">/mo</span>
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
          {listing.beds && (
            <span className="flex items-center gap-1">
              <BedDouble size={14} /> {listing.beds} bd
            </span>
          )}
          {listing.baths && (
            <span className="flex items-center gap-1">
              <Bath size={14} /> {listing.baths} ba
            </span>
          )}
          {listing.sqft && (
            <span className="flex items-center gap-1">
              <Ruler size={14} /> {listing.sqft.toLocaleString("en-US")} sqft
            </span>
          )}
          <span>{listing.homeType}</span>
        </div>
        <p className="mt-1 truncate text-[14px]">{listing.address}</p>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-3 flex w-full items-center justify-between rounded-xl bg-tint px-3 py-2 text-[13px] font-medium"
        >
          {money(pay.downPayment)} down ({downPct}%) · see the payment
          <ChevronDown size={15} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="mt-2 space-y-3">
            <dl className="space-y-1 text-[13px]">
              <Row label="Cash up front (down payment)" value={money(pay.downPayment)} />
              <Row label="Loan" value={money(pay.loan)} />
              <div className="my-1 border-t border-border" />
              <Row label="Loan payment" value={money(pay.monthlyPI)} />
              <Row label="Property tax" value={money(pay.monthlyTax)} />
              <Row label="Home insurance" value={money(pay.monthlyInsurance)} />
              {pay.monthlyPmi > 0 && <Row label="Mortgage insurance" value={money(pay.monthlyPmi)} />}
              {pay.monthlyHoa > 0 && <Row label="HOA" value={money(pay.monthlyHoa)} />}
              <Row label="Every month" value={money(pay.monthlyTotal)} bold />
            </dl>
            <p className="text-[11px] text-muted">Closing costs (often 2–5% of the price) are on top of the down payment.</p>
            {photos.length > 1 ? (
              <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
                {photos.map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={src} src={src} alt="" loading="lazy" className="h-28 w-40 shrink-0 snap-start rounded-xl object-cover" />
                ))}
              </div>
            ) : (
              <button
                type="button"
                onClick={morePhotos}
                disabled={loadingPhotos}
                className="flex items-center gap-1.5 text-[13px] font-medium disabled:opacity-50"
                style={{ color: "var(--reg)" }}
              >
                {loadingPhotos ? <Loader2 size={14} className="animate-spin" /> : <Images size={14} />}
                More photos
              </button>
            )}
          </div>
        )}
        <a
          href={listing.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-[13px] font-medium hover:bg-tint"
        >
          See it on Zillow <ExternalLink size={13} />
        </a>
      </div>
    </article>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <dt className={bold ? "" : "text-muted"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
