export interface StyleImage {
  id: string
  title: string
  season: string
  category: string
  tags: string[]
  image: string
  isRepeatOrder: boolean
}

export interface ErpInsight {
  materialFocus: string[]
  craftFocus: string[]
  priceBand: string
  orderTrend: string
  repeatOrderSignal: string
}

export interface ExternalSignal {
  source: string
  insight: string
  designAction: string
}

export interface UserReviewSignal {
  source: string
  sourceUrl?: string
  sampleLabel: string
  status: "verified" | "pending" | "identity-only"
  productScope: string
  sentiment: "正向" | "负向" | "混合"
  praised: string[]
  painPoints: string[]
  designAction: string
  confidence: "高" | "中" | "低"
  notes?: string[]
  channel?: "官网" | "社媒" | "电商" | "评测站" | "ERP" | "其他"
  collectedAt?: string // ISO日期，追踪数据时效性
}

/** 竞对品牌 */
export interface CompetitorBrand {
  name: string
  origin?: string
  website?: string
  segment?: string
  positioning: string
  priceBand?: string
  signatureProducts?: string[]
  strengths: string[]
  weaknesses: string[]
  competitorType: "同类定位" | "快时尚对标"
}

/** 设计趋势信号 */
export interface TrendSignal {
  topic: string
  direction: "上升" | "稳定" | "下降"
  description: string
  applicableCustomers?: string[]
  source?: string
}

/** 市场销售数据 */
export interface MarketData {
  metric: string
  value: string
  unit?: string
  period?: string
  source?: string
}

/** 竞对情报聚合 */
export interface CompetitorIntel {
  competitors: CompetitorBrand[]
  trendSignals: TrendSignal[]
  marketData?: MarketData[]
  source?: string
  collectedAt?: string
  confidence: "高" | "中" | "低"
}

export interface CustomerProfile {
  id: string
  name: string
  erpCode?: string
  market: string
  positioning: string
  maturity: "数据充足" | "需设计师补标" | "新客户验证"
  styleTags: string[]
  silhouette: string
  colorDirection: string
  fabricPreference: string
  priceStrategy: string
  trendPrediction: string
  representativeStyles: StyleImage[]
  erpInsight: ErpInsight
  externalSignals: ExternalSignal[]
  userReviews?: UserReviewSignal[]
  risks: string[]
  competitorIntel?: CompetitorIntel
}

export interface GenerationSettings {
  count: number
  season: string
  category: string
  creativity: number
  targetPrice: string
  mustHave: string
  avoid: string
  imageSize?: "2K" | "4K"
  useSketchControl?: boolean
}

export interface ApiConfig {
  provider: "local" | "ark"
  endpoint: string
  apiKey: string
  intelSource?: "tavily" | "agent-reach" | "hybrid"
  aiKey?: string
  tavilyKey?: string
  arkKey?: string
}

export interface IntelResult {
  brandSummary?: string
  consumer?: string
  aesthetic?: string
  trendDirection?: string
  styleTrends?: string[]
  designDirections?: string[]
  fabricColorNotes?: string
  sources?: string[]
  officialImages?: string[]
}

/** 线稿对话修改：每一步修改记录 */
export interface SketchEditStep {
  id: string
  /** 该步的图片 URL */
  image: string
  /** 用户的修改指令（自然语言） */
  instruction: string
  /** 发送给 AI 的完整 prompt */
  prompt: string
  /** 时间戳 */
  timestamp: string
  /** 该步之前的上一步图片（用于对比） */
  beforeImage: string
}

/** 线稿对话消息 */
export interface SketchChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  image?: string
  timestamp: string
  /** 如果是 assistant 消息，关联的修改步骤 */
  editStepId?: string
}

export interface GeneratedLook {
  id: string
  customerId: string
  title: string
  prompt: string
  image: string
  score: number
  trendScore: number
  commercialScore: number
  estimatedCost: number
  sourceMode: "定向出款" | "参考图融合" | "线稿图"
  selected: boolean
  reviewStatus?: "待看" | "入选" | "待修改" | "淘汰"
  note: string
  modificationNote?: string
  palette: string[]
  keyDetails: string[]
  revisionAdvice: string
  createdAt: string
  designDirection?: string
  imageStatus?: "local-preview" | "model-generating" | "model-ready" | "model-failed"
  imageError?: string
  parentId?: string
  version?: number
}

export interface ComparisonResult {
  overallScore: number
  categoryMatch: boolean
  fabricOverlap: number
  colorOverlap: number
  silhouetteMatch: boolean
  matchedStyles: string[]
  matchedFabrics: string[]
  matchedColors: string[]
}

export interface CostEstimate {
  estimatedFOB: number
  fobLow: number
  fobHigh: number
  fabricCost: number
  laborCost: number
  accessoryCost: number
  overhead: number
  historicalMin?: number
  historicalMax?: number
  category: string
  complexity: number
}

export interface TechPackData {
  styleName: string
  customerName: string
  season: string
  category: string
  designDirection: string
  palette: string[]
  keyDetails: string[]
  fabrics: string[]
  accessories: string[]
  constructionNotes: string[]
  sizeChart: { size: string; chest: string; length: string; shoulder: string; sleeve: string }[]
  packagingNotes: string
}

export interface LaunchTask {
  date: string
  title: string
  owner: string
  status: "已完成" | "进行中" | "待开始"
}

export interface ErpStatus {
  ok: boolean
  database: string
  server: string
  port: number
  loginName: string
  version: string
  mode: string
}

export interface ProductionFeasibility {
  ok: boolean
  code: string
  summary: {
    fabricCount: number
    accessoryCount: number
    contractCount: number
    avgContractAmount: number
    currency: string
  }
  fabrics: FabricRecord[]
  accessories: AccessoryRecord[]
  fabricNames: string[]
  recentContracts: ContractRecord[]
}

export interface FabricRecord {
  name: string
  composition: string
  width: string
  weight: string
  color: string
  avgPrice: number
  usageCount: number
  supplier: string
  lastUsed: string
}

export interface AccessoryRecord {
  name: string
  spec: string
  color: string
  avgPrice: number
  usageCount: number
  supplier: string
}

export interface ContractRecord {
  billNo: string
  customerName: string
  amount: number
  contractDate: string
  deliveryDate: string
  currency: string
  tradeType: string
}

export interface ErpTopItem {
  name: string
  count: number
  extra: string | null
}

export interface CustomerTrend {
  code: string
  matched: boolean
  evolution: string
  years: TrendYear[]
}

export interface TrendYear {
  year: number
  contracts: number
  totalAmount: number
  avgAmount: number
  quotations: number
  avgQuote: number
  fabrics: ErpTopItem[]
  colors: ErpTopItem[]
  orderTypes: TrendItem[]
}

export interface TrendItem {
  name: string
  cnt?: number
  share?: number
}

export interface ErpCustomerSummary {
  code: string
  matched: boolean
  maturity: CustomerProfile["maturity"]
  master: Array<Record<string, string | number | null>>
  stats: {
    contracts: Record<string, string | number | null>
    quotations: Record<string, string | number | null>
  }
  topFabrics: ErpTopItem[]
  topAccessories: ErpTopItem[]
  topColors: ErpTopItem[]
  orderTypes: ErpTopItem[]
  recentOrders: Array<Record<string, string | number | null>>
  imageFiles: Array<Record<string, string | number | null>>
  suggestedProfilePatch: Partial<CustomerProfile>
}
