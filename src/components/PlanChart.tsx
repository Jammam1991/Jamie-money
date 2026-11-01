import type { YearPoint } from '@/lib/retirementPlan'

// Two things by age: your 401k (Chris's share plus your own savings, growing)
// as a green hill, and what you have paid Chris so far as a red line. A dot
// marks the age the 401k passes what you paid, if it ever does.
// A copy of Money App's app/divorce/retirement/PlanChart.tsx, worded for Jamie.

const W = 640
const H = 220
const PAD = { l: 8, r: 8, t: 28, b: 26 }

const short = (n: number) =>
  n === 0 ? '$0' : n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1000)}k`

export default function PlanChart({ points }: { points: YearPoint[] }) {
  if (points.length < 2) return null
  const minAge = points[0].age
  const maxAge = points[points.length - 1].age
  const maxY = Math.max(1, ...points.map((p) => Math.max(p.loanPaid, p.withSavings)))
  const x = (age: number) => PAD.l + ((age - minAge) / Math.max(1, maxAge - minAge)) * (W - PAD.l - PAD.r)
  const y = (v: number) => H - PAD.b - (v / maxY) * (H - PAD.t - PAD.b)
  const ageStep = maxAge - minAge > 20 ? 10 : 5
  const ages: number[] = []
  for (let a = Math.ceil(minAge / ageStep) * ageStep; a <= maxAge; a += ageStep) ages.push(a)

  const line = (key: 'loanPaid' | 'withSavings') => points.map((p) => `${x(p.age)},${y(p[key])}`).join(' ')
  const area = `${x(minAge)},${y(0)} ${line('withSavings')} ${x(maxAge)},${y(0)}`

  // The last time the 401k climbs back above what he has paid.
  let cross: YearPoint | null = null
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    if (b.loanPaid > 0 && a.withSavings < a.loanPaid && b.withSavings >= b.loanPaid) cross = b
  }
  const last = points[points.length - 1]

  return (
    <div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 mb-2 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: 'var(--pos)' }} />
          Your 401k
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: 'var(--neg)' }} />
          Paid to Chris so far
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Your 401k vs what you have paid Chris, by age">
        <defs>
          <linearGradient id="plan-hill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--pos)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--pos)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} stroke="var(--border)" strokeWidth={1} />
        <polygon points={area} fill="url(#plan-hill)" />
        <polyline fill="none" stroke="var(--pos)" strokeWidth={3} strokeLinejoin="round" points={line('withSavings')} />
        <polyline fill="none" stroke="var(--neg)" strokeWidth={2.5} strokeLinejoin="round" points={line('loanPaid')} />
        {cross && (
          <g>
            <circle cx={x(cross.age)} cy={y(cross.withSavings)} r={6} fill="var(--card)" stroke="var(--pos)" strokeWidth={3} />
            <text x={x(cross.age)} y={y(cross.withSavings) - 12} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--pos)">
              Even at {Math.floor(cross.age)}
            </text>
          </g>
        )}
        <text x={x(maxAge)} y={y(last.withSavings) - 10} textAnchor="end" fontSize={12} fontWeight={700} fill="var(--pos)">
          {short(last.withSavings)}
        </text>
        {ages.map((a) => (
          <text key={a} x={x(a)} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--muted)">
            {a}
          </text>
        ))}
      </svg>
    </div>
  )
}
