import express from "express"
import cors from "cors"
import sql from "mssql"
import { execFile } from "node:child_process"
import { mkdirSync, existsSync } from "node:fs"
import { writeFile, unlink, readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { buildDesignReviewWorkbook, buildTechPackWorkbook, workbookToBuffer } from "./export-excel.mjs"
import { generateTechPackPDF, generateDesignReviewPDF } from "./export-pdf.mjs"

const serverDir = path.dirname(fileURLToPath(import.meta.url))
const execFileAsync = promisify(execFile)
// 生成的款式图存到磁盘，永久保存（火山方舟原始 URL 仅 24 小时有效）
const generatedDir = path.join(serverDir, "generated")
if (!existsSync(generatedDir)) {
  mkdirSync(generatedDir, { recursive: true })
}

const port = Number(process.env.ERP_API_PORT ?? 8787)
const database = process.env.ERP_DB_DATABASE ?? "RichMaxGarmentBF_ssmj"

const config = {
  user: process.env.ERP_DB_USER,
  password: process.env.ERP_DB_PASSWORD,
  server: process.env.ERP_DB_HOST,
  port: Number(process.env.ERP_DB_PORT ?? 1433),
  database,
  connectionTimeout: 10000,
  requestTimeout: 30000,
  pool: {
    max: 4,
    min: 0,
    idleTimeoutMillis: 15000
  },
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    readOnlyIntent: true
  }
}

const app = express()
app.use(cors({ origin: true }))
// 16mb：参考图（base64）和生图请求体可能较大
app.use(express.json({ limit: "16mb" }))

// 列出所有已保存的图片及其元数据（必须在 static 中间件之前注册）
app.get("/api/img", async (_req, res, next) => {
  try {
    const files = await readdir(generatedDir)
    const images = []
    for (const file of files) {
      // 只处理图片文件，跳过元数据 JSON 本身
      if (file.endsWith(".json")) continue
      const ext = path.extname(file).toLowerCase()
      if (![".jpeg", ".jpg", ".png", ".webp"].includes(ext)) continue

      const base = path.basename(file, ext)
      const metaFile = `${base}.json`
      let meta = null
      try {
        const raw = await readFile(path.join(generatedDir, metaFile), "utf-8")
        meta = JSON.parse(raw)
      } catch {
        meta = null
      }
      images.push({
        file,
        url: `/api/img/${file}`,
        createdAt: meta?.createdAt ?? null,
        prompt: meta?.prompt?.slice(0, 200) ?? null,
        customerId: meta?.customerId ?? null,
        customerName: meta?.customerName ?? null,
        title: meta?.title ?? null,
        score: meta?.score ?? null,
        trendScore: meta?.trendScore ?? null,
        commercialScore: meta?.commercialScore ?? null,
        estimatedCost: meta?.estimatedCost ?? null,
        sourceMode: meta?.sourceMode ?? null,
        selected: meta?.selected ?? null,
        reviewStatus: meta?.reviewStatus ?? null,
        note: meta?.note ?? null,
        palette: Array.isArray(meta?.palette) ? meta.palette : null,
        keyDetails: Array.isArray(meta?.keyDetails) ? meta.keyDetails : null,
        revisionAdvice: meta?.revisionAdvice ?? null,
        designDirection: meta?.designDirection ?? null,
        version: meta?.version ?? null,
      })
    }
    // 按文件名（时间戳）倒序
    images.sort((a, b) => b.file.localeCompare(a.file))
    res.json({ ok: true, images })
  } catch (err) {
    next(err)
  }
})

// 删除某张已保存的款式图文件及元数据（前端删款时调用，best-effort）
app.delete("/api/img/:file", async (req, res) => {
  const safe = path.basename(req.params.file)
  try {
    await unlink(path.join(generatedDir, safe))
    // 同时删除关联的元数据 JSON
    const ext = path.extname(safe)
    const metaFile = `${path.basename(safe, ext)}.json`
    try { await unlink(path.join(generatedDir, metaFile)) } catch { /* 元数据不存在则跳过 */ }
    res.json({ ok: true })
  } catch {
    res.json({ ok: true, note: "file already gone" })
  }
})

// 永久保存的款式图（火山方舟原图 URL 24h 过期，这里落地到磁盘长期可用）
app.use("/api/img", express.static(generatedDir, { maxAge: "30d", immutable: true }))

let poolPromise

function assertConfigured() {
  const missing = ["ERP_DB_HOST", "ERP_DB_USER", "ERP_DB_PASSWORD"].filter((key) => !process.env[key])
  if (missing.length) {
    const error = new Error(`Missing database env vars: ${missing.join(", ")}`)
    error.statusCode = 503
    throw error
  }
}

async function getPool() {
  assertConfigured()
  if (!poolPromise) {
    poolPromise = sql.connect(config)
  }
  return poolPromise
}

function rejectUnsafeSql(query) {
  const unsafe = /\b(INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|GRANT|REVOKE|BACKUP|RESTORE)\b/i
  if (unsafe.test(query)) {
    throw new Error("Unsafe SQL blocked by read-only guard")
  }
}

async function readonlyQuery(query, inputs = {}) {
  rejectUnsafeSql(query)
  const pool = await getPool()
  const request = pool.request()
  for (const [name, value] of Object.entries(inputs)) {
    request.input(name, value.type, value.value)
  }
  return request.query(`SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;\n${query}`)
}

function likeInput(value) {
  return `%${String(value ?? "").trim()}%`
}

function safeCustomerCode(value) {
  const code = String(value ?? "").trim()
  // 只允许字母、数字、空格、下划线、连字符、& 符号和中英文括号，禁止特殊字符
  if (!/^[\w\s&\-（）()]{1,40}$/i.test(code)) {
    const error = new Error("Invalid customer code")
    error.statusCode = 400
    throw error
  }
  return code
}

function summarizeTopRows(rows, field, valueField = "rows", limit = 8) {
  return rows
    .filter((row) => row[field])
    .slice(0, limit)
    .map((row) => ({
      name: row[field],
      count: Number(row[valueField] ?? 0),
      extra: row.extra ?? null
    }))
}

// ERP 里同一颜色常有多种写法（"黑色" / "黑色 Black" / "black黑色" / "61藏青"），
// 归一化成中文核心色名后合并计数，避免画像里出现重复色。
function normalizeColorName(name) {
  return String(name ?? "")
    // 颜色字段里常混入备注（如 "深蓝,同寄客人的样品"），只取第一段
    .split(/[，,、；;(（/]/)[0]
    .replace(/[a-zA-Z]/g, "")
    .replace(/[0-9#\\\-_.)）]/g, "")
    .replace(/\s+/g, "")
    .trim()
}

function mergeTopByName(items, normalize, limit = 8) {
  const map = new Map()
  for (const item of items) {
    const key = normalize(item.name)
    if (!key) continue
    const prev = map.get(key) ?? { name: key, count: 0, extra: item.extra ?? null }
    prev.count += Number(item.count ?? 0)
    map.set(key, prev)
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit)
}

function splitProductTokens(value) {
  return String(value ?? "")
    .split(/[\/,，、;；\s]+/)
    .map((token) => token.trim())
    .filter((token) => token && token.length <= 8)
}

function num(value) {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function fmtMoney(value) {
  return Math.round(num(value)).toLocaleString("zh-CN")
}

// mssql 返回的是 Date 对象，统一转成 YYYY-MM 文本。
function yearMonth(value) {
  if (!value) return ""
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 7)
}

app.use("/api/erp", (req, res, next) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "ERP API is read-only. Only GET is allowed." })
    return
  }
  next()
})

app.get("/api/erp/status", async (_req, res, next) => {
  try {
    const result = await readonlyQuery(`
      SELECT
        @@VERSION AS version,
        DB_NAME() AS currentDatabase,
        SYSTEM_USER AS loginName
    `)
    const row = result.recordset[0]
    res.json({
      ok: true,
      database: row.currentDatabase,
      server: config.server,
      port: config.port,
      loginName: row.loginName,
      version: String(row.version).split("\n")[0],
      mode: "read-only GET endpoints, fixed SELECT queries"
    })
  } catch (error) {
    next(error)
  }
})

app.get("/api/erp/customers/top", async (_req, res, next) => {
  try {
    const result = await readonlyQuery(`
      SELECT TOP 120
        CustomerName,
        CustomerID,
        COUNT(*) AS contractCount,
        MAX(ContractDate) AS lastContractDate,
        MIN(ContractDate) AS firstContractDate,
        SUM(ISNULL(TotalAmount, 0)) AS totalAmount
      FROM EXP_Contract_Garment WITH (NOLOCK)
      WHERE CustomerName IS NOT NULL AND LTRIM(RTRIM(CustomerName)) <> ''
      GROUP BY CustomerName, CustomerID
      ORDER BY COUNT(*) DESC, MAX(ContractDate) DESC
    `)
    res.json({ customers: result.recordset })
  } catch (error) {
    next(error)
  }
})

app.get("/api/erp/customers/:code/summary", async (req, res, next) => {
  try {
    const code = safeCustomerCode(req.params.code)
    const inputs = { kw: { type: sql.NVarChar, value: likeInput(code) } }

    const [
      master,
      contracts,
      quotations,
      fabricTop,
      accessoryTop,
      colorTop,
      recentOrders,
      imageFiles,
      orderTypes
    ] = await Promise.all([
      readonlyQuery(`
        SELECT TOP 5
          id,
          ShortName,
          cnname,
          enname,
          area,
          Web,
          ClientGrade,
          ClientProduct,
          YearProcurement,
          CooperationStatus,
          StartTime,
          BusinessUser,
          BusinessDept,
          CustomerStatus
        FROM bas_customer WITH (NOLOCK)
        WHERE ShortName LIKE @kw OR cnname LIKE @kw OR enname LIKE @kw OR MainCustomerShortName LIKE @kw
        ORDER BY id DESC
      `, inputs),
      readonlyQuery(`
        SELECT
          COUNT(*) AS contractCount,
          MIN(ContractDate) AS firstContractDate,
          MAX(ContractDate) AS lastContractDate,
          SUM(ISNULL(TotalAmount, 0)) AS totalAmount,
          AVG(NULLIF(TotalAmount, 0)) AS avgAmount
        FROM EXP_Contract_Garment WITH (NOLOCK)
        WHERE CustomerName LIKE @kw
      `, inputs),
      readonlyQuery(`
        SELECT
          COUNT(*) AS quotationCount,
          MIN(QuotationDate) AS firstQuotationDate,
          MAX(QuotationDate) AS lastQuotationDate,
          SUM(ISNULL(Num, 0)) AS totalQuantity,
          SUM(ISNULL(FabricCost, 0)) AS fabricCost,
          SUM(ISNULL(AccessoriesCost, 0)) AS accessoriesCost,
          SUM(ISNULL(TotalFeeCost, 0)) AS feeCost,
          AVG(NULLIF(TotalMoney, 0)) AS avgQuoteAmount
        FROM EXP_Quotation_Clothing WITH (NOLOCK)
        WHERE CustomerName LIKE @kw
      `, inputs),
      readonlyQuery(`
        SELECT TOP 12
          CnName AS name,
          COUNT(*) AS rows,
          MAX(CnComposition) AS extra
        FROM Dom_PurRequirements_Fabric WITH (NOLOCK)
        WHERE CustomerShortName LIKE @kw
        GROUP BY CnName
        ORDER BY COUNT(*) DESC
      `, inputs),
      readonlyQuery(`
        SELECT TOP 12
          CnName AS name,
          COUNT(*) AS rows,
          MAX(ISNULL(ProductSpec, PartName)) AS extra
        FROM Dom_PurRequirements_Accessories WITH (NOLOCK)
        WHERE CustomerName LIKE @kw
        GROUP BY CnName
        ORDER BY COUNT(*) DESC
      `, inputs),
      readonlyQuery(`
        SELECT TOP 12
          CnColor AS name,
          COUNT(*) AS rows,
          MAX(ColorCode) AS extra
        FROM Dom_PurRequirements_Fabric WITH (NOLOCK)
        WHERE CustomerShortName LIKE @kw AND CnColor IS NOT NULL AND LTRIM(RTRIM(CnColor)) <> ''
        GROUP BY CnColor
        ORDER BY COUNT(*) DESC
      `, inputs),
      readonlyQuery(`
        SELECT TOP 12
          CustomerName,
          BillNo,
          ContractDate,
          DeliveryDate,
          ISNULL(CnNameDesc, GoodsDesc) AS CnName,
          PONumber,
          TotalAmount,
          CurrencyName,
          OrderType
        FROM EXP_Contract_Garment WITH (NOLOCK)
        WHERE CustomerName LIKE @kw
        ORDER BY ContractDate DESC
      `, inputs),
      readonlyQuery(`
        SELECT TOP 12
          CustomerName,
          BillNo,
          CnName,
          PONumber,
          ImageFileSC,
          QuotationDate
        FROM EXP_Quotation_Clothing WITH (NOLOCK)
        WHERE CustomerName LIKE @kw
          AND ImageFileSC IS NOT NULL
          AND LTRIM(RTRIM(CAST(ImageFileSC AS nvarchar(max)))) <> ''
        ORDER BY QuotationDate DESC
      `, inputs),
      readonlyQuery(`
        SELECT
          ISNULL(NULLIF(LTRIM(RTRIM(OrderType)), ''), '未标注') AS name,
          COUNT(*) AS rows
        FROM EXP_Contract_Garment WITH (NOLOCK)
        WHERE CustomerName LIKE @kw
        GROUP BY ISNULL(NULLIF(LTRIM(RTRIM(OrderType)), ''), '未标注')
        ORDER BY COUNT(*) DESC
      `, inputs)
    ])

    const contractStats = contracts.recordset[0] ?? {}
    const quotationStats = quotations.recordset[0] ?? {}
    const masterRow = master.recordset[0] ?? {}
    const topFabrics = summarizeTopRows(fabricTop.recordset, "name")
    const topAccessories = summarizeTopRows(accessoryTop.recordset, "name")
    const topColors = mergeTopByName(summarizeTopRows(colorTop.recordset, "name", "rows", 24), normalizeColorName)
    const orderTypeRows = summarizeTopRows(orderTypes.recordset, "name")
    const contractCount = num(contractStats.contractCount)
    const quotationCount = num(quotationStats.quotationCount)
    const matched = contractCount > 0 || quotationCount > 0 || master.recordset.length > 0
    const maturity =
      contractCount >= 40 || quotationCount >= 40
        ? "数据充足"
        : contractCount > 0 || quotationCount > 0
          ? "需设计师补标"
          : "新客户验证"

    const patch = matched
      ? buildProfilePatch({
          code,
          maturity,
          masterRow,
          contractStats,
          quotationStats,
          topFabrics,
          topAccessories,
          topColors,
          orderTypeRows
        })
      : { maturity }

    res.json({
      code,
      matched,
      maturity,
      master: master.recordset,
      stats: {
        contracts: contractStats,
        quotations: quotationStats
      },
      topFabrics,
      topAccessories,
      topColors,
      orderTypes: orderTypeRows,
      recentOrders: recentOrders.recordset,
      imageFiles: imageFiles.recordset,
      suggestedProfilePatch: patch
    })
  } catch (error) {
    next(error)
  }
})

// ── 客户风格演变趋势（3-5 年维度）──
app.get("/api/erp/customers/:code/trend", async (req, res, next) => {
  try {
    const code = safeCustomerCode(req.params.code)
    const inputs = { kw: { type: sql.NVarChar, value: likeInput(code) } }

    // 合同按年份聚合：笔数、金额、品类、订单类型
    const contractTrend = await readonlyQuery(`
      SELECT
        YEAR(ContractDate) AS yr,
        COUNT(*) AS cnt,
        SUM(ISNULL(TotalAmount, 0)) AS totalAmount,
        AVG(NULLIF(TotalAmount, 0)) AS avgAmount
      FROM EXP_Contract_Garment WITH (NOLOCK)
      WHERE CustomerName LIKE @kw
        AND ContractDate IS NOT NULL
        AND YEAR(ContractDate) >= YEAR(GETDATE()) - 5
      GROUP BY YEAR(ContractDate)
      ORDER BY yr
    `, inputs)

    // 注意：合同表里没有干净的"成衣品类"字段，CnNameDesc/GoodsDesc 存的是客户自有款名
    // （多为地名/系列名，如 LONDON、VANCOUVER、MONTANA），不是夹克/马甲这类品类，
    // 因此不做"品类演变"，只用真实可信的 面料 / 色彩 / 订单类型 维度。

    // 面料演变：按年份统计面料偏好
    // 用 LIKE 做 JOIN 是因为合同表 CustomerName 可能是全称（如 "PT International-Trend GmbH"），
    // 而面辅料表 CustomerShortName 是简称（如 "PT"），等值匹配会丢失数据
    const fabricTrend = await readonlyQuery(`
      SELECT
        YEAR(c.ContractDate) AS yr,
        f.CnName AS name,
        COUNT(*) AS cnt
      FROM Dom_PurRequirements_Fabric f WITH (NOLOCK)
      JOIN EXP_Contract_Garment c WITH (NOLOCK)
        ON c.CustomerName LIKE '%' + f.CustomerShortName + '%'
      WHERE c.CustomerName LIKE @kw
        AND f.CustomerShortName LIKE @kw
        AND c.ContractDate IS NOT NULL
        AND YEAR(c.ContractDate) >= YEAR(GETDATE()) - 5
        AND f.CnName IS NOT NULL
      GROUP BY YEAR(c.ContractDate), f.CnName
      ORDER BY yr, cnt DESC
    `, inputs)

    // 色彩演变
    const colorTrend = await readonlyQuery(`
      SELECT
        YEAR(c.ContractDate) AS yr,
        f.CnColor AS name,
        COUNT(*) AS cnt
      FROM Dom_PurRequirements_Fabric f WITH (NOLOCK)
      JOIN EXP_Contract_Garment c WITH (NOLOCK)
        ON c.CustomerName LIKE '%' + f.CustomerShortName + '%'
      WHERE c.CustomerName LIKE @kw
        AND f.CustomerShortName LIKE @kw
        AND c.ContractDate IS NOT NULL
        AND YEAR(c.ContractDate) >= YEAR(GETDATE()) - 5
        AND f.CnColor IS NOT NULL
        AND LTRIM(RTRIM(f.CnColor)) <> ''
      GROUP BY YEAR(c.ContractDate), f.CnColor
      ORDER BY yr, cnt DESC
    `, inputs)

    // 订单类型演变
    const orderTypeTrend = await readonlyQuery(`
      SELECT
        YEAR(ContractDate) AS yr,
        ISNULL(NULLIF(LTRIM(RTRIM(OrderType)), ''), '未标注') AS name,
        COUNT(*) AS cnt
      FROM EXP_Contract_Garment WITH (NOLOCK)
      WHERE CustomerName LIKE @kw
        AND ContractDate IS NOT NULL
        AND YEAR(ContractDate) >= YEAR(GETDATE()) - 5
      GROUP BY YEAR(ContractDate), ISNULL(NULLIF(LTRIM(RTRIM(OrderType)), ''), '未标注')
      ORDER BY yr, cnt DESC
    `, inputs)

    // 报价趋势
    const quotationTrend = await readonlyQuery(`
      SELECT
        YEAR(QuotationDate) AS yr,
        COUNT(*) AS cnt,
        SUM(ISNULL(Num, 0)) AS totalQuantity,
        AVG(NULLIF(TotalMoney, 0)) AS avgQuoteAmount
      FROM EXP_Quotation_Clothing WITH (NOLOCK)
      WHERE CustomerName LIKE @kw
        AND QuotationDate IS NOT NULL
        AND YEAR(QuotationDate) >= YEAR(GETDATE()) - 5
      GROUP BY YEAR(QuotationDate)
      ORDER BY yr
    `, inputs)

    // 组装：按年归并
    const yearMap = new Map()
    for (const row of contractTrend.recordset) {
      const yr = row.yr
      if (!yearMap.has(yr)) yearMap.set(yr, { year: yr, contracts: 0, totalAmount: 0, avgAmount: 0, fabrics: [], colors: [], orderTypes: [], quotations: 0, avgQuote: 0 })
      const entry = yearMap.get(yr)
      entry.contracts = num(row.cnt)
      entry.totalAmount = num(row.totalAmount)
      entry.avgAmount = num(row.avgAmount)
    }
    for (const row of quotationTrend.recordset) {
      const yr = row.yr
      if (!yearMap.has(yr)) yearMap.set(yr, { year: yr, contracts: 0, totalAmount: 0, avgAmount: 0, fabrics: [], colors: [], orderTypes: [], quotations: 0, avgQuote: 0 })
      const entry = yearMap.get(yr)
      entry.quotations = num(row.cnt)
      entry.avgQuote = num(row.avgQuoteAmount)
    }

    const fabByYear = new Map()
    for (const row of fabricTrend.recordset) {
      const yr = row.yr
      if (!fabByYear.has(yr)) fabByYear.set(yr, [])
      const name = String(row.name ?? "").trim()
      if (name) fabByYear.get(yr).push({ name, count: num(row.cnt) })
    }

    const colByYear = new Map()
    for (const row of colorTrend.recordset) {
      const yr = row.yr
      if (!colByYear.has(yr)) colByYear.set(yr, [])
      const name = normalizeColorName(row.name)
      if (name) colByYear.get(yr).push({ name, count: num(row.cnt) })
    }

    const otByYear = new Map()
    for (const row of orderTypeTrend.recordset) {
      const yr = row.yr
      if (!otByYear.has(yr)) otByYear.set(yr, [])
      otByYear.get(yr).push({ name: row.name, cnt: num(row.cnt) })
    }

    for (const [yr, entry] of yearMap) {
      const fabs = fabByYear.get(yr) ?? []
      const cols = colByYear.get(yr) ?? []
      const ots = otByYear.get(yr) ?? []
      entry.fabrics = mergeTopByName(fabs, (n) => n, 5)
      entry.colors = mergeTopByName(cols, normalizeColorName, 5)
      entry.orderTypes = ots.slice(0, 4).map((item) => ({
        name: item.name,
        share: Math.round((item.cnt / (ots.reduce((s, i) => s + i.cnt, 0) || 1)) * 100)
      }))
    }

    const years = [...yearMap.values()].sort((a, b) => a.year - b.year)

    // 生成一句话演变总结
    const evolution = buildEvolutionSummary(code, years)

    res.json({ code, years, evolution, matched: years.length > 0 })
  } catch (error) {
    next(error)
  }
})

// 把 ERP 原始数据加工成一份可直接套用的客户画像（市场、定位、风格标签、面料/色彩、
// 价格带、订单趋势、返单信号），尽量用真实数字，缺字段时给出可读的兜底文案。
function buildProfilePatch({ code, maturity, masterRow, contractStats, quotationStats, topFabrics, topAccessories, topColors, orderTypeRows }) {
  const enName = String(masterRow.enname ?? "").trim()
  const products = splitProductTokens(masterRow.ClientProduct)
  const grade = String(masterRow.ClientGrade ?? "").trim()
  const yearProcurement = num(masterRow.YearProcurement)
  const dept = String(masterRow.BusinessDept ?? "").trim()
  const businessUser = String(masterRow.BusinessUser ?? "").trim()

  const fabricNames = topFabrics.map((item) => item.name).filter(Boolean)
  const accessoryNames = topAccessories.map((item) => item.name).filter(Boolean)
  const colorNames = topColors.map((item) => item.name).filter(Boolean)

  const styleTags = [...new Set([
    ...products.slice(0, 5),
    ...fabricNames.slice(0, 2)
  ])].slice(0, 7)

  const positioningParts = []
  if (enName) positioningParts.push(`ERP 客户全称 ${enName}`)
  if (grade) positioningParts.push(`${grade} 级客户`)
  if (yearProcurement) positioningParts.push(`年采购约 ${yearProcurement} 万`)
  if (products.length) positioningParts.push(`主营 ${products.slice(0, 6).join("、")}`)
  if (businessUser || dept) positioningParts.push(`对接 ${[dept, businessUser].filter(Boolean).join(" ")}`)
  const positioning = positioningParts.length
    ? `${positioningParts.join("，")}。以下画像由 ERP 历史订单自动生成。`
    : `${code} 的画像由 ERP 历史订单自动生成。`

  const market = products.length
    ? `出口·${products.slice(0, 3).join("/")}`
    : (enName ? `出口客户·${enName}` : "出口客户")

  return {
    maturity,
    market,
    positioning,
    styleTags: styleTags.length ? styleTags : fabricNames.slice(0, 5),
    fabricPreference: fabricNames.slice(0, 6).join("、") || "ERP 暂未命中面料偏好",
    colorDirection: colorNames.slice(0, 6).join("、") || "ERP 暂未命中色彩偏好",
    trendPrediction: buildTrendText(code, contractStats, orderTypeRows),
    priceStrategy: buildPriceText(contractStats, quotationStats),
    erpInsight: {
      materialFocus: fabricNames.slice(0, 5).length ? fabricNames.slice(0, 5) : ["ERP暂无面料数据"],
      craftFocus: accessoryNames.slice(0, 5).length ? accessoryNames.slice(0, 5) : ["ERP暂无辅料数据"],
      priceBand: buildPriceBand(contractStats, quotationStats),
      orderTrend: buildOrderTrend(contractStats),
      repeatOrderSignal: buildRepeatSignal(orderTypeRows, contractCountOf(contractStats))
    }
  }
}

function contractCountOf(contractStats) {
  return num(contractStats.contractCount)
}

function buildTrendText(code, contractStats, orderTypeRows) {
  const contractCount = num(contractStats.contractCount)
  if (!contractCount) {
    return `${code} 暂未命中成衣合同，建议先按报价和面辅料偏好验证方向。`
  }
  const bulk = orderTypeRows.find((row) => /大货/.test(row.name))
  const bulkShare = bulk ? Math.round((bulk.count / contractCount) * 100) : 0
  const focus = bulkShare >= 50
    ? "以大货返单为主，方向偏稳健，建议在客户已验证品类上做面料和细节升级"
    : "样品/小单占比较高，仍在打样验证阶段，可适当增加新方向试探"
  return `${code} 近年累计 ${contractCount} 笔成衣合同，${focus}。`
}

function buildOrderTrend(contractStats) {
  const contractCount = num(contractStats.contractCount)
  if (!contractCount) return "ERP 暂无成衣合同记录。"
  const first = yearMonth(contractStats.firstContractDate)
  const last = yearMonth(contractStats.lastContractDate)
  const total = num(contractStats.totalAmount)
  return `${first || "—"} 至 ${last || "—"} 共 ${contractCount} 笔合同，累计金额约 ${fmtMoney(total)}。`
}

function buildRepeatSignal(orderTypeRows, contractCount) {
  if (!contractCount) return "暂无返单数据。"
  const bulk = orderTypeRows.find((row) => /大货/.test(row.name))
  const sample = orderTypeRows.find((row) => /样/.test(row.name))
  const bulkShare = bulk ? Math.round((bulk.count / contractCount) * 100) : 0
  const sampleShare = sample ? Math.round((sample.count / contractCount) * 100) : 0
  return `大货 ${bulkShare}% / 样品 ${sampleShare}%（按合同笔数）。`
}

function buildPriceBand(contractStats, quotationStats) {
  const totalAmount = num(contractStats.totalAmount)
  const quantity = num(quotationStats.totalQuantity)
  const avgContract = num(contractStats.avgAmount)
  if (quantity && totalAmount) {
    const unit = totalAmount / quantity
    return `单件约 ${unit.toFixed(2)}（合同总额/报价数量估算），单笔合同均额约 ${fmtMoney(avgContract)}。`
  }
  if (avgContract) {
    return `单笔合同均额约 ${fmtMoney(avgContract)}，单价待报价明细校准。`
  }
  return "价格带需结合报价明细进一步校准。"
}

function buildPriceText(contractStats, quotationStats) {
  const quantity = num(quotationStats.totalQuantity)
  const totalAmount = num(contractStats.totalAmount)
  if (quantity && totalAmount) {
    const unit = totalAmount / quantity
    return `历史单件约 ${unit.toFixed(2)}，建议新款控制工艺复杂度，落在客户已验证的价格带内；要溢价则放在面料性能和关键细节上。`
  }
  const avgContract = num(contractStats.avgAmount)
  if (avgContract) {
    return `单笔合同均额约 ${fmtMoney(avgContract)}，建议结合客户历史成本结构控制复杂度。`
  }
  return "价格带需结合报价明细进一步校准。"
}

function buildEvolutionSummary(code, years) {
  if (!years.length) return `${code} 暂无足够历史数据用于趋势分析。`
  const first = years[0]
  const last = years[years.length - 1]
  const contractGrowth = first.contracts ? Math.round(((last.contracts - first.contracts) / Math.max(first.contracts, 1)) * 100) : 0
  const amountGrowth = first.totalAmount ? Math.round(((last.totalAmount - first.totalAmount) / Math.max(first.totalAmount, 1)) * 100) : 0

  const earlyFabs = new Set(first.fabrics?.map((f) => f.name) ?? [])
  const lateFabs = new Set(last.fabrics?.map((f) => f.name) ?? [])
  const newFabs = [...lateFabs].filter((f) => !earlyFabs.has(f)).slice(0, 3)
  const droppedFabs = [...earlyFabs].filter((f) => !lateFabs.has(f)).slice(0, 3)

  const parts = []
  parts.push(`近 ${years.length} 年累计 ${years.reduce((s, y) => s + y.contracts, 0)} 笔合同`)
  if (contractGrowth > 20) parts.push(`合同量增长 ${contractGrowth}%`)
  else if (contractGrowth < -20) parts.push(`合同量下降 ${Math.abs(contractGrowth)}%`)
  else parts.push("合同量保持稳定")

  if (newFabs.length) parts.push(`面料从 ${first.fabrics?.[0]?.name ?? "—"} 扩展到 ${last.fabrics?.[0]?.name ?? "—"}${newFabs.length > 1 ? "等" : ""}`)
  if (droppedFabs.length) parts.push(`减少使用 ${droppedFabs[0]}`)

  return parts.join("；") + "。"
}

// ───────────────────────────────────────────────────────────────────────────
// AI 智能分析：用 DeepSeek 结合「品牌公开信息 + ERP 历史订单」生成智能画像与设计方向。
// DeepSeek API 无实时联网检索能力，分析基于模型已有知识 + 传入的公开信息 + ERP 数据。
// 需要 DEEPSEEK_API_KEY（环境变量，或前端高级设置里临时传入）。不触碰数据库。
// ───────────────────────────────────────────────────────────────────────────
function getAiKey(req) {
  const key = process.env.DEEPSEEK_API_KEY || req.body?.apiKey
  if (!key) {
    const error = new Error("未配置 DeepSeek API Key（用 DEEPSEEK_API_KEY 启动后端，或在前端「高级」里填入）")
    error.statusCode = 503
    throw error
  }
  return key
}

function extractJson(text) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)
  try {
    return JSON.parse(candidate)
  } catch {
    return null
  }
}

// Tavily 实时联网检索（专为 LLM 设计的搜索 API），返回网页摘要 + 来源。
// includeDomains 非空时把检索限定在指定域名（用于定向抓品牌官网）。
async function tavilySearch(key, query, includeDomains) {
  const payload = {
    query,
    search_depth: "advanced",
    max_results: 6,
    include_answer: true
  }
  if (includeDomains && includeDomains.length) {
    payload.include_domains = includeDomains
  }
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(payload)
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(`Tavily ${response.status}: ${detail.slice(0, 150)}`)
  }
  const data = await response.json()
  return {
    answer: data.answer ?? "",
    results: (data.results ?? []).map((row) => ({
      title: row.title,
      url: row.url,
      content: String(row.content ?? "").slice(0, 500)
    }))
  }
}

// Tavily Extract：抓取指定网址的正文内容 + 页面图片（真正"进官网看"）。
async function tavilyExtract(key, url) {
  const response = await fetch("https://api.tavily.com/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ urls: [url], include_images: true, extract_depth: "advanced" }),
    signal: AbortSignal.timeout(40000)
  })
  if (!response.ok) {
    throw new Error(`Tavily extract ${response.status}`)
  }
  const data = await response.json()
  const row = (data.results ?? [])[0] ?? {}
  return {
    content: String(row.raw_content ?? "").slice(0, 2500),
    images: (row.images ?? []).filter((u) => typeof u === "string").slice(0, 8)
  }
}

function normalizeIntelSource(value) {
  return ["tavily", "agent-reach", "hybrid"].includes(value) ? value : "hybrid"
}

function uniqueStrings(values, limit = 8) {
  const seen = new Set()
  return values
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim())
    .filter((value) => !seen.has(value) && seen.add(value))
    .slice(0, limit)
}

function extractUrls(text, limit = 8) {
  return uniqueStrings(String(text ?? "").match(/https?:\/\/[^\s)"'<>]+/g) ?? [], limit)
}

function extractMarkdownImages(text, limit = 8) {
  const images = []
  for (const match of String(text ?? "").matchAll(/!\[[^\]]*]\((https?:\/\/[^)\s]+)\)/g)) {
    images.push(match[1])
  }
  return uniqueStrings(images, limit)
}

async function runOptionalCommand(command, args, timeout = 15000) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout,
      windowsHide: true,
      maxBuffer: 1024 * 1024
    })
    return { ok: true, text: String(stdout || stderr || "").trim() }
  } catch (error) {
    const detail = error.code === "ENOENT" ? `${command} 未安装或不在 PATH` : error.message
    return { ok: false, error: detail }
  }
}

async function readWithJina(url) {
  const response = await fetch(`https://r.jina.ai/${url}`, { signal: AbortSignal.timeout(30000) })
  if (!response.ok) {
    throw new Error(`Jina Reader ${response.status}`)
  }
  const text = await response.text()
  return {
    title: "品牌官网正文",
    url,
    content: text.slice(0, 2500),
    images: extractMarkdownImages(text)
  }
}

async function collectAgentReachIntel({ customerName, brand, website, gender }) {
  const query = `${brand || customerName} ${gender || ""} fashion brand collection products positioning 2026`.trim()
  const doctor = await runOptionalCommand("agent-reach", ["doctor", "--json"], 8000)
  const exa = await runOptionalCommand("mcporter", ["call", `exa.web_search_exa(query: ${JSON.stringify(query)}, numResults: 5)`], 20000)

  let officialContent = ""
  let officialImages = []
  const results = []
  const notes = []

  if (doctor.ok && doctor.text) {
    notes.push(`agent-reach doctor：${doctor.text.slice(0, 600)}`)
  } else if (doctor.error) {
    notes.push(`agent-reach CLI 暂不可用：${doctor.error}`)
  }

  if (website) {
    try {
      const official = await readWithJina(website)
      officialContent = official.content
      officialImages = official.images
      results.push({ title: official.title, url: website, content: official.content.slice(0, 600), source: "Jina Reader" })
    } catch (error) {
      notes.push(`Jina 官网读取失败：${error.message}`)
    }
  }

  if (exa.ok && exa.text) {
    const urls = extractUrls(exa.text, 5)
    results.push(...urls.map((url, index) => ({
      title: `Agent-Reach Exa 结果 ${index + 1}`,
      url,
      content: exa.text.slice(0, 700),
      source: "Exa"
    })))
    if (!urls.length) {
      notes.push(`Exa 原始结果：${exa.text.slice(0, 900)}`)
    }
  } else if (exa.error) {
    notes.push(`Exa 通道暂不可用：${exa.error}`)
  }

  return {
    answer: notes.join("\n"),
    results: results.slice(0, 7),
    officialContent,
    officialImages,
    used: Boolean(results.length || officialContent),
    error: results.length || officialContent ? null : notes.join("；") || "Agent-Reach 未返回可用内容"
  }
}

// ── 生产可行性分析 — 面料 / 辅料 / 成本 / 供应商 ──
app.get("/api/erp/customers/:code/production", async (req, res, next) => {
  try {
    const code = safeCustomerCode(req.params.code)
    const kw = { type: sql.NVarChar, value: likeInput(code) }

    const [fabrics, accessories, recentCosts] = await Promise.all([
      // 该客户常用面料（近3年，Top 10）
      readonlyQuery(`
        SELECT TOP 10
          CnName AS name,
          CnComposition AS composition,
          MenFu AS width,
          KeZhong AS weight,
          CnColor AS color,
          AVG(ISNULL(HisPrice, 0)) AS avgPrice,
          COUNT(*) AS usageCount,
          SupplierShortName AS supplier,
          MAX(DeliveryDate) AS lastUsed
        FROM Dom_PurRequirements_Fabric WITH (NOLOCK)
        WHERE CustomerShortName LIKE @kw
          AND CnName IS NOT NULL AND CnName != ''
          AND InputDate >= DATEADD(YEAR, -3, GETDATE())
        GROUP BY CnName, CnComposition, MenFu, KeZhong, CnColor, SupplierShortName
        ORDER BY usageCount DESC
      `, { kw }),

      // 该客户常用辅料（Top 8）
      readonlyQuery(`
        SELECT TOP 8
          CnName AS name,
          ProductSpec AS spec,
          CnColor AS color,
          AVG(ISNULL(Price, 0)) AS avgPrice,
          COUNT(*) AS usageCount,
          SupplierName AS supplier
        FROM Dom_PurRequirements_Accessories WITH (NOLOCK)
        WHERE CustomerName LIKE @kw
          AND CnName IS NOT NULL AND CnName != ''
          AND createTime >= DATEADD(YEAR, -3, GETDATE())
        GROUP BY CnName, ProductSpec, CnColor, SupplierName
        ORDER BY usageCount DESC
      `, { kw }),

      // 近期合同成本区间（报价 + 合同金额）
      readonlyQuery(`
        SELECT TOP 10
          c.BillNo,
          c.CustomerName,
          c.TotalAmount,
          c.ContractDate,
          c.DeliveryDate,
          c.Currency,
          c.TradeType
        FROM EXP_Contract_Garment c WITH (NOLOCK)
        WHERE c.CustomerName LIKE @kw
          AND c.ContractDate >= DATEADD(YEAR, -2, GETDATE())
        ORDER BY c.ContractDate DESC
      `, { kw }),
    ])

    // 汇总统计
    const fabricCount = fabrics.recordset.length
    const accessoryCount = accessories.recordset.length
    const contractCount = recentCosts.recordset.length

    const avgContractAmount = contractCount > 0
      ? recentCosts.recordset.reduce((s, r) => s + (r.TotalAmount || 0), 0) / contractCount
      : 0

    // 去重面料名列表（供前端匹配）
    const fabricNames = [...new Set(fabrics.recordset.map(r => r.name))].filter(Boolean)

    res.json({
      ok: true,
      code,
      summary: {
        fabricCount,
        accessoryCount,
        contractCount,
        avgContractAmount: Math.round(avgContractAmount),
        currency: recentCosts.recordset[0]?.Currency || "USD",
      },
      fabrics: fabrics.recordset.map(r => ({
        name: r.name,
        composition: r.composition,
        width: r.width,
        weight: r.weight,
        color: r.color,
        avgPrice: r.avgPrice,
        usageCount: r.usageCount,
        supplier: r.supplier,
        lastUsed: r.lastUsed,
      })),
      accessories: accessories.recordset.map(r => ({
        name: r.name,
        spec: r.spec,
        color: r.color,
        avgPrice: r.avgPrice,
        usageCount: r.usageCount,
        supplier: r.supplier,
      })),
      fabricNames,
      recentContracts: recentCosts.recordset.slice(0, 5).map(r => ({
        billNo: r.BillNo,
        customerName: r.CustomerName,
        amount: r.TotalAmount,
        contractDate: r.ContractDate,
        deliveryDate: r.DeliveryDate,
        currency: r.Currency,
        tradeType: r.TradeType,
      })),
    })
  } catch (error) {
    next(error)
  }
})

app.post("/api/intel", async (req, res, next) => {
  try {
    const key = getAiKey(req)
    const { customerName, brand, brandInfo, website, erp } = req.body ?? {}
    if (!customerName) {
      const error = new Error("缺少 customerName")
      error.statusCode = 400
      throw error
    }

    const gender = brandInfo?.gender ?? ""
    let host = null
    try { if (website) host = new URL(website).hostname.replace(/^www\./, "") } catch { host = null }

    // 联网情报来源可选：Tavily、Agent-Reach 或混合。前端只传选择，具体采集留在后端。
    const tavilyKey = process.env.TAVILY_API_KEY || req.body?.tavilyKey
    const intelSource = normalizeIntelSource(req.body?.intelSource || process.env.INTEL_SOURCE)
    const useTavily = (intelSource === "tavily" || intelSource === "hybrid") && tavilyKey
    const useReach = intelSource === "agent-reach" || intelSource === "hybrid"
    let tavilyWeb = null
    let reachWeb = null
    let tavilyOfficialContent = ""
    let tavilyOfficialImages = []

    if (useTavily) {
      try {
        const generalQuery = `${brand || customerName} ${gender} 品牌 当季系列 collection 2026 风格 定位 男女`
        const general = await tavilySearch(tavilyKey, generalQuery)
        let officialResults = []
        if (host) {
          try {
            const official = await tavilySearch(tavilyKey, `${brand || customerName} ${gender} collection products`, [host])
            officialResults = official.results ?? []
          } catch { officialResults = [] }
          // 真正进官网首页抓正文 + 图片
          try {
            const extracted = await tavilyExtract(tavilyKey, website)
            tavilyOfficialContent = extracted.content
            tavilyOfficialImages = extracted.images
          } catch { /* 抓取失败不阻断 */ }
        }
        const seen = new Set()
        const merged = [...officialResults, ...(general.results ?? [])]
          .filter((row) => row.url && !seen.has(row.url) && seen.add(row.url))
          .slice(0, 7)
        tavilyWeb = { answer: general.answer ?? "", results: merged, official: officialResults.length }
      } catch (webError) {
        tavilyWeb = { error: webError.message, results: [] }
      }
    }

    if (useReach) {
      reachWeb = await collectAgentReachIntel({ customerName, brand, website, gender })
    }

    const sections = []
    if (tavilyWeb?.results?.length || tavilyOfficialContent) {
      sections.push([
        `实时联网检索（Tavily，公开网页，时间约 ${new Date().toISOString().slice(0, 10)}${host ? `；含官网 ${host}` : ""}）：`,
        tavilyOfficialContent ? `【品牌官网正文摘录】\n${tavilyOfficialContent}` : "",
        tavilyWeb?.answer ? `综合摘要：${tavilyWeb.answer}` : "",
        ...(tavilyWeb?.results ?? []).map((row, index) => `[T${index + 1}] ${row.title}\n${row.url}\n${row.content}`)
      ].filter(Boolean).join("\n"))
    } else if (useTavily && tavilyWeb?.error) {
      sections.push(`（Tavily 联网检索失败：${tavilyWeb.error}）`)
    } else if (intelSource === "tavily") {
      sections.push("（本次未联网检索：未配置 Tavily Key）")
    }

    if (reachWeb?.results?.length || reachWeb?.officialContent) {
      sections.push([
        `Agent-Reach 情报（web/search 路由，时间约 ${new Date().toISOString().slice(0, 10)}${host ? `；含官网 ${host}` : ""}）：`,
        reachWeb.officialContent ? `【品牌官网正文摘录】\n${reachWeb.officialContent}` : "",
        reachWeb.answer ? `通道状态：${reachWeb.answer}` : "",
        ...(reachWeb.results ?? []).map((row, index) => `[R${index + 1}] ${row.title}\n${row.url}\n${row.content}`)
      ].filter(Boolean).join("\n"))
    } else if (useReach && reachWeb?.error) {
      sections.push(`（Agent-Reach 情报暂不可用：${reachWeb.error}）`)
    }

    const webText = sections.length ? sections.join("\n\n") : "（本次未联网检索）"
    const sourceUrls = uniqueStrings([
      ...(tavilyWeb?.results ?? []).map((row) => row.url),
      ...(reachWeb?.results ?? []).map((row) => row.url)
    ], 8)
    const officialImages = uniqueStrings([...(tavilyOfficialImages ?? []), ...(reachWeb?.officialImages ?? [])], 8)

    const system = [
      "你是资深服装买手与服装趋势分析师。你会拿到：实时联网检索到的品牌官网与公开网页、内置品牌信息、ERP 历史订单数据。",
      gender ? `【硬性约束】该客户的目标人群是「${gender}」，必须严格按此性别/人群来分析消费者和给设计方向，绝对不能改成其它性别（例如男装绝不能给成女装）。若联网信息与之冲突，以「${gender}」为准。` : "请先从内置品牌信息和官网判断目标性别/人群，并严格据此设计。",
      website ? `品牌官网：${website}。请优先依据官网内容判断品牌真实定位、风格与当季系列。` : "",
      "ERP 反映工厂端真实订单与面辅料偏好；请把品牌端定位与工厂端能力结合起来。",
      "designDirections 必须是该人群、该品牌可直接落地的具体款式，紧扣品牌既有品类与 ERP 高频面辅料，不要给偏离品牌定位或性别的方向；不要编造检索结果里没有的具体系列。",
      "只输出一个 JSON 对象（不要任何多余文字或解释），字段：",
      "brandSummary(品牌一句话定位，含目标人群), consumer(目标消费者，须与上述性别一致), aesthetic(风格/廓形/色彩调性),",
      "trendDirection(基于官网/联网信息的当季趋势判断), styleTrends(该品类该人群当季正在流行的具体款式/廓形/工艺细节，3-5条字符串数组，要具体到款式而非泛泛而谈),",
      "designDirections(3-5条具体出款方向的字符串数组，每条一句话可落地), fabricColorNotes(面料与色彩建议)。全部用中文。"
    ].filter(Boolean).join("\n")

    const userText = [
      `客户简称/品牌：${customerName}${brand ? `（品牌：${brand}）` : ""}`,
      webText,
      brandInfo ? `内置品牌信息：${JSON.stringify(brandInfo).slice(0, 1200)}` : "（无内置品牌信息）",
      erp ? `ERP 历史摘要（真实订单）：${JSON.stringify(erp).slice(0, 2800)}` : "（暂无 ERP 摘要）",
      "请结合以上资料，给出智能画像 JSON。"
    ].join("\n\n")

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        // v4-flash 快（约数秒）且质量足够；要更深度分析可用 DEEPSEEK_MODEL=deepseek-v4-pro
        model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userText }
        ],
        response_format: { type: "json_object" },
        stream: false
      })
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => "")
      const error = new Error(`DeepSeek 接口报错 ${response.status}：${detail.slice(0, 200)}`)
      error.statusCode = response.status === 401 ? 401 : 502
      throw error
    }

    const data = await response.json()
    const text = data?.choices?.[0]?.message?.content ?? ""
    const parsed = extractJson(text)
    if (!parsed) {
      res.json({ ok: true, parsed: null, raw: text })
      return
    }
    // 用真实采集到的网址作为来源（比让模型自己编网址可靠）
    if (sourceUrls.length) {
      parsed.sources = sourceUrls.slice(0, 5)
    }
    // 官网抓到的真实图片，回传给前端做"官网视觉参考"
    if (officialImages.length) {
      parsed.officialImages = officialImages
    }
    res.json({
      ok: true,
      parsed,
      web: {
        source: intelSource,
        tavily: { used: Boolean(tavilyWeb?.results?.length), error: tavilyWeb?.error ?? null },
        reach: { used: Boolean(reachWeb?.used), error: reachWeb?.error ?? null },
        official: officialImages.length
      }
    })
  } catch (error) {
    next(error)
  }
})

// ───────────────────────────────────────────────────────────────────────────
// 真实出图：火山方舟 Doubao Seedream（图像生成 / 组图 / 图生图）。
// 需要 ARK_API_KEY（环境变量，或前端高级设置传入）。不触碰数据库。
// ───────────────────────────────────────────────────────────────────────────
function getArkKey(req) {
  const key = process.env.ARK_API_KEY || req.body?.arkKey
  if (!key) {
    const error = new Error("未配置火山方舟 ARK_API_KEY（环境变量启动后端，或前端「高级」里填入）")
    error.statusCode = 503
    throw error
  }
  return key
}

app.post("/api/genimage", async (req, res, next) => {
  try {
    const key = getArkKey(req)
    const { prompt, count = 1, size, referenceImage, customerId, customerName, title, lookMeta } = req.body ?? {}
    if (!prompt) {
      const error = new Error("缺少 prompt")
      error.statusCode = 400
      throw error
    }
    const n = Math.max(1, Math.min(Number(count) || 1, 14))

    const body = {
      model: process.env.ARK_MODEL || "doubao-seedream-5-0-260128",
      prompt: String(prompt).slice(0, 1200),
      size: size || "2K",
      response_format: "url",
      watermark: false,
      stream: false
    }
    if (referenceImage) {
      // 把参考图统一转成 base64 data URI，因为火山方舟无法访问 localhost
      try {
        if (referenceImage.startsWith("/api/img/")) {
          // 本地已保存的图片 → 从磁盘读取转 base64
          const imgFile = path.basename(referenceImage)
          const imgPath = path.join(generatedDir, imgFile)
          const buf = await readFile(imgPath)
          const ext = path.extname(imgFile).slice(1) || "jpeg"
          body.image = `data:image/${ext};base64,${buf.toString("base64")}`
        } else if (referenceImage.startsWith("data:image/svg")) {
          // SVG data URI 不被 Ark API 接受 → 跳过，仅用 prompt
          // 不设置 body.image
        } else if (referenceImage.startsWith("data:")) {
          // 已经是 base64 data URI → 直接使用
          body.image = referenceImage
        } else if (referenceImage.startsWith("http")) {
          // 公网 URL → 先尝试下载转 base64，失败则直接用 URL
          try {
            const imgRes = await fetch(referenceImage, { signal: AbortSignal.timeout(30000) })
            if (imgRes.ok) {
              const buf = Buffer.from(await imgRes.arrayBuffer())
              const ct = imgRes.headers.get("content-type") || "image/jpeg"
              const ext = ct.includes("png") ? "png" : "jpeg"
              body.image = `data:image/${ext};base64,${buf.toString("base64")}`
            } else {
              body.image = referenceImage
            }
          } catch {
            body.image = referenceImage
          }
        } else {
          body.image = referenceImage
        }
      } catch {
        // 转换失败则不带参考图，仅用 prompt 生成
      }
    }
    if (n > 1) {
      body.sequential_image_generation = "auto"
      body.sequential_image_generation_options = { max_images: n }
    } else {
      body.sequential_image_generation = "disabled"
    }

    // 每张图约 30-40 秒，超时按图片数量 × 60 秒计算
    const fetchTimeout = Math.max(60000, n * 60000)
    let response = null
    let lastConnectError = null
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await fetch("https://ark.cn-beijing.volces.com/api/v3/images/generations", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(fetchTimeout)
        })
        break
      } catch (fetchError) {
        lastConnectError = fetchError
      }
    }
    if (!response) {
      const error = new Error(`连接火山方舟失败（重试多次仍超时）：${lastConnectError?.cause?.code || lastConnectError?.message || "网络问题"}`)
      error.statusCode = 504
      throw error
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => "")
      const error = new Error(`火山方舟报错 ${response.status}：${detail.slice(0, 300)}`)
      error.statusCode = response.status === 401 ? 401 : 502
      throw error
    }
    const data = await response.json()
    const rawImages = (data.data ?? [])
      .map((item) => item.url || (item.b64_json ? `data:image/png;base64,${item.b64_json}` : null))
      .filter(Boolean)

    // 把火山方舟返回的图片落地到本地磁盘，返回永久可用的 /api/img/ 链接；下载失败则退回原始URL
    const images = []
    for (const src of rawImages) {
      try {
        let buffer
        let ext = "jpeg"
        if (src.startsWith("data:")) {
          const match = src.match(/^data:image\/(\w+);base64,(.*)$/)
          if (!match) { images.push(src); continue }
          ext = match[1] === "png" ? "png" : "jpeg"
          buffer = Buffer.from(match[2], "base64")
        } else {
          const imgRes = await fetch(src, { signal: AbortSignal.timeout(60000) })
          if (!imgRes.ok) { images.push(src); continue }
          ext = (imgRes.headers.get("content-type") || "").includes("png") ? "png" : "jpeg"
          buffer = Buffer.from(await imgRes.arrayBuffer())
        }
        const file = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        await writeFile(path.join(generatedDir, file), buffer)
        // 同步保存元数据 JSON，实现图片的长期持久化
        const metaFile = `${path.basename(file, path.extname(file))}.json`
        const meta = {
          createdAt: new Date().toISOString(),
          prompt: String(prompt).slice(0, 2000),
          customerId: customerId ?? null,
          customerName: customerName ?? null,
          title: title ?? null,
          ...(lookMeta && typeof lookMeta === "object" ? lookMeta : {}),
        }
        await writeFile(path.join(generatedDir, metaFile), JSON.stringify(meta, null, 2))
        images.push(`/api/img/${file}`)
      } catch {
        images.push(src) // 落地失败就用原始URL兜底（24h内仍可看）
      }
    }
    res.json({ ok: true, images, model: body.model })
  } catch (error) {
    next(error)
  }
})

// ─── 导出 API ───

/**
 * POST /api/export/excel
 * Body: { type: "design-review" | "tech-pack", customer, looks, erpSummary?, cost? }
 * 返回 .xlsx 二进制文件
 */
app.post("/api/export/excel", async (req, res, next) => {
  try {
    const body = req.body
    if (!body) return res.status(400).json({ error: "missing body" })

    const { type, customer, looks, look, erpSummary, cost } = body

    let wb
    let filename
    const now = new Date().toISOString().slice(0, 10)

    if (type === "design-review") {
      if (!customer || !looks) return res.status(400).json({ error: "need customer and looks" })
      wb = await buildDesignReviewWorkbook({ customer, looks })
      filename = `设计评审_${customer.name}_${now}.xlsx`
    } else if (type === "tech-pack") {
      if (!look || !customer) return res.status(400).json({ error: "need look and customer" })
      wb = await buildTechPackWorkbook({ look, customer, erpSummary, cost })
      filename = `工艺单_${look.title}_${now}.xlsx`
    } else {
      return res.status(400).json({ error: `unknown type: ${type}` })
    }

    const buffer = await workbookToBuffer(wb)
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
    res.send(Buffer.from(buffer))
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/export/pdf
 * Body: { type: "design-review" | "tech-pack", customer, looks, look, erpSummary?, cost? }
 * 返回 .pdf 二进制文件
 */
app.post("/api/export/pdf", async (req, res, next) => {
  try {
    const body = req.body
    if (!body) return res.status(400).json({ error: "missing body" })

    const { type, customer, looks, look, erpSummary, cost } = body

    let pdfBuffer
    let filename
    const now = new Date().toISOString().slice(0, 10)

    if (type === "design-review") {
      if (!customer || !looks) return res.status(400).json({ error: "need customer and looks" })
      pdfBuffer = await generateDesignReviewPDF({ customer, looks })
      filename = `设计评审_${customer.name}_${now}.pdf`
    } else if (type === "tech-pack") {
      if (!look || !customer) return res.status(400).json({ error: "need look and customer" })
      pdfBuffer = await generateTechPackPDF({ look, customer, erpSummary, cost })
      filename = `工艺单_${look.title}_${now}.pdf`
    } else {
      return res.status(400).json({ error: `unknown type: ${type}` })
    }

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
    res.send(pdfBuffer)
  } catch (error) {
    if (error.message?.includes("puppeteer") || error.message?.includes("browser")) {
      res.status(500).json({ error: "PDF 生成失败，请确认服务器已安装 Chromium", detail: error.message })
    } else {
      next(error)
    }
  }
})

app.use((error, _req, res, _next) => {
  const status = error.statusCode ?? 500
  res.status(status).json({
    error: status === 500 ? "ERP read-only API error" : error.message,
    detail: error.message
  })
})

app.listen(port, () => {
  console.log(`ERP read-only API listening on http://localhost:${port}`)
  console.log(`Database target: ${config.server}:${config.port}/${database}`)
  console.log("Safety: GET-only routes, fixed SELECT queries, no write endpoints")
})
