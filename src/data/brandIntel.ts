// 内置品牌情报（公开信息快照）
// 这些是首期客户对应的真实品牌的公开定位信息，用于在没有联网时也能给出"比 ERP 更懂品牌"的画像。
// 仅作方向参考；要拿到当季最新动态，走「AI 联网智能分析」（Claude 在线检索）。
// confidence 标注可信度：高=公开品牌、信息明确；中=方向可靠但细节需核实；低=ERP 全称对应的品牌身份待联网确认。

export interface BrandIntel {
  brand: string
  origin: string
  website: string
  /** 目标性别/人群：男装 / 女装 / 童装 / 男女装 / 中性。直接决定出图用什么模特，必须准确。 */
  gender: "男装" | "女装" | "童装" | "男女装" | "中性"
  segment: string
  consumer: string
  aesthetic: string
  signatureProducts: string[]
  trendNotes: string
  confidence: "高" | "中" | "低"
}

// key = 客户 id（见 customers.ts）
export const brandIntel: Record<string, BrandIntel> = {
  "4f": {
    brand: "4F（OTCF S.A.）",
    origin: "波兰·克拉科夫",
    website: "https://4f.com",
    gender: "男女装",
    segment: "运动 / 城市户外",
    consumer: "重视性价比与功能的大众运动人群，覆盖滑雪、跑步、训练到通勤户外。",
    aesthetic: "干净的运动机能风，配色克制（黑/灰/海军蓝 + 少量亮色点缀），强调面料性能与可叠穿性。",
    signatureProducts: ["软壳/防风夹克", "滑雪服", "功能卫衣", "训练裤"],
    trendNotes: "持续从硬核运动向城市机能/通勤场景延伸，轻量化、环保再生面料、可收纳设计是重点。",
    confidence: "高"
  },
  tj: {
    brand: "TEE JAYS",
    origin: "丹麦 / 北欧",
    website: "https://teejays.com",
    gender: "男女装",
    segment: "高品质基础款 / 企业团装",
    consumer: "面向 B2B 团装与零售商，看重版型稳定、面料品质和可批量复制的基础款。",
    aesthetic: "极简北欧风，纯色为主，重视克重、手感、耐洗与版型一致性，而非花哨设计。",
    signatureProducts: ["重磅 T 恤/Polo", "摇粒绒", "软壳外套", "卫衣"],
    trendNotes: "重点在面料升级（有机棉、再生涤纶）、色卡延展和稳定的版型工艺，而非款式更替。",
    confidence: "高"
  },
  pwt: {
    brand: "PWT Group（Lindbergh / Bruun & Stengade 等）",
    origin: "丹麦",
    website: "https://pwtgroup.com",
    gender: "男装",
    segment: "男装集团（轻商务休闲）",
    consumer: "欧洲男装零售渠道，目标都市男性，价格带中端，偏修身合体。",
    aesthetic: "斯堪的纳维亚轻商务：合体版型、低饱和大地色与藏蓝，细节克制精致。",
    signatureProducts: ["针织衫", "衬衫", "西装外套", "摇粒绒/夹克"],
    trendNotes: "smart-casual 混搭、可机洗易打理面料、合体但不紧绷的版型是长期方向。",
    confidence: "高"
  },
  nex: {
    brand: "NO EXCESS",
    origin: "荷兰·阿姆斯特丹",
    website: "https://www.no-excess.com",
    gender: "男装",
    segment: "男装休闲",
    consumer: "30–50 岁都市男性，喜欢有手工感、耐穿、不张扬的日常休闲装。",
    aesthetic: "成衣染（garment dye）做旧质感，大地色与复古色调，强调面料肌理与穿着舒适度。",
    signatureProducts: ["成衣染 T 恤/卫衣", "格纹衬衫", "针织", "夹克"],
    trendNotes: "成衣染工艺、复古色卡、棉麻与再生面料的舒适休闲是其核心标签。",
    confidence: "高"
  },
  hup: {
    brand: "HUPPA",
    origin: "爱沙尼亚",
    website: "https://huppa.com",
    gender: "童装",
    segment: "儿童功能外套",
    consumer: "面向寒冷气候家庭的婴童/儿童，核心诉求是保暖、防风防水与活动自由。",
    aesthetic: "高饱和明快配色 + 实用细节（反光条、可调节、加长保暖），功能优先。",
    signatureProducts: ["羽绒/棉服", "连体雪服", "冲锋衣裤", "中棉夹克"],
    trendNotes: "保暖科技（防水透湿膜、环保填充）、安全反光、可成长调节设计是持续重点。",
    confidence: "高"
  },
  vg: {
    brand: "Velilla（Velilla Group）",
    origin: "西班牙",
    website: "https://www.velilla.com",
    gender: "男女装",
    segment: "职业装 / 工装制服",
    consumer: "B2B 制服采购（餐饮、医疗、工业、安保），看重耐穿、易打理、可绣印与合规。",
    aesthetic: "实用职业装：功能版型、企业色卡、强调耐磨耐洗与三防/抗菌等功能整理。",
    signatureProducts: ["工装夹克/裤", "Polo/衬衫制服", "工程服", "围裙/防护"],
    trendNotes: "功能面料（抗菌、三防、机械弹力）、可定制色与企业 logo 绣印、舒适化工装是方向。",
    confidence: "高"
  },
  dvh: {
    brand: "DVH",
    origin: "澳大利亚",
    website: "",
    gender: "女装",
    segment: "度假休闲女装",
    consumer: "偏好轻松度假生活方式的年轻女性，重视拍照效果、轻便打包和自然舒适感。",
    aesthetic: "轻松度假风：宽松飘逸廓形、天然纤维肌理、海盐/珊瑚/沙色等自然色调，素色肌理为主、局部印花点缀。",
    signatureProducts: ["棉麻罩衫", "印花长裙", "阔腿裤", "度假连衣裙"],
    trendNotes: "度假风从大面积印花转向素色肌理和局部图案；抗皱、透度控制、洗后稳定性是品质关键。",
    confidence: "低"
  },
  sewd: {
    brand: "SEWD",
    origin: "英国",
    website: "",
    gender: "女装",
    segment: "轻奢通勤女装",
    consumer: "面向都市职业女性，重视精致感、质感与 office-to-dinner 场景切换能力。",
    aesthetic: "英式轻奢通勤：收腰/微廓形、柔和亮色（奶油白/雾蓝/鼠尾草绿/莓果）、垂感梭织与仿醋酸面料，精致领型与褶量细节。",
    signatureProducts: ["褶量衬衫连衣裙", "微廓形短外套", "垂感阔腿裤", "套装"],
    trendNotes: "从甜美转向轻熟通勤，简化装饰、高级色、抗皱垂感面料是方向；套装和日夜切换款式有增长空间。",
    confidence: "低"
  },
  jrc: {
    brand: "JRC",
    origin: "日本",
    website: "",
    gender: "女装",
    segment: "日系简约女装",
    consumer: "面向 25-45 岁轻熟女性，偏好自然舒适、含蓄克制的日常穿搭，重视面料触感与版型耐穿度。",
    aesthetic: "日系极简女装：以棉麻感、垂感梭织、柔和中性色为主调，宽松廓形、A 字/茧型、低调细节，温柔而有结构感。",
    signatureProducts: ["A字衬衫裙", "茧型薄外套", "棉麻连衣裙", "宽松衬衫"],
    trendNotes: "从基础极简转向柔和结构感，腰线抽褶、可调节细节、自然纹理面料是方向；浅色系透明度与抗皱性是品质关键。",
    confidence: "中"
  }
}
