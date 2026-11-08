// ── Claude reads Jamie's situation and says what house makes sense ──────────
// Server-only. Gathers what the app already knows (bills, debts, the divorce,
// his pay, the calculator's knobs), adds what he wrote on the Home Buying page,
// and asks Claude for a price and a monthly payment he can live with. The
// answer comes back as JSON in a fixed shape, so the page can use the numbers
// to sort and colour real listings — not just show a paragraph.
//
// Needs ANTHROPIC_API_KEY in Vercel (a key made at console.anthropic.com).

import Anthropic from "@anthropic-ai/sdk";
import { cleanAnalysis, type HomeAnalysis, type HomeProfile } from "./homePlan";
import type { HomeBuyingInputs } from "./homeBuying";
import type { Bill, Debt } from "./data";

export function analysisReady(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "verdict",
    "headline",
    "comfortableMonthly",
    "maxMonthly",
    "comfortablePrice",
    "maxPrice",
    "downPaymentPct",
    "summary",
    "nextSteps",
    "watchOuts",
  ],
  properties: {
    verdict: { type: "string", enum: ["ready", "almost", "not_yet"] },
    headline: { type: "string", description: "One short sentence, plain words, the answer first." },
    comfortableMonthly: { type: "number", description: "All-in monthly housing payment (loan, tax, insurance, PMI, HOA) that leaves real breathing room." },
    maxMonthly: { type: "number", description: "The most he should ever pay per month, all-in. A stretch, not a target." },
    comfortablePrice: { type: "number", description: "House price that lands at comfortableMonthly with the suggested down payment." },
    maxPrice: { type: "number", description: "House price that lands at maxMonthly." },
    downPaymentPct: { type: "number", description: "Suggested down payment as a percent of the price, given the cash he has." },
    summary: { type: "string", description: "2-4 short sentences in plain words. No jargon; explain any money term you must use." },
    nextSteps: { type: "array", items: { type: "string" }, description: "3-5 concrete things to do next, most important first." },
    watchOuts: { type: "array", items: { type: "string" }, description: "1-4 risks specific to his situation." },
  },
} as const;

const SYSTEM = `You help Jamie, a massage therapist and gym co-owner going through a divorce, work out what home he can sensibly buy.
Be honest and kind. Use plain words a non-finance person understands; no acronyms unless explained.
Base every number on the facts given. Where income is irregular or cash-based, be conservative and say so.
The all-in monthly payment means loan principal and interest + property tax + home insurance + mortgage insurance (if under 20% down) + HOA dues.
If buying doesn't make sense yet, say so plainly and set the prices to what he could reach soon, with steps to get there.`;

export async function analyzeHome(context: {
  profile: HomeProfile;
  inputs: HomeBuyingInputs;
  taxRatePct: number;
  weeklyIncome: number;
  bills: Bill[];
  debts: Debt[];
  divorceSupportMonthly: number;
  settlementTotal: number | null;
  creditScore: number | null;
}): Promise<{ ok: true; analysis: HomeAnalysis } | { ok: false; error: string }> {
  if (!analysisReady()) {
    return { ok: false, error: "Claude isn't switched on yet — Admin needs to add the Claude key (ANTHROPIC_API_KEY) in Vercel." };
  }
  const { profile, inputs, debts, bills } = context;
  const facts = {
    writtenByJamie: profile,
    fromTheApp: {
      massageIncomePerWeekAverage: Math.round(context.weeklyIncome),
      monthlyBills: bills.map((b) => ({ name: b.name, amount: b.amount })),
      monthlyBillsTotal: Math.round(bills.reduce((s, b) => s + b.amount, 0)),
      personalDebts: debts
        .filter((d) => d.scope !== "business")
        .map((d) => ({ name: d.name, balance: Math.round(d.balance), monthlyMinimum: Math.round(d.minPayment || d.monthly), apr: d.apr })),
      divorce: {
        supportPerMonth: context.divorceSupportMonthly,
        settlementOwedTotal: context.settlementTotal,
      },
      creditScoreOnFile: context.creditScore,
    },
    mortgageAssumptions: {
      interestRatePct: inputs.ratePct,
      loanYears: inputs.years,
      propertyTaxPctOfPrice: context.taxRatePct,
      homeInsurancePctOfPrice: inputs.insurancePct,
      mortgageInsurancePctOfLoan: inputs.pmiPct,
      area: inputs.place,
    },
  };

  try {
    const client = new Anthropic();
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Here is Jamie's situation as JSON. Work out what home makes sense for him.\n\n${JSON.stringify(facts, null, 2)}`,
        },
      ],
    });
    if (response.stop_reason === "refusal") {
      return { ok: false, error: "Claude couldn't look at this one. Try rewording the notes." };
    }
    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    const analysis = cleanAnalysis(JSON.parse(text));
    if (!analysis) return { ok: false, error: "Claude's answer came back garbled. Try again." };
    return { ok: true, analysis };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return { ok: false, error: "The Claude key was turned down. Admin needs to check ANTHROPIC_API_KEY." };
    }
    if (err instanceof Anthropic.RateLimitError) {
      return { ok: false, error: "Claude is busy right now. Try again in a minute." };
    }
    if (err instanceof Anthropic.APIError && err.status === 400 && /credit/i.test(err.message)) {
      return { ok: false, error: "The Claude account is out of credit. Admin needs to top it up." };
    }
    return { ok: false, error: "Claude didn't answer just now. Try again in a minute." };
  }
}
