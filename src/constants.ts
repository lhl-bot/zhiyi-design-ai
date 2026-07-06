// ─── 全局常量 ───

/** 高分 / 推荐 / 自动入选的分数阈值 */
export const SCORE_THRESHOLD = 86

/** 品类匹配正则 — 面料/辅料/工艺提取共用 */
export const CATEGORY_PATTERN = "外套|夹克|大衣|风衣|西装|马甲|连衣裙|衬衫|裤|套装|卫衣"
export const CATEGORY_REGEX = /外套|夹克|大衣|风衣|西装|马甲|连衣裙|衬衫|裤|套装|卫衣/

/** 辅料关键词 */
export const ACCESSORY_REGEX = /扣|拉链|按扣|盘扣|磁吸|扣件|辅料|吊牌|拉绳|绳|袢|环|织带/
/** 面料关键词 */
export const FABRIC_REGEX = /面|料|布|绒|针织|帆布|天丝|羊毛|尼龙|涤纶|牛仔|醋酸/
/** 工艺关键词 */
export const CRAFT_REGEX = /缝|包边|滚边|压胶|拼接|打枣|车缝|明线|暗线|锁链|贴边|对格|对条/

/** localStorage key */
export const STORAGE_KEY = "ai-fashion-design-v2"
export const STORAGE_VERSION = 4
export const MOODBOARD_STORAGE_KEY = "mood-boards-v1"

/** 生成数量范围 */
export const MIN_LOOK_COUNT = 1
export const MAX_LOOK_COUNT = 30

/** 默认设置 */
export const DEFAULT_SEASON = "2026AW"
export const SEASONS = ["2026AW", "2026SS", "2027SS", "2025AW", "2025SS"]

export const CATEGORY_OPTIONS = [
  "自动匹配", "夹克", "马甲", "连衣裙", "衬衫", "长裤", "套装",
  "风衣", "卫衣", "户外裤", "针织套头", "羽绒服", "软壳",
]

/** 后端 API 端口 */
export const ERP_API_PORT = 8787

/** 默认 API 配置 */
export const DEFAULT_API_CONFIG = {
  provider: "local" as const,
  endpoint: "",
  apiKey: "",
  intelSource: "hybrid" as const,
}

/** 默认生成设置 */
export const DEFAULT_GENERATION_SETTINGS = {
  count: 6,
  season: "2026AW",
  category: "自动匹配",
  creativity: 5,
  targetPrice: "按客户历史价格带控制",
  mustHave: "保留客户核心风格、面料偏好和可生产工艺",
  avoid: "避免结构变形、过度复杂辅料、不可落地廓形",
}
