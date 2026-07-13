import { ChangeEvent, useEffect, useMemo, useState } from "react"
import {
  Check, Clipboard, Database, Download, FileJson, FileText, Globe, GitBranch, ImagePlus, Layers,
  Loader2, Printer, RotateCcw, Shirt, Settings2, Sparkles, TrendingUp, Upload, X
} from "lucide-react"
import { customers as seededCustomers } from "./data/customers"
import { brandIntel } from "./data/brandIntel"
import { deleteSavedImage, fetchErpCustomerSummary, fetchErpCustomerTrend, fetchErpStatus, fetchGenImages, fetchIntel, fetchSavedImages } from "./services/erp"
import { buildLocalPreviewImage, buildLookImagePrompt, compareLookWithHistory, estimateCost, generateLooks, generateIteratedLook } from "./services/generation"
import { traceToVector, downloadVectorSVG } from "./services/vectorize"
import { getTechSketchPngDataURL } from "./services/techSketch"
import type {
  ApiConfig, ComparisonResult, CostEstimate, CustomerProfile, CustomerTrend,
  ErpCustomerSummary, GeneratedLook, GenerationSettings, IntelResult
} from "./types"
import { buildMarkdownExport, buildTechPackMarkdown, downloadExcel, downloadJson, downloadMarkdown, downloadPDF, exportTechPackPDF } from "./utils/export"
import { DashboardView } from "./components/DashboardView"
import { ComparisonView } from "./components/ComparisonView"
import { MoodBoardView } from "./components/MoodBoardView"
import { SidebarView } from "./components/SidebarView"
import { TrendSection } from "./components/TrendSection"
import { LookDetail } from "./components/LookDetail"
import { ProfileCard } from "./components/ProfileCard"
import { LookCard } from "./components/LookCard"
import { AdvancedPanel } from "./components/AdvancedPanel"
import { ImageGalleryView } from "./components/ImageGalleryView"
import { ProductionPanel } from "./components/ProductionPanel"
import { SCORE_THRESHOLD, STORAGE_KEY, STORAGE_VERSION, MIN_LOOK_COUNT, MAX_LOOK_COUNT, DEFAULT_GENERATION_SETTINGS, DEFAULT_API_CONFIG, SEASONS, CATEGORY_OPTIONS } from "./constants"
import { copyText, imageStatusMeta, reviewStatusOf, statusTone, srcClass, intelSourceLabel, type ReviewStatus } from "./utils/helpers"

const storageKey = STORAGE_KEY

/** 从 prompt 生成一致性 seed（同 prompt 多次出图结果稳定） */
function hashForPrompt(prompt: string): number {
  let h = 0
  for (let i = 0; i < prompt.length; i++) { h = ((h << 5) - h + prompt.charCodeAt(i)) | 0 }
  return Math.abs(h) % 2147483647
}

/** 并发限流：控制同时运行的最大 Promise 数量 */
async function pLimit<T>(concurrency: number, items: T[], task: (item: T) => Promise<void>): Promise<void> {
  const executing: Promise<void>[] = []
  for (const item of items) {
    const p = task(item)
    executing.push(p)
    p.then(() => { executing.splice(executing.indexOf(p), 1) })
    if (executing.length >= concurrency) {
      await Promise.race(executing)
    }
  }
  await Promise.all(executing)
}
const storageVersion = STORAGE_VERSION
const minLookCount = MIN_LOOK_COUNT
const maxLookCount = MAX_LOOK_COUNT

type ViewType = "workbench" | "dashboard" | "comparison" | "moodboard" | "gallery"

const defaultSettings: GenerationSettings = DEFAULT_GENERATION_SETTINGS
const defaultApiConfig: ApiConfig = DEFAULT_API_CONFIG
const seasons = SEASONS
const categoryOptions = CATEGORY_OPTIONS
const designTemplates = [
  { name: "通勤夹克", category: "夹克", mustHave: "干净短外套廓形、轻商务通勤、隐藏门襟或精致拉链、可量产梭织面料", avoid: "避免过度户外化、夸张口袋和高成本五金" },
  { name: "户外裤", category: "户外裤", mustHave: "直筒或微锥裤型、弹力机能面料、可调节腰头、拉链安全袋", avoid: "避免重装登山感、过多分割线和复杂压胶" },
  { name: "针织套头", category: "针织套头", mustHave: "松弛套头比例、细腻针织肌理、领口袖口稳定、适合系列配色", avoid: "避免过薄透底、过松变形和难维护纱线" },
  { name: "连衣裙", category: "连衣裙", mustHave: "可销售A字或衬衫裙廓形、腰节清晰、垂感面料、通勤到休闲可切换", avoid: "避免复杂露肤、过多抽褶和难生产结构" },
  { name: "卫衣", category: "卫衣", mustHave: "年轻休闲轮廓、罗纹稳定、局部拼接或袋型变化、可做系列色", avoid: "避免印花过多、帽绳复杂和厚重僵硬" },
  { name: "羽绒服", category: "羽绒服", mustHave: "保暖轻量、绗缝比例清楚、防钻绒面料、袖口和下摆防风结构", avoid: "避免过大廓形、过密绗线和不可控充绒量" },
  { name: "软壳", category: "软壳", mustHave: "轻户外软壳面料、利落分割线、防风立领、运动通勤两用", avoid: "避免专业装备感过强、过多反光和复杂贴膜" },
  { name: "风衣", category: "风衣", mustHave: "中长风衣比例、挺括但有垂感、腰带或抽绳调节、经典门襟", avoid: "避免过长压身、硬挺噪音面料和复杂拼接" },
]
const materialLibrary = [
  { name: "四面弹尼龙", weight: "140-180gsm", composition: "Nylon/Spandex", categories: ["户外裤", "软壳", "夹克"], risk: "浅色易显皱，需确认色牢度", price: "$3.2-4.8/m" },
  { name: "涤棉斜纹", weight: "220-260gsm", composition: "Poly/Cotton", categories: ["夹克", "风衣", "长裤"], risk: "洗后缩率和起毛需测试", price: "$2.4-3.6/m" },
  { name: "羊毛混纺针织", weight: "12-14针", composition: "Wool/Nylon/Acrylic", categories: ["针织套头", "套装"], risk: "注意缩水、起球和手感批差", price: "$6.5-9.0/kg" },
  { name: "轻量防钻绒胆布", weight: "35-55gsm", composition: "Nylon/Poly", categories: ["羽绒服", "马甲"], risk: "需做防钻绒和撕裂强力测试", price: "$1.8-3.2/m" },
  { name: "天丝混纺平纹", weight: "150-190gsm", composition: "Tencel/Poly", categories: ["连衣裙", "衬衫"], risk: "湿态强力和色花风险需关注", price: "$3.8-5.6/m" },
  { name: "棉涤抓绒", weight: "280-360gsm", composition: "Cotton/Poly", categories: ["卫衣"], risk: "克重高会影响运费和蓬松度", price: "$3.0-4.6/m" },
]
const colorLibrary = ["#2f3a34", "#879582", "#d9ded2", "#3c332c", "#b8875d", "#efe0cf", "#24364b", "#8aa0b5", "#f1ece1", "#6f6a61", "#c9c1b5", "#f5f1e8"]
const defaultCustomerId = seededCustomers.find((customer) => customer.id === "tj")?.id ?? seededCustomers[0].id
type DataSource = "erp" | "master-only" | "none" | "loading" | "error"
type ResultFilter = "all" | "selected" | "recommended" | "draft" | ReviewStatus
type ResultSort = "newest" | "score" | "trend" | "commercial"

interface StoredState {
  version?: number
  customers: CustomerProfile[]
  looks: GeneratedLook[]
  apiConfig: ApiConfig
}

// ═══════════════ App ─══════════════

export function App() {
  const [initialState] = useState<StoredState | null>(() => loadState())
  const [profiles, setProfiles] = useState<CustomerProfile[]>(() => initialState?.customers?.length ? initialState.customers : seededCustomers)
  const [looks, setLooks] = useState<GeneratedLook[]>(() => initialState?.looks ?? [])
  const [apiConfig, setApiConfig] = useState<ApiConfig>(() => normalizeApiConfig(initialState))
  const [selectedCustomerId, setSelectedCustomerId] = useState(profiles.find((customer) => customer.id === defaultCustomerId)?.id ?? profiles[0]?.id ?? defaultCustomerId)
  const [settings, setSettings] = useState<GenerationSettings>(defaultSettings)
  const [erpSummaries, setErpSummaries] = useState<Record<string, ErpCustomerSummary>>({})
  const [appliedErpIds, setAppliedErpIds] = useState<string[]>([])
  const [erpLoadingCustomerId, setErpLoadingCustomerId] = useState<string | null>(null)
  const [erpErrors, setErpErrors] = useState<Record<string, string>>({})
  const [referencePreview, setReferencePreview] = useState<string | null>(null)
  const [referenceNote, setReferenceNote] = useState("")
  const [trendByCustomer, setTrendByCustomer] = useState<Record<string, CustomerTrend>>({})
  const [intelByCustomer, setIntelByCustomer] = useState<Record<string, IntelResult>>({})
  const [intelLoading, setIntelLoading] = useState(false)
  const [intelError, setIntelError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [genProgress, setGenProgress] = useState<{ done: number; total: number; ok: number; fail: number } | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all")
  const [resultSort, setResultSort] = useState<ResultSort>("newest")
  const [toast, setToast] = useState<string | null>(null)
  const [detailLook, setDetailLook] = useState<GeneratedLook | null>(null)
  const [activeView, setActiveView] = useState<ViewType>("workbench")

  const selectedCustomer = useMemo(
    () => profiles.find((c) => c.id === selectedCustomerId) ?? profiles[0] ?? seededCustomers[0],
    [profiles, selectedCustomerId]
  )

  const erpSummary = erpSummaries[selectedCustomer.id] ?? null
  const erpError = erpErrors[selectedCustomer.id] ?? null
  const erpLoading = erpLoadingCustomerId === selectedCustomer.id
  const erpContracts = Number(erpSummary?.stats.contracts.contractCount ?? 0)
  const erpQuotations = Number(erpSummary?.stats.quotations.quotationCount ?? 0)
  const erpHasOrders = Boolean(erpSummary) && (erpContracts > 0 || erpQuotations > 0)
  const erpApplied = appliedErpIds.includes(selectedCustomer.id)
  const dataSource: DataSource = erpLoading && !erpSummary
    ? "loading" : erpHasOrders ? "erp" : erpSummary?.matched ? "master-only"
    : erpSummary ? "none" : erpError ? "error" : "loading"

  const customerLooks = looks.filter((l) => l.customerId === selectedCustomer.id)
  const selectedLooks = customerLooks.filter((l) => l.selected)
  const recommendedLooks = customerLooks.filter((l) => l.score >= SCORE_THRESHOLD)
  const reviewCounts = useMemo(() => customerLooks.reduce<Record<ReviewStatus, number>>(
    (counts, l) => { counts[reviewStatusOf(l)] += 1; return counts }, { 待看: 0, 入选: 0, 待修改: 0, 淘汰: 0 }
  ), [customerLooks])
  const customerLookCounts = useMemo(() => profiles.reduce<Record<string, number>>(
    (counts, p) => { counts[p.id] = looks.filter((l) => l.customerId === p.id).length; return counts }, {}
  ), [looks, profiles])
  const displayedLooks = useMemo(
    () => sortLooks(filterLooks(customerLooks, resultFilter), resultSort), [customerLooks, resultFilter, resultSort]
  )
  const recommendedMaterials = useMemo(
    () => materialLibrary.filter((m) => settings.category === "自动匹配" || m.categories.includes(settings.category)).slice(0, 3),
    [settings.category]
  )

  function applyDesignTemplate(t: typeof designTemplates[number]) {
    setSettings((s) => ({ ...s, category: t.category, mustHave: t.mustHave, avoid: t.avoid }))
    setToast(`已套用模板：${t.name}`)
  }

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ version: storageVersion, customers: profiles, looks, apiConfig }))
  }, [profiles, looks, apiConfig])

  // 启动时从后端恢复已保存的图片（长期持久化）
  useEffect(() => {
    let cancelled = false
    async function restoreSavedImages() {
      try {
        const savedImages = await fetchSavedImages()
        if (cancelled || !savedImages.length) return
        setLooks((prev) => {
          const existingUrls = new Set(prev.map((l) => l.image))
          const restored: GeneratedLook[] = []
          for (const img of savedImages) {
            if (!img.url || existingUrls.has(img.url)) continue
            if (!img.customerId) continue // 没有客户关联的图片暂不恢复
            existingUrls.add(img.url)
            restored.push({
              id: `restored-${img.file}`,
              customerId: img.customerId,
              title: img.title || "已保存款式",
              prompt: img.prompt || "",
              image: img.url,
              score: Number(img.score ?? 0),
              trendScore: Number(img.trendScore ?? 0),
              commercialScore: Number(img.commercialScore ?? 0),
              estimatedCost: Number(img.estimatedCost ?? 0),
              sourceMode: (img.sourceMode === "参考图融合" || img.sourceMode === "线稿图" ? img.sourceMode : "定向出款"),
              selected: Boolean(img.selected),
              reviewStatus: (img.reviewStatus === "入选" || img.reviewStatus === "待修改" || img.reviewStatus === "淘汰") ? img.reviewStatus : "待看",
              note: img.note || "",
              palette: Array.isArray(img.palette) ? img.palette : [],
              keyDetails: Array.isArray(img.keyDetails) ? img.keyDetails : [],
              revisionAdvice: img.revisionAdvice || "",
              createdAt: img.createdAt ? new Date(img.createdAt).toLocaleString("zh-CN") : "",
              imageStatus: "model-ready",
              designDirection: img.designDirection || undefined,
              version: img.version ?? undefined,
            })
          }
          return [...prev, ...restored]
        })
      } catch {
        // 后端不可用时静默跳过
      }
    }
    restoreSavedImages()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (erpSummaries[selectedCustomer.id] || erpLoadingCustomerId === selectedCustomer.id) return
    void loadErpData(selectedCustomer)
  }, [selectedCustomer.id])

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t) }, [toast])

  async function loadErpData(customer: CustomerProfile) {
    setErpLoadingCustomerId(customer.id)
    setErpErrors((c) => { const n = { ...c }; delete n[customer.id]; return n })
    try {
      const [summaryResult, trendResult] = await Promise.allSettled([
        fetchErpCustomerSummary(customer.erpCode ?? customer.name),
        fetchErpCustomerTrend(customer.erpCode ?? customer.name),
      ])
      if (summaryResult.status === "rejected") {
        throw summaryResult.reason
      }
      const summary = summaryResult.value
      const trend = trendResult.status === "fulfilled" ? trendResult.value : null
      if (summary) {
        setErpSummaries((c) => ({ ...c, [customer.id]: summary }))
        if (summary.suggestedProfilePatch && !appliedErpIds.includes(customer.id)) {
          setProfiles((prev) => prev.map((p) => p.id === customer.id ? { ...p, ...summary.suggestedProfilePatch } : p))
          setAppliedErpIds((ids) => [...ids, customer.id])
        }
      }
      if (trend && trend.years?.length) {
        setTrendByCustomer((c) => ({ ...c, [customer.id]: trend }))
      }
    } catch (err) {
      setErpErrors((c) => ({ ...c, [customer.id]: err instanceof Error ? err.message : "ERP 连接失败" }))
    } finally {
      setErpLoadingCustomerId(null)
    }
  }

  async function handleIntelAnalyze() {
    setIntelLoading(true); setIntelError(null)
    const brand = brandIntel[selectedCustomer.id]
    try {
      const result = await fetchIntel({
        customerName: selectedCustomer.name,
        brand: brand?.brand,
        brandInfo: brand,
        website: brand?.website,
        apiKey: apiConfig.aiKey,
        tavilyKey: apiConfig.tavilyKey,
        intelSource: apiConfig.intelSource ?? "hybrid",
      })
      if (result) setIntelByCustomer((c) => ({ ...c, [selectedCustomer.id]: result }))
    } catch (err) { setIntelError(err instanceof Error ? err.message : "AI 分析失败") }
    finally { setIntelLoading(false) }
  }

  async function handleGenerate(mode: GeneratedLook["sourceMode"]) {
    if (isGenerating) return; setIsGenerating(true); setGenProgress(null)
    try {
      const useArk = apiConfig.provider === "ark"
      const generated = await generateLooks({
        customer: selectedCustomer, settings, mode,
        referenceNote: referencePreview ? referenceNote : undefined,
        erp: erpSummary ? { summary: erpSummary, trend: trendByCustomer[selectedCustomer.id] ?? undefined, intel: intelByCustomer[selectedCustomer.id] } : undefined,
      })
      if (generated.length) {
        const withImages = generated.map((l) => {
          const localPreview = buildLocalPreviewImage(l)
          return { ...l, image: localPreview, imageStatus: useArk ? "model-generating" as const : "local-preview" as const, createdAt: new Date().toLocaleString("zh-CN") }
        })
        setLooks((prev) => [...prev, ...withImages])
        if (!useArk) {
          setToast(`已生成 ${generated.length} 款本地预览`)
          return
        }
        const total = withImages.length; setGenProgress({ done: 0, total, ok: 0, fail: 0 })
        await pLimit(2, withImages, async (look) => {
          // 参考图优先级：参考图融合模式用用户上传图；否则若开启线稿控制则用线稿 PNG 锁定廓形
          let referenceImage: string | undefined
          if (mode === "参考图融合") {
            referenceImage = referencePreview ?? undefined
          } else if (settings.useSketchControl) {
            referenceImage = (await getTechSketchPngDataURL(look, selectedCustomer)) ?? undefined
          }
          try {
            const images = await fetchGenImages({
              prompt: look.prompt,
              count: 1,
              size: settings.imageSize,
              seed: hashForPrompt(look.prompt),
              arkKey: apiConfig.arkKey,
              referenceImage,
              customerId: selectedCustomer.id,
              customerName: selectedCustomer.name,
              title: look.title,
              lookMeta: savedLookMeta(look),
            })
            const imageUrl = images[0] ?? ""
            setLooks((prev) => prev.map((l) =>
              l.id === look.id ? { ...l, image: imageUrl || l.image, imageStatus: imageUrl ? "model-ready" : "model-failed", imageError: imageUrl ? undefined : "模型未返回图片" } : l
            ))
            setGenProgress((p) => p ? { ...p, done: p.done + 1, ok: images.length > 0 ? p.ok + 1 : p.ok } : null)
          } catch (err) {
            const message = err instanceof Error ? err.message : "真实出图失败"
            setLooks((prev) => prev.map((l) => l.id === look.id ? { ...l, imageStatus: "model-failed", imageError: message } : l))
            setGenProgress((p) => p ? { ...p, done: p.done + 1, fail: p.fail + 1 } : null)
          }
        })
        setToast(`已生成 ${generated.length} 款设计，正在真实出图`)
      }
    } catch (err) { setToast("生成失败：" + (err instanceof Error ? err.message : "未知错误")) }
    finally { setIsGenerating(false) }
  }

  function handleReferenceUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setReferenceNote("客户参考图：" + file.name)
    const reader = new FileReader()
    reader.onload = () => setReferencePreview(typeof reader.result === "string" ? reader.result : null)
    reader.readAsDataURL(file)
  }

  function updateLookNote(id: string, note: string) { setLooks((c) => c.map((l) => l.id === id ? { ...l, note } : l)) }
  function updateLookReviewStatus(id: string, status: ReviewStatus) { setLooks((c) => c.map((l) => l.id === id ? { ...l, selected: status === "入选", reviewStatus: status } : l)) }
  function updateLookModificationNote(id: string, n: string) { setLooks((c) => c.map((l) => l.id === id ? { ...l, modificationNote: n } : l)) }

  function exportMarkdown() {
    downloadMarkdown(`${selectedCustomer.name}-AI推款包.md`, buildMarkdownExport({ customer: selectedCustomer, looks: customerLooks }))
    setToast("Markdown 推款包已导出")
  }
  function exportJson() { downloadJson(`${selectedCustomer.name}-AI推款数据.json`, { customer: selectedCustomer, looks: customerLooks, settings }); setToast("JSON 数据包已导出") }
  
  function selectRecommendedLooks() {
    setLooks((c) => c.map((l) => l.customerId === selectedCustomer.id && l.score >= SCORE_THRESHOLD ? { ...l, selected: true, reviewStatus: "入选" } : l))
    setToast(`已把 ${selectedCustomer.name} 的高分款选入精修池`)
  }
  function clearSelectedLooks() {
    setLooks((c) => c.map((l) => l.customerId === selectedCustomer.id ? { ...l, selected: false, reviewStatus: reviewStatusOf(l) === "入选" ? "待看" : reviewStatusOf(l) } : l))
    setToast(`已取消 ${selectedCustomer.name} 的全部选择`)
  }
  async function copyLookPrompt(look: GeneratedLook) { const ok = await copyText(look.prompt); setToast(ok ? `已复制「${look.title}」提示词` : "复制失败") }
  function resetCurrentCustomerLooks() {
    if (!customerLooks.length) return; if (!window.confirm(`确认清空 ${selectedCustomer.name} 的 ${customerLooks.length} 款记录吗？`)) return
    void Promise.allSettled(customerLooks.map((look) => deleteSavedImage(look.image)))
    setLooks((c) => c.filter((l) => l.customerId !== selectedCustomer.id)); setToast(`已清空 ${selectedCustomer.name} 的记录`)
  }
  function exportTechPack(look: GeneratedLook) {
    downloadMarkdown(`${look.title.replace(/[\\/:*?"<>|]/g, "_")}-TechPack.md`, buildTechPackMarkdown(look, selectedCustomer, erpSummary ?? undefined))
    setToast(`Tech Pack 已导出：「${look.title}」`)
  }
  async function vectorizeLook(look: GeneratedLook) {
    if (!look.image) { setToast("该款式没有图片"); return }
    try {
      const svg = await traceToVector(look.image)
      if (svg) { downloadVectorSVG(svg, look.title); setToast(`矢量 SVG 已导出：「${look.title}」`) }
      else setToast("矢量转换未返回结果")
    } catch { setToast("矢量转换失败，请重试") }
  }
  async function handleIterate(look: GeneratedLook, modification: string) {
    const iterated = await generateIteratedLook({ baseLook: look, customer: selectedCustomer, settings, modification, erp: undefined })
    const localPreview = buildLocalPreviewImage(iterated)
    const useArk = apiConfig.provider === "ark"
    const withImage = { ...iterated, image: localPreview, imageStatus: useArk ? "model-generating" as const : "local-preview" as const, createdAt: new Date().toLocaleString("zh-CN") }
    setLooks((c) => [...c, withImage]); setToast(`已生成 V${iterated.version ?? 2}：「${iterated.title}」`)
    if (!useArk) return
    fetchGenImages({
      prompt: iterated.prompt,
      count: 1,
      size: settings.imageSize,
      seed: hashForPrompt(iterated.prompt),
      arkKey: apiConfig.arkKey,
      referenceImage: look.image && !look.image.startsWith("data:image/svg") ? look.image : undefined,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      title: iterated.title,
      lookMeta: savedLookMeta(iterated),
    })
      .then((images) => {
        const imageUrl = images[0] ?? ""
        setLooks((prev) => prev.map((l) => l.id === withImage.id ? { ...l, image: imageUrl || l.image, imageStatus: imageUrl ? "model-ready" : "model-failed", imageError: imageUrl ? undefined : "模型未返回图片" } : l))
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "真实出图失败"
        setLooks((prev) => prev.map((l) => l.id === withImage.id ? { ...l, imageStatus: "model-failed", imageError: message } : l))
      })
  }
  async function deleteLook(look: GeneratedLook) {
    await deleteSavedImage(look.image)
    setLooks((c) => c.filter((l) => l.id !== look.id))
  }
  function getComparisonForLook(look: GeneratedLook) { return compareLookWithHistory({ look, customer: selectedCustomer, erpSummary: erpSummaries[selectedCustomer.id] ?? null, trend: trendByCustomer[selectedCustomer.id] ?? null }) }
  function getCostEstimate(look: GeneratedLook) { return estimateCost(look, selectedCustomer, erpSummaries[selectedCustomer.id] ?? null) }

  async function exportExcel() {
    const ok = await downloadExcel("design-review", { customer: selectedCustomer, looks: customerLooks, erpSummary: erpSummary ?? undefined })
    if (ok) setToast("设计评审 Excel 已导出")
  }
  async function exportPDFReview() {
    const ok = await downloadPDF("design-review", { customer: selectedCustomer, looks: customerLooks })
    if (ok) setToast("设计评审 PDF 已导出")
  }
  async function exportLookTechPackExcel(look: GeneratedLook) {
    const ok = await downloadExcel("tech-pack", { look, customer: selectedCustomer, erpSummary: erpSummary ?? undefined, cost: getCostEstimate(look) })
    if (ok) setToast(`工艺单 Excel 已导出：「${look.title}」`)
  }
  async function exportLookTechPackPDF(look: GeneratedLook) {
    const ok = await downloadPDF("tech-pack", { look, customer: selectedCustomer, erpSummary: erpSummary ?? undefined, cost: getCostEstimate(look) })
    if (ok) setToast(`工艺单 PDF 已导出：「${look.title}」`)
  }

  // ─── Render ───
  return (
    <div className="app-shell">
      <SidebarView activeView={activeView} onNavigate={setActiveView} />

      {activeView === "dashboard" && (
        <div className="page"><DashboardView profiles={profiles} looks={looks} onSelectCustomer={(id) => setSelectedCustomerId(id)} onSwitchToWorkbench={() => setActiveView("workbench")} /></div>
      )}
      {activeView === "comparison" && (
        <div className="page"><ComparisonView profiles={profiles} looks={looks} /></div>
      )}
      {activeView === "moodboard" && (
        <div className="page"><MoodBoardView looks={looks} customerNames={Object.fromEntries(profiles.map((p) => [p.id, p.name]))} /></div>
      )}
      {activeView === "gallery" && (
        <ImageGalleryView />
      )}

      {activeView === "workbench" && (
        <div className="page">
          <header className="topbar">
            <div className="brand">
              <span className="logo">SD</span>
              <div><strong>AI 服装定向设计</strong><small>选客户 · 一键出款 · 挑图导出</small></div>
            </div>
            <div className="topbar-right">
              <label className="customer-pick">
                <span>客户</span>
                <select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}>
                  {profiles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <button className="secondary-btn compact-btn" onClick={() => setShowAdvanced((v) => !v)} title="高级设置">
                <Settings2 size={16} /> 高级
              </button>
            </div>
          </header>

          <ProfileCard
            customer={selectedCustomer} dataSource={dataSource}
            erpContracts={erpContracts} erpQuotations={erpQuotations}
            erpApplied={erpApplied} erpError={erpError} onRetry={() => loadErpData(selectedCustomer)}
            intel={intelByCustomer[selectedCustomer.id] ?? null} intelLoading={intelLoading}
            intelError={intelError} onAnalyze={handleIntelAnalyze}
            intelSource={apiConfig.intelSource ?? "hybrid"}
            trend={trendByCustomer[selectedCustomer.id] ?? null}
          />

          {showAdvanced && <AdvancedPanel apiConfig={apiConfig} onApiChange={setApiConfig} settings={settings} onSettingsChange={setSettings} onReload={() => loadErpData(selectedCustomer)} erpLoading={erpLoading} />}

          <ProductionPanel customerCode={selectedCustomer.erpCode ?? selectedCustomer.name} customerName={selectedCustomer.name} />

          <section className="card">
            <div className="step-head"><span className="step-no">2</span><h2>生成定向款</h2></div>
            <div className="generate-controls">
              <label className="mini-field"><span>季节</span><select value={settings.season} onChange={(e) => setSettings({ ...settings, season: e.target.value })}>{seasons.map((s) => <option key={s}>{s}</option>)}</select></label>
              <label className="mini-field"><span>品类</span><select value={settings.category} onChange={(e) => setSettings({ ...settings, category: e.target.value })}>{categoryOptions.map((c) => <option key={c}>{c}</option>)}</select></label>
              <label className="mini-field"><span>数量</span><input type="number" min={minLookCount} max={maxLookCount} value={settings.count} onChange={(e) => setSettings({ ...settings, count: Math.max(minLookCount, Math.min(maxLookCount, Number(e.target.value) || minLookCount)) })} /></label>
              <button className="primary-btn" onClick={() => handleGenerate("定向出款")} disabled={isGenerating}>
                {isGenerating ? <><Loader2 className="spin" size={16} /> 生成中…</> : <><Sparkles size={16} /> 生成定向款</>}
              </button>
              <button className="secondary-btn" onClick={() => handleGenerate("线稿图")} disabled={isGenerating}>
                <Shirt size={16} /> 线稿图
              </button>
            </div>
            <div className="template-row">
              {designTemplates.slice(0, 4).map((t) => <button key={t.name} className="chip-btn" onClick={() => applyDesignTemplate(t)}>{t.name}</button>)}
            </div>
            <div className="mini-grid">
              <label className="mini-field wide"><span>必须保留</span><input value={settings.mustHave} onChange={(e) => setSettings({ ...settings, mustHave: e.target.value })} /></label>
              <label className="mini-field wide"><span>避免方向</span><input value={settings.avoid} onChange={(e) => setSettings({ ...settings, avoid: e.target.value })} /></label>
            </div>
            <div className="reference-row">
              <label className="reference-upload"><input type="file" accept="image/*" onChange={handleReferenceUpload} />{referencePreview ? <img src={referencePreview} alt="参考图" /> : <span><Upload size={16} /> 上传参考图（可选）</span>}</label>
              <div className="reference-text">
                <p>{referencePreview ? referenceNote : "客户发来类似感觉的图时，上传后可按这张图融合出款。"}</p>
                <button className="secondary-btn" onClick={() => handleGenerate("参考图融合")} disabled={isGenerating || !referencePreview}><ImagePlus size={16} /> 生成融合款</button>
              </div>
            </div>
          </section>

          <section className="card results-card" id="results">
            <div className="results-head">
              <div className="step-head"><span className="step-no">3</span><h2>挑款 / 导出</h2></div>
              <div className="results-meta">
                <span>{customerLooks.length} 款结果</span><span>已选 {selectedLooks.length} 款</span>
                <button className="secondary-btn compact-btn" onClick={resetCurrentCustomerLooks} disabled={!customerLooks.length}><RotateCcw size={15} /> 清空</button>
                <button className="secondary-btn compact-btn" onClick={exportJson} disabled={!customerLooks.length}><FileJson size={15} /> JSON</button>
                <button className="secondary-btn compact-btn" onClick={exportExcel} disabled={!customerLooks.length}><Download size={15} /> Excel</button>
                <button className="secondary-btn compact-btn" onClick={exportPDFReview} disabled={!customerLooks.length}><Printer size={15} /> PDF</button>
                <button className="primary-btn compact-btn" onClick={exportMarkdown} disabled={!customerLooks.length}><Download size={15} /> 推款包</button>
              </div>
            </div>
            <div className="results-toolbar">
              <div className="segmented" role="group" aria-label="结果筛选">
                <button className={resultFilter === "all" ? "active" : ""} onClick={() => setResultFilter("all")}>全部</button>
                <button className={resultFilter === "selected" ? "active" : ""} onClick={() => setResultFilter("selected")}>已选</button>
                <button className={resultFilter === "recommended" ? "active" : ""} onClick={() => setResultFilter("recommended")}>高分</button>
                <button className={resultFilter === "待看" || resultFilter === "draft" ? "active" : ""} onClick={() => setResultFilter("待看")}>待看 {reviewCounts.待看}</button>
                <button className={resultFilter === "待修改" ? "active" : ""} onClick={() => setResultFilter("待修改")}>待修改 {reviewCounts.待修改}</button>
                <button className={resultFilter === "淘汰" ? "active" : ""} onClick={() => setResultFilter("淘汰")}>淘汰 {reviewCounts.淘汰}</button>
              </div>
              <label className="sort-control">
                <span>排序</span><select value={resultSort} onChange={(e) => setResultSort(e.target.value as ResultSort)}>
                  <option value="newest">最新生成</option><option value="score">综合分最高</option><option value="trend">趋势分最高</option><option value="commercial">商业分最高</option>
                </select>
              </label>
              <div className="batch-actions">
                <button className="secondary-btn compact-btn" onClick={selectRecommendedLooks} disabled={!recommendedLooks.length}>高分全选</button>
                <button className="secondary-btn compact-btn" onClick={clearSelectedLooks} disabled={!selectedLooks.length}>取消选择</button>
              </div>
            </div>
            {genProgress && (
              <div className="gen-progress-banner"><div className="gen-progress-bar"><div className="gen-progress-fill" style={{ width: `${Math.round((genProgress.done / genProgress.total) * 100)}%` }} /></div></div>
            )}
            <div className="looks-grid">
              {displayedLooks.map((look) => (
                <LookCard
                  key={look.id} look={look}
                  onToggle={() => setLooks((c) => c.map((l) => l.id === look.id ? { ...l, selected: !l.selected } : l))}
                  onNote={(note) => updateLookNote(look.id, note)}
                  onReviewStatus={(status) => updateLookReviewStatus(look.id, status)}
                  onModificationNote={(note) => updateLookModificationNote(look.id, note)}
                  onCopyPrompt={() => copyLookPrompt(look)}
                  onDetail={() => setDetailLook(look)}
                  onDelete={() => deleteLook(look)}
                  onDownload={() => { const a = document.createElement("a"); a.href = look.image; a.download = `${look.title}.png`; a.click() }}
                  onExportTechPack={() => exportLookTechPackExcel(look)}
                  onExportPDF={() => exportLookTechPackPDF(look)}
                  onVectorize={() => vectorizeLook(look)}
                  comparison={getComparisonForLook(look)}
                  cost={getCostEstimate(look)}
                />
              ))}
            </div>
          </section>

          {detailLook && (
            <LookDetail
              look={detailLook}
              onClose={() => setDetailLook(null)}
              onToggle={() => setLooks((c) => c.map((l) => l.id === detailLook.id ? { ...l, selected: !l.selected } : l))}
              onReviewStatus={(s) => updateLookReviewStatus(detailLook.id, s)}
              onModificationNote={(n) => updateLookModificationNote(detailLook.id, n)}
              onDownload={() => { const a = document.createElement("a"); a.href = detailLook.image; a.download = `${detailLook.title}.png`; a.click() }}
              onExportTechPack={() => exportLookTechPackExcel(detailLook)}
              onExportPDF={() => exportLookTechPackPDF(detailLook)}
              onIterate={(mod) => handleIterate(detailLook, mod)}
              onSketchModified={(updated) => {
                setLooks((c) => c.map((l) => l.id === updated.id ? { ...l, image: updated.image, modificationNote: updated.modificationNote } : l))
                setDetailLook((prev) => prev ? { ...prev, image: updated.image, modificationNote: updated.modificationNote } : prev)
              }}
              comparison={getComparisonForLook(detailLook)}
              allLooks={looks}
              cost={getCostEstimate(detailLook)}
            />
          )}
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

// ═══════════════ Helpers ═══════════════

function loadState(): StoredState | null {
  try { const raw = localStorage.getItem(storageKey); return raw ? JSON.parse(raw) as StoredState : null }
  catch { return null }
}

function normalizeApiConfig(state: StoredState | null): ApiConfig {
  if (!state?.apiConfig) return defaultApiConfig
  return { ...defaultApiConfig, ...state.apiConfig }
}

function savedLookMeta(look: GeneratedLook) {
  return {
    score: look.score,
    trendScore: look.trendScore,
    commercialScore: look.commercialScore,
    estimatedCost: look.estimatedCost,
    sourceMode: look.sourceMode,
    selected: look.selected,
    reviewStatus: look.reviewStatus ?? (look.selected ? "入选" : "待看"),
    note: look.note,
    palette: look.palette,
    keyDetails: look.keyDetails,
    revisionAdvice: look.revisionAdvice,
    designDirection: look.designDirection ?? null,
    version: look.version ?? null,
  }
}

function filterLooks(looks: GeneratedLook[], filter: ResultFilter) {
  if (filter === "selected") return looks.filter((l) => l.selected)
  if (filter === "recommended") return looks.filter((l) => l.score >= SCORE_THRESHOLD)
  if (filter === "draft") return looks.filter((l) => reviewStatusOf(l) === "待看")
  if (filter === "待看" || filter === "入选" || filter === "待修改" || filter === "淘汰") return looks.filter((l) => reviewStatusOf(l) === filter)
  return looks
}

function sortLooks(looks: GeneratedLook[], sort: ResultSort) {
  const s = [...looks]
  if (sort === "score") return s.sort((a, b) => b.score - a.score)
  if (sort === "trend") return s.sort((a, b) => b.trendScore - a.trendScore)
  if (sort === "commercial") return s.sort((a, b) => b.commercialScore - a.commercialScore)
  return s
}

function pickProductImages(images?: string[]): string[] {
  const list = (images ?? []).filter((u) => typeof u === "string" && /^https?:\/\//i.test(u))
  const isJunk = (u: string) => /(logo|icon|favicon|sprite|figma|placeholder|payment|\.svg)/i.test(u) || /no_excess\.png/i.test(u)
  const cleaned = list.filter((u) => !isJunk(u) && /\.(jpe?g|webp|png)(\?|$)/i.test(u))
  const products = cleaned.filter((u) => !/(banner|hero|cover|slide|lookbook-hero)/i.test(u))
  return (products.length ? products : cleaned).slice(0, 8)
}
