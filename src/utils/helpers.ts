import type { GeneratedLook } from "../types"
import { SCORE_THRESHOLD } from "../constants"

export type ReviewStatus = "待看" | "入选" | "待修改" | "淘汰"

export function reviewStatusOf(look: GeneratedLook): ReviewStatus {
  if (look.reviewStatus) return look.reviewStatus as ReviewStatus
  if (look.selected) return "入选"
  return look.score >= SCORE_THRESHOLD ? "待修改" : "待看"
}

export function statusTone(status: ReviewStatus): string {
  if (status === "入选") return "selected"
  if (status === "待修改") return "revise"
  if (status === "淘汰") return "reject"
  return "pending"
}

export function imageStatusMeta(look: GeneratedLook) {
  const status = look.imageStatus ?? "local-preview"
  const metas: Record<string, { label: string; tone: string }> = {
    "local-preview": { label: "本地预览", tone: "local" },
    "model-generating": { label: "大模型出图中", tone: "pending" },
    "model-ready": { label: "大模型已返回", tone: "ready" },
    "model-failed": { label: "大模型失败", tone: "failed" },
  }
  return metas[status]
}

export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return fallbackCopyText(text)
    }
  }
  return fallbackCopyText(text)
}

function fallbackCopyText(text: string): boolean {
  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "true")
  textarea.style.position = "fixed"
  textarea.style.left = "-9999px"
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand("copy")
  document.body.removeChild(textarea)
  return copied
}

export function srcClass(source: string): string {
  switch (source) {
    case "ERP": return "erp"
    case "示例": return "sample"
    case "官网": return "web"
    case "品牌": return "web"
    case "联网": return "live"
    case "AI": return "ai"
    default: return "muted"
  }
}

export function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

export function intelSourceLabel(source: string): string {
  if (source === "agent-reach") return "Agent-Reach 情报"
  if (source === "tavily") return "Tavily 实时联网"
  return "Agent-Reach + Tavily 混合情报"
}
