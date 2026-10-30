import type { YearPoint } from '@/lib/retirementPlan'

// Three lines by age: what Jamie has paid Chris so far, the 401(k) money from
// Chris growing on its own, and the same 401(k) with his own savings added.
// A copy of Money App's app/divorce/retirement/PlanChart.tsx, worded for Jamie.

const W = 640
const H = 240
const PAD = { l: 52, r: 12, t: 12, b: 28 }

const SERIES = [
  { key: 'loanPaid', label: 'Paid back to Chris so far', color: 'var(--neg)', dash: '' },
  { key: 'fromChris', label: '401k from Chris, growing', color: 'var(--pos)', dash: '' },
  { key: 'withSavings', label: 'Plus your own savings', color: 'var(--accent)', dash: '5 4' },
] as const

const short = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1000)}k`

export default function PlanChart({ points }: { points: YearPoint[] }) {
  if (points.length < 2) return null
  const minAge = points[0].age
  const maxAge = points[points.length - 1].age
  const maxY = Math.max(1, ...points.map((p) => Math.max(p.loanPaid, p.fromChris, p.withSavings)))
  const x = (age: number) => PAD.l + ((age - minAge) / Math.max(1, maxAge - minAge)) * (W - PAD.l - PAD.r)
  const y = (v: number) => H - PAD.b - (v / maxY) * (H - PAD.t - PAD.b)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxY)
  const ageStep = maxAge - minAge > 20 ? 10 : 5
  const ages: number[] = []
  for (let a = Math.ceil(minAge / ageStep) * ageStep; a <= maxAge; a += ageStep) ages.push(a)

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Loan paid back vs 401k growth by age">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">
              {short(t)}
            </text>
          </g>
        ))}
        {ages.map((a) => (
          <text key={a} x={x(a)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--muted)">
            {a}
          </text>
        ))}
        {SERIES.map((s) => (
          <polyline
            key={s.key}
            fill="none"
            stroke={s.color}
            strokeWidth={2.5}
            strokeDasharray={s.dash}
            strokeLinejoin="round"
            points={points.map((p) => `${x(p.age)},${y(p[s.key])}`).join(' ')}
          />
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-xs text-muted">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="inline-block w-4 h-0.5" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
        <span>Age along the bottom.</span>
      </div>
    </div>
  )
}
