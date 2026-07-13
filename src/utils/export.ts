import type { CostEstimate, CustomerProfile, ErpCustomerSummary, GeneratedLook, TechPackData, UserReviewSignal } from "../types"
import { CATEGORY_REGEX, ACCESSORY_REGEX, FABRIC_REGEX, CRAFT_REGEX } from "../constants"
import { userReviewSignalsOf } from "./customerReviews"
import { competitorIntelOf } from "./competitorIntel"

/** HTML 实体转义，防止 XSS */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function escapeMarkdown(value: string) {
  return escapeHtml(value).replace(/\|/g, "\\|")
}

function reviewStatusText(status: UserReviewSignal["status"]) {
  if (status === "verified") return "已采集"
  if (status === "identity-only") return "已确认主体"
  return "待采集"
}

function reviewPromptWeightText(status: UserReviewSignal["status"]) {
  return status === "verified" ? "强约束辅助出图" : "弱约束辅助出图"
}

function formatReviewExport(customer: CustomerProfile) {
  const userReviews = userReviewSignalsOf(customer)
  if (!userReviews.length) return ""
  return `用户评价数据：${userReviews.map((review) => {
    const praise = review.praised.length ? review.praised.join("、") : "待采集真实商品评价"
    const pain = review.painPoints.length ? review.painPoints.join("、") : "待采集真实商品评价"
    const source = review.sourceUrl ? `${review.source} ${review.sourceUrl}` : review.source
    const channelTag = review.channel ? `[${review.channel}]` : ""
    return `${source}${channelTag}（${reviewStatusText(review.status)}，${reviewPromptWeightText(review.status)}，${review.sampleLabel}）；好评点：${praise}；痛点：${pain}；设计动作：${review.designAction}`
  }).join(" / ")}`
}

function formatCompetitorExport(customerId: string): string {
  const intel = competitorIntelOf(customerId)
  if (!intel || intel.competitors.length === 0) return ""

  const competitorLines = intel.competitors.map((c) =>
    `- **${c.name}**（${c.competitorType}）：${c.positioning}；价格带：${c.priceBand || "—"}；优势：${c.strengths.join("、")}；劣势：${c.weaknesses.join("、")}`
  )

  const trendLines = intel.trendSignals.length > 0
    ? [
        "",
        "### 趋势信号",
        ...intel.trendSignals.map((t) =>
          `- **${t.topic}** ${t.direction}：${t.description}${t.source ? `（来源：${t.source}）` : ""}`
        ),
      ]
    : []

  return [
    "## 竞对情报",
    "",
    `> 可信度：${intel.confidence}${intel.collectedAt ? `　|　采集于 ${intel.collectedAt}` : ""}${intel.source ? `　|　${intel.source}` : ""}`,
    "",
    "### 竞对品牌",
    ...competitorLines,
    ...trendLines,
  ].join("\n")
}

export function buildMarkdownExport({
  customer,
  looks
}: {
  customer: CustomerProfile
  looks: GeneratedLook[]
}) {
  const selectedLooks = looks.filter((look) => look.selected)
  const totalCost = looks.reduce((sum, look) => sum + look.estimatedCost, 0)
  const reviewLooks = looks.filter((look) => (look.reviewStatus ?? (look.selected ? "入选" : "待看")) !== "淘汰")
  const reviewExport = formatReviewExport(customer)
  const competitorExport = formatCompetitorExport(customer.id)

  const sections = [
    `# ${customer.name} 设计评审包`,
    "",
    `生成时间：${new Date().toLocaleString("zh-CN", { hour12: false })}`,
    `客户定位：${customer.positioning}`,
    `风格标签：${customer.styleTags.join("、")}`,
    `趋势判断：${customer.trendPrediction}`,
    reviewExport,
    `本批生成数量：${looks.length}`,
    `已筛选款式：${selectedLooks.length}`,
    `预估API成本：¥${totalCost.toFixed(2)}`,
    "",
    "## 评审汇总",
    "",
    "| 款式 | 状态 | 匹配分 | 来源 | 修改意见 | 设计师备注 |",
    "| --- | --- | ---: | --- | --- | --- |",
    ...looks.map((look) => `| ${escapeMarkdown(look.title)} | ${look.reviewStatus ?? (look.selected ? "入选" : "待看")} | ${look.score} | ${look.sourceMode} | ${escapeMarkdown(look.modificationNote || "—")} | ${escapeMarkdown(look.note || "待补充")} |`),
    "",
    "## 入选 / 待修改款式单",
    "",
    ...reviewLooks.map((look) => `### ${look.title}
- 评审状态：${look.reviewStatus ?? (look.selected ? "入选" : "待看")}
- 趋势分：${look.trendScore}
- 商业分：${look.commercialScore}
- 配色：${look.palette.join("、")}
- 面料建议：${suggestFabrics(customer, look).join("、")}
- 关键细节：${look.keyDetails.join("、")}
- 成本估算：¥${look.estimatedCost.toFixed(2)}（API）；FOB 需以工艺单成本核算为准
- 修改意见：${look.modificationNote || "—"}
- 修改建议：${look.revisionAdvice}`),
    "",
    "## 生成提示词",
    "",
    ...looks.map((look, index) => `${index + 1}. ${look.prompt}`),
    "",
  ]

  if (competitorExport) {
    sections.push(competitorExport, "")
  }

  return sections.join("\n")
}

function suggestFabrics(customer: CustomerProfile, look: GeneratedLook): string[] {
  const fromCustomer = customer.fabricPreference.split(/[、,，；;]/).map((item) => item.trim()).filter(Boolean)
  const fromDetails = look.keyDetails.filter((item) => FABRIC_REGEX.test(item))
  return [...new Set([...fromDetails, ...fromCustomer, ...customer.erpInsight.materialFocus])].slice(0, 4)
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

// ─── 后端 Excel / PDF 下载 ───

/**
 * 从后端下载 Excel 文件
 * @param type "design-review" | "tech-pack"
 * @param payload 请求体
 */
export async function downloadExcel(
  type: "design-review" | "tech-pack",
  payload: Record<string, unknown>
): Promise<boolean> {
  try {
    const res = await fetch("/api/export/excel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...payload }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    downloadBlob(blob, getFilename(type, payload, "xlsx"))
    return true
  } catch (err) {
    console.error("Excel download failed:", err)
    alert("Excel 导出失败，请确认后端服务已启动。")
    return false
  }
}

/**
 * 从后端下载 PDF 文件
 * @param type "design-review" | "tech-pack"
 * @param payload 请求体
 */
export async function downloadPDF(
  type: "design-review" | "tech-pack",
  payload: Record<string, unknown>
): Promise<boolean> {
  try {
    const res = await fetch("/api/export/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...payload }),
    })
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || `HTTP ${res.status}`)
    }
    const blob = await res.blob()
    downloadBlob(blob, getFilename(type, payload, "pdf"))
    return true
  } catch (err) {
    console.error("PDF download failed:", err)
    const msg = err instanceof Error ? err.message : "未知错误"
    alert(`PDF 导出失败：${msg}\n\n请确认后端已安装 Chromium（puppeteer 依赖）。`)
    return false
  }
}

function getFilename(type: string, payload: Record<string, unknown>, ext: string) {
  const now = new Date().toISOString().slice(0, 10)
  const customerName = (payload.customer as { name?: string })?.name || ""
  const lookTitle = (payload.look as { title?: string })?.title || ""
  if (type === "tech-pack") return `工艺单_${lookTitle}_${now}.${ext}`
  return `设计评审_${customerName}_${now}.${ext}`
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function buildTechPackMarkdown(look: GeneratedLook, customer: CustomerProfile, erpSummary?: ErpCustomerSummary): string {
  const now = new Date().toLocaleString("zh-CN", { hour12: false })
  const category = look.keyDetails.find((d) => CATEGORY_REGEX.test(d)) || look.title

  // 优先用 ERP 真实面料数据，回退到客户画像 + 关键词提取
  const erpFabrics = erpSummary?.topFabrics?.map((f) => f.name) ?? []
  const seededFabrics = [
    customer.fabricPreference.split(/[、,，]/).filter(Boolean).slice(0, 3).join("、"),
    customer.erpInsight?.materialFocus?.join("、") || "",
  ].filter(Boolean)
  const fabrics = erpFabrics.length >= 2
    ? erpFabrics.slice(0, 4)
    : seededFabrics.length ? seededFabrics : ["按客户面料偏好"]

  const accessories = [
    ...look.keyDetails.filter((d) => ACCESSORY_REGEX.test(d)),
    ...(erpSummary?.topAccessories?.map((a) => a.name) ?? []).slice(0, 3),
  ]

  const constructionNotes = [
    ...look.keyDetails.filter((d) => CRAFT_REGEX.test(d)),
    customer.erpInsight?.craftFocus?.join("、") || "",
  ].filter(Boolean)

  // 客户化尺寸表：从 ERP 历史订单中提取常用尺码区间
  const sizeChart = erpSummary?.recentOrders?.length
    ? buildCustomerSizeChart(erpSummary.recentOrders)
    : [
        { size: "S", chest: "92", length: "64", shoulder: "38", sleeve: "56" },
        { size: "M", chest: "96", length: "65", shoulder: "39", sleeve: "57" },
        { size: "L", chest: "100", length: "66", shoulder: "40", sleeve: "58" },
        { size: "XL", chest: "104", length: "67", shoulder: "41", sleeve: "59" },
        { size: "XXL", chest: "108", length: "68", shoulder: "42", sleeve: "60" },
      ]

  const data: TechPackData = {
    styleName: look.title,
    customerName: customer.name,
    season: look.sourceMode === "线稿图" ? "技术线稿" : customer.trendPrediction.slice(0, 20),
    category,
    designDirection: look.designDirection || look.revisionAdvice,
    palette: look.palette,
    keyDetails: look.keyDetails,
    fabrics: fabrics.length ? fabrics : ["按客户面料偏好"],
    accessories: accessories.length ? accessories : ["按客户辅料标准"],
    constructionNotes: constructionNotes.length ? constructionNotes : ["按品牌工艺标准"],
    sizeChart,
    packagingNotes: "独立PE袋包装，12件/箱，按客户贴标要求执行。",
  }

  return [
    `# Tech Pack — ${data.styleName}`,
    "",
    `> 生成时间：${now}　|　客户：${data.customerName}　|　品类：${data.category}`,
    "",
    "## 1. 款式信息",
    "",
    `| 项目 | 内容 |`,
    `| --- | --- |`,
    `| 款名 | ${escapeMarkdown(data.styleName)} |`,
    `| 客户 | ${data.customerName} |`,
    `| 品类 | ${data.category} |`,
    `| 季节/趋势 | ${data.season} |`,
    `| 综合评分 | ${look.score}（趋势 ${look.trendScore} / 商业 ${look.commercialScore}） |`,
    `| 来源模式 | ${look.sourceMode} |`,
    `| 评审状态 | ${look.reviewStatus ?? (look.selected ? "入选" : "待看")} |`,
    `| 版本 | V${look.version ?? 1}${look.parentId ? "（基于迭代）" : ""} |`,
    "",
    "## 2. 设计方向",
    "",
    data.designDirection,
    look.modificationNote ? `\n设计师修改意见：${look.modificationNote}` : "",
    "",
    "## 3. 配色方案",
    "",
    "| 序号 | 色值 | 用途 |",
    "| ---: | --- | --- |",
    ...data.palette.map((color, i) => `| ${i + 1} | ${color} | ${i === 0 ? "主色调" : i === 1 ? "辅助色" : "点缀色"} |`),
    "",
    "## 4. 面料清单",
    "",
    "| 序号 | 面料 | 用途 |",
    "| ---: | --- | --- |",
    ...data.fabrics.map((f, i) => `| ${i + 1} | ${escapeMarkdown(f)} | ${i === 0 ? "主面料" : "拼接/里布"} |`),
    "",
    "## 5. 辅料清单",
    "",
    "| 序号 | 辅料 | 规格 |",
    "| ---: | --- | --- |",
    ...data.accessories.map((a, i) => `| ${i + 1} | ${escapeMarkdown(a)} | 按品牌标准 |`),
    "",
    "## 6. 工艺要求",
    "",
    ...data.constructionNotes.map((c, i) => `${i + 1}. ${escapeMarkdown(c)}`),
    "",
    "## 7. 关键设计细节",
    "",
    ...data.keyDetails.map((d, i) => `- ${escapeMarkdown(d)}`),
    "",
    "## 8. 参考尺寸表（cm）",
    "",
    "> 注意：以下为参考基码尺寸，实际需根据客户尺码表调整。",
    "",
    "| 码数 | 胸围 | 衣长 | 肩宽 | 袖长 |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...data.sizeChart.map((s) => `| ${s.size} | ${s.chest} | ${s.length} | ${s.shoulder} | ${s.sleeve} |`),
    "",
    "## 9. 包装与交付",
    "",
    data.packagingNotes,
    "",
    "---",
    "",
    `*本 Tech Pack 由 AI 服装定向设计系统自动生成，供版师和工厂参考。实际生产前需设计师审核确认。*`,
    "",
  ].join("\n")
}

function buildCustomerSizeChart(
  orders: Array<Record<string, string | number | null>>
): { size: string; chest: string; length: string; shoulder: string; sleeve: string }[] {
  const sizes = new Map<string, { chest: number[]; length: number[]; shoulder: number[]; sleeve: number[] }>()
  for (const o of orders) {
    const size = String(o.Size || o.SizeCode || o.SKU || "")
    const chest = Number(o.Chest || o.Bust)
    const length = Number(o.Length || o.BodyLength)
    const shoulder = Number(o.Shoulder)
    const sleeve = Number(o.Sleeve)
    if (!size || isNaN(chest) || isNaN(length)) continue
    if (!sizes.has(size)) sizes.set(size, { chest: [], length: [], shoulder: [], sleeve: [] })
    const entry = sizes.get(size)!
    entry.chest.push(chest)
    entry.length.push(length)
    if (!isNaN(shoulder)) entry.shoulder.push(shoulder)
    if (!isNaN(sleeve)) entry.sleeve.push(sleeve)
  }
  if (sizes.size === 0) return [
    { size: "S", chest: "92", length: "64", shoulder: "38", sleeve: "56" },
    { size: "M", chest: "96", length: "65", shoulder: "39", sleeve: "57" },
    { size: "L", chest: "100", length: "66", shoulder: "40", sleeve: "58" },
  ]
  const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
  return [...sizes.entries()]
    .slice(0, 6)
    .map(([size, v]) => ({
      size,
      chest: String(avg(v.chest)),
      length: String(avg(v.length)),
      shoulder: v.shoulder.length ? String(avg(v.shoulder)) : "38",
      sleeve: v.sleeve.length ? String(avg(v.sleeve)) : "58",
    }))
}

// ─── PDF 导出（专业版工艺单）─────────────────────────────────────────────────
export function exportTechPackPDF(
  look: GeneratedLook,
  customer: CustomerProfile,
  erpSummary?: ErpCustomerSummary,
  cost?: CostEstimate
) {
  const now = new Date()
  const dateStr = now.toLocaleDateString("zh-CN")
  const timeStr = now.toLocaleTimeString("zh-CN", { hour12: false })
  const tpNo = `TP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`

  const category = look.keyDetails.find((d) => CATEGORY_REGEX.test(d)) || look.title
  const season = customer.trendPrediction?.slice(0, 30) || "—"

  // 面料
  const erpFabrics = erpSummary?.topFabrics?.map((f) => f.name) ?? []
  const seededFabrics = [
    customer.fabricPreference.split(/[、,，]/).filter(Boolean).slice(0, 3).join("、"),
    customer.erpInsight?.materialFocus?.join("、") || "",
  ].filter(Boolean)
  const fabrics = erpFabrics.length >= 2 ? erpFabrics.slice(0, 5) : seededFabrics.length ? seededFabrics : ["按客户面料偏好"]

  // 辅料
  const accessories = [
    ...look.keyDetails.filter((d) => ACCESSORY_REGEX.test(d)),
    ...(erpSummary?.topAccessories?.map((a) => a.name) ?? []).slice(0, 4),
  ].slice(0, 6)

  if (accessories.length === 0) accessories.push("按客户辅料标准")

  // 工艺
  const constructionNotes = [
    ...look.keyDetails.filter((d) => CRAFT_REGEX.test(d)),
    customer.erpInsight?.craftFocus?.join("、") || "",
  ].filter(Boolean)
  if (constructionNotes.length === 0) constructionNotes.push("按品牌工艺标准执行")

  // 尺寸表
  const sizeChart = erpSummary?.recentOrders?.length
    ? buildCustomerSizeChart(erpSummary.recentOrders)
    : [
        { size: "S", chest: "92", length: "64", shoulder: "38", sleeve: "56" },
        { size: "M", chest: "96", length: "65", shoulder: "39", sleeve: "57" },
        { size: "L", chest: "100", length: "66", shoulder: "40", sleeve: "58" },
        { size: "XL", chest: "104", length: "67", shoulder: "41", sleeve: "59" },
        { size: "XXL", chest: "108", length: "68", shoulder: "42", sleeve: "60" },
      ]

  // 配色色块渲染
  const paletteSwatches = look.palette.map(
    (c, i) =>
      `<div class="swatch-item"><div class="swatch-box" style="background:${c}"></div><span>${c}</span><small>${i === 0 ? "主色" : i === 1 ? "辅色" : "点缀"}</small></div>`
  ).join("")

  // 成本行
  const costRows = cost
    ? `<tr><td class="lbl">面料成本</td><td>$${cost.fabricCost.toFixed(2)}</td><td class="lbl">辅料成本</td><td>$${cost.accessoryCost.toFixed(2)}</td></tr>
       <tr><td class="lbl">工时成本</td><td>$${cost.laborCost.toFixed(2)}</td><td class="lbl">包装杂费</td><td>$${cost.overhead.toFixed(2)}</td></tr>
       <tr><td class="lbl">复杂度</td><td>${cost.complexity.toFixed(2)}×</td><td class="lbl"><b>估算 FOB</b></td><td><b>$${cost.fobLow.toFixed(2)} ~ $${cost.fobHigh.toFixed(2)}</b></td></tr>
       ${cost.historicalMin ? `<tr><td class="lbl">ERP 历史区间</td><td>$${cost.historicalMin} ~ $${cost.historicalMax}</td><td></td><td></td></tr>` : ""}`
    : ""

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>工艺单 — ${escapeHtml(look.title)} — ${escapeHtml(customer.name)}</title>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Source Han Sans CN", "Microsoft YaHei", "PingFang SC", sans-serif;
    font-size: 9px;
    color: #1a1a1a;
    line-height: 1.4;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: 281mm;
    min-height: 194mm;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    grid-template-rows: auto auto 1fr auto auto;
    gap: 3px;
    padding: 3px;
  }
  /* ── 区块 ── */
  .block {
    border: 1px solid #333;
    padding: 4px 5px;
  }
  .block.full { grid-column: 1 / -1; }
  .block.span2 { grid-column: span 2; }
  .block-title {
    font-size: 10px;
    font-weight: 700;
    border-bottom: 1px solid #333;
    padding-bottom: 2px;
    margin-bottom: 4px;
    letter-spacing: 0.05em;
  }
  /* ── Header ── */
  .tp-header { display: flex; align-items: center; gap: 8px; }
  .tp-logo { font-size: 22px; font-weight: 900; letter-spacing: 0.08em; color: #5C4A36; }
  .tp-title { font-size: 14px; font-weight: 700; }
  .tp-meta { display: flex; gap: 14px; flex-wrap: wrap; font-size: 9px; }
  .tp-meta span { white-space: nowrap; }
  .tp-meta b { display: inline-block; min-width: 38px; color: #555; }
  /* ── Table ── */
  table { width: 100%; border-collapse: collapse; font-size: 8.5px; }
  th, td { border: 1px solid #999; padding: 2.5px 4px; text-align: center; }
  th { background: #e8e4dc; font-weight: 700; }
  .lbl { text-align: left; font-weight: 600; background: #f5f3ee; }
  td.lbl { background: #f5f3ee; }
  /* ── Sketch ── */
  .sketch-area {
    display: flex; align-items: center; justify-content: center;
    min-height: 140px; background: #fafaf8;
    overflow: hidden;
  }
  .sketch-area img {
    max-width: 100%; max-height: 200px; object-fit: contain;
    display: block;
  }
  .sketch-placeholder {
    color: #bbb; font-size: 12px; text-align: center;
    padding: 30px;
  }
  /* ── Swatches ── */
  .swatch-row { display: flex; gap: 6px; flex-wrap: wrap; }
  .swatch-item { text-align: center; }
  .swatch-box {
    width: 32px; height: 18px; border: 1px solid #999;
    border-radius: 2px; margin-bottom: 2px;
  }
  .swatch-item span { display: block; font-size: 7.5px; font-weight: 600; }
  .swatch-item small { display: block; font-size: 7px; color: #888; }
  /* ── Detail tags ── */
  .detail-list { display: flex; flex-wrap: wrap; gap: 3px; }
  .detail-tag {
    padding: 1px 5px; border: 1px solid #ccc; border-radius: 2px;
    font-size: 7.5px; background: #fafaf7;
  }
  /* ── Approval ── */
  .approval-row { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 3px; }
  .approval-cell { border: 1px solid #ccc; padding: 6px 8px; text-align: center; font-size: 8px; }
  .approval-cell .sig-line { border-bottom: 1px solid #333; margin: 10px 0 3px; }
  .foot-note { font-size: 7.5px; color: #999; text-align: right; padding-top: 2px; }
</style>
</head>
<body>
<div class="page">

  <!-- ═══ 头部信息 ═══ -->
  <div class="block full tp-header">
    <div class="tp-logo">三时集团</div>
    <div style="flex:1">
      <div class="tp-title">服装生产工艺单 / Tech Pack</div>
      <div class="tp-meta">
        <span><b>工艺单号：</b>${tpNo}</span>
        <span><b>日期：</b>${dateStr}</span>
        <span><b>客户：</b>${customer.name}</span>
        <span><b>市场：</b>${customer.market}</span>
      </div>
    </div>
  </div>

  <!-- ═══ 款式基本信息 ═══ -->
  <div class="block">
    <div class="block-title">款式信息</div>
    <table>
      <tr><td class="lbl">款名</td><td>${look.title}</td></tr>
      <tr><td class="lbl">品类</td><td>${category}</td></tr>
      <tr><td class="lbl">季节</td><td>${season}</td></tr>
      <tr><td class="lbl">来源模式</td><td>${look.sourceMode}</td></tr>
      <tr><td class="lbl">综合评分</td><td>${look.score} 分（趋势 ${look.trendScore} / 商业 ${look.commercialScore}）</td></tr>
      <tr><td class="lbl">版本</td><td>V${look.version ?? 1}${look.parentId ? " (迭代款)" : ""}</td></tr>
    </table>
  </div>

  <!-- ═══ 配色方案 ═══ -->
  <div class="block">
    <div class="block-title">配色方案</div>
    <div class="swatch-row">${paletteSwatches || '<span style="color:#999;font-size:9px">待补充配色</span>'}</div>
  </div>

  <!-- ═══ 款式图 ═══ -->
  <div class="block span2" style="grid-row: span 2;">
    <div class="block-title">款式图 / 效果图</div>
    <div class="sketch-area">
      ${look.image && !look.image.startsWith("data:image/svg")
        ? `<img src="${escapeHtml(look.image)}" alt="${escapeHtml(look.title)}" />`
        : `<div class="sketch-placeholder">请在此处粘贴款式效果图<br>（正面 / 背面）</div>`
      }
    </div>
  </div>

  <!-- ═══ 设计细节 ═══ -->
  <div class="block">
    <div class="block-title">关键设计细节</div>
    <div class="detail-list">
      ${look.keyDetails.map((d) => `<span class="detail-tag">${d}</span>`).join("")}
    </div>
    ${look.revisionAdvice ? `<p style="margin-top:4px;font-size:8px;color:#666">修改建议：${escapeHtml(look.revisionAdvice.slice(0, 120))}</p>` : ""}
  </div>

  <!-- ═══ 面料清单 ═══ -->
  <div class="block">
    <div class="block-title">面料清单</div>
    <table>
      <tr><th>序号</th><th>面料名称</th><th>用途</th></tr>
      ${fabrics.map((f, i) => `<tr><td>${i + 1}</td><td>${f}</td><td>${i === 0 ? "主面料" : i === 1 ? "里布 / 拼接" : "部件"}</td></tr>`).join("")}
    </table>
  </div>

  <!-- ═══ 辅料清单 ═══ -->
  <div class="block">
    <div class="block-title">辅料清单</div>
    <table>
      <tr><th>序号</th><th>辅料名称</th><th>规格说明</th></tr>
      ${accessories.map((a, i) => `<tr><td>${i + 1}</td><td>${a}</td><td>按品牌标准</td></tr>`).join("")}
    </table>
  </div>

  <!-- ═══ 尺寸表 ═══ -->
  <div class="block">
    <div class="block-title">参考尺寸表（单位：cm）</div>
    <table>
      <tr><th>码数</th><th>胸围</th><th>衣长</th><th>肩宽</th><th>袖长</th></tr>
      ${sizeChart.map((s) => `<tr><td><b>${s.size}</b></td><td>${s.chest}</td><td>${s.length}</td><td>${s.shoulder}</td><td>${s.sleeve}</td></tr>`).join("")}
    </table>
    <p style="font-size:7px;color:#999;margin-top:2px">※ 以上为参考基码尺寸，实际生产需根据客户尺码表调整。</p>
  </div>

  <!-- ═══ 工艺要求 ═══ -->
  <div class="block">
    <div class="block-title">工艺要求</div>
    <table>
      <tr><th>序号</th><th>工艺项</th><th>要求</th></tr>
      ${constructionNotes.map((c, i) => `<tr><td>${i + 1}</td><td>${c.slice(0, 20)}</td><td>按品牌标准</td></tr>`).join("")}
    </table>
  </div>

  <!-- ═══ 成本估算 ═══ -->
  <div class="block">
    <div class="block-title">成本估算（USD）</div>
    ${costRows
      ? `<table><tr><th>项目</th><th>金额</th><th>项目</th><th>金额</th></tr>${costRows}</table>`
      : `<p style="font-size:9px;color:#999">成本估算需在生成款式后自动计算。</p>`
    }
  </div>

  <!-- ═══ 包装与交付 ═══ -->
  <div class="block">
    <div class="block-title">包装与交付</div>
    <table>
      <tr><td class="lbl">包装方式</td><td>独立 PE 袋包装，12 件/箱</td></tr>
      <tr><td class="lbl">吊牌/标签</td><td>按客户品牌吊牌及洗水唛要求执行</td></tr>
      <tr><td class="lbl">出货港口</td><td>FOB 上海 / 宁波</td></tr>
      <tr><td class="lbl">交期</td><td>确认产前样后 35-45 天</td></tr>
    </table>
  </div>

  <!-- ═══ 审批签名 ═══ -->
  <div class="block full">
    <div class="block-title">审批栏</div>
    <div class="approval-row">
      <div class="approval-cell"><b>设计师</b><div class="sig-line"></div><span>日期：____/____/____</span></div>
      <div class="approval-cell"><b>版师确认</b><div class="sig-line"></div><span>日期：____/____/____</span></div>
      <div class="approval-cell"><b>生产审核</b><div class="sig-line"></div><span>日期：____/____/____</span></div>
      <div class="approval-cell"><b>客户确认</b><div class="sig-line"></div><span>日期：____/____/____</span></div>
    </div>
  </div>

  <!-- ═══ 脚注 ═══ -->
  <div class="block full foot-note">
    本工艺单由 智衣Design AI 服装定向设计系统自动生成 · ${dateStr} ${timeStr} · 生产前需设计师审核确认
  </div>

</div>
<script>window.onload=function(){window.print()}</script>
</body>
</html>`

  const win = window.open("", "_blank", "width=1100,height=800")
  if (!win) return
  win.document.write(html)
  win.document.close()
}
