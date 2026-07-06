// ─── Excel 导出模块 ───
// 使用 exceljs 生成 .xlsx 文件，支持设计评审表 + 工艺单
import ExcelJS from "exceljs"

const STYLE = {
  header: { bold: true, size: 12, color: { argb: "FF5C4A36" } },
  subHeader: { bold: true, size: 10, color: { argb: "FF5C4A36" } },
  body: { size: 10, color: { argb: "FF333333" } },
  muted: { size: 9, color: { argb: "FF8A7560" } },
  accent: { argb: "FFF0EBE0" },
  border: { argb: "FFD4CCB5" },
}

/**
 * 构建设计评审 Excel 工作簿
 * @param {{ customer: object, looks: object[] }} params
 */
export async function buildDesignReviewWorkbook({ customer, looks }) {
  const wb = new ExcelJS.Workbook()
  wb.creator = "智衣Design AI"

  // ── Sheet 1: 评审汇总 ──
  const reviewSheet = wb.addWorksheet("评审汇总")
  buildReviewSheet(reviewSheet, customer, looks)

  // ── Sheet 2: 款式详情 ──
  const detailSheet = wb.addWorksheet("款式详情")
  buildDetailSheet(detailSheet, looks)

  // ── Sheet 3: 成本估算 ──
  if (looks.some((l) => l.estimatedCost > 0)) {
    const costSheet = wb.addWorksheet("成本估算")
    buildCostSheet(costSheet, looks)
  }

  return wb
}

function buildReviewSheet(sheet, customer, looks) {
  const selectedLooks = looks.filter((l) => l.selected)
  const reviewLooks = looks.filter((l) => (l.reviewStatus ?? (l.selected ? "入选" : "待看")) !== "淘汰")

  // 标题
  sheet.mergeCells("A1:H1")
  const titleCell = sheet.getCell("A1")
  titleCell.value = `${customer.name} — 设计评审包`
  titleCell.font = { ...STYLE.header, size: 16 }
  titleCell.alignment = { horizontal: "left" }

  sheet.mergeCells("A2:H2")
  const dateCell = sheet.getCell("A2")
  dateCell.value = `生成时间：${new Date().toLocaleString("zh-CN")}　|　客户定位：${customer.positioning}　|　风格：${customer.styleTags.join("、")}`
  dateCell.font = STYLE.muted

  // 汇总统计
  sheet.mergeCells("A4:D4")
  sheet.getCell("A4").value = "评审统计"
  sheet.getCell("A4").font = STYLE.subHeader

  const stats = [
    ["生成数量", looks.length, "已筛选", selectedLooks.length],
    ["有效款式", reviewLooks.length, "最高分", Math.max(...looks.map((l) => l.score)), "分"],
  ]
  stats.forEach((row, ri) => {
    row.forEach((val, ci) => {
      const cell = sheet.getCell(5 + ri, 1 + ci)
      cell.value = ci % 2 === 0 ? String(val) : val
      if (ci % 2 === 0) cell.font = STYLE.muted
      else cell.font = { bold: true, size: 11, color: { argb: "FF5C4A36" } }
    })
  })

  // 款式表格
  const tableStart = 8
  const headers = ["款式名", "状态", "匹配分", "趋势分", "商业分", "来源", "成本(¥)", "修改意见"]
  headers.forEach((h, i) => {
    const cell = sheet.getCell(tableStart, i + 1)
    cell.value = h
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } }
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5C4A36" } }
    cell.alignment = { horizontal: "center", vertical: "middle" }
    cell.border = { bottom: { style: "thin", color: STYLE.border } }
  })

  looks.forEach((look, ri) => {
    const row = tableStart + 1 + ri
    const values = [
      look.title,
      look.reviewStatus ?? (look.selected ? "入选" : "待看"),
      look.score,
      look.trendScore,
      look.commercialScore,
      look.sourceMode,
      look.estimatedCost.toFixed(2),
      look.modificationNote || look.revisionAdvice || "-",
    ]
    values.forEach((v, ci) => {
      const cell = sheet.getCell(row, ci + 1)
      cell.value = v
      cell.font = STYLE.body
      cell.border = { bottom: { style: "thin", color: { argb: "FFE0D8C8" } } }
      if (ri % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAFAF7" } }

      // 入选高亮
      const statusIdx = 1
      if (ci === statusIdx && (values[statusIdx] === "入选")) {
        cell.font = { ...STYLE.body, bold: true, color: { argb: "FF7BA688" } }
      }
    })
  })

  // 列宽
  sheet.getColumn(1).width = 22
  sheet.getColumn(2).width = 10
  sheet.getColumn(3).width = 10
  sheet.getColumn(4).width = 10
  sheet.getColumn(5).width = 10
  sheet.getColumn(6).width = 14
  sheet.getColumn(7).width = 12
  sheet.getColumn(8).width = 30
}

function buildDetailSheet(sheet, looks) {
  // 标题
  sheet.mergeCells("A1:H1")
  sheet.getCell("A1").value = "入选 / 待修改款式详情"
  sheet.getCell("A1").font = { ...STYLE.header, size: 14 }

  let row = 3
  const reviewLooks = looks.filter((l) => (l.reviewStatus ?? (l.selected ? "入选" : "待看")) !== "淘汰")

  reviewLooks.forEach((look, idx) => {
    // 款式分隔标题
    sheet.mergeCells(`A${row}:H${row}`)
    sheet.getCell(`A${row}`).value = `${idx + 1}. ${look.title}`
    sheet.getCell(`A${row}`).font = { bold: true, size: 11, color: { argb: "FF5C4A36" } }
    sheet.getCell(`A${row}`).fill = { type: "pattern", pattern: "solid", fgColor: STYLE.accent }
    row++

    const fields = [
      ["评审状态", look.reviewStatus ?? (look.selected ? "入选" : "待看")],
      ["趋势分 / 商业分", `${look.trendScore} / ${look.commercialScore}`],
      ["配色", look.palette?.join("、") || "-"],
      ["关键细节", look.keyDetails?.join("、") || "-"],
      ["成本估算(¥)", look.estimatedCost?.toFixed(2) || "-"],
      ["修改意见", look.modificationNote || "-"],
      ["修改建议", look.revisionAdvice || "-"],
      ["设计方向", look.designDirection || "-"],
      ["来源模式", look.sourceMode],
    ]

    fields.forEach(([label, value]) => {
      const lCell = sheet.getCell(row, 1)
      lCell.value = label
      lCell.font = STYLE.muted

      const vCell = sheet.getCell(row, 2)
      vCell.value = value
      vCell.font = STYLE.body
      sheet.mergeCells(`B${row}:H${row}`)
      row++
    })

    row++ // 空行分隔
  })

  sheet.getColumn(1).width = 16
  sheet.getColumn(2).width = 60
}

function buildCostSheet(sheet, looks) {
  sheet.mergeCells("A1:F1")
  sheet.getCell("A1").value = "成本估算汇总"
  sheet.getCell("A1").font = { ...STYLE.header, size: 14 }

  const headers = ["款式名", "面料成本", "辅料成本", "工时", "杂费", "估算FOB"]
  headers.forEach((h, i) => {
    const cell = sheet.getCell(3, i + 1)
    cell.value = h
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } }
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5C4A36" } }
    cell.alignment = { horizontal: "center" }
  })

  looks.forEach((look, ri) => {
    const row = 4 + ri
    sheet.getCell(row, 1).value = look.title
    sheet.getCell(row, 2).value = look.estimatedCost || "-"
    sheet.getCell(row, 3).value = "-"
    sheet.getCell(row, 4).value = "-"
    sheet.getCell(row, 5).value = "-"
    sheet.getCell(row, 6).value = `¥${look.estimatedCost?.toFixed(2) || "-"}`

    for (let c = 1; c <= 6; c++) {
      const cell = sheet.getCell(row, c)
      cell.font = STYLE.body
      cell.border = { bottom: { style: "thin", color: { argb: "FFE0D8C8" } } }
      if (ri % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAFAF7" } }
      if (c >= 2) cell.alignment = { horizontal: "center" }
    }
  })

  sheet.getColumn(1).width = 24
  for (let c = 2; c <= 6; c++) sheet.getColumn(c).width = 14
}

/**
 * 构建工艺单 Excel（单款）
 */
export async function buildTechPackWorkbook({ look, customer, erpSummary, cost }) {
  const wb = new ExcelJS.Workbook()
  wb.creator = "智衣Design AI"

  const sheet = wb.addWorksheet("工艺单")
  const now = new Date()
  const tpNo = `TP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`

  // ── 标题 ──
  sheet.mergeCells("A1:F1")
  sheet.getCell("A1").value = "三时集团 · 服装生产工艺单"
  sheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "FF5C4A36" } }
  sheet.mergeCells("A2:F2")
  sheet.getCell("A2").value = `工艺单号：${tpNo}　|　日期：${now.toLocaleDateString("zh-CN")}　|　客户：${customer.name}`
  sheet.getCell("A2").font = STYLE.muted

  let row = 4

  // 辅助函数：写一个区块
  const section = (title, dataPairs, span = 6) => {
    sheet.mergeCells(row, 1, row, span)
    sheet.getCell(row, 1).value = title
    sheet.getCell(row, 1).font = STYLE.subHeader
    sheet.getCell(row, 1).fill = { type: "pattern", pattern: "solid", fgColor: STYLE.accent }
    row++
    dataPairs.forEach(([label, value]) => {
      sheet.getCell(row, 1).value = label
      sheet.getCell(row, 1).font = STYLE.muted
      if (span > 1) sheet.mergeCells(row, 2, row, span)
      sheet.getCell(row, 2).value = value
      sheet.getCell(row, 2).font = STYLE.body
      row++
    })
    row++ // 空行
  }

  // 款式信息
  section("款式信息", [
    ["款名", look.title],
    ["品类", look.keyDetails.find((d) => /外套|夹克|大衣|风衣|西装|马甲|连衣裙|衬衫|裤|套装|卫衣/.test(d)) || look.title],
    ["季节/趋势", customer.trendPrediction?.slice(0, 30) || "-"],
    ["综合评分", `${look.score}（趋势 ${look.trendScore} / 商业 ${look.commercialScore}）`],
    ["来源模式", look.sourceMode],
    ["版本", `V${look.version ?? 1}${look.parentId ? "（迭代款）" : ""}`],
  ])

  // 设计方向
  section("设计方向", [
    ["方向", look.designDirection || look.revisionAdvice || "-"],
    ["修改意见", look.modificationNote || "-"],
  ])

  // 配色方案
  sheet.mergeCells(row, 1, row, 6)
  sheet.getCell(row, 1).value = "配色方案"
  sheet.getCell(row, 1).font = STYLE.subHeader
  sheet.getCell(row, 1).fill = { type: "pattern", pattern: "solid", fgColor: STYLE.accent }
  row++
  if (look.palette?.length) {
    look.palette.forEach((c, i) => {
      sheet.getCell(row, 1).value = i + 1
      sheet.getCell(row, 1).font = STYLE.body
      sheet.getCell(row, 1).alignment = { horizontal: "center" }

      sheet.getCell(row, 2).value = c
      sheet.getCell(row, 2).font = STYLE.body
      try {
        if (c.startsWith("#") && c.length === 7) {
          sheet.getCell(row, 2).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: `FF${c.slice(1)}` },
          }
          sheet.getCell(row, 2).font = { ...STYLE.body, color: { argb: isLight(c) ? "FF333333" : "FFFFFFFF" } }
        }
      } catch { /* 颜色解析失败跳过 */ }
      sheet.getCell(row, 3).value = i === 0 ? "主色调" : i === 1 ? "辅助色" : "点缀色"
      sheet.getCell(row, 3).font = STYLE.muted
      row++
    })
  }
  row++

  // 面料清单
  const erpFabrics = erpSummary?.topFabrics?.map((f) => f.name) ?? []
  const seededFabrics = customer.fabricPreference?.split(/[、,，]/).filter(Boolean).slice(0, 3).join("、") || ""
  const fabrics = erpFabrics.length >= 2 ? erpFabrics.slice(0, 5) : [seededFabrics].filter(Boolean)
  if (!fabrics.length) fabrics.push("按客户面料偏好")

  sheet.mergeCells(row, 1, row, 6)
  sheet.getCell(row, 1).value = "面料清单"
  sheet.getCell(row, 1).font = STYLE.subHeader
  sheet.getCell(row, 1).fill = { type: "pattern", pattern: "solid", fgColor: STYLE.accent }
  row++
  ;["序号", "面料名称", "用途"].forEach((h, i) => {
    sheet.getCell(row, i + 1).font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } }
    sheet.getCell(row, i + 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5C4A36" } }
    sheet.getCell(row, i + 1).value = h
    sheet.getCell(row, i + 1).alignment = { horizontal: "center" }
  })
  row++
  fabrics.forEach((f, i) => {
    sheet.getCell(row, 1).value = i + 1
    sheet.getCell(row, 1).font = STYLE.body
    sheet.getCell(row, 1).alignment = { horizontal: "center" }
    sheet.getCell(row, 2).value = f
    sheet.getCell(row, 2).font = STYLE.body
    sheet.getCell(row, 3).value = i === 0 ? "主面料" : i === 1 ? "里布 / 拼接" : "部件"
    sheet.getCell(row, 3).font = STYLE.muted
    row++
  })
  row++

  // 关键细节
  section("关键设计细节", [
    ["细节", look.keyDetails?.join("、") || "-"],
    ["修改建议", look.revisionAdvice?.slice(0, 200) || "-"],
  ])

  // 尺寸表
  sheet.mergeCells(row, 1, row, 6)
  sheet.getCell(row, 1).value = "参考尺寸表（单位：cm）"
  sheet.getCell(row, 1).font = STYLE.subHeader
  sheet.getCell(row, 1).fill = { type: "pattern", pattern: "solid", fgColor: STYLE.accent }
  row++
  ;["码数", "胸围", "衣长", "肩宽", "袖长"].forEach((h, i) => {
    sheet.getCell(row, i + 1).font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } }
    sheet.getCell(row, i + 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5C4A36" } }
    sheet.getCell(row, i + 1).value = h
    sheet.getCell(row, i + 1).alignment = { horizontal: "center" }
  })
  row++
  const sizeChart = [
    { size: "S", chest: "92", length: "64", shoulder: "38", sleeve: "56" },
    { size: "M", chest: "96", length: "65", shoulder: "39", sleeve: "57" },
    { size: "L", chest: "100", length: "66", shoulder: "40", sleeve: "58" },
    { size: "XL", chest: "104", length: "67", shoulder: "41", sleeve: "59" },
    { size: "XXL", chest: "108", length: "68", shoulder: "42", sleeve: "60" },
  ]
  sizeChart.forEach((s) => {
    ;[s.size, s.chest, s.length, s.shoulder, s.sleeve].forEach((v, ci) => {
      const c = sheet.getCell(row, ci + 1)
      c.value = v
      c.font = STYLE.body
      c.alignment = { horizontal: "center" }
    })
    row++
  })
  row++

  // 成本估算
  if (cost) {
    section("成本估算（USD）", [
      ["面料成本", `$${cost.fabricCost?.toFixed(2) || "-"}`],
      ["辅料成本", `$${cost.accessoryCost?.toFixed(2) || "-"}`],
      ["工时成本", `$${cost.laborCost?.toFixed(2) || "-"}`],
      ["包装杂费", `$${cost.overhead?.toFixed(2) || "-"}`],
      ["复杂度系数", `${cost.complexity?.toFixed(2) || "-"}×`],
      ["估算 FOB", `$${cost.fobLow?.toFixed(2)} ~ $${cost.fobHigh?.toFixed(2)}`],
      ...(cost.historicalMin ? [["ERP 历史区间", `$${cost.historicalMin} ~ $${cost.historicalMax}`]] : []),
    ])
  }

  // 包装与交付
  section("包装与交付", [
    ["包装方式", "独立 PE 袋包装，12 件/箱"],
    ["吊牌/标签", "按客户品牌吊牌及洗水唛要求执行"],
    ["出货港口", "FOB 上海 / 宁波"],
    ["交期", "确认产前样后 35-45 天"],
  ])

  // 脚注
  sheet.mergeCells(row, 1, row, 6)
  sheet.getCell(row, 1).value = `本工艺单由 智衣Design AI 服装定向设计系统自动生成 · ${now.toLocaleString("zh-CN")} · 生产前需设计师审核确认`
  sheet.getCell(row, 1).font = STYLE.muted
  sheet.getCell(row, 1).alignment = { horizontal: "right" }

  // 列宽
  sheet.getColumn(1).width = 20
  sheet.getColumn(2).width = 22
  for (let c = 3; c <= 6; c++) sheet.getColumn(c).width = 16

  return wb
}

function isLight(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 150
}

/**
 * 将 workbook 写入 Buffer
 */
export async function workbookToBuffer(wb) {
  return wb.xlsx.writeBuffer()
}
