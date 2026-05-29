import type { Company, MarketData } from './types'
import { formatDate } from './format'

export function allRows(data: MarketData): Company[] {
  return Object.values(data.buckets).flatMap((b) => b.members)
}

/** An extreme single-name move that would distort a headline if taken at face value. */
export const OUTLIER_THRESHOLD = 150

/**
 * An FT-style standfirst, computed from the live data — no invented numbers.
 * Leads with breadth, names the arc (trough → recovery), and the market lag.
 */
export function buildDek(data: MarketData): string {
  const rows = allRows(data)
  const n = rows.length
  const up = rows.filter((c) => c.ytdPct >= 0).length
  const hist = data.history ?? []
  const last = hist[hist.length - 1]
  const trough = hist.reduce((lo, p) => (p.medianYtd < lo.medianYtd ? p : lo), hist[0])

  if (!last) {
    return `As of ${formatDate(data.asOf)}, ${up} of ${n} tracked SaaS names are above where they started 2026.`
  }

  const med = last.medianYtd
  const recovered = (trough.medianYtd - med).toFixed(0) // points clawed back from the low
  let s = `As of ${formatDate(data.asOf)}, ${up} of ${n} tracked names are back above water — `
  s += `but the cohort still sits ${Math.abs(med).toFixed(1)}% below where it began 2026, `
  s += `having clawed back ${recovered} points from its ${formatDate(trough.date)} low of ${trough.medianYtd}%.`
  if (last.spxYtd != null) {
    const gap = (last.spxYtd - med).toFixed(0)
    s += ` Software still trails the market: the S&P 500 is ${last.spxYtd > 0 ? 'up' : 'down'} ${Math.abs(last.spxYtd).toFixed(1)}% over the same span, a ${gap}-point gap.`
  }
  return s
}

/** Biggest winner/loser, flagging an extreme outlier so it doesn't mislead. */
export function headlineMovers(rows: Company[]) {
  const sorted = [...rows].sort((a, b) => b.ytdPct - a.ytdPct)
  const winner = sorted[0]
  const loser = sorted[sorted.length - 1]
  const winnerIsOutlier = winner.ytdPct > OUTLIER_THRESHOLD
  // The most representative strong gainer, ignoring the outlier.
  const runnerUp = sorted.find((c) => c.ytdPct <= OUTLIER_THRESHOLD)
  return { winner, loser, winnerIsOutlier, runnerUp }
}
