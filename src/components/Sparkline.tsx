interface SparklineProps {
  values: number[]
  positive: boolean
  width?: number
  height?: number
}

/**
 * Hand-coded SVG sparkline in the FT register: a single hairline path over a
 * dotted baseline (the YTD start), a small terminal dot, no fills or neon.
 */
export default function Sparkline({
  values,
  positive,
  width = 132,
  height = 30,
}: SparklineProps) {
  if (values.length < 2) return <svg width={width} height={height} />

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pad = 3

  const x = (i: number) => (i / (values.length - 1)) * (width - pad * 2) + pad
  const y = (v: number) => height - pad - ((v - min) / range) * (height - pad * 2)

  const path = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(' ')
  const baselineY = y(values[0])
  const color = positive ? '#0D7680' : '#990F3D'
  const lastX = x(values.length - 1)
  const lastY = y(values[values.length - 1])

  return (
    <svg width={width} height={height} className="overflow-visible">
      <line
        x1={pad}
        x2={width - pad}
        y1={baselineY}
        y2={baselineY}
        stroke="#2B2A28"
        strokeOpacity="0.28"
        strokeWidth="1"
        strokeDasharray="1.5 3"
      />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r="1.9" fill={color} />
    </svg>
  )
}
