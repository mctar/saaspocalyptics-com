import type { Company, SortKey } from './types'

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: '$',
  EUR: '€',
  INR: '₹',
  GBP: '£',
}

export function pct(value: number, withSign = true): string {
  const sign = withSign && value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

export function price(value: number, currency: string): string {
  const sym = CURRENCY_SYMBOL[currency] ?? ''
  return `${sym}${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatDate(iso: string): string {
  // iso is YYYY-MM-DD; render as e.g. "29 May 2026" without timezone drift.
  const [y, m, d] = iso.split('-').map(Number)
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ]
  return `${d} ${months[m - 1]} ${y}`
}

export function sortCompanies(rows: Company[], key: SortKey): Company[] {
  const out = [...rows]
  switch (key) {
    case 'ytd':
      return out.sort((a, b) => a.ytdPct - b.ytdPct) // worst first — the carnage
    case 'fromLow':
      return out.sort((a, b) => b.fromLowPct - a.fromLowPct) // strongest recovery first
    case 'name':
      return out.sort((a, b) => a.name.localeCompare(b.name))
  }
}

export function median(values: number[]): number {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
