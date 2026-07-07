// ─── PDF 导出模块 ───
// 使用 puppeteer 渲染 HTML 模板 → 生成 PDF 工艺单 / 设计评审包
import puppeteer from "puppeteer"

/**
 * 生成工艺单 PDF
 * @param {{ look: object, customer: object, erpSummary?: object, cost?: object }} params
 * @returns {Promise<Buffer>} PDF Buffer
 */
export async function generateTechPackPDF({ look, customer, erpSummary, cost }) {
  const html = buildTechPackHTML({ look, customer, erpSummary, cost })
  return renderPDF(html, { landscape: true })
}

/**
 * 生成设计评审包 PDF
 * @param {{ customer: object, looks: object[] }} params
 * @returns {Promise<Buffer>} PDF Buffer
 */
export async function generateDesignReviewPDF({ customer, looks }) {
  const html = buildDesignReviewHTML({ customer, looks })
  return renderPDF(html, { landscape: false })
}

/**
 * 核心：puppeteer 渲染 HTML → PDF
 */
async function renderPDF(html, { landscape } = {}) {
  let browser
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    })
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 })
    const pdf = await page.pdf({
      format: "A4",
      landscape: !!landscape,
      margin: { top: "8mm", right: "8mm", bottom: "8mm", left: "8mm" },
      printBackground: true,
      preferCSSPageSize: true,
    })
    return Buffer.from(pdf)
  } finally {
    if (browser) {
      try { await browser.close() } catch { /* ignore */ }
    }
  }
}

// ════════════════════════════════════════
//  HTML 模板
// ════════════════════════════════════════

function buildTechPackHTML({ look, customer, erpSummary, cost }) {
  const now = new Date()
  const dateStr = now.toLocaleDateString("zh-CN")
  const tpNo = `TP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`

  const category = look.keyDetails?.find((d) => /外套|夹克|大衣|风衣|西装|马甲|连衣裙|衬衫|裤|套装|卫衣/.test(d)) || look.title
  const season = customer.trendPrediction?.slice(0, 30) || "-"

  // 面料
  const erpFabrics = erpSummary?.topFabrics?.map((f) => f.name) ?? []
  const seededFabrics = customer.fabricPreference?.split(/[、,，]/).filter(Boolean).slice(0, 3).join("、") || ""
  const fabrics = erpFabrics.length >= 2 ? erpFabrics.slice(0, 5) : seededFabrics ? [seededFabrics] : ["按客户面料偏好"]

  // 辅料
  const accessories = [
    ...(look.keyDetails || []).filter((d) => /扣|拉链|按扣|盘扣|磁吸|扣件|辅料|吊牌|拉绳|绳|袢|环|织带/.test(d)),
    ...(erpSummary?.topAccessories?.map((a) => a.name) ?? []).slice(0, 4),
  ].slice(0, 6)
  if (!accessories.length) accessories.push("按客户辅料标准")

  // 工艺
  const constructionNotes = [
    ...(look.keyDetails || []).filter((d) => /缝|包边|滚边|压胶|拼接|打枣|车缝|明线|暗线|锁链|贴边|对格|对条/.test(d)),
    customer.erpInsight?.craftFocus?.join("、") || "",
  ].filter(Boolean)
  if (!constructionNotes.length) constructionNotes.push("按品牌工艺标准执行")

  // 配色
  const paletteSwatches = (look.palette || []).map((c, i) =>
    `<div class="swatch-item"><div class="swatch-box" style="background:${c}"></div><span>${c}</span><small>${i === 0 ? "主色" : i === 1 ? "辅色" : "点缀"}</small></div>`
  ).join("")

  // 尺寸表
  const sizeChart = [
    { size: "S", chest: "92", length: "64", shoulder: "38", sleeve: "56" },
    { size: "M", chest: "96", length: "65", shoulder: "39", sleeve: "57" },
    { size: "L", chest: "100", length: "66", shoulder: "40", sleeve: "58" },
    { size: "XL", chest: "104", length: "67", shoulder: "41", sleeve: "59" },
    { size: "XXL", chest: "108", length: "68", shoulder: "42", sleeve: "60" },
  ]

  // 成本行
  const costRows = cost
    ? `<tr><td class="lbl">面料成本</td><td>$${cost.fabricCost?.toFixed(2) || "-"}</td><td class="lbl">辅料成本</td><td>$${cost.accessoryCost?.toFixed(2) || "-"}</td></tr>
       <tr><td class="lbl">工时成本</td><td>$${cost.laborCost?.toFixed(2) || "-"}</td><td class="lbl">包装杂费</td><td>$${cost.overhead?.toFixed(2) || "-"}</td></tr>
       <tr><td class="lbl">复杂度</td><td>${cost.complexity?.toFixed(2) || "-"}×</td><td class="lbl"><b>估算 FOB</b></td><td><b>$${cost.fobLow?.toFixed(2)} ~ $${cost.fobHigh?.toFixed(2)}</b></td></tr>
       ${cost.historicalMin ? `<tr><td class="lbl">ERP 历史区间</td><td>$${cost.historicalMin} ~ $${cost.historicalMax}</td><td></td><td></td></tr>` : ""}`
    : ""

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>工艺单 — ${look.title}</title>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
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
    grid-template-rows: auto auto 1fr auto;
    gap: 3px;
    padding: 3px;
  }
  .block { border: 1px solid #333; padding: 4px 5px; }
  .block.full { grid-column: 1 / -1; }
  .block.span2 { grid-column: span 2; }
  .block-title {
    font-size: 10px; font-weight: 700;
    border-bottom: 1px solid #333;
    padding-bottom: 2px; margin-bottom: 4px;
    letter-spacing: 0.05em;
  }
  .tp-header { display: flex; align-items: center; gap: 8px; }
  .tp-logo { font-size: 22px; font-weight: 900; letter-spacing: 0.08em; color: #5C4A36; }
  .tp-title { font-size: 14px; font-weight: 700; }
  .tp-meta { display: flex; gap: 14px; flex-wrap: wrap; font-size: 9px; }
  .tp-meta b { display: inline-block; min-width: 38px; color: #555; }
  table { width: 100%; border-collapse: collapse; font-size: 8.5px; }
  th, td { border: 1px solid #999; padding: 2.5px 4px; text-align: center; }
  th { background: #e8e4dc; font-weight: 700; }
  .lbl { text-align: left; font-weight: 600; background: #f5f3ee; }
  .sketch-area {
    display: flex; align-items: center; justify-content: center;
    min-height: 140px; background: #fafaf8; overflow: hidden;
  }
  .sketch-area img { max-width: 100%; max-height: 200px; object-fit: contain; }
  .swatch-row { display: flex; gap: 6px; flex-wrap: wrap; }
  .swatch-item { text-align: center; }
  .swatch-box { width: 32px; height: 18px; border: 1px solid #999; border-radius: 2px; margin-bottom: 2px; }
  .swatch-item span { display: block; font-size: 7.5px; font-weight: 600; }
  .swatch-item small { display: block; font-size: 7px; color: #888; }
  .detail-list { display: flex; flex-wrap: wrap; gap: 3px; }
  .detail-tag { padding: 1px 5px; border: 1px solid #ccc; border-radius: 2px; font-size: 7.5px; background: #fafaf7; }
  .approval-row { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 3px; }
  .approval-cell { border: 1px solid #ccc; padding: 6px 8px; text-align: center; font-size: 8px; }
  .approval-cell .sig-line { border-bottom: 1px solid #333; margin: 10px 0 3px; }
  .foot-note { font-size: 7.5px; color: #999; text-align: right; padding-top: 2px; }
</style>
</head>
<body>
<div class="page">
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

  <div class="block">
    <div class="block-title">款式信息</div>
    <table>
      <tr><td class="lbl">款名</td><td>${look.title}</td></tr>
      <tr><td class="lbl">品类</td><td>${category}</td></tr>
      <tr><td class="lbl">季节</td><td>${season}</td></tr>
      <tr><td class="lbl">来源</td><td>${look.sourceMode}</td></tr>
      <tr><td class="lbl">评分</td><td>${look.score}（趋势 ${look.trendScore} / 商业 ${look.commercialScore}）</td></tr>
      <tr><td class="lbl">版本</td><td>V${look.version ?? 1}${look.parentId ? " (迭代款)" : ""}</td></tr>
    </table>
  </div>

  <div class="block">
    <div class="block-title">配色方案</div>
    <div class="swatch-row">${paletteSwatches || '<span style="color:#999;font-size:9px">待补充配色</span>'}</div>
  </div>

  <div class="block span2" style="grid-row: span 2;">
    <div class="block-title">款式图 / 效果图</div>
    <div class="sketch-area">
      ${look.image
        ? `<img src="${look.image}" alt="${look.title}" />`
        : '<div class="sketch-placeholder" style="color:#bbb;font-size:12px;text-align:center;padding:50px 30px">款式效果图<br>（正面 / 背面）</div>'
      }
    </div>
  </div>

  <div class="block">
    <div class="block-title">关键设计细节</div>
    <div class="detail-list">
      ${(look.keyDetails || []).map((d) => `<span class="detail-tag">${d}</span>`).join("")}
    </div>
    ${look.revisionAdvice ? `<p style="margin-top:4px;font-size:8px;color:#666">修改建议：${look.revisionAdvice.slice(0, 120)}</p>` : ""}
  </div>

  <div class="block">
    <div class="block-title">面料清单</div>
    <table>
      <tr><th>#</th><th>面料</th><th>用途</th></tr>
      ${fabrics.map((f, i) => `<tr><td>${i + 1}</td><td>${f}</td><td>${i === 0 ? "主面料" : i === 1 ? "里布/拼接" : "部件"}</td></tr>`).join("")}
    </table>
  </div>

  <div class="block">
    <div class="block-title">辅料清单</div>
    <table>
      <tr><th>#</th><th>辅料</th><th>规格</th></tr>
      ${accessories.map((a, i) => `<tr><td>${i + 1}</td><td>${a}</td><td>按品牌标准</td></tr>`).join("")}
    </table>
  </div>

  <div class="block">
    <div class="block-title">参考尺寸表（cm）</div>
    <table>
      <tr><th>码数</th><th>胸围</th><th>衣长</th><th>肩宽</th><th>袖长</th></tr>
      ${sizeChart.map((s) => `<tr><td><b>${s.size}</b></td><td>${s.chest}</td><td>${s.length}</td><td>${s.shoulder}</td><td>${s.sleeve}</td></tr>`).join("")}
    </table>
    <p style="font-size:7px;color:#999;margin-top:2px">※ 参考基码尺寸，实际需按客户尺码表调整</p>
  </div>

  <div class="block">
    <div class="block-title">工艺要求</div>
    <table>
      <tr><th>#</th><th>工艺项</th><th>要求</th></tr>
      ${constructionNotes.map((c, i) => `<tr><td>${i + 1}</td><td>${c.slice(0, 20)}</td><td>按品牌标准</td></tr>`).join("")}
    </table>
  </div>

  ${cost ? `
  <div class="block">
    <div class="block-title">成本估算（USD）</div>
    <table>
      <tr><th>项目</th><th>金额</th><th>项目</th><th>金额</th></tr>
      ${costRows}
    </table>
  </div>` : ""}

  <div class="block">
    <div class="block-title">包装与交付</div>
    <table>
      <tr><td class="lbl">包装方式</td><td>独立 PE 袋，12 件/箱</td></tr>
      <tr><td class="lbl">吊牌/标签</td><td>按客户品牌吊牌及洗水唛要求执行</td></tr>
      <tr><td class="lbl">出货港口</td><td>FOB 上海 / 宁波</td></tr>
      <tr><td class="lbl">交期</td><td>确认产前样后 35-45 天</td></tr>
    </table>
  </div>

  <div class="block full">
    <div class="block-title">审批栏</div>
    <div class="approval-row">
      <div class="approval-cell"><b>设计师</b><div class="sig-line"></div><span>日期：____/____/____</span></div>
      <div class="approval-cell"><b>版师确认</b><div class="sig-line"></div><span>日期：____/____/____</span></div>
      <div class="approval-cell"><b>生产审核</b><div class="sig-line"></div><span>日期：____/____/____</span></div>
      <div class="approval-cell"><b>客户确认</b><div class="sig-line"></div><span>日期：____/____/____</span></div>
    </div>
  </div>

  <div class="block full foot-note">
    本工艺单由 智衣Design AI 自动生成 · ${dateStr} · 生产前需设计师审核确认
  </div>
</div>
</body>
</html>`
}

function buildDesignReviewHTML({ customer, looks }) {
  const now = new Date()
  const dateStr = now.toLocaleDateString("zh-CN")
  const selectedLooks = looks.filter((l) => l.selected)
  const reviewLooks = looks.filter((l) => (l.reviewStatus ?? (l.selected ? "入选" : "待看")) !== "淘汰")

  const looksTableRows = looks.map((look) => {
    const status = look.reviewStatus ?? (look.selected ? "入选" : "待看")
    const statusColor = status === "入选" ? "#7BA688" : status === "待修改" ? "#A67C52" : status === "淘汰" ? "#C26A6A" : "#8A7560"
    return `<tr>
      <td>${look.title}</td>
      <td style="color:${statusColor};font-weight:600">${status}</td>
      <td style="text-align:center">${look.score}</td>
      <td style="text-align:center">${look.trendScore}</td>
      <td style="text-align:center">${look.commercialScore}</td>
      <td>${look.sourceMode}</td>
      <td style="text-align:right">¥${look.estimatedCost?.toFixed(2)}</td>
      <td style="font-size:8px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${look.modificationNote || look.revisionAdvice || "-"}</td>
    </tr>`
  }).join("")

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>设计评审包 — ${customer.name}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Microsoft YaHei", "PingFang SC", "Georgia", serif;
    font-size: 10px;
    color: #1a1a1a;
    line-height: 1.5;
    padding: 8px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1 { font-size: 20px; color: #5C4A36; margin-bottom: 4px; }
  .meta { font-size: 9px; color: #8A7560; margin-bottom: 16px; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: #D4CCB5; border: 1px solid #D4CCB5; margin-bottom: 18px; border-radius: 4px; overflow: hidden; }
  .stat { padding: 10px; text-align: center; background: #fff; }
  .stat big { display: block; font-size: 22px; font-weight: 700; color: #5C4A36; }
  .stat small { font-size: 9px; color: #8A7560; }
  h2 { font-size: 14px; color: #5C4A36; margin: 16px 0 8px; border-bottom: 1px solid #D4CCB5; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 12px; }
  th { background: #5C4A36; color: #fff; padding: 5px 6px; text-align: left; font-weight: 600; }
  td { padding: 5px 6px; border-bottom: 1px solid #E0D8C8; }
  tr:nth-child(even) td { background: #FAFAF7; }
  .look-card { border: 1px solid #D4CCB5; border-radius: 4px; padding: 12px; margin-bottom: 12px; page-break-inside: avoid; }
  .look-title { font-size: 13px; font-weight: 700; color: #5C4A36; margin-bottom: 8px; }
  .look-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 9px; }
  .look-grid span { color: #8A7560; }
  .palette-row { display: flex; gap: 4px; margin: 4px 0; }
  .palette-dot { width: 18px; height: 12px; border: 1px solid #999; border-radius: 2px; }
  .tag { display: inline-block; padding: 1px 6px; border: 1px solid #D4CCB5; border-radius: 2px; font-size: 8px; margin: 1px; }
</style>
</head>
<body>
<h1>${customer.name} — 设计评审包</h1>
<div class="meta">生成时间：${dateStr}　|　定位：${customer.positioning}　|　风格：${customer.styleTags?.join("、")}</div>

<div class="stats">
  <div class="stat"><big>${looks.length}</big><small>生成数量</small></div>
  <div class="stat"><big>${selectedLooks.length}</big><small>已筛选</small></div>
  <div class="stat"><big>${reviewLooks.length}</big><small>有效款式</small></div>
  <div class="stat"><big>${looks.length ? Math.round(looks.reduce((s, l) => s + l.score, 0) / looks.length) : 0}</big><small>平均分</small></div>
</div>

<h2>评审汇总</h2>
<table>
  <tr><th>款式名</th><th>状态</th><th style="text-align:center">匹配分</th><th style="text-align:center">趋势</th><th style="text-align:center">商业</th><th>来源</th><th style="text-align:right">成本(¥)</th><th>修改意见</th></tr>
  ${looksTableRows}
</table>

<h2>入选 / 待修改款式详情</h2>
${reviewLooks.map((look) => `
<div class="look-card">
  <div class="look-title">${look.title}</div>
  <div class="look-grid">
    <div><span>评审状态：</span>${look.reviewStatus ?? (look.selected ? "入选" : "待看")}</div>
    <div><span>综合分：</span>${look.score}（趋势 ${look.trendScore} / 商业 ${look.commercialScore}）</div>
    <div><span>配色：</span>${(look.palette || []).map((c) => `<span class="palette-dot" style="background:${c}"></span>`).join("")} ${look.palette?.join(" ") || "-"}</div>
    <div><span>来源：</span>${look.sourceMode}</div>
    <div style="grid-column:1/-1"><span>关键细节：</span>${(look.keyDetails || []).map((d) => `<span class="tag">${d}</span>`).join(" ")}</div>
    <div><span>成本：</span>¥${look.estimatedCost?.toFixed(2) || "-"}</div>
    <div><span>版本：</span>V${look.version ?? 1}${look.parentId ? " (迭代款)" : ""}</div>
  </div>
  <div style="margin-top:8px;font-size:9px;color:#666"><span>修改建议：</span>${look.revisionAdvice || "-"}</div>
</div>
`).join("")}

<div style="text-align:right;color:#8A7560;font-size:8px;margin-top:16px;padding-top:8px;border-top:1px solid #D4CCB5">
  本评审包由 智衣Design AI 自动生成 · ${dateStr}
</div>
</body>
</html>`
}

export { buildTechPackHTML, buildDesignReviewHTML }
