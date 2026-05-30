export interface Fundamentals {
  revenueGrowthPct?: number
  operatingMarginPct?: number
  ruleOf40?: number
  marketCap?: number
}

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
  fundamentals?: Fundamentals
}

export interface Bucket {
  label: string
  blurb: string
  members: Company[]
}

export interface HistoryPoint {
  date: string
  medianYtd: number
  pctUp: number
  buckets: Record<string, number>
  igvYtd?: number
  spxYtd?: number
}

export interface Benchmark {
  ticker: string
  name: string
}

export interface AiBlock {
  todaysRead?: string
  sinceLastRun?: string
  buckets?: Record<string, string>
  model?: string
  generatedAt?: string
}

export interface MarketData {
  asOf: string
  generatedAt: string
  baselineDate: string
  buckets: Record<string, Bucket>
  benchmarks?: Benchmark[]
  history?: HistoryPoint[]
  ai?: AiBlock
}

export type SortKey = 'ytd' | 'fromLow' | 'rule40' | 'name'
