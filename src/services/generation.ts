import type { CustomerProfile, CostEstimate, CustomerTrend, ErpCustomerSummary, ErpTopItem, GeneratedLook, GenerationSettings, IntelResult, ComparisonResult } from "../types"
import type { BrandIntel } from "../data/brandIntel"
import { getTechSketchDataURL } from "./techSketch"
import { SCORE_THRESHOLD, CATEGORY_REGEX, ACCESSORY_REGEX, FABRIC_REGEX, CRAFT_REGEX } from "../constants"
import { reviewSummaryForPrompt, userReviewSignalsOf, verifiedUserReviewSignalsOf } from "../utils/customerReviews"

// ─── 品类词库（按大类分组，确保每批款式覆盖不同品类）────────────────────
const nounsByCategory: Record<string, string[]> = {
  outerwear: ["解构感风衣", "轻量工装夹克", "双面穿短外套", "oversize西装外套", "机能连帽夹克", "箱型短外套", "长款无领大衣", "垫肩短夹克", "针织拼接风衣", "束腰廓形外套", "棒球领夹克", "围裹式大衣", "短款牛仔外套", "羊毛混纺大衣", "落肩西装"],
  tops: ["不对称衬衫", "立领荷叶边上衣", "半拉链卫衣", "羊腿袖针织衫", "V领马甲背心", "古巴领短袖衬衫", "一字领打底衫", "假两件套头上衣", "抽褶泡泡袖上衣", "拉链翻领卫衣", "垂感飘带衬衫", "螺纹高领打底"],
  bottoms: ["直筒九分西裤", "微喇牛仔裤", "工装束脚裤", "百褶阔腿裤", "高腰纸袋裤", "侧开衩半身裙", "A字迷笛裙", "锥形烟管裤", "水洗直筒牛仔", "机能伞兵裤", "垂感拖地西裤", "抽绳运动长裤"],
  dresses: ["衬衫式连衣裙", "针织修身裙", "裹身茶歇裙", "A字背心长裙", "吊带叠穿连衣裙", "polo领针织裙", "方领泡泡袖裙", "不对称下摆裙", "鱼尾针织裙", "风衣式连衣裙", "迷你百褶裙", "挂脖露肩裙"],
  sets: ["短外套+高腰裤套装", "针织开衫+吊带裙套装", "西装马甲+阔腿裤套装", "连帽卫衣+半身裙套装", "箱型夹克+百褶裙套装"]
}

const allNouns = [...nounsByCategory.outerwear, ...nounsByCategory.tops, ...nounsByCategory.bottoms, ...nounsByCategory.dresses, ...nounsByCategory.sets]

// ─── 细节词库（按工艺类型分组，每款从不同类型各取一个，避免重复单一维度）──
const detailsByType: Record<string, string[]> = {
  closure: ["暗门襟拉链", "双排金属扣", "隐藏式按扣", "斜开襟拉链", "绑带式门襟", "中式盘扣", "磁吸隐形扣"],
  pocket: ["立体工装贴袋", "斜插拉链口袋", "立体风琴袋", "隐藏侧缝口袋", "翻盖按扣胸袋", "拼接双层口袋"],
  collar: ["翻领拼接", "可立可翻两用领", "尖角衬衫领", "中式小立领", "无领圆领口", "不对称翻领", "飘带领结"],
  sleeve: ["落肩超长袖", "可调节袖袢", "灯笼袖收口", "弧形袖窿", "卷边袖口", "插肩袖拼接"],
  hem: ["弧形前短后长下摆", "抽绳调节下摆", "开衩圆摆", "松紧收口下摆", "不规则毛边下摆"],
  texture: ["细腻针织肌理", "斜纹帆布质感", "仿醋酸垂感", "水洗做旧触感", "摇粒绒柔软面", "泡泡纱立体感", "天丝柔滑光泽"],
  functional: ["可拆卸帽子", "内置防风袖口", "透气孔细节", "反光嵌条", "内袋分隔系统"]
}

// ─── 结构词库 ───────────────────────────────────────────────────────────
const constructionWords = [
  "三针五线加固", "来去缝净边工艺", "包边收口", "双明线装饰", "压胶无缝拼接",
  "滚边包缝", "法式缝份", "链式平缝", "三角打枣加固", "人字车缝",
  "贴边内收", "撞色包边", "隐线暗缝", "锁链绣装饰线"
]

// ─── 版型描述词库 ───────────────────────────────────────────────────────
const fitPhrases = [
  "宽松落肩，叠穿友好", "直身微宽松，不挑身材", "短款利落，优化比例",
  "收腰A型，修饰曲线", "合体但不紧绷", "茧型廓形，包容度高",
  "箱型方正，结构感强", "修身直筒，纵向拉伸"
]

// ─── 季节感知配色板 ────────────────────────────────────────────────────
const awPalettes: Array<[string, string, string]> = [
  ["#1f2d2a", "#879582", "#d9ded2"],  // 深松绿
  ["#24364b", "#8aa0b5", "#f1ece1"],  // 钢蓝
  ["#3c332c", "#b8875d", "#efe0cf"],  // 暖咖
  ["#2a1f1c", "#a0634b", "#e8d5c8"],  // 栗棕
  ["#1c1e24", "#6b5b4f", "#d4cdc4"],  // 墨色大地
  ["#322b3a", "#8c7e6d", "#f0ebe0"],  // 暗紫灰
  ["#2d1f1a", "#7a5340", "#e8dfd2"],  // 可可棕
  ["#1a222e", "#5c6a7a", "#cad0d8"],  // 深蓝灰
  ["#3b2c24", "#9e7b5c", "#ede1d2"],  // 焦糖
  ["#1e2824", "#4a6b5a", "#dee6df"],  // 森林绿
]

const ssPalettes: Array<[string, string, string]> = [
  ["#40523e", "#9b7d45", "#e8ddc6"],  // 鼠尾草绿
  ["#f5f1e8", "#d3b8a3", "#8c7e6d"],  // 奶油沙色
  ["#101214", "#d35b86", "#d8d8df"],   // 灰粉撞色
  ["#e8e4dc", "#b5a69e", "#6d8b7a"],  // 米白柔和
  ["#f0ede4", "#c9c1b5", "#5d7a6e"],  // 亚麻浅调
  ["#eaf0ee", "#a8c4bd", "#6b8076"],  // 薄荷雾
  ["#fff4e8", "#deb89b", "#8fa8a0"],  // 蜜桃沙色
  ["#f6f2ea", "#c2a98e", "#5e7562"],  // 燕麦奶
  ["#fef9f2", "#d4c4a8", "#7a9a84"],  // 浅杏绿
  ["#f8f3eb", "#b8cec0", "#859e8f"],  // 雾蓝灰
]

// ─── 季节 -> 流行趋势关键词 ──────────────────────────────────────────
const seasonTrends: Record<string, { mood: string; detail: string }> = {
  "2026AW": { mood: "静奢质感到机能防护，面料纹理与结构层次并重", detail: "立体肌理面料、可拆卸结构、多层叠穿系统" },
  "2026SS": { mood: "轻盈度假到都市通勤，柔和亮色与天然触感主导", detail: "垂感天然纤维、局部透肤设计、松弛廓形" },
  "2027SS": { mood: "复古未来感混搭休闲运动，高饱和点缀与极简底色的对撞", detail: "科技感辅料、不对称结构、可调节细节" },
  "2025AW": { mood: "经典回归，重工面料与精裁结构", detail: "厚实羊毛混纺、双面呢料、精裁西装化" },
  "2025SS": { mood: "多巴胺淡出，低饱和松弛美学上位", detail: "水洗做旧、植物染、微皱肌理" },
}

// ─── 客户风格 → 出款焦点品类映射 ─────────────────────────────────────
const styleToCategory: Record<string, string[]> = {
  "机能通勤": nounsByCategory.outerwear.slice(0, 5),
  "轻户外": [...nounsByCategory.outerwear.slice(3, 8), ...nounsByCategory.bottoms.slice(4, 8)],
  "极简": [...nounsByCategory.dresses.slice(0, 3), ...nounsByCategory.tops.slice(0, 3), ...nounsByCategory.bottoms.slice(0, 2)],
  "美式休闲": [...nounsByCategory.tops.slice(3, 7), ...nounsByCategory.bottoms.slice(3, 7)],
  "工装": [...nounsByCategory.outerwear.slice(1, 4), ...nounsByCategory.bottoms.slice(2, 5)],
  "优雅通勤": [...nounsByCategory.dresses.slice(0, 4), ...nounsByCategory.sets],
  "北欧极简": [...nounsByCategory.outerwear.slice(4, 7), ...nounsByCategory.tops.slice(0, 3), ...nounsByCategory.bottoms.slice(0, 3)],
  "度假": [...nounsByCategory.dresses.slice(2, 6), ...nounsByCategory.tops.slice(7, 12), ...nounsByCategory.bottoms.slice(5, 9)],
  "户外基础": nounsByCategory.outerwear.slice(0, 6),
  "年轻": [...nounsByCategory.tops.slice(3, 8), ...nounsByCategory.bottoms.slice(3, 6), ...nounsByCategory.dresses.slice(8, 12)],
}

export interface ErpContext {
  summary?: ErpCustomerSummary | null
  trend?: CustomerTrend | null
  intel?: IntelResult | null
  website?: string | null
  brand?: BrandIntel | null
}

// ─── 小工具 ──────────────────────────────────────────────────────────────
function pick<T>(arr: T[], seed: number): T { return arr[Math.abs(seed) % arr.length] }

function shuffleSeed(seed: number, arr: string[]): string[] {
  const copy = [...arr]
  // simple deterministic shuffle by seed
  for (let i = copy.length - 1; i > 0; i--) {
    const j = (seed * (i + 1) * 7 + 13) % (i + 1)
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
    seed = seed * 1103515245 + 12345
  }
  return copy
}

function hash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) { h = ((h << 5) - h + str.charCodeAt(i)) | 0 }
  return Math.abs(h)
}

function topNames(items: ErpTopItem[] | undefined, limit: number): string {
  if (!items || !items.length) return ""
  return items.slice(0, limit).map((i) => i.name).join("、")
}

function firstUseful(value: string | undefined, fallback: string): string {
  return String(value ?? "")
    .split(/[、，,；;\/]/)
    .map((t) => t.trim())
    .find(Boolean) ?? fallback
}

function latestTrendYear(erp?: ErpContext | null) {
  const years = erp?.trend?.years ?? []
  return years.length ? years[years.length - 1] : null
}

function materialFor(customer: CustomerProfile, erp?: ErpContext | null): string {
  const latest = latestTrendYear(erp)
  return latest?.fabrics?.[0]?.name
    || erp?.summary?.topFabrics?.[0]?.name
    || firstUseful(customer.fabricPreference, "梭织功能面料")
}

function colorFor(customer: CustomerProfile, erp?: ErpContext | null): string {
  const latest = latestTrendYear(erp)
  return latest?.colors?.[0]?.name
    || erp?.summary?.topColors?.[0]?.name
    || firstUseful(customer.colorDirection, "品牌核心色")
}

function clip(text: string, max: number): string {
  const t = String(text ?? "").trim()
  return t.length > max ? t.slice(0, max) + "…" : t
}

// ─── 挑选适合该客户的出款品类词 ─────────────────────────────────────────
function pickNounsForCustomer(customer: CustomerProfile, settings: GenerationSettings, count: number): string[] {
  // 先按客户风格标签匹配品类
  let pool: string[] = []
  for (const tag of customer.styleTags) {
    const matched = styleToCategory[tag]
    if (matched) { pool = pool.concat(matched) }
  }
  // 没匹配到则用全量
  if (pool.length < count) pool = pool.concat(allNouns)
  // 如果用户指定了品类，限定在该品类
  if (settings.category !== "自动匹配") {
    pool = pool.filter((n) => n.includes(settings.category))
    if (pool.length < count) pool = allNouns.filter((n) => n.includes(settings.category))
  }
  // 去重 + shuffle
  const uniq = [...new Set(pool)]
  // 用客户 id 做种子保证同客户同批次结果稳定，但不同客户不同
  const seed = hash(customer.id + settings.season)
  return shuffleSeed(seed, uniq).slice(0, Math.max(count, uniq.length))
}

// ─── 设计方向生成（大幅增强）──────────────────────────────────────────
function fallbackDesignDirections(
  customer: CustomerProfile,
  settings: GenerationSettings,
  count: number,
  erp?: ErpContext | null
): string[] {
  const material = materialFor(customer, erp)
  const color = colorFor(customer, erp)
  const brand = erp?.brand
  const season = settings.season
  const isAW = season.includes("AW") || season.includes("FW")
  const craft = customer.erpInsight?.craftFocus?.[0] || pick(["压胶工艺", "精致包边", "暗线缝制", "明线装饰", "激光切割", "拼接工艺"], hash(customer.id))

  // 7 种不同的设计方向模板，每次随机选 count 种排列
  const templates = [
    // 面料质地主导
    () => `${material} + ${customer.fabricPreference.split(/[、,，]/)[0] || "品牌核心面料"}混搭，用${craft}工艺突出质感层次，${isAW ? "深色底+金属辅料点缀" : "浅色底+自然材质辅料"}。`,
    // 廓形创新
    () => `${customer.silhouette}基础上的${isAW ? "解构重组" : "松弛延伸"}，保留品牌辨识度同时增加${season}流行廓形元素。`,
    // 色彩叙事
    () => `以${color}为主调，${isAW ? "加入暖调大地色做层次过渡" : "搭配柔和亮色或自然中性色"}，形成${season}系列色卡逻辑。`,
    // 品类深挖
    () => {
      const product = customer.erpInsight?.materialFocus?.[0] || customer.styleTags[0] || "核心品类"
      return `${product}品类深度开发：在${customer.styleTags.slice(0, 2).join("和")}风格基础上，做${season}的${isAW ? "面料升级版" : "轻量化版本"}。`
    },
    // 场景驱动
    () => {
      const scene = brand?.segment || customer.market
      return `面向${scene}场景：设计可多场合适配的${isAW ? "保暖层搭" : "清凉通勤"}单品，一件满足${isAW ? "从室外到室内" : "从办公室到社交"}的切换需求。`
    },
    // 趋势响应
    () => {
      const trend = seasonTrends[season]?.detail || "当季流行元素"
      return `呼应当季趋势（${trend}），结合客户历史数据中验证过的${material}和${color}方向。`
    },
    // 数据驱动（如果有 ERP 数据则引用）
    () => {
      const erpPrice = erp?.summary?.suggestedProfilePatch?.priceStrategy
      const priceNote = erpPrice && erpPrice !== "待外部渠道校准" ? `控制在${erpPrice.slice(0, 30)}以内` : "控制工艺复杂度"
      return `基于客户历史订单表现：${customer.erpInsight?.orderTrend || "稳定品类"}；${priceNote}，优先做${customer.erpInsight?.repeatOrderSignal || "返单信号强的品类"}。`
    },
    // 差异化尝试
    () => `在客户舒适区边缘做一次谨慎试探：保留${customer.styleTags.slice(0, 2).join("+")}基底，用${season}新面料/新辅料做${customer.styleTags.length > 3 ? customer.styleTags[3] : "细节升级"}。`,
  ]

  const seed = hash(customer.id + settings.season + settings.creativity.toString())
  const shuffled = shuffleSeed(seed, templates.map((_, i) => i.toString()))
  const picked = shuffled.slice(0, Math.max(count, 6)).map((idx) => templates[Number(idx)]())
  // 确保不重复；不足时从第二轮填充
  const uniq = [...new Set(picked)]
  while (uniq.length < count) {
    const extra = templates[uniq.length % templates.length]()
    if (!uniq.includes(extra)) uniq.push(extra)
  }
  return uniq
}

// ─── 从设计方向提取款名 ────────────────────────────────────────────────
function directionTitle(direction: string): string {
  const clause = direction
    .replace(/（[^）]*）/g, "")
    .replace(/\([^)]*\)/g, "")
    .split(/[，,。；;：:]/)[0]
    .replace(/^(推出|开发|设计|打造|尝试|延续|拓展|强化|引入|采用|制作|融入|主打)/, "")
    .replace(/^(一款|一件|一条|一套|新款)/, "")
    .trim()
  const lastDe = clause.lastIndexOf("的")
  if (lastDe >= 0 && lastDe < clause.length - 1) {
    const garment = clause.slice(lastDe + 1).trim()
    if (garment.length >= 2 && garment.length <= 14) return garment
  }
  if (!clause) {
    const raw = direction.replace(/[（(][^)）]*[)）]/g, "").trim()
    return raw.length > 12 ? raw.slice(0, 12) : (raw || "新款")
  }
  return clause.length > 14 ? clause.slice(0, 14).replace(/的$/, "") : clause
}

// ─── 性别 / 模特 ───────────────────────────────────────────────────────
function genderModel(gender: string | undefined, index: number, total: number): { tag: string; model: string } {
  const g = gender ?? ""
  const race = "欧美白人"
  if (g.includes("童")) return { tag: "童装", model: `${race}儿童模特` }
  const hasMale = g.includes("男")
  const hasFemale = g.includes("女")
  if (hasMale && hasFemale) {
    // 均匀交替覆盖男女
    return index % 2 === 0
      ? { tag: "男装", model: `${race}成年男性模特` }
      : { tag: "女装", model: `${race}成年女性模特` }
  }
  if (hasMale) return { tag: "男装", model: `${race}成年男性模特` }
  if (hasFemale) return { tag: "女装", model: `${race}成年女性模特` }
  return { tag: "", model: `${race}成年模特` }
}

// ─── 判断品类所属大类（用于配 SVG 廓形）───────────────────────────────
function garmentClass(noun: string): keyof typeof nounsByCategory {
  if (/外套|夹克|大衣|风衣|西装|马甲|开衫/.test(noun)) return "outerwear"
  if (/裙|连衣裙/.test(noun)) return "dresses"
  if (/裤|牛仔|半身裙/.test(noun)) return "bottoms"
  if (/套装/.test(noun)) return "sets"
  return "tops"
}

// ─── 挑选调色板（季节感知）───────────────────────────────────────────
function pickPalette(season: string, seed: number): string[] {
  return season.includes("AW") || season.includes("FW")
    ? [...awPalettes[seed % awPalettes.length]]
    : [...ssPalettes[seed % ssPalettes.length]]
}

// ─── 挑选细节（从不同类型各取一个，确保维度丰富）────────────────────
function pickKeyDetails(seed: number, count = 5): string[] {
  const types = Object.keys(detailsByType)
  const picked: string[] = []
  // 每款至少保证：闭合方式、口袋、领型、面料肌理 + 一个随机维度
  const priority = ["closure", "pocket", "collar", "texture", "sleeve", "hem", "functional"]
  for (const type of priority) {
    const pool = detailsByType[type]
    if (pool) picked.push(pool[seed % pool.length])
    seed = seed * 31 + 7
  }
  return [...new Set(picked)].slice(0, count)
}

// ─── 构建出图提示词各段落 ──────────────────────────────────────────────
function buildProfileBlurb(customer: CustomerProfile, _erp?: ErpContext | null): string {
  return `${customer.name}（${customer.market || "服装品牌"}），定位：${customer.positioning || customer.styleTags.slice(0, 3).join("、")}。`
}

function buildMaterialBlurb(customer: CustomerProfile, erp?: ErpContext | null): string {
  const parts: string[] = []
  const erpFabrics = topNames(erp?.summary?.topFabrics, 6)
  if (erpFabrics) parts.push(`历史高频面料：${erpFabrics}`)
  else if (customer.fabricPreference) parts.push(`面料偏好：${customer.fabricPreference}`)
  const erpColors = topNames(erp?.summary?.topColors, 5)
  if (erpColors) parts.push(`历史高频色：${erpColors}`)
  else if (customer.colorDirection) parts.push(`色彩方向：${customer.colorDirection}`)
  if (customer.erpInsight?.craftFocus?.length) parts.push(`核心工艺：${customer.erpInsight.craftFocus.join("、")}`)
  const erpPrice = erp?.summary?.suggestedProfilePatch?.priceStrategy
  if (erpPrice && erpPrice !== "待外部渠道校准") parts.push(`价格带：${erpPrice}`)
  return parts.join("；") + "。"
}

function buildTrendBlurb(customer: CustomerProfile, erp?: ErpContext | null): string {
  const parts: string[] = []
  if (customer.erpInsight?.orderTrend) parts.push(`订单趋势：${customer.erpInsight.orderTrend}`)
  if (customer.erpInsight?.repeatOrderSignal) parts.push(`返单信号：${customer.erpInsight.repeatOrderSignal}`)
  if (customer.trendPrediction) parts.push(`趋势预判：${customer.trendPrediction}`)
  if (erp?.trend?.evolution && erp.trend.evolution.length > 30) parts.push(`历年演变：${erp.trend.evolution}`)
  return parts.length ? parts.join("；") + "。" : ""
}

function buildExternalBlurb(customer: CustomerProfile, erp?: ErpContext | null): string {
  const parts: string[] = []
  const reviewSummary = reviewSummaryForPrompt(customer)
  if (reviewSummary) parts.push(`用户评价/采集状态：${reviewSummary}`)
  if (customer.externalSignals?.length) {
    const insights = customer.externalSignals
      .slice(0, 3)
      .map((s) => `${s.source}:${s.insight}，辅助动作:${s.designAction}`)
      .join("；")
    if (insights) parts.push(`消费者/渠道反馈：${insights}`)
  }
  if (erp?.intel) {
    const i = erp.intel
    if (i.consumer) parts.push(`目标消费者：${i.consumer}`)
    if (i.aesthetic) parts.push(`品牌美学：${i.aesthetic}`)
    if (i.trendDirection) parts.push(`趋势方向：${i.trendDirection}`)
    if (i.designDirections?.length) parts.push(`设计方向建议：${i.designDirections.join("；")}`)
  }
  if (erp?.website) parts.push(`品牌官网：${erp.website}`)
  return parts.length ? parts.join("。") + "。" : ""
}

function buildConstraintBlurb(settings: GenerationSettings): string {
  const parts: string[] = []
  if (settings.mustHave && settings.mustHave !== "保留客户核心风格、面料偏好和可生产工艺") parts.push(`必须保留：${settings.mustHave}`)
  if (settings.avoid && settings.avoid !== "避免结构变形、过度复杂辅料、不可落地廓形") parts.push(`避免：${settings.avoid}`)
  if (settings.targetPrice && settings.targetPrice !== "按客户历史价格带控制") parts.push(`目标价格：${settings.targetPrice}`)
  return parts.length ? parts.join("；") + "。" : ""
}

// ─── 主出图提示词 ──────────────────────────────────────────────────────
export function buildBatchPrompt(opts: {
  customer: CustomerProfile; settings: GenerationSettings; mode: GeneratedLook["sourceMode"]
  referenceNote?: string; erp?: ErpContext | null
}): string {
  const { customer, settings, mode, referenceNote, erp } = opts
  if (mode === "线稿图") return buildLineArtPrompt(opts)
  const category = settings.category === "自动匹配" ? "服装" : settings.category
  const seasonTrend = seasonTrends[settings.season]
  const fusion = mode === "参考图融合" && referenceNote ? `融合参考图的廓形、情绪与比例（${referenceNote}）。` : ""
  const parts = [
    `为「${customer.name}」设计 ${settings.count} 款 ${settings.season} ${category} 系列款式效果图，系列主题呼应当季"${seasonTrend?.mood || ""}"。`,
    buildProfileBlurb(customer, erp),
    buildMaterialBlurb(customer, erp),
    buildTrendBlurb(customer, erp),
    buildExternalBlurb(customer, erp),
    `廓形偏好：${customer.silhouette}。当季工艺重点：${seasonTrend?.detail || "可量产工艺细节"}。`,
    fusion,
    buildConstraintBlurb(settings),
    `硬性要求：必须是可工业化生产的服装设计，不是概念插画；廓形、口袋、门襟、领型、袖口、下摆、面料肌理清晰可见。`,
    `画面规格：白色或浅灰 studio 纯色背景，单款完整正面展示，平铺或轻量悬挂，服装比例自然，光线干净均匀，高端品牌 lookbook 级画质。`,
    `负面约束：不要文字、logo、水印、模特面部特写、乱码、重复身体、畸形手脚、夸张结构、随机装饰、不可落地辅料。`
  ]
  return parts.filter(Boolean).join("")
}

// ─── 单款出图提示词（发给火山方舟，每款独立）─────────────────────────
export function buildLookImagePrompt(opts: {
  customer: CustomerProfile; look: GeneratedLook; settings: GenerationSettings
  mode: GeneratedLook["sourceMode"]; referenceNote?: string; erp?: ErpContext | null; brandRef?: boolean
}): string {
  const { customer, look, settings, mode, referenceNote, erp, brandRef } = opts
  if (mode === "线稿图") return buildLineArtPrompt({ customer, settings, referenceNote, erp })
  const brandRefLead = brandRef
    ? "请参考品牌官网产品图的版型、面料质感、做工风格基调，在此基础上设计一款全新的款式（不是复制参考图）。"
    : ""
  const category = settings.category === "自动匹配" ? "服装" : settings.category
  const fusion = mode === "参考图融合" && referenceNote ? `参考上传图融入其廓形、情绪与比例（${referenceNote}）。` : ""
  const mainColor = look.palette?.[0] ? `，主色调 ${look.palette[0]}` : ""
  const intel = erp?.intel
  const trendYears = erp?.trend?.years ?? []
  const latestYear = trendYears.length ? trendYears[trendYears.length - 1] : null
  const fabrics = latestYear?.fabrics?.length
    ? latestYear.fabrics.slice(0, 3).map((f) => f.name).join("、")
    : customer.fabricPreference
  const colors = latestYear?.colors?.length
    ? latestYear.colors.slice(0, 3).map((c) => c.name).join("、")
    : customer.colorDirection
  const { tag: genderTag, model } = genderModel(erp?.brand?.gender, hash(look.id), look.keyDetails.length)
  const genderLead = genderTag ? `${genderTag}，` : ""
  const brief = look.designDirection
    ? `核心设计方向：${look.designDirection}`
    : `设计要点：${look.title}；关键细节 ${look.keyDetails.filter(Boolean).join("、")}`
  const aesthetic = intel?.aesthetic ? `品牌调性：${clip(intel.aesthetic, 40)}；` : ""
  const trendLine = intel?.trendDirection ? `呼应当季趋势：${clip(intel.trendDirection, 52)}；` : ""
  const seasonNote = seasonTrends[settings.season]
  const reviewText = reviewSummaryForPrompt(customer)
  const verifiedReviewCount = verifiedUserReviewSignalsOf(customer).length
  const reviewDirective = reviewText
    ? `用户评价与采集状态：${clip(reviewText, 220)}；${verifiedReviewCount ? "已采集评价作为强约束，回应差评痛点并保留好评点。" : ""}待采集/主体确认信息作为弱约束和核验提醒，不要虚构用户痛点。`
    : ""
  const sourceContext = buildExternalBlurb(customer, erp)
  const sourceDirective = sourceContext ? `综合数据辅助：${clip(sourceContext, 220)}` : ""
  // 增强生图质量的关键段落
  return [
    `Professional fashion product photography. ${genderLead}「${customer.name}」${settings.season} ${genderTag}${category}。`,
    brandRefLead,
    `${brief}。当季设计语境：${seasonNote?.mood || ""}。`,
    `${aesthetic}风格标签：${customer.styleTags.slice(0, 4).join("、")}；廓形：${customer.silhouette}；色彩：${colors}${mainColor}；面料：${fabrics}。`,
    trendLine,
    reviewDirective,
    sourceDirective,
    fusion,
    `Garment design requirements: Fully realized wearable garment, clean front silhouette, clearly defined collar/placket/pockets/cuffs/hem with visible seam lines and stitching details, commercially producible pattern cutting, refined modern proportions.`,
    `Image specifications: ${model} full-body front view on seamless white or very light gray studio background, even soft diffused professional lighting, fabric texture and drape clearly visible, crisp focus, high-end e-commerce editorial quality, subtle shadow on floor for depth.`,
    `Negative: no text, no letters, no logos, no watermarks, no brand marks, no UI elements, no extra limbs, no cropped body parts, no distorted hands/feet, no random straps/buckles, no fantasy armor, no busy background, no harsh shadows.`
  ].filter(Boolean).join("")
}

// ─── 线稿图专出提示词 ──────────────────────────────────────────────────
export function buildLineArtPrompt(opts: {
  customer: CustomerProfile; settings: GenerationSettings; referenceNote?: string; erp?: ErpContext | null
}): string {
  const { customer, settings, referenceNote, erp } = opts
  const category = settings.category === "自动匹配" ? "服装" : settings.category
  const fusion = referenceNote ? `参考以下廓形与结构要点：${referenceNote}。` : ""
  return [
    `为服装品牌「${customer.name}」设计 1 款 ${settings.season} ${category} 专业服装技术线稿图（technical flat sketch / CAD-style）。`,
    buildProfileBlurb(customer, erp),
    buildExternalBlurb(customer, erp),
    `版型偏好：${customer.silhouette}。`,
    customer.erpInsight?.craftFocus?.length ? `工艺细节参考：${customer.erpInsight.craftFocus.join("、")}。` : "",
    fusion,
    buildConstraintBlurb(settings),
    `严格要求：纯黑白线稿、无填充色、无阴影、无渐变、无模特、无背景纹理，白色背景，黑色钢笔线条，线条干净利落粗细均匀，`,
    `正面平铺展示款式结构，包含缝线、省道、口袋、拉链、领型、袖口、下摆等工艺细节，类似 tech pack 中的 flat sketch 风格，`,
    `画面中不出现任何文字、logo、水印或装饰元素。`
  ].filter(Boolean).join("")
}

// ─── 生成本地预览 SVG（多廓形，不同品类不同形状）───────────────────
export function buildLocalPreviewImage(look: GeneratedLook): string {
  const [primary = "#2f3a34", secondary = "#8c8a78", ground = "#f5f1e8"] = look.palette
  const title = escapeXml(look.title.replace(/^.+?\s/, ""))
  const detail = escapeXml(look.keyDetails.slice(0, 3).join(" / "))
  const isLine = look.sourceMode === "线稿图"
  const stroke = isLine ? "#1c1a17" : "rgba(28,26,23,0.68)"
  const fill = isLine ? "none" : primary
  const gClass = garmentClass(look.title)
  const silhouettePath = getSilhouettePath(gClass, { isLine, primary, secondary })

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="1200" viewBox="0 0 960 1200">
  <defs>
    <linearGradient id="bgg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${ground}"/>
      <stop offset="1" stop-color="#ffffff"/>
    </linearGradient>
    <filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#1f1c18" flood-opacity="0.10"/>
    </filter>
  </defs>
  <rect width="960" height="1200" fill="url(#bgg)"/>
  <rect x="84" y="74" width="792" height="1052" rx="22" fill="rgba(255,255,255,0.72)" stroke="rgba(60,54,44,0.12)"/>
  <g filter="url(#sh)" stroke="${stroke}" stroke-width="${isLine ? 7 : 4}" stroke-linejoin="round" stroke-linecap="round" fill="${fill}">
    ${silhouettePath}
  </g>
  <g font-family="Inter, PingFang SC, Noto Sans SC, system-ui, sans-serif" fill="#2b2722">
    <text x="118" y="960" font-size="34" font-weight="700">${title}</text>
    <text x="118" y="1016" font-size="22" fill="#6b6256">${detail}</text>
    <text x="118" y="1068" font-size="18" letter-spacing="4" fill="#9a907f">DESIGN PREVIEW</text>
  </g>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

// ─── 五种不同品类廓形的 SVG path ──────────────────────────────────────
function getSilhouettePath(
  gClass: string,
  opts: { isLine: boolean; primary: string; secondary: string }
): string {
  // 1. 外套/夹克：有领结构 + 口袋
  if (gClass === "outerwear") {
    return `
      <path d="M344 210 C370 196 430 188 480 188 C530 188 590 196 616 210 L660 300 L628 440 C616 740 576 840 480 846 C384 840 344 740 332 440 L300 300 Z"/>
      <path d="M384 222 L480 336 L576 222"/>
      <path d="M480 336 L480 830"/>
      <path d="M348 440 C380 470 420 484 480 484 C540 484 580 470 612 440"/>
      <rect x="360" y="510" width="84" height="106" rx="6"/>
      <rect x="516" y="510" width="84" height="106" rx="6"/>
      <rect x="360" y="510" width="40" height="22" rx="3"/>
      <rect x="560" y="510" width="40" height="22" rx="3"/>
      <path d="M384 222 L480 310 L576 222"/>
      <path d="M420 222 C435 238 450 242 480 242 C510 242 525 238 540 222"/>
      <circle cx="430" cy="570" r="4" fill="none"/>
      <circle cx="530" cy="570" r="4" fill="none"/>
    `
  }
  // 2. 连衣裙：收腰 A 型
  if (gClass === "dresses") {
    return `
      <path d="M380 190 C410 180 440 176 480 176 C520 176 550 180 580 190 L620 260 L610 440 C590 620 500 880 480 900 C460 880 370 620 350 440 L340 260 Z"/>
      <path d="M410 192 C430 210 460 220 480 220 C500 220 530 210 550 192"/>
      <path d="M480 220 L480 880"/>
      <path d="M360 460 C400 510 440 530 480 530 C520 530 560 510 600 460"/>
      <path d="M376 192 L480 320 L584 192"/>
      <path d="M370 460 C420 490 540 490 590 460"/>
    `
  }
  // 3. 裤装：上窄下宽
  if (gClass === "bottoms") {
    return `
      <path d="M400 180 C430 170 460 165 480 165 C500 165 530 170 560 180 L580 230 L560 860 C550 880 510 890 480 890 C450 890 410 880 400 860 L380 230 Z"/>
      <path d="M420 184 L480 220 L540 184"/>
      <path d="M480 220 L480 870"/>
      <rect x="390" y="420" width="50" height="88" rx="4"/>
      <rect x="520" y="420" width="50" height="88" rx="4"/>
      <path d="M388 440 L438 440"/>
      <path d="M522 440 L572 440"/>
    `
  }
  // 4. 上装：短款
  if (gClass === "tops") {
    return `
      <path d="M360 190 C390 170 430 162 480 162 C530 162 570 170 600 190 L640 280 L624 560 C612 620 544 640 480 644 C416 640 348 620 336 560 L320 280 Z"/>
      <path d="M396 180 L480 310 L564 180"/>
      <path d="M480 310 L480 626"/>
      <path d="M340 400 C390 450 440 470 480 470 C520 470 570 450 620 400"/>
      <path d="M320 280 C370 310 570 310 640 280"/>
      <circle cx="430" cy="460" r="5" fill="none"/>
      <circle cx="530" cy="460" r="5" fill="none"/>
    `
  }
  // 5. 套装：上下分体
  return `
    <path d="M370 170 C395 156 435 148 480 148 C525 148 565 156 590 170 L628 250 L614 460 C604 490 548 500 480 502 C412 500 356 490 346 460 L332 250 Z"/>
    <path d="M378 166 L480 280 L582 166"/>
    <path d="M480 280 L480 486"/>
    <path d="M346 380 C390 420 440 435 480 435 C520 435 570 420 614 380"/>
    <rect x="380" y="510" width="64" height="118" rx="5"/>
    <rect x="516" y="510" width="64" height="118" rx="5"/>
    <path d="M334 250 C380 270 580 270 626 250"/>
    <circle cx="440" cy="444" r="4" fill="none"/>
    <circle cx="520" cy="444" r="4" fill="none"/>
    <path d="M378 548 L446 548 M514 548 L586 548"/>
  `
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

// ─── generateLooks：核心出款逻辑 ────────────────────────────────────────
export async function generateLooks(opts: {
  customer: CustomerProfile; settings: GenerationSettings; mode: GeneratedLook["sourceMode"]
  referenceNote?: string; erp?: ErpContext | null
}): Promise<GeneratedLook[]> {
  const { customer, settings, mode, referenceNote, erp } = opts

  const isLineArt = mode === "线稿图"
  const count = isLineArt ? 1 : settings.count

  // 设计方向：AI 联网分析优先，否则用增强版 fallback
  const directions = erp?.intel?.designDirections?.filter(Boolean).length
    ? erp.intel.designDirections.filter(Boolean)
    : fallbackDesignDirections(customer, settings, count, erp)

  // 品类词：用户指定品类 > 风格匹配 > 全量
  const nouns = pickNounsForCustomer(customer, settings, count)
  const seedBase = hash(customer.id + settings.season + settings.creativity.toString())

  return Array.from({ length: count }, (_, index) => {
    const seed = seedBase + index * 137
    const direction = !isLineArt && directions.length ? directions[index % directions.length] : undefined
    const noun = pick(nouns, seed)
    const isAW = settings.season.includes("AW") || settings.season.includes("FW")
    const material = materialFor(customer, erp)
    const color = colorFor(customer, erp)

    // 款名：设计方向优先 → 品类词 + 当季形容词
    const title = isLineArt
      ? `${customer.name} 技术线稿 · ${noun}`
      : direction
        ? `${customer.name} ${directionTitle(direction)}`
        : `${customer.name} ${pick([isAW ? "质感" : "轻量", isAW ? "层次" : "松弛", isAW ? "解构" : "通透"], seed)}${noun}`

    const palette = isLineArt ? ["#ffffff", "#1a1a1a", "#f5f5f5"] : pickPalette(settings.season, seed)
    const keyDetails = isLineArt
      ? ["技术线稿", "可编辑参考", "黑白款式图"]
      : pickKeyDetails(seed, 5)

    // 评分：基于品类匹配度 + 创意强度 + 数据成熟度加权
    const directionLen = direction?.length ?? 0
    const categoryMatch = directionLen > 0 ? Math.min(15, directionLen * 3) : 10
    const creativityBonus = settings.creativity >= 7 ? 5 : settings.creativity >= 4 ? 3 : 1
    const maturityBonus = customer.maturity === "数据充足" ? 8 : customer.maturity === "需设计师补标" ? 4 : 2
    const reviewBonus = verifiedUserReviewSignalsOf(customer).length ? 3 : userReviewSignalsOf(customer).length ? 1 : 0
    const baseScore = isLineArt ? 100 : Math.min(98, 60 + categoryMatch + creativityBonus + maturityBonus + reviewBonus + (seed % 8))
    const trendScore = isLineArt ? 0 : Math.min(99, baseScore - 3 + ((seed * 7) % 10))
    const commercialScore = isLineArt ? 0 : Math.min(99, baseScore - 2 + ((seed * 11) % 8))
    const score = isLineArt ? 100 : Math.round(trendScore * 0.45 + commercialScore * 0.55)

    const imagePrompt = isLineArt
      ? buildLineArtPrompt({ customer, settings, referenceNote, erp })
      : buildLookImagePrompt({
          customer,
          look: {
            id: `${customer.id}-${mode}-${index}`, customerId: customer.id,
            title, prompt: "", image: "", score, trendScore, commercialScore,
            estimatedCost: 0, sourceMode: mode, selected: false, note: "",
            palette, keyDetails, revisionAdvice: "", createdAt: "", designDirection: direction
          },
          settings, mode, referenceNote, erp
        })

    return {
      id: `${customer.id}-${mode}-${Date.now()}-${index}`,
      customerId: customer.id,
      title,
      prompt: imagePrompt,
      image: "",
      score,
      trendScore,
      commercialScore,
      estimatedCost: isLineArt ? 0 : Number((0.09 + settings.creativity * 0.006 + (index % 4) * 0.012).toFixed(3)),
      sourceMode: mode,
      selected: isLineArt || score >= SCORE_THRESHOLD,
      reviewStatus: isLineArt || score >= SCORE_THRESHOLD ? "入选" : "待看",
      note: isLineArt
        ? "线稿图（火山方舟生成），点击底部「转矢量」按钮可转为 SVG 编辑"
        : score >= 88 ? "建议优先进入设计师精修池" : score >= 82 ? "可考虑精修，注意评审建议" : "",
      palette,
      keyDetails,
      revisionAdvice: isLineArt
        ? "线条清晰、结构完整，可直接作为设计师改款底图。点击底部「转矢量」按钮导出 SVG。"
        : direction
          ? `评审重点：是否准确落实「${directionTitle(direction)}」方向，检查${material}、${color}的可量产性。`
          : score >= 90 ? "保留整体方向，重点精修面料质感与工艺落点。" : "建议调整廓形比例或简化工艺细节后再评审。",
      createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
      designDirection: direction,
      imageStatus: "model-generating" as const
    }
  })
}

// ─── 款式版本迭代 ──────────────────────────────────────────────────────
export async function generateIteratedLook(opts: {
  baseLook: GeneratedLook
  customer: CustomerProfile
  settings: GenerationSettings
  modification: string
  erp?: ErpContext | null
}): Promise<GeneratedLook> {
  const { baseLook, customer, settings, modification, erp } = opts

  const newVersion = (baseLook.version ?? 1) + 1
  const modPrompt = `在原款「${baseLook.title}」基础上进行 V${newVersion} 微调：${modification}。保留原款核心廓形与品牌风格，仅调整指定部分。原款设计方向：${baseLook.designDirection || baseLook.revisionAdvice}`

  const seedBase = hash(customer.id + settings.season + settings.creativity.toString() + modification)

  const title = `${customer.name} ${directionTitle(modification) || baseLook.title.replace(/^.*?\s/, "")} V${newVersion}`
  const palette = pickPalette(settings.season, seedBase)
  const keyDetails = pickKeyDetails(seedBase, 5)

  const baseScore = 70 + (seedBase % 20)
  const trendScore = Math.min(99, baseScore - 2 + ((seedBase * 7) % 12))
  const commercialScore = Math.min(99, baseScore + ((seedBase * 11) % 10))
  const score = Math.round(trendScore * 0.45 + commercialScore * 0.55)

  const imagePrompt = buildLookImagePrompt({
    customer,
    look: {
      id: `${customer.id}-iter-${Date.now()}`,
      customerId: customer.id,
      title,
      prompt: modPrompt,
      image: "",
      score,
      trendScore,
      commercialScore,
      estimatedCost: 0,
      sourceMode: baseLook.sourceMode,
      selected: false,
      note: "",
      palette,
      keyDetails,
      revisionAdvice: "",
      createdAt: "",
      designDirection: modPrompt,
    },
    settings,
    mode: baseLook.sourceMode === "线稿图" ? "定向出款" : baseLook.sourceMode,
    erp,
  })

  return {
    id: `${customer.id}-iter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    customerId: customer.id,
    title,
    prompt: imagePrompt,
    image: "",
    score,
    trendScore,
    commercialScore,
    estimatedCost: Number((0.09 + settings.creativity * 0.006).toFixed(3)),
    sourceMode: baseLook.sourceMode === "线稿图" ? "定向出款" : baseLook.sourceMode,
    selected: score >= SCORE_THRESHOLD,
    reviewStatus: score >= SCORE_THRESHOLD ? "入选" : "待修改",
    note: score >= 88 ? "迭代款：建议优先评审" : "",
    modificationNote: modification,
    palette,
    keyDetails,
    revisionAdvice: `V${newVersion} 迭代方向：${modification}。对比 V${baseLook.version ?? 1} 检查改动是否到位。`,
    createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    designDirection: modPrompt,
    imageStatus: "model-generating",
    parentId: baseLook.id,
    version: newVersion,
  }
}

// ─── 历史爆款对比 ──────────────────────────────────────────────────────
export function compareLookWithHistory(opts: {
  look: GeneratedLook
  customer: CustomerProfile
  erpSummary?: ErpCustomerSummary | null
  trend?: CustomerTrend | null
}): ComparisonResult {
  const { look, customer, erpSummary, trend } = opts

  // ERP 历史高频数据
  const topFabrics = erpSummary?.topFabrics?.map((f) => f.name) ?? []
  const topColors = erpSummary?.topColors?.map((c) => c.name) ?? []
  const recentOrders = erpSummary?.recentOrders ?? []
  const representativeStyles = customer.representativeStyles.filter((s) => s.isRepeatOrder)

  // 1. 品类匹配：检查款式标题或细节是否包含历史订单品类关键词
  const lookCategoryText = look.title + " " + look.keyDetails.join(" ")
  const historyCategories = recentOrders.map((o) => String(o.ProductName || o.StyleName || o.Category || "")).filter(Boolean)
  const repStyleNames = representativeStyles.map((s) => s.title)
  const allHistoryNames = [...historyCategories, ...repStyleNames]
  const categoryKeywords = extractKeywords(lookCategoryText)
  const matchedStyles = allHistoryNames.filter((name) => {
    const nameKeywords = extractKeywords(name)
    return nameKeywords.some((k) => categoryKeywords.includes(k))
  })
  const categoryMatch = matchedStyles.length > 0

  // 2. 面料重合度：检查客户面料偏好是否在款式细节中提及
  const lookFabricText = look.keyDetails.join(" ") + " " + (look.designDirection || "")
  const fabricKeywords = topFabrics.length ? topFabrics : customer.fabricPreference.split(/[、,，]/).filter(Boolean)
  const matchedFabrics = fabricKeywords.filter((f) => lookFabricText.includes(f.split(/[\s(（]/)[0])).map((f) => f)
  const fabricOverlap = fabricKeywords.length ? matchedFabrics.length / fabricKeywords.length : 0

  // 3. 色彩重合度：检查调色板是否与历史高频色匹配
  const colorNames = topColors.length ? topColors : customer.colorDirection.split(/[、,，]/).filter(Boolean)
  const lookColorText = look.keyDetails.join(" ") + " " + look.palette.join(" ")
  const matchedColors = colorNames.filter((c) => lookColorText.includes(c.split(/[\s(（]/)[0]))
  const colorOverlap = colorNames.length ? matchedColors.length / colorNames.length : 0

  // 4. 廓形相似度：基于 garmentClass 匹配
  const lookGarmentClass = garmentClass(look.title)
  const silhouetteMatch = customer.silhouette.includes(lookGarmentClass) || lookCategoryText.includes(customer.silhouette)

  // 综合评分
  const scores = [
    categoryMatch ? 30 : 0,
    Math.round(fabricOverlap * 30),
    Math.round(colorOverlap * 20),
    silhouetteMatch ? 20 : 0,
  ]
  const overallScore = Math.min(100, scores.reduce((a, b) => a + b, 0))

  return {
    overallScore,
    categoryMatch,
    fabricOverlap: Math.round(fabricOverlap * 100),
    colorOverlap: Math.round(colorOverlap * 100),
    silhouetteMatch,
    matchedStyles: matchedStyles.slice(0, 5),
    matchedFabrics: matchedFabrics.slice(0, 5),
    matchedColors: matchedColors.slice(0, 5),
  }
}

function extractKeywords(text: string): string[] {
  const cleaned = text.replace(/[（）()【】\[\]{}""''：:，,。.、；;！!？?]/g, " ")
  return cleaned.split(/\s+/).filter((w) => w.length >= 2)
}

// ─── 成本估算引擎 ─────────────────────────────────────────────────────────
export function estimateCost(look: GeneratedLook, customer: CustomerProfile, erpSummary?: ErpCustomerSummary | null): CostEstimate {
  const lookText = look.title + " " + look.keyDetails.join(" ")

  // 1. 品类基准 FOB (USD)
  const baseFOB: Record<string, number> = {
    outerwear: 22, dress: 16, top: 10, bottom: 13, vest: 12, coat: 28, set: 30,
  }
  const garment = garmentClass(look.title)
  const base = baseFOB[garment] || 15

  // 2. 复杂度系数（基于关键细节数量 + 工艺复杂度）
  const detailCount = look.keyDetails.length
  const hasLining = /里布|内衬|里料/.test(lookText)
  const hasFunctional = /压胶|防水|防风|透气|反光|可拆卸/.test(lookText)
  const complexityFactor = 1 + (detailCount - 5) * 0.04 + (hasLining ? 0.08 : 0) + (hasFunctional ? 0.1 : 0)

  // 3. 面料成本估算
  const fabricMap: Record<string, number> = {
    羊毛: 8, 羊绒: 18, 真丝: 10, 醋酸: 6, 天丝: 5, 棉麻: 4, 尼龙: 3.5, 涤纶: 2.5,
    弹力: 3, 摇粒绒: 4, 牛仔: 5, 皮革: 12, 羽绒: 15, 针织: 4, 斜纹: 3, 帆布: 3,
  }
  let fabricCost = 0
  let fabricCount = 0
  for (const [key, cost] of Object.entries(fabricMap)) {
    if (lookText.includes(key)) { fabricCost += cost; fabricCount++ }
  }
  const estimatedFabricCost = fabricCount > 0 ? fabricCost / fabricCount : 4

  // 4. 辅料成本
  const accessoryCost = look.keyDetails.filter((d) => /拉链|扣|盘扣|磁吸|按扣/.test(d)).length * 1.2

  // 5. 工时成本（按品类 + 复杂度）
  const laborBase: Record<string, number> = { outerwear: 12, dress: 10, top: 6, bottom: 7, vest: 6, coat: 14, set: 18 }
  const laborCost = (laborBase[garment] || 8) * Math.min(complexityFactor, 1.6)

  // 6. 包装+杂费
  const overhead = 2.5

  // 7. 综合 FOB
  const estimatedFOB = parseFloat((estimatedFabricCost + accessoryCost + laborCost + overhead).toFixed(2))

  // 8. ERP 历史价格校准
  let historicalMin: number | undefined
  let historicalMax: number | undefined
  if (erpSummary?.recentOrders?.length) {
    const amounts = erpSummary.recentOrders
      .map((o) => Number(o.SellUnitPrice || o.FOB || o.UnitPrice))
      .filter((n) => n > 0)
    if (amounts.length) {
      amounts.sort((a, b) => a - b)
      historicalMin = parseFloat(amounts[0].toFixed(2))
      historicalMax = parseFloat(amounts[amounts.length - 1].toFixed(2))
    }
  }
  // 如果ERP价格带可用，取估算和历史的加权值
  const fobLow = historicalMin ? parseFloat((estimatedFOB * 0.6 + historicalMin * 0.4).toFixed(2)) : parseFloat((estimatedFOB * 0.85).toFixed(2))
  const fobHigh = historicalMax ? parseFloat((estimatedFOB * 0.6 + historicalMax * 0.4).toFixed(2)) : parseFloat((estimatedFOB * 1.25).toFixed(2))

  return {
    estimatedFOB: parseFloat(estimatedFOB.toFixed(2)),
    fobLow,
    fobHigh,
    fabricCost: parseFloat(estimatedFabricCost.toFixed(2)),
    laborCost: parseFloat(laborCost.toFixed(2)),
    accessoryCost: parseFloat(accessoryCost.toFixed(2)),
    overhead: parseFloat(overhead.toFixed(2)),
    historicalMin,
    historicalMax,
    category: garment,
    complexity: parseFloat(complexityFactor.toFixed(2)),
  }
}
