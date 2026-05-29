import { useMemo, useRef, useState } from 'react'
import type { Company } from '../lib/types'
import { matchesLens, type Lens } from '../lib/brief'

const W = 920
const H = 420
const PAD = { top: 24, right: 20, bottom: 44, left: 48 }

export const BUCKET_COLOR: Record<string, string> = {
  sp500_software: '#0F5499', // blue
  big_saas_outside: '#0D7680', // teal
  gsi: '#990F3D', // claret
}

interface Point {
  c: Company
  bucket: string
  x: number // rule of 40
  y: number // ytd
}

/**
 * Rule-of-40 (x) against YTD performance (y). If the market were rewarding
 * fundamental quality, points would trend up-and-to-the-right. The scatter
 * shows how loosely that holds during the recovery.
 */
export default function Scatter({
  data,
  lens = 'all',
}: {
  data: Record<string, Company[]>
  lens?: Lens
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)

  const points = useMemo<Point[]>(() => {
    const out: Point[] = []
    for (const [bucket, members] of Object.entries(data)) {
      for (const c of members) {
        if (c.fundamentals?.ruleOf40 != null) {
          out.push({ c, bucket, x: c.fundamentals.ruleOf40, y: c.ytdPct })
        }
      }
    }
    return out
  }, [data])

  const { x, y, xTicks, yTicks } = useMemo(() => {
    const xs = points.map((p) => p.x)
    const ys = points.map((p) => p.y)
    const xLo = Math.min(0, ...xs) - 5
    const xHi = Math.max(...xs) + 5
    const yLo = Math.min(...ys) - 5
    const yHi = Math.max(0, ...ys) + 5
    const plotW = W - PAD.left - PAD.right
    const plotH = H - PAD.top - PAD.bottom
    const x = (v: number) => PAD.left + ((v - xLo) / (xHi - xLo)) * plotW
    const y = (v: number) => PAD.top + (1 - (v - yLo) / (yHi - yLo)) * plotH
    const xTicks = ticks(xLo, xHi, 20)
    const yTicks = ticks(yLo, yHi, 25)
    return { x, y, xTicks, yTicks }
  }, [points])

  if (points.length < 3) return null

  function onMove(e: React.MouseEvent) {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const mx = ((e.clientX - rect.left) / rect.width) * W
    const my = ((e.clientY - rect.top) / rect.height) * H
    let best = -1
    let bestD = Infinity
    points.forEach((p, i) => {
      const d = (x(p.x) - mx) ** 2 + (y(p.y) - my) ** 2
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    setHover(bestD < 900 ? best : null)
  }

  const hp = hover != null ? points[hover] : null

  return (
    <figure className="m-0">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="Rule of 40 versus year-to-date performance"
      >
        {/* gridlines */}
        {xTicks.map((t) => (
          <g key={`x${t}`}>
            <line x1={x(t)} x2={x(t)} y1={PAD.top} y2={H - PAD.bottom} stroke="#2B2A28" strokeOpacity={t === 0 ? 0.3 : 0.07} strokeWidth={1} />
            <text x={x(t)} y={H - PAD.bottom + 16} textAnchor="middle" className="fill-ink-faint" fontSize="11" fontFamily="'Libre Franklin',sans-serif">{t}</text>
          </g>
        ))}
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#2B2A28" strokeOpacity={t === 0 ? 0.3 : 0.07} strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t) + 3} textAnchor="end" className="fill-ink-faint" fontSize="11" fontFamily="'Libre Franklin',sans-serif">{t > 0 ? '+' : ''}{t}%</text>
          </g>
        ))}

        {/* the "rule of 40" line at x=40 */}
        <line x1={x(40)} x2={x(40)} y1={PAD.top} y2={H - PAD.bottom} stroke="#0D7680" strokeOpacity={0.5} strokeWidth={1} strokeDasharray="4 4" />
        <text x={x(40) + 4} y={PAD.top + 12} className="fill-teal" fontSize="10" fontWeight="600" fontFamily="'Libre Franklin',sans-serif">rule of 40</text>

        {/* points — dimmed when they don't match the active lens */}
        {points.map((p, i) => {
          const inLens = matchesLens(p.c, lens)
          let opacity = inLens ? 0.85 : 0.1
          if (hover != null) opacity = hover === i ? 1 : opacity * 0.45
          return (
            <circle
              key={p.c.ticker}
              cx={x(p.x)}
              cy={y(p.y)}
              r={hover === i ? 6 : inLens ? 4 : 3}
              fill={BUCKET_COLOR[p.bucket] ?? '#2B2A28'}
              fillOpacity={opacity}
              stroke="#FFF1E5"
              strokeWidth={1}
            />
          )
        })}

        {/* axis labels */}
        <text x={(PAD.left + W - PAD.right) / 2} y={H - 6} textAnchor="middle" className="fill-ink-soft" fontSize="11" fontWeight="600" fontFamily="'Libre Franklin',sans-serif">
          Rule of 40  (revenue growth % + operating margin %)
        </text>
        <text transform={`rotate(-90 12 ${(PAD.top + H - PAD.bottom) / 2})`} x={12} y={(PAD.top + H - PAD.bottom) / 2} textAnchor="middle" className="fill-ink-soft" fontSize="11" fontWeight="600" fontFamily="'Libre Franklin',sans-serif">
          YTD %
        </text>

        {/* hover tooltip */}
        {hp && (
          <g>
            <text x={x(hp.x)} y={y(hp.y) - 10} textAnchor="middle" className="fill-ink" fontSize="12.5" fontWeight="600" fontFamily="'Source Serif 4',serif">
              {hp.c.name}
            </text>
            <text x={x(hp.x)} y={y(hp.y) + 20} textAnchor="middle" className="fill-ink-soft" fontSize="11" fontFamily="'Libre Franklin',sans-serif">
              R40 {hp.x.toFixed(0)} · {hp.y > 0 ? '+' : ''}{hp.y.toFixed(0)}% YTD
            </text>
          </g>
        )}
      </svg>
    </figure>
  )
}

function ticks(lo: number, hi: number, step: number): number[] {
  const out: number[] = []
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) out.push(t)
  return out
}
