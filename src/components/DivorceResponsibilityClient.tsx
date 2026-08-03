import type { ReactNode } from "react";
import { Card } from "@/components/ui";
import { money, moneyExact } from "@/lib/data";
import {
  ADVANCES,
  ASSETS,
  DRAWS,
  STORY,
  assetsHalf,
  assetsTotal,
  bill,
  chrisDrawsTotal,
  chrisSpareMonthly,
  chrisSpareTotal,
  drawsTotal,
  gymOwesChris,
  gymSettleUp,
  jamieEarlyTotal,
  jamieEarnedTotal,
  jamieHalfOfDebt,
  jamieHalfOfGymDebt,
  jamieLateTotal,
  jamieRetirementClaim,
} from "@/lib/debtStory";

// The story is told in chapters, top to bottom, the way you'd tell it out loud:
// how the pile got built, who fed it, who paid for it, and what's left to settle.
// A server component on purpose — the manager-pay months are counted from "now",
// and doing that on the server means the number can't drift after hydration.

export default function DivorceResponsibilityClient() {
  const now = new Date();
  const settle = gymSettleUp(now);
  const total = bill(now);

  return (
    <div className="space-y-4">
      {/* The ending, up front — then the rest of the page explains it. */}
      <div className="rounded-2xl bg-warn-bg p-5 text-center">
        <p className="text-[15px] font-medium text-warn">
          🧾 What Jamie owes Chris
        </p>
        <p className="mt-1 text-5xl font-bold text-warn">{money(total.owes)}</p>
        <p className="mt-2 text-[13px] text-warn">
          Here&apos;s how that number got here.
        </p>
      </div>

      {/* ── 2020: the beginning ─────────────────────────────────────────── */}
      <Chapter
        n={1}
        emoji="💍"
        when={String(STORY.marriedYear)}
        title="We got married"
        accent="var(--fico)"
        bg="var(--fico-bg)"
      >
        <p className="text-[15px]">
          Two people, one set of bills. Everything after this point was built
          together — the good and the borrowed.
        </p>
      </Chapter>

      {/* ── The pile ────────────────────────────────────────────────────── */}
      <Chapter
        n={2}
        emoji="💳"
        when={`${STORY.marriedYear}–${STORY.separatedYear}`}
        title="The pile grew"
        accent="var(--warn)"
        bg="var(--warn-bg)"
      >
        <p className="text-4xl font-bold" style={{ color: "var(--warn)" }}>
          {money(STORY.jointDebt)}
        </p>
        <p className="mt-1 text-[15px]">
          {`borrowed in ${STORY.yearsTogether} years. Not on emergencies — most of it went to keeping Jamie's lifestyle going.`}
        </p>
      </Chapter>

      {/* ── Where Chris's paycheck went ─────────────────────────────────── */}
      <Chapter
        n={3}
        emoji="💵"
        when="Every month"
        title="Chris's paycheck disappeared"
        accent="var(--reg)"
        bg="var(--reg-bg)"
      >
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat
            label="Came in"
            value={money(STORY.chrisCashMonthly)}
            color="var(--good)"
          />
          <Stat
            label="His own bills"
            value={money(STORY.chrisBillsMonthly)}
            color="var(--text)"
          />
          <Stat
            label="Left over"
            value={money(chrisSpareMonthly)}
            color="var(--reg)"
          />
        </div>
        <p className="mt-3 text-[15px]">
          Chris didn&apos;t spend on himself, so that{" "}
          <strong>{money(chrisSpareMonthly)} a month</strong> should have piled
          up. Over {STORY.yearsTogether} years that&apos;s{" "}
          <strong>{money(chrisSpareTotal)}</strong>
          {" — and it went to Jamie's lifestyle instead."}
        </p>
      </Chapter>

      {/* ── What Jamie made vs what Jamie paid ──────────────────────────── */}
      <Chapter
        n={4}
        emoji="💰"
        when={`${STORY.marriedYear}–${STORY.separatedYear}`}
        title="Jamie was not broke"
        accent="var(--warn)"
        bg="var(--warn-bg)"
      >
        <div className="space-y-2">
          <Row
            label={`${money(STORY.jamieWeeklyEarly)}/week × ${STORY.jamieEarlyYears} years`}
            value={money(jamieEarlyTotal)}
          />
          <Row
            label={`${money(STORY.jamieMonthlyLate)}/month × 1 year`}
            value={money(jamieLateTotal)}
          />
          <div className="flex items-center justify-between border-t border-border pt-2 text-[15px] font-semibold">
            <span>Jamie brought in</span>
            <span>{money(jamieEarnedTotal)}</span>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-card p-4 text-center">
          <p className="text-[13px] text-muted">
            Put toward the debt payments
          </p>
          <p className="text-5xl font-bold" style={{ color: "var(--warn)" }}>
            $0
          </p>
        </div>

        {/* Who actually made the payments. */}
        <div className="mt-4">
          <p className="mb-2 text-[13px] text-muted">Who paid the bill</p>
          <div className="flex h-6 overflow-hidden rounded-full bg-tint">
            <div
              className="flex items-center justify-center text-[11px] font-semibold text-white"
              style={{ width: "100%", background: "var(--good)" }}
            >
              Chris 100%
            </div>
          </div>
          <p className="mt-2 text-[13px]">
            Chris&apos;s property covered the payments, and his paycheck covered
            the rest — including Jamie&apos;s half.
          </p>
        </div>
      </Chapter>

      {/* ── The one line in Jamie's favor ───────────────────────────────── */}
      <Chapter
        n={5}
        emoji="🏦"
        when={`Since ${STORY.marriedYear}`}
        title="The one thing that goes Jamie's way"
        accent="var(--good)"
        bg="var(--good-bg)"
      >
        <p className="text-[15px]">
          Chris built about <strong>{money(STORY.chris401k)}</strong> in
          401k/pension while they were married. Because it was built during the
          marriage, <strong>{money(jamieRetirementClaim)}</strong> of it points
          back at Jamie — and it comes straight off what he owes.
        </p>
      </Chapter>

      {/* ── 2023: separated, still married on paper ─────────────────────── */}
      <Chapter
        n={6}
        emoji="🚪"
        when={String(STORY.separatedYear)}
        title="We separated"
        accent="var(--fico)"
        bg="var(--fico-bg)"
      >
        <p className="text-[15px]">
          Still legally married — on purpose, for the benefits. But the money
          story didn&apos;t change: Chris kept paying, Jamie kept spending.
        </p>
      </Chapter>

      {/* ── The gym ─────────────────────────────────────────────────────── */}
      <Chapter
        n={7}
        emoji="🏋️"
        when={`${STORY.separatedYear} onward`}
        title="Then we started the gym"
        accent="var(--warn)"
        bg="var(--warn-bg)"
      >
        <ul className="space-y-2.5 text-[15px]">
          <Beat emoji="🤫">
            Jamie quietly stopped his massage business — the{" "}
            {money(STORY.jamieMonthlyLate)}/month one — and never told Chris.
          </Beat>
          <Beat emoji="🏧">
            Instead he pulled money out of the gym as distributions, no joint
            approval, calling it &ldquo;his paycheck.&rdquo;
          </Beat>
          <Beat emoji="🕳️">
            That left a hole every month. Chris refilled it, over and over.
          </Beat>
          <Beat emoji="💳">
            He refilled it with borrowed money — so the shortfall turned into
            more shared debt.
          </Beat>
        </ul>

        <div className="mt-4 rounded-xl bg-card p-4">
          <p className="text-[13px] text-muted">
            What the gym owes Chris today
          </p>
          <p className="text-4xl font-bold" style={{ color: "var(--warn)" }}>
            {moneyExact(gymOwesChris)}
          </p>
          <div className="mt-3 space-y-1.5">
            {ADVANCES.map((a) => (
              <Row
                key={a.label}
                label={a.label}
                value={moneyExact(a.amount)}
              />
            ))}
          </div>
          <p className="mt-3 text-[13px] text-muted">
            Loans and card payments Chris made out of his own pocket to keep the
            doors open. Jamie&apos;s side of the ledger:{" "}
            <strong>{moneyExact(STORY.contributionsJamie)}</strong> contributed.
          </p>
        </div>
      </Chapter>

      {/* ── The receipts ────────────────────────────────────────────────── */}
      <Chapter
        n={8}
        emoji="🧾"
        when="From the books"
        title="Here's exactly what he took"
        accent="var(--reg)"
        bg="var(--reg-bg)"
      >
        <div className="rounded-xl bg-card p-3">
          {DRAWS.map((d) => (
            <div
              key={d.bucket}
              className="border-t border-border py-2.5 first:border-t-0 first:pt-0"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[15px] font-medium">{d.bucket}</span>
                <span className="shrink-0 text-[15px] font-semibold">
                  {moneyExact(d.amount)}
                </span>
              </div>
              <p className="text-xs text-muted">{d.what}</p>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-3 border-t-2 border-border pt-2.5">
            <span className="text-[15px] font-bold">Total he took</span>
            <span className="shrink-0 text-xl font-bold" style={{ color: "var(--warn)" }}>
              {moneyExact(drawsTotal)}
            </span>
          </div>
        </div>
        <p className="mt-3 text-[13px]">
          A Porsche payment, a Tesla insurance bill, an Equinox membership — paid
          by the gym, called a paycheck. And this is only what&apos;s{" "}
          <strong>on the books</strong>: the PT cash he collected on the side was
          never tracked, so it isn&apos;t in this total at all.
        </p>

        {/* Same business, same two partners, wildly different withdrawals. */}
        <p className="mt-4 mb-2 text-[13px] text-muted">
          Distributions, side by side
        </p>
        <Split
          leftLabel="Jamie took"
          leftValue={drawsTotal}
          rightLabel="Chris took"
          rightValue={chrisDrawsTotal}
        />
      </Chapter>

      {/* ── The part that goes back the other way ───────────────────────── */}
      <Chapter
        n={9}
        emoji="⚖️"
        when={`${settle.months} months running the gym`}
        title="But he did do the job"
        accent="var(--good)"
        bg="var(--good-bg)"
      >
        <p className="text-[15px]">
          Jamie managed the place from December {STORY.gymStartYear}. A manager
          doing that job gets paid — call it{" "}
          <strong>{money(STORY.managerMonthly)}/month</strong>. He never drew a
          real paycheck, so that pay is his, and it comes off what he took.
        </p>

        <p className="mt-2 text-[13px] text-muted">
          A placeholder, deliberately low. Jamie was also taking PT cash off the
          books the whole time and none of it was tracked — that money counts as
          pay too. Once it&apos;s totalled, this rate gets revisited.
        </p>

        <div className="mt-4 space-y-2 rounded-xl bg-card p-4">
          <Row
            label={`Manager pay earned (${settle.months} × ${money(STORY.managerMonthly)})`}
            value={money(settle.earned)}
          />
          <Row label="What he actually drew" value={moneyExact(drawsTotal)} />
          <div className="flex items-center justify-between gap-3 border-t border-border pt-2 text-[15px] font-bold">
            <span>{settle.overdraw > 0 ? "Drew beyond his pay" : "He's under his pay by"}</span>
            <span
              className="shrink-0"
              style={{
                color: settle.overdraw > 0 ? "var(--warn)" : "var(--good)",
              }}
            >
              {moneyExact(settle.overdraw > 0 ? settle.overdraw : settle.underdraw)}
            </span>
          </div>
        </div>

        <p className="mt-3 text-[13px]">
          {settle.overdraw > 0
            ? "Everything above the pay he earned is money he has to hand back."
            : "So the draws themselves aren't the debt — the earned pay covers them. What's left to settle is the money Chris sank into the gym to keep it alive."}
        </p>
      </Chapter>

      {/* ── The car ─────────────────────────────────────────────────────── */}
      <Chapter
        n={10}
        emoji="🚗"
        when="Both names, one driver"
        title="And the car is his"
        accent="var(--warn)"
        bg="var(--warn-bg)"
      >
        <p className="text-4xl font-bold" style={{ color: "var(--warn)" }}>
          {money(STORY.carLoan)}
        </p>
        <p className="mt-1 text-[15px]">
          still owed on the loan. Both their names are on the paper, but
          it&apos;s Jamie&apos;s car and Jamie drives it — and the gym has been
          making the payments, which is the{" "}
          <strong>{moneyExact(DRAWS[0].amount)}</strong> Taycan line in his draws
          above. The whole balance sits on his side.
        </p>
        <p className="mt-3 text-[13px] text-muted">
          Counted on its own, not inside the {money(STORY.jointDebt)} above.
        </p>
      </Chapter>

      {/* ── The bill ────────────────────────────────────────────────────── */}
      <Card className="border-l-4" style={{ borderLeftColor: "var(--warn)" }}>
        <p className="mb-3 text-[15px] font-semibold">🧮 So here&apos;s the bill</p>
        <div className="space-y-2">
          <Row
            label={`Half the shared debt (${money(STORY.jointDebt)})`}
            value={money(jamieHalfOfDebt)}
          />
          <Row label="The car loan — all of it" value={money(STORY.carLoan)} />
          <Row
            label={`Half of what the gym owes Chris (${moneyExact(gymOwesChris)})`}
            value={moneyExact(jamieHalfOfGymDebt)}
          />
          <Row
            label="Drawn beyond the pay he earned"
            value={moneyExact(total.overdraw)}
          />
          <Row
            label={`Chris's half of the things Jamie's holding (${money(assetsTotal)})`}
            value={money(assetsHalf)}
          />
          <div className="flex items-center justify-between gap-3 border-t border-border pt-2 text-lg font-bold">
            <span>Jamie owes</span>
            <span className="shrink-0" style={{ color: "var(--warn)" }}>
              {money(total.owes)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 pt-1 text-[13px] text-muted">
            <span>Less his slice of the retirement</span>
            <span className="shrink-0">− {money(jamieRetirementClaim)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-[15px] font-semibold">
            <span>Net</span>
            <span className="shrink-0">{money(total.net)}</span>
          </div>
        </div>
        <p className="mt-3 text-[13px] text-muted">
          The lines don&apos;t overlap: the shared debt was built before the gym
          existed, the car loan is counted on its own, and the gym line is money
          Chris personally lent the business that it can&apos;t pay back if it
          closes. The draws aren&apos;t charged twice — they&apos;re already
          netted against the manager pay he earned. The untracked PT cash
          isn&apos;t counted anywhere.
        </p>
      </Card>

      {/* ── Things, not money ───────────────────────────────────────────── */}
      <Card>
        <p className="mb-1 text-[15px] font-semibold">💍 Then there&apos;s the stuff</p>
        <p className="mb-3 text-[13px] text-muted">
          Bought during the marriage, so it gets split too — and Jamie is
          holding all of it. If he keeps it, he owes Chris half of what
          it&apos;s worth. That half is on the bill above.
        </p>
        <div className="space-y-2">
          {ASSETS.map((a, i) => (
            <div
              key={`${a.item}-${i}`}
              className="flex items-center justify-between gap-3 text-[15px]"
            >
              <span>
                {a.item}
                <span className="block text-xs text-muted">{a.who}</span>
              </span>
              <span className="shrink-0 font-medium">{money(a.value)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 border-t border-border pt-2 text-[15px] font-bold">
            <span>Worth altogether</span>
            <span className="shrink-0">{money(assetsTotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-[13px] text-muted">
            <span>Chris&apos;s half — owed back</span>
            <span className="shrink-0">{money(assetsHalf)}</span>
          </div>
        </div>
      </Card>

      <Card className="bg-tint">
        <p className="text-xs text-muted">
          <strong>Chris&apos;s figures, not legal advice.</strong> These are
          estimates from memory and household records. What a court actually
          splits depends on state law, who benefited from each debt, how the
          business is structured, and what the two of you agree to. A lawyer has
          to sign off on the real number.
        </p>
      </Card>
    </div>
  );
}

// ── Small pieces ─────────────────────────────────────────────────────────────

// One chapter of the story: a numbered, color-washed panel.
function Chapter({
  n,
  emoji,
  when,
  title,
  accent,
  bg,
  children,
}: {
  n: number;
  emoji: string;
  when: string;
  title: string;
  accent: string;
  bg: string;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border-l-4 p-4"
      style={{ background: bg, borderLeftColor: accent }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
          style={{ background: accent }}
        >
          {n}
        </span>
        <span className="text-[12px] font-medium uppercase tracking-wide" style={{ color: accent }}>
          {when}
        </span>
      </div>
      <p className="mb-2 text-[19px] font-semibold">
        {emoji} {title}
      </p>
      {children}
    </div>
  );
}

// A labelled number in a little white tile.
function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-xl bg-card p-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="text-lg font-semibold" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

// Two amounts as one bar, so the gap between them is the point.
function Split({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
}: {
  leftLabel: string;
  leftValue: number;
  rightLabel: string;
  rightValue: number;
}) {
  const total = leftValue + rightValue;
  const leftPct = total > 0 ? (leftValue / total) * 100 : 50;

  return (
    <div>
      <div className="flex h-7 overflow-hidden rounded-full bg-tint">
        <div
          className="flex items-center justify-center text-[11px] font-semibold text-white"
          style={{ width: `${leftPct}%`, background: "var(--warn)" }}
        >
          {Math.round(leftPct)}%
        </div>
        <div
          className="flex flex-1 items-center justify-center text-[11px] font-semibold text-white"
          style={{ background: "var(--good)" }}
        >
          {Math.round(100 - leftPct)}%
        </div>
      </div>
      <div className="mt-2 flex justify-between text-[13px]">
        <span>
          {leftLabel}{" "}
          <strong style={{ color: "var(--warn)" }}>
            {moneyExact(leftValue)}
          </strong>
        </span>
        <span>
          {rightLabel}{" "}
          <strong style={{ color: "var(--good)" }}>
            {moneyExact(rightValue)}
          </strong>
        </span>
      </div>
    </div>
  );
}

// A label-on-the-left, amount-on-the-right line.
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[15px]">
      <span className="text-muted">{label}</span>
      <span className="shrink-0 font-medium">{value}</span>
    </div>
  );
}

// One beat of the gym story.
function Beat({ emoji, children }: { emoji: string; children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="shrink-0 text-lg leading-tight">{emoji}</span>
      <span>{children}</span>
    </li>
  );
}
