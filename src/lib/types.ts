export interface Company {
  ticker: string
  name: string
  currency: string
  baseline: number
  last: number
  lastDate: string
  ytdPct: number
  fromHighPct: number
  fromLowPct: number
  sparkline: number[]
}

export interface Bucket {
  label: string
  blurb: string
  members: Company[]
}

export interface MarketData {
  asOf: string
  generatedAt: string
  baselineDate: string
  buckets: Record<string, Bucket>
}

export type SortKey = 'ytd' | 'fromLow' | 'name'
