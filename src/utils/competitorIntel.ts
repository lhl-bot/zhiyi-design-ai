import type { CompetitorIntel } from "../types"
import { competitorIntel } from "../data/competitorIntel"
import { clip } from "./helpers"

/** 取客户竞对情报 */
export function competitorIntelOf(customerId: string): CompetitorIntel | undefined {
  return competitorIntel[customerId]
}

/** 拼接趋势信号为AI提示词（取Top 3，避免token溢出） */
export function trendSignalsForPrompt(customerId: string): string {
  const intel = competitorIntel[customerId]
  if (!intel || intel.trendSignals.length === 0) return ""
  const top = intel.trendSignals.slice(0, 3)
  return top.map(t => `${t.topic}(${t.direction}): ${t.description}`).join("; ")
}

/** 拼接竞对摘要为提示词（含clip截断） */
export function competitorSummaryForPrompt(customerId: string): string {
  const intel = competitorIntel[customerId]
  if (!intel || intel.competitors.length === 0) return ""
  const parts = intel.competitors.slice(0, 3).map(c => {
    const products = c.signatureProducts?.slice(0, 2).join("/") || ""
    const strength = c.strengths?.[0] || ""
    const pos = c.positioning?.slice(0, 30) || ""
    const detail = [products, strength, pos].filter(Boolean).join(", ")
    return detail ? `${c.name}(${detail})` : c.name
  }).join("; ")
  const summary = `竞对参考: ${parts}`
  return clip(summary, 200)
}
