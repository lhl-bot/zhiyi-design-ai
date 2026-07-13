import type { CustomerProfile, CostEstimate, CustomerTrend, ErpCustomerSummary, ErpTopItem, GeneratedLook, GenerationSettings, IntelResult, ComparisonResult } from "../types"
import type { BrandIntel } from "../data/brandIntel"
import { getTechSketchDataURL } from "./techSketch"
import { SCORE_THRESHOLD, CATEGORY_REGEX, ACCESSORY_REGEX, FABRIC_REGEX, CRAFT_REGEX } from "../constants"
import { reviewSummaryForPrompt, userReviewSignalsOf, verifiedUserReviewSignalsOf } from "../utils/customerReviews"
import { trendSignalsForPrompt, competitorSummaryForPrompt } from "../utils/competitorIntel"

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
  // 新增：覆盖更多客户风格标签，减少回退全量词库的概率
  "防风面料": nounsByCategory.outerwear.slice(0, 6),
  "多口袋": [...nounsByCategory.outerwear.slice(1, 5), ...nounsByCategory.bottoms.slice(2, 6)],
  "棉麻感": [...nounsByCategory.dresses.slice(0, 4), ...nounsByCategory.tops.slice(0, 4)],
  "丹宁": nounsByCategory.bottoms.slice(0, 5),
  "卫衣套装": [...nounsByCategory.sets, ...nounsByCategory.tops.slice(2, 6)],
  "宽松廓形": [...nounsByCategory.dresses.slice(0, 3), ...nounsByCategory.tops.slice(0, 4), ...nounsByCategory.bottoms.slice(0, 3)],
  "运动混搭": [...nounsByCategory.tops.slice(3, 8), ...nounsByCategory.bottoms.slice(3, 7)],
  "基础爆款": [...nounsByCategory.tops.slice(0, 5), ...nounsByCategory.bottoms.slice(0, 5)],
  "温柔中性色": [...nounsByCategory.dresses.slice(0, 4), ...nounsByCategory.tops.slice(0, 4)],
  "低调细节": [...nounsByCategory.dresses.slice(0, 3), ...nounsByCategory.tops.slice(0, 3)],
  "针织": [...nounsByCategory.tops.slice(4, 8), ...nounsByCategory.dresses.slice(2, 6)],
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

/** 获取多个不同面料，用于设计方向间差异化（不同方向用不同面料）*/
function materialsFor(customer: CustomerProfile, erp?: ErpContext | null, count = 4): string[] {
  const latest = latestTrendYear(erp)
  const fromTrend = latest?.fabrics?.map((f) => f.name).filter(Boolean) ?? []
  const fromSummary = erp?.summary?.topFabrics?.map((f) => f.name).filter(Boolean) ?? []
  const fromProfile = customer.fabricPreference.split(/[、,，；;]/).map((t) => t.trim()).filter(Boolean)
  const combined = [...fromTrend, ...fromSummary, ...fromProfile]
  const uniq = [...new Set(combined)]
  if (uniq.length === 0) return ["梭织功能面料"]
  return uniq.slice(0, Math.max(count, uniq.length))
}

/** 获取多个不同色彩，用于设计方向间差异化 */
function colorsFor(customer: CustomerProfile, erp?: ErpContext | null, count = 4): string[] {
  const latest = latestTrendYear(erp)
  const fromTrend = latest?.colors?.map((c) => c.name).filter(Boolean) ?? []
  const fromSummary = erp?.summary?.topColors?.map((c) => c.name).filter(Boolean) ?? []
  const fromProfile = customer.colorDirection.split(/[、,，；;]/).map((t) => t.trim()).filter(Boolean)
  const combined = [...fromTrend, ...fromSummary, ...fromProfile]
  const uniq = [...new Set(combined)]
  if (uniq.length === 0) return ["品牌核心色"]
  return uniq.slice(0, Math.max(count, uniq.length))
}

function clip(text: string, max: number): string {
  const t = String(text ?? "").trim()
  return t.length > max ? t.slice(0, max) + "…" : t
}

// ─── 中文面料/工艺术语 → 英文映射（提升模型面料质感还原）────────────
const fabricTermMap: Record<string, string> = {
  "华达呢": "gabardine", "涅纶": "polyester", "涤纶": "polyester", "棉": "cotton", "纯棉": "pure cotton",
  "有机棉": "organic cotton", "重磅棉": "heavyweight cotton", "羊毛": "wool", "羊毛混纺": "wool blend",
  "亚麻": "linen", "棉麻": "cotton-linen blend", "真丝": "silk", "丝": "silk", "醋酸": "acetate",
  "雪纺": "chiffon", "乔其纱": "georgette", "牛仔": "denim", "灯芯绒": "corduroy",
  "摇粒绒": "polar fleece", "抓绒": "fleece", "珊瑚绒": "coral fleece", "羊绒": "cashmere",
  "针织": "knit", "罗纹": "rib knit", "府绸": "poplin", "斜纹": "twill", "帆布": "canvas",
  "氨纶": "spandex", "弹力": "stretch", "粘胶": "viscose", "天丝": "tencel", "莫代尔": "modal",
  "尼龙": "nylon", "软壳": "softshell", "羽绒": "down", "混纺": "blend", "缎": "satin",
  "蕾丝": "lace", "鹿皮": "suede", "皮革": "leather", "卡其": "khaki twill", "提花": "jacquard",
  "泡泡纱": "seersucker", "华尔纱": "voile", "卡子": "double-faced wool", "双面呢": "double-faced wool",
  "唵啡": "cotton jersey", "卫衣布": "french terry", "水洗": "washed", "成衣染": "garment dyed",
  "再生涤纶": "recycled polyester", "复合面料": "composite fabric", "功能面料": "performance fabric",
  "防泼水": "water-repellent", "速干": "quick-dry", "磨毛": "brushed", "涂层": "coated",
  "弹力棉": "stretch cotton", "石墨烯": "graphene-infused", "防水透湿膜": "waterproof breathable membrane",
  "锦纶": "nylon", "PU涂层": "PU coated",
}

/** 把中文面料名转换为英文术语（命中则替换，未命中保留原词）*/
function toEnglishFabric(name: string): string {
  const trimmed = String(name ?? "").trim()
  if (!trimmed) return ""
  // 完全匹配优先
  if (fabricTermMap[trimmed]) return fabricTermMap[trimmed]
  // 子串包含匹配（按键长降序，避免短词误中）
  for (const key of Object.keys(fabricTermMap).sort((a, b) => b.length - a.length)) {
    if (trimmed.includes(key)) return fabricTermMap[key]
  }
  return trimmed
}

// ─── 中文工艺细节术语 → 英文映射（避免中文词混入英文 prompt 段）────────────
const detailTermMap: Record<string, string> = {
  // closure
  "暗门襟拉链": "concealed placket zipper", "双排金属扣": "double-breasted metal buttons",
  "隐藏式按扣": "hidden snap fasteners", "斜开襟拉链": "diagonal placket zipper",
  "绑带式门襟": "wrap tie front", "中式盘扣": "Chinese knot button", "磁吸隐形扣": "magnetic hidden clasp",
  // pocket
  "立体工装贴袋": "3D cargo patch pocket", "斜插拉链口袋": "angled zip pocket",
  "立体风琴袋": "3D accordion pocket", "隐藏侧缝口袋": "hidden side seam pocket",
  "翻盖按扣胸袋": "flap snap chest pocket", "拼接双层口袋": "spliced double-layer pocket",
  // collar
  "翻领拼接": "lapel splice", "可立可翻两用领": "convertible collar",
  "尖角衬衫领": "pointed shirt collar", "中式小立领": "mandarin collar",
  "无领圆领口": "collarless round neck", "不对称翻领": "asymmetrical lapel",
  "飘带领结": "ribbon tie collar",
  // sleeve
  "落肩超长袖": "drop-shoulder elongated sleeve", "可调节袖袢": "adjustable sleeve tab",
  "灯笼袖收口": "lantern sleeve with cuff", "弧形袖窿": "curved armhole",
  "卷边袖口": "rolled cuff", "插肩袖拼接": "raglan sleeve splice",
  // hem
  "弧形前短后长下摆": "curved high-low hem", "抽绳调节下摆": "drawstring adjustable hem",
  "开衩圆摆": "slit round hem", "松紧收口下摆": "elastic hem",
  "不规则毛边下摆": "irregular raw-edge hem",
  // texture
  "细腻针织肌理": "fine knit texture", "斜纹帆布质感": "twill canvas texture",
  "仿醋酸垂感": "acetate-like drape", "水洗做旧触感": "washed vintage texture",
  "摇粒绒柔软面": "polar fleece soft surface", "泡泡纱立体感": "seersucker 3D texture",
  "天丝柔滑光泽": "tencel smooth luster",
  // functional
  "可拆卸帽子": "detachable hood", "内置防风袖口": "built-in windproof cuff",
  "透气孔细节": "ventilation hole detail", "反光嵌条": "reflective trim",
  "内袋分隔系统": "internal pocket divider system",
  // constructionWords
  "三针五线加固": "3-needle 5-thread reinforcement", "来去缝净边工艺": "french seam finish",
  "包边收口": "bound edge finish", "双明线装饰": "double topstitch detail",
  "压胶无缝拼接": "taped seamless joint", "滚边包缝": "bias bound seam",
  "法式缝份": "french seam allowance", "链式平缝": "chain stitch flat seam",
  "三角打枣加固": "triangle bartack reinforcement", "人字车缝": "zigzag stitch",
  "贴边内收": "faced inward curve", "撞色包边": "contrast binding",
  "隐线暗缝": "hidden blind stitch", "锁链绣装饰线": "chain embroidery detail",
}

/** 把中文工艺细节词转换为英文术语（命中则替换，未命中保留原词）*/
function toEnglishDetail(name: string): string {
  const trimmed = String(name ?? "").trim()
  if (!trimmed) return ""
  // 完全匹配优先
  if (detailTermMap[trimmed]) return detailTermMap[trimmed]
  // 子串包含匹配（按键长降序，避免短词误中）
  for (const key of Object.keys(detailTermMap).sort((a, b) => b.length - a.length)) {
    if (trimmed.includes(key)) return detailTermMap[key]
  }
  return trimmed
}

// ─── 中文色名 → 英文映射（避免中文词混入英文 prompt 段）────────────────────
const colorTermMap: Record<string, string> = {
  "深松绿": "deep pine green", "岩灰": "stone gray", "深海军蓝": "deep navy blue", "苔绿": "moss green",
  "暖咖": "warm coffee brown", "栗棕": "chestnut brown", "米白": "off-white", "雾粉": "misty pink",
  "燕麦": "oatmeal", "墨蓝": "ink blue", "酒红": "burgundy", "巧克力色": "chocolate brown",
  "卡其": "khaki", "橄榄绿": "olive green", "炭灰": "charcoal gray", "鼠尾草绿": "sage green",
  "莓果色": "berry tone", "宝蓝": "royal blue", "铁锈红": "rust red", "钴蓝": "cobalt blue",
  "藏青": "navy", "军绿": "army green", "姜黄": "turmeric yellow", "藕粉": "lotus pink",
  "豆绿": "bean green", "杏色": "apricot", "雾蓝": "misty blue", "砖红": "brick red",
  "墨绿": "dark green", "驼色": "camel", "灰蓝": "grayish blue", "粉灰": "dusty pink",
  "银灰": "silver gray", "奶白": "cream white", "深灰": "dark gray", "浅灰": "light gray",
  "藏蓝": "navy blue", "黑": "black", "白": "white", "灰": "gray", "蓝": "blue", "绿": "green",
  "红": "red", "棕": "brown", "黄": "yellow", "驼": "camel", "军": "military",
}

/** 把中文色名转换为英文术语（命中则替换，未命中保留原词；支持整句子串替换）*/
function toEnglishColor(name: string): string {
  const trimmed = String(name ?? "").trim()
  if (!trimmed) return ""
  // 完全匹配优先
  if (colorTermMap[trimmed]) return colorTermMap[trimmed]
  // 子串匹配替换（按键长降序，避免短词误中），替换所有匹配项，未匹配部分保留原词
  let result = trimmed
  for (const key of Object.keys(colorTermMap).sort((a, b) => b.length - a.length)) {
    if (result.includes(key)) {
      result = result.split(key).join(colorTermMap[key])
    }
  }
  return result
}

// ─── 创意强度 → 英文引导词（seedream 不支持 guidance_scale，改用提示词引导）──
function creativityGuidance(creativity: number): string {
  if (creativity <= 2) return "Strictly adhere to the design specification, faithful reproduction of brand style, no creative deviation, conservative and production-ready."
  if (creativity <= 4) return "Faithful adherence to the design specification with minimal creative refinement, staying close to brand identity."
  if (creativity <= 6) return "Balanced interpretation of the design specification with moderate creative refinement."
  if (creativity <= 7) return "Creative interpretation of the design specification with refined experimental elements and modern styling."
  return "Bold creative interpretation, experimental silhouette and unexpected detail combinations while staying wearable and producible."
}

// ─── 客户市场定位中文关键词 → 英文（注入 prompt 英文强权重区）────────────
const marketTermMap: Record<string, string> = {
  "女装": "women's wear", "男装": "men's wear", "童装": "children's wear", "中性": "unisex",
  "日本": "Japanese", "日系": "Japanese", "北美": "North American", "美式": "American",
  "欧洲": "European", "欧美": "European & American", "韩国": "Korean", "韩系": "Korean",
  "国内": "domestic Chinese", "中国": "Chinese", "东南亚": "Southeast Asian", "澳洲": "Australian",
  "简约": "minimalist", "极简": "minimalist", "休闲": "casual", "户外": "outdoor",
  "机能": "techwear", "商务": "business", "通勤": "commuter", "运动": "sporty athleisure",
  "时尚": "fashion-forward", "轻奢": "affordable luxury", "快时尚": "fast fashion",
  "潮流": "trendy streetwear", "街头": "streetwear", "优雅": "elegant", "轻熟": "sophisticated",
  "度假": "resort", "工装": "workwear", "复古": "vintage", "设计师": "designer",
}

/** 把客户市场定位中文转英文关键词串（命中则替换，未命中保留原词）*/
function marketToEnglish(market: string): string {
  const trimmed = String(market ?? "").trim()
  if (!trimmed) return "fashion brand"
  const hits: string[] = []
  for (const key of Object.keys(marketTermMap).sort((a, b) => b.length - a.length)) {
    if (trimmed.includes(key) && !hits.includes(marketTermMap[key])) hits.push(marketTermMap[key])
  }
  return hits.length ? hits.join(" ") : trimmed
}

// ─── 品类中文 → 英文主体名词（注入 Design 段作为强约束）──────────────────
const categoryToEnglish: Record<string, string> = {
  "夹克": "jacket", "马甲": "vest", "连衣裙": "dress", "衬衫": "shirt",
  "长裤": "trousers", "套装": "coordinated set", "风衣": "trench coat",
  "卫衣": "hoodie", "户外裤": "outdoor technical pants", "针织套头": "knit pullover",
  "羽绒服": "down jacket", "软壳": "softshell jacket", "西装": "tailored blazer",
  "大衣": "overcoat", "外套": "coat",
}

// ─── 品类 → nounsByCategory 大类键（品类词库过滤兜底）────────────────────
const categoryToGroup: Record<string, keyof typeof nounsByCategory> = {
  "夹克": "outerwear", "风衣": "outerwear", "羽绒服": "outerwear", "软壳": "outerwear",
  "大衣": "outerwear", "西装": "outerwear", "外套": "outerwear",
  "马甲": "tops", "衬衫": "tops", "卫衣": "tops", "针织套头": "tops",
  "连衣裙": "dresses", "长裤": "bottoms", "户外裤": "bottoms", "套装": "sets",
}

// ─── 中文色名 → 近似 HEX（配色对齐客户 colorDirection）────────────────────
const colorHexMap: Record<string, string> = {
  "米白": "#f0ebe0", "奶白": "#f5f1e8", "奶油": "#f3ead6", "燕麦": "#d9cdb8",
  "雾粉": "#e6d0cb", "藕粉": "#e3c3c0", "粉灰": "#d8c5c2", "浅灰": "#d0d0cf",
  "银灰": "#c4c8cc", "深灰": "#4a4a4a", "炭灰": "#36363a", "灰蓝": "#8fa3ad",
  "雾蓝": "#a9bcc4", "墨蓝": "#22303f", "藏青": "#1f2a44", "藏蓝": "#1f2a44",
  "钴蓝": "#2a4d8f", "宝蓝": "#274690", "巧克力": "#4a3228", "栗棕": "#5a3c2c",
  "暖咖": "#5c4433", "驼色": "#b08d57", "卡其": "#b5a06e", "橄榄绿": "#6b6b3a",
  "军绿": "#4b5320", "墨绿": "#2e4437", "松绿": "#1f2d2a", "苔绿": "#6f7a4a",
  "酒红": "#6d232f", "铁锈红": "#9c4a34", "砖红": "#a4472e", "莓果": "#7a2f45",
  "姜黄": "#d9a441", "杏色": "#f0d5b8", "黑": "#1a1a1a", "白": "#f7f7f7",
  "灰": "#9a9a9a", "蓝": "#3a5a80", "绿": "#4a6b4a", "红": "#a23a3a",
  "棕": "#6b4a30", "黄": "#d9b84a", "粉": "#e8c4c4", "紫": "#6a5a7a", "橙": "#d97a3a",
}

/** 中文色名 → HEX（完全匹配优先，其次子串匹配；未命中返回空串）*/
function zhColorToHex(name: string): string {
  const trimmed = String(name ?? "").trim()
  if (!trimmed) return ""
  if (colorHexMap[trimmed]) return colorHexMap[trimmed]
  for (const key of Object.keys(colorHexMap).sort((a, b) => b.length - a.length)) {
    if (trimmed.includes(key)) return colorHexMap[key]
  }
  return ""
}

/** 按客户 colorDirection 生成 3 色配色板，不足时用季节色板补齐，seed 轮转差异化 */
function paletteForCustomer(customer: CustomerProfile, season: string, seed: number): string[] {
  const names = String(customer.colorDirection ?? "")
    .split(/[、,，；;。\/\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)
  let hexes: string[] = []
  for (const name of names) {
    const hex = zhColorToHex(name)
    if (hex && !hexes.includes(hex)) hexes.push(hex)
  }
  // seed 轮转差异化：不同款式从不同起点取色，避免雷同
  if (hexes.length > 1) {
    const offset = Math.abs(seed) % hexes.length
    hexes = [...hexes.slice(offset), ...hexes.slice(0, offset)]
  }
  // 用季节色板补齐到 3 色
  const result = [...hexes]
  for (const c of pickPalette(season, seed)) {
    if (result.length >= 3) break
    if (!result.includes(c)) result.push(c)
  }
  return result.slice(0, 3)
}

// ─── 挑选适合该客户的出款品类词 ─────────────────────────────────────────
function pickNounsForCustomer(customer: CustomerProfile, settings: GenerationSettings, count: number, nonce?: number): string[] {
  // 先按客户风格标签匹配品类（精确 + 子串模糊匹配）
  let pool: string[] = []
  for (const tag of customer.styleTags) {
    // 精确匹配优先
    if (styleToCategory[tag]) { pool = pool.concat(styleToCategory[tag]); continue }
    // 子串模糊匹配：标签包含映射 key 或 key 包含标签
    for (const key of Object.keys(styleToCategory)) {
      if (tag.includes(key) || key.includes(tag)) {
        pool = pool.concat(styleToCategory[key])
      }
    }
  }
  // 从客户代表款式中反推品类偏好，作为补充池
  if (pool.length < count) {
    for (const s of customer.representativeStyles) {
      const cat = (s.category || "").toLowerCase()
      if (cat.includes("jacket") || cat.includes("coat") || cat.includes("outer") || cat.includes("vest")) {
        pool = pool.concat(nounsByCategory.outerwear)
      } else if (cat.includes("dress") || cat.includes("skirt")) {
        pool = pool.concat(nounsByCategory.dresses)
      } else if (cat.includes("pant") || cat.includes("jean") || cat.includes("bottom")) {
        pool = pool.concat(nounsByCategory.bottoms)
      } else if (cat.includes("set") || cat.includes("suit")) {
        pool = pool.concat(nounsByCategory.sets)
      } else if (cat) {
        pool = pool.concat(nounsByCategory.tops)
      }
    }
  }
  // 没匹配到则用全量
  if (pool.length < count) pool = pool.concat(allNouns)
  // 如果用户指定了品类，限定在该品类
  if (settings.category !== "自动匹配") {
    const cat = settings.category
    let filtered = pool.filter((n) => n.includes(cat))
    if (filtered.length < count) filtered = allNouns.filter((n) => n.includes(cat))
    // 词库无字面命中（如长裤/户外裤/针织套头/软壳/羽绒服）时，按大类取词兜底，保证 title 品类正确且非空
    if (filtered.length === 0 && categoryToGroup[cat]) filtered = [...nounsByCategory[categoryToGroup[cat]]]
    if (filtered.length) pool = filtered
  }
  // 去重 + shuffle
  const uniq = [...new Set(pool)]
  // 用客户 id + nonce 做种子，nonce 保证不同批次结果不同
  const seed = hash(customer.id + settings.season + String(nonce ?? ""))
  return shuffleSeed(seed, uniq).slice(0, Math.max(count, uniq.length))
}

// ─── 设计方向生成（大幅增强）──────────────────────────────────────────
function fallbackDesignDirections(
  customer: CustomerProfile,
  settings: GenerationSettings,
  count: number,
  erp?: ErpContext | null,
  nonce?: number
): string[] {
  // 多面料/多色彩轮转：不同方向使用不同面料和色彩，消除雷同
  const materials = materialsFor(customer, erp, 8)
  const colors = colorsFor(customer, erp, 8)
  const crafts = customer.erpInsight?.craftFocus?.length
    ? [...customer.erpInsight.craftFocus]
    : ["压胶工艺", "精致包边", "暗线缝制", "明线装饰", "激光切割", "拼接工艺"]
  const brand = erp?.brand
  const season = settings.season
  const isAW = season.includes("AW") || season.includes("FW")

  // 8 种不同的设计方向模板，每个模板接受序号 i 用于面料/色彩/工艺轮转
  const templates: Array<(i: number) => string> = [
    // 面料质地主导
    (i) => `${materials[i % materials.length]} + ${customer.fabricPreference.split(/[、,，]/)[0] || "品牌核心面料"}混搭，用${crafts[i % crafts.length]}工艺突出质感层次，${isAW ? "深色底+金属辅料点缀" : "浅色底+自然材质辅料"}。`,
    // 廓形创新
    () => `${customer.silhouette}基础上的${isAW ? "解构重组" : "松弛延伸"}，保留品牌辨识度同时增加${season}流行廓形元素。`,
    // 色彩叙事
    (i) => `以${colors[i % colors.length]}为主调，${isAW ? "加入暖调大地色做层次过渡" : "搭配柔和亮色或自然中性色"}，形成${season}系列色卡逻辑。`,
    // 品类深挖
    (i) => {
      const focusList = customer.erpInsight?.materialFocus ?? []
      const product = focusList[i % Math.max(1, focusList.length)] || customer.styleTags[0] || "核心品类"
      return `${product}品类深度开发：在${customer.styleTags.slice(0, 2).join("和")}风格基础上，做${season}的${isAW ? "面料升级版" : "轻量化版本"}。`
    },
    // 场景驱动
    () => {
      const scene = brand?.segment || customer.market
      return `面向${scene}场景：设计可多场合适配的${isAW ? "保暖层搭" : "清凉通勤"}单品，一件满足${isAW ? "从室外到室内" : "从办公室到社交"}的切换需求。`
    },
    // 趋势响应
    (i) => {
      const trend = seasonTrends[season]?.detail || "当季流行元素"
      return `呼应当季趋势（${trend}），结合客户历史数据中验证过的${materials[(i + 1) % materials.length]}和${colors[(i + 2) % colors.length]}方向。`
    },
    // 数据驱动（如果有 ERP 数据则引用）
    () => {
      const erpPrice = erp?.summary?.suggestedProfilePatch?.priceStrategy
      const priceNote = erpPrice && erpPrice !== "待外部渠道校准" ? `控制在${erpPrice.slice(0, 30)}以内` : "控制工艺复杂度"
      return `基于客户历史订单表现：${customer.erpInsight?.orderTrend || "稳定品类"}；${priceNote}，优先做${customer.erpInsight?.repeatOrderSignal || "返单信号强的品类"}。`
    },
    // 差异化尝试
    (i) => `在客户舒适区边缘做一次谨慎试探：保留${customer.styleTags.slice(0, 2).join("+")}基底，用${season}新面料/新辅料做${customer.styleTags.length > 3 ? customer.styleTags[3] : "细节升级"}。`,
  ]

  const seed = hash(customer.id + settings.season + settings.creativity.toString() + String(nonce ?? ""))
  const shuffled = shuffleSeed(seed, templates.map((_, i) => i.toString()))
  const picked = shuffled.slice(0, Math.max(count, 6)).map((idx, ord) => templates[Number(idx)](ord))
  // 确保不重复；不足时从第二轮填充
  const uniq = [...new Set(picked)]
  let fillIdx = uniq.length
  while (uniq.length < count && fillIdx < 100) {
    const extra = templates[fillIdx % templates.length](fillIdx)
    if (!uniq.includes(extra)) uniq.push(extra)
    fillIdx++
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
function pickKeyDetails(seed: number, count = 5, customer?: CustomerProfile): string[] {
  const picked: string[] = []
  // 优先纳入客户专属工艺特征（erpInsight.craftFocus），确保不同客户细节天然不同
  if (customer?.erpInsight?.craftFocus?.length) {
    picked.push(...customer.erpInsight.craftFocus.slice(0, 3))
  }
  // 每款至少保证：闭合方式、口袋、领型、面料肌理 + 一个随机维度
  const priority = ["closure", "pocket", "collar", "texture", "sleeve", "hem", "functional"]
  for (const type of priority) {
    if (picked.length >= count) break
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
  const trendSignals = trendSignalsForPrompt(customer.id)
  if (trendSignals) parts.push(`竞对趋势：${trendSignals}`)
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
  const categoryEn = settings.category !== "自动匹配" ? (categoryToEnglish[settings.category] || settings.category) : "garment"
  const identityLine = `Brand context: "${customer.name}", ${marketToEnglish(customer.market)}, clear target customer and positioning. `
  const fusion = mode === "参考图融合" && referenceNote ? `参考上传图融入其廓形、情绪与比例（${referenceNote}）。` : ""
  const mainColor = look.palette?.[0] ? `，主色调 ${look.palette[0]}` : ""
  const intel = erp?.intel
  const trendYears = erp?.trend?.years ?? []
  const latestYear = trendYears.length ? trendYears[trendYears.length - 1] : null
  const fabrics = latestYear?.fabrics?.length
    ? latestYear.fabrics.slice(0, 3).map((f) => f.name).join("、")
    : customer.fabricPreference
  const colors = latestYear?.colors?.length
    ? latestYear.colors.slice(0, 3).map((c) => toEnglishColor(c.name)).join(", ")
    : toEnglishColor(customer.colorDirection)
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
  let reviewDirective = reviewText
    ? `用户评价与采集状态：${clip(reviewText, 220)}；${verifiedReviewCount ? "已采集评价作为强约束，回应差评痛点并保留好评点。" : ""}待采集/主体确认信息作为弱约束和核验提醒，不要虚构用户痛点。`
    : ""
  const sourceContext = buildExternalBlurb(customer, erp)
  let sourceDirective = sourceContext ? `综合数据辅助：${clip(sourceContext, 220)}` : ""
  const competitorSummary = competitorSummaryForPrompt(customer.id)
  let competitorDirective = competitorSummary ? `竞对情报：${competitorSummary}；` : ""
  // 面料触感增强词：中文面料名转英文术语，提升模型质感还原
  const fabricTextureHints = latestYear?.fabrics?.length
    ? `${latestYear.fabrics.slice(0, 2).map((f) => toEnglishFabric(f.name)).join(" and ")} fabric with visible weave texture, natural drape`
    : "premium fabric with visible texture and natural drape"
  // 创意强度引导词（B项：seedream 不支持 guidance_scale，改用提示词层面控制）
  const creativityLine = creativityGuidance(settings.creativity)
  // 构建上下文暗区（不影响画面但告知模型背景）
  let contextSection = [sourceDirective, competitorDirective].filter(Boolean).join("")
  // 设计硬约束（必须保留 / 避免方向 / 目标价格）——界面显式输入，最高优先级，不参与超限截断
  const constraintDirective = buildConstraintBlurb(settings)
  // 增强生图质量的关键段落——英文前置，中文数据后置
  // ─── prompt 预算管理：确保总长度不超过 3000 字符（服务端 3200 上限留 200 余量）──
  const MAX_PROMPT = 3000
  const buildParts = () => [
    // 第1段：视觉风格（纯英文，模型最敏感的区域）
    `High-end fashion e-commerce product photography, ${genderTag ? genderTag + " " : ""}${settings.season} collection. `,
    identityLine,
    `Design: a ${categoryEn} — ${look.title || look.designDirection?.slice(0, 60) || customer.styleTags.slice(0, 2).join(" ")}, ${fabricTextureHints}. `,
    `Silhouette: ${customer.silhouette}, refined modern proportions, commercially producible pattern cutting. `,
    `${creativityLine} `,
    // 第2段：细节构造（英文，精确描述工艺）
    `Garment construction: clean front view, clearly defined collar neckline placket closure, `,
    `${look.keyDetails?.filter(Boolean).slice(0, 3).map(toEnglishDetail).join(", ") || "functional pocket details, structured seams"}, `,
    `visible topstitching and seam lines, professional finishing on cuffs and hem. `,
    // 第3段：色调面料（中英混合，数据驱动）
    `${aesthetic}Style: ${customer.styleTags.slice(0, 4).join("/")}. `,
    `Color palette: ${colors}${mainColor}. ${trendLine}`,
    // 第4段：品牌/趋势上下文（中文，给模型语义理解但不主导画面）
    `${genderLead}「${customer.name}」（${customer.market}，定位：${clip(customer.positioning, 40)}）${settings.season} ${category}。${brief}。${seasonNote?.mood ? `当季语境：${seasonNote.mood}。` : ""}`,
    brandRefLead,
    // 设计硬约束（必须保留 / 避免方向 / 目标价格）——用户界面显式输入，作为强指引
    constraintDirective,
    // 第5段：评价/竞对约束（中文，作为辅助指引）
    reviewDirective,
    contextSection,
    fusion,
    // 第6段：画面规格（英文）
    `${model} full-body front view on seamless white or very light gray studio background, `,
    `even soft diffused professional lighting highlighting fabric texture and drape, `,
    `crisp focus, subtle shadow on floor for depth, editorial lookbook quality, ${settings.imageSize ?? "2K"} resolution.`,
    // 第7段：负面约束（英文，NEW——增强版）
    `Negative: no text, no letters, no logos, no watermarks, no brand marks, no UI elements, `,
    `no human face close-up, no extra limbs, no cropped body parts, no distorted hands or feet, `,
    `no random straps or buckles, no fantasy armor, no busy or cluttered background, no harsh shadows, no overexposure.`
  ].filter(Boolean).join("")
  let fullPrompt = buildParts()
  if (fullPrompt.length > MAX_PROMPT) {
    // 超限时缩减低优先级中文段
    reviewDirective = clip(reviewDirective, 120)
    fullPrompt = buildParts()
  }
  if (fullPrompt.length > MAX_PROMPT) {
    contextSection = [sourceDirective ? clip(sourceDirective, 80) : "", competitorDirective ? clip(competitorDirective, 80) : ""].filter(Boolean).join("")
    fullPrompt = buildParts()
  }
  return fullPrompt
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

  // 确定性 nonce：同一客户同一参数产生相同 nonce → 相同 prompt → 相同 seed → 可复现
  const nonce = hash(customer.id + settings.season + settings.creativity.toString() + (settings.category || ""))

  // 设计方向：AI 联网分析优先，否则用增强版 fallback
  const directions = erp?.intel?.designDirections?.filter(Boolean).length
    ? erp.intel.designDirections.filter(Boolean)
    : fallbackDesignDirections(customer, settings, count, erp, nonce)

  // 品类词：用户指定品类 > 风格匹配 > 全量
  const nouns = pickNounsForCustomer(customer, settings, count, nonce)
  const seedBase = hash(customer.id + settings.season + settings.creativity.toString() + String(nonce))

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

    const palette = isLineArt ? ["#ffffff", "#1a1a1a", "#f5f5f5"] : paletteForCustomer(customer, settings.season, seed)
    const keyDetails = isLineArt
      ? ["技术线稿", "可编辑参考", "黑白款式图"]
      : pickKeyDetails(seed, 5, customer)

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
  const keyDetails = pickKeyDetails(seedBase, 5, customer)

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
  // 优先用返单代表款作为历史基线；无返单标记时退回全部代表款，保证基线非空
  const repRepeat = customer.representativeStyles.filter((s) => s.isRepeatOrder)
  const representativeStyles = repRepeat.length ? repRepeat : customer.representativeStyles

  const lookGarmentClass = garmentClass(look.title)

  // 1. 品类匹配：按品类大类（garmentClass）或款名双向子串判定，避免中文整词全等失配
  const lookCategoryText = look.title + " " + look.keyDetails.join(" ")
  const historyCategories = recentOrders.map((o) => String(o.ProductName || o.StyleName || o.Category || "")).filter(Boolean)
  const repStyleNames = representativeStyles.map((s) => s.title)
  const allHistoryNames = [...historyCategories, ...repStyleNames]
  const matchedStyles = allHistoryNames.filter(
    (name) => garmentClass(name) === lookGarmentClass || looseOverlap(look.title, name)
  )
  const categoryMatch = matchedStyles.length > 0

  // 2. 面料重合度：客户/ERP 高频面料与款名+细节+设计方向做中文感知子串匹配
  const lookFabricText = [look.title, ...look.keyDetails, look.designDirection || ""].join(" ")
  const fabricKeywords = topFabrics.length ? topFabrics : customer.fabricPreference.split(/[、,，；;]/).map((s) => s.trim()).filter(Boolean)
  const matchedFabrics = fabricKeywords.filter((f) => looseOverlap(lookFabricText, f))
  const fabricOverlap = fabricKeywords.length ? matchedFabrics.length / fabricKeywords.length : 0

  // 3. 色彩重合度：调色板存的是 HEX，故把色名转 HEX 与 palette 比对（palette 亦由 colorDirection 转来），并兜底文本匹配
  const colorNames = topColors.length ? topColors : customer.colorDirection.split(/[、,，；;。\/\s]+/).map((s) => s.trim()).filter(Boolean)
  const paletteSet = new Set(look.palette.map((h) => h.toLowerCase()))
  const lookColorText = look.keyDetails.join(" ") + " " + look.title
  const matchedColors = colorNames.filter((c) => {
    const hex = zhColorToHex(c)
    if (hex && paletteSet.has(hex.toLowerCase())) return true
    return looseOverlap(lookColorText, c)
  })
  const colorOverlap = colorNames.length ? matchedColors.length / colorNames.length : 0

  // 4. 廓形相似度：以款式品类大类是否落在客户历史/代表款的品类大类内判定，并兜底 silhouette 文本重合
  const historyGarmentClasses = new Set(allHistoryNames.map((n) => garmentClass(n)))
  const silhouetteMatch = historyGarmentClasses.has(lookGarmentClass) || looseOverlap(customer.silhouette, look.title)

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

// 中文感知的宽松重合判定：任一方为另一方子串，或存在共享的 2 字片段（bigram）即视为重合
function looseOverlap(a: string, b: string): boolean {
  const s1 = String(a ?? "").trim()
  const s2 = String(b ?? "").trim()
  if (!s1 || !s2) return false
  if (s1.includes(s2) || s2.includes(s1)) return true
  const shortStr = s1.length <= s2.length ? s1 : s2
  const longStr = s1.length <= s2.length ? s2 : s1
  for (let i = 0; i + 2 <= shortStr.length; i++) {
    if (longStr.includes(shortStr.slice(i, i + 2))) return true
  }
  return false
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
