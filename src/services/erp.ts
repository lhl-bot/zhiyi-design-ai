import type { CustomerTrend, ErpCustomerSummary, ErpStatus, IntelResult, ProductionFeasibility } from "../types"

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  const contentType = response.headers.get("content-type") ?? ""

  if (!response.ok) {
    // 尝试解析 JSON 错误体，失败则用状态码 + 响应文本前 200 字符
    let detail = `请求失败：${response.status}`
    if (contentType.includes("application/json")) {
      const body = await response.json().catch(() => null) as { detail?: string; error?: string } | null
      detail = body?.detail ?? body?.error ?? detail
    } else {
      const text = (await response.text().catch(() => "")).slice(0, 200)
      detail = `API 返回非 JSON 响应 (${response.status})：${text}`
    }
    throw new Error(detail)
  }

  // 即使 200 OK，也先校验 Content-Type，避免把 HTML 当 JSON 解析
  if (!contentType.includes("application/json")) {
    const preview = (await response.text().catch(() => "")).slice(0, 200)
    throw new Error(`API 返回了非 JSON 内容（Content-Type: ${contentType || "未知"}）。请确认后端服务是否正常。响应预览：${preview}`)
  }

  return response.json() as Promise<T>
}

export function fetchErpStatus() {
  return getJson<ErpStatus>("/api/erp/status")
}

export function fetchErpCustomerSummary(code: string) {
  return getJson<ErpCustomerSummary>(`/api/erp/customers/${encodeURIComponent(code)}/summary`)
}

export function fetchErpCustomerTrend(code: string) {
  return getJson<CustomerTrend>(`/api/erp/customers/${encodeURIComponent(code)}/trend`)
}

export async function fetchIntel(payload: {
  customerName: string
  brand?: string
  brandInfo?: unknown
  website?: string
  erp?: unknown
  apiKey?: string
  tavilyKey?: string
  intelSource?: "tavily" | "agent-reach" | "hybrid"
}): Promise<IntelResult> {
  const response = await fetch("/api/intel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  const body = (await response.json().catch(() => null)) as
    | { parsed?: IntelResult | null; raw?: string; detail?: string; error?: string }
    | null
  if (!response.ok) {
    throw new Error(body?.detail ?? body?.error ?? `分析失败：${response.status}`)
  }
  if (!body?.parsed) {
    throw new Error("模型未返回结构化结果，可重试一次")
  }
  return body.parsed
}

export async function fetchGenImages(payload: {
  prompt: string
  count: number
  size?: string
  seed?: number
  referenceImage?: string
  arkKey?: string
  customerId?: string
  customerName?: string
  title?: string
  lookMeta?: Record<string, unknown>
}): Promise<string[]> {
  const response = await fetch("/api/genimage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  const body = (await response.json().catch(() => null)) as
    | { images?: string[]; detail?: string; error?: string }
    | null
  if (!response.ok) {
    throw new Error(body?.detail ?? body?.error ?? `出图失败：${response.status}`)
  }
  return body?.images ?? []
}

// 删除已落地到后端磁盘的款式图（best-effort，失败也不影响前端删款）
export async function deleteSavedImage(image: string): Promise<void> {
  if (!image.startsWith("/api/img/")) return
  await fetch(image, { method: "DELETE" }).catch(() => undefined)
}

/** 后端已保存的图片元数据 */
export interface SavedImageMeta {
  file: string
  url: string
  createdAt: string | null
  prompt: string | null
  customerId: string | null
  customerName: string | null
  title: string | null
  score?: number | null
  trendScore?: number | null
  commercialScore?: number | null
  estimatedCost?: number | null
  sourceMode?: string | null
  selected?: boolean | null
  reviewStatus?: string | null
  note?: string | null
  palette?: string[] | null
  keyDetails?: string[] | null
  revisionAdvice?: string | null
  designDirection?: string | null
  version?: number | null
}

/** 获取后端所有已保存的图片及其元数据 */
export async function fetchSavedImages(): Promise<SavedImageMeta[]> {
  const response = await fetch("/api/img")
  const body = (await response.json().catch(() => null)) as
    | { ok?: boolean; images?: SavedImageMeta[]; detail?: string }
    | null
  if (!response.ok) {
    throw new Error(body?.detail ?? `获取已保存图片失败：${response.status}`)
  }
  return body?.images ?? []
}

/** 生产可行性分析 */
export function fetchProductionFeasibility(code: string) {
  return getJson<ProductionFeasibility>(`/api/erp/customers/${encodeURIComponent(code)}/production`)
}
