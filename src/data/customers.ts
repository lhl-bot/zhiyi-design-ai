import type { CustomerProfile, LaunchTask } from "../types"

const sampleImage = (customerId: string, index: number) => `/samples/${customerId}-${index}.png`

export const customers: CustomerProfile[] = [
  {
    id: "4f",
    name: "4F",
    market: "欧洲户外/通勤",
    positioning: "偏功能性的城市户外客户，重视面料性能、廓形干净和耐穿感。",
    maturity: "数据充足",
    styleTags: ["机能通勤", "轻户外", "防风面料", "低饱和色", "多口袋"],
    silhouette: "直筒偏宽松，强调肩线和下摆比例，适合叠穿。",
    colorDirection: "岩灰、深海军蓝、苔绿色、黑色为主，少量高亮压胶细节。",
    fabricPreference: "尼龙斜纹、涤纶复合布、轻薄防泼水面料。",
    priceStrategy: "中高价格带，推荐在面料功能和细节工艺上做价值感。",
    trendPrediction: "从硬核户外转向城市机能，建议减少厚重结构，增加轻量收纳和通勤场景。",
    representativeStyles: [
      {
        id: "4f-r1",
        title: "轻机能连帽夹克",
        season: "2025AW",
        category: "Jacket",
        tags: ["连帽", "压胶", "防泼水"],
        image: sampleImage("4f", 1),
        isRepeatOrder: true
      },
      {
        id: "4f-r2",
        title: "多口袋通勤马甲",
        season: "2026SS",
        category: "Vest",
        tags: ["多口袋", "尼龙", "叠穿"],
        image: sampleImage("4f", 2),
        isRepeatOrder: false
      }
    ],
    erpInsight: {
      materialFocus: ["轻薄尼龙", "防泼水复合布", "网眼里布"],
      craftFocus: ["压胶拉链", "隐藏口袋", "调节抽绳"],
      priceBand: "FOB 18-32 USD",
      orderTrend: "近三年从厚夹克转向轻外套和功能马甲。",
      repeatOrderSignal: "返单集中在深色连帽外套和可拆卸马甲。"
    },
    externalSignals: [
      {
        source: "DTC/官网",
        insight: "消费者更关注通勤场景下的轻便和防雨。",
        designAction: "保留防护卖点，但版型做轻薄，减少登山感。"
      },
      {
        source: "评论/社媒",
        insight: "常见吐槽是口袋够多但拿取不顺手。",
        designAction: "将胸袋和侧袋做差异化入口，提升使用感。"
      }
    ],
    risks: ["功能细节过多会抬高成本", "需要设计师确认工艺可生产性"]
  },
  {
    id: "jrc",
    name: "JRC",
    market: "日本简约女装",
    positioning: "偏生活方式的轻熟女客户，喜欢舒适、干净、含蓄的细节。",
    maturity: "数据充足",
    styleTags: ["极简", "棉麻感", "宽松廓形", "温柔中性色", "低调细节"],
    silhouette: "A字与茧型为主，肩线自然，衣长偏中长。",
    colorDirection: "米白、雾粉、燕麦、浅灰、墨蓝。",
    fabricPreference: "棉麻混纺、柔软斜纹、轻薄针织拼接。",
    priceStrategy: "稳定中价位，适合用面料触感和版型提升价值。",
    trendPrediction: "从基础极简转向柔和结构感，建议增加腰部抽褶和可调节细节。",
    representativeStyles: [
      {
        id: "jrc-r1",
        title: "棉麻感A字衬衫裙",
        season: "2025SS",
        category: "Dress",
        tags: ["A字", "棉麻", "中长款"],
        image: sampleImage("jrc", 1),
        isRepeatOrder: true
      },
      {
        id: "jrc-r2",
        title: "轻薄茧型外套",
        season: "2026SS",
        category: "Coat",
        tags: ["茧型", "无领", "轻薄"],
        image: sampleImage("jrc", 2),
        isRepeatOrder: true
      }
    ],
    erpInsight: {
      materialFocus: ["棉麻混纺", "柔软斜纹", "天丝感面料"],
      craftFocus: ["细褶", "暗门襟", "包边"],
      priceBand: "FOB 12-24 USD",
      orderTrend: "返单款以连衣裙和轻外套为主，色彩逐年更浅。",
      repeatOrderSignal: "米白和燕麦色中长款稳定返单。"
    },
    externalSignals: [
      {
        source: "DTC/官网",
        insight: "品牌内容强调日常舒适与自然面料。",
        designAction: "推荐自然纹理面料和可通勤可休闲的款式。"
      },
      {
        source: "消费者反馈",
        insight: "消费者关注不透、好打理、不显臃肿。",
        designAction: "增加里布方案和腰线微调，避免过度宽松。"
      }
    ],
    risks: ["浅色面料需要确认透度", "廓形太宽会影响接受度"]
  },
  {
    id: "tj",
    name: "TJ",
    market: "北美大众休闲",
    positioning: "价格敏感但上新节奏快，适合做易量产的休闲爆款。",
    maturity: "数据充足",
    styleTags: ["美式休闲", "卫衣套装", "丹宁", "运动混搭", "基础爆款"],
    silhouette: "宽松短款上衣搭配直筒裤，强调易穿搭。",
    colorDirection: "黑白灰、复古蓝、酒红、巧克力色。",
    fabricPreference: "棉涤卫衣布、牛仔、罗纹、摇粒绒。",
    priceStrategy: "低到中价位，优先控制工艺复杂度。",
    trendPrediction: "休闲基础款向复古校园和运动生活方式靠拢。",
    representativeStyles: [
      {
        id: "tj-r1",
        title: "复古短款卫衣",
        season: "2025AW",
        category: "Sweatshirt",
        tags: ["短款", "罗纹", "复古"],
        image: sampleImage("tj", 1),
        isRepeatOrder: true
      },
      {
        id: "tj-r2",
        title: "直筒水洗牛仔裤",
        season: "2026SS",
        category: "Denim",
        tags: ["直筒", "水洗", "基础"],
        image: sampleImage("tj", 2),
        isRepeatOrder: false
      }
    ],
    erpInsight: {
      materialFocus: ["卫衣布", "水洗丹宁", "摇粒绒"],
      craftFocus: ["印花", "明线", "罗纹拼接"],
      priceBand: "FOB 8-18 USD",
      orderTrend: "基础休闲款稳定，短款和套装需求增加。",
      repeatOrderSignal: "灰黑卫衣与基础丹宁返单强。"
    },
    externalSignals: [
      {
        source: "电商评价",
        insight: "消费者常提到缩水、起球和尺码偏差。",
        designAction: "优先做预缩面料、抗起球说明和尺码稳定版型。"
      },
      {
        source: "社媒趋势",
        insight: "复古校园和运动生活方式热度高。",
        designAction: "推荐短款卫衣、棒球领外套和直筒下装。"
      }
    ],
    risks: ["价格带限制复杂工艺", "爆款迭代速度要求高"]
  },
  {
    id: "pwt",
    name: "PWT",
    erpCode: "PT",
    market: "欧洲工装休闲",
    positioning: "偏耐穿和实用主义，接受中性化工装细节。",
    maturity: "需设计师补标",
    styleTags: ["工装", "耐磨", "中性", "可调节", "大口袋"],
    silhouette: "方正外套和直筒下装，结构清晰。",
    colorDirection: "卡其、橄榄绿、炭灰、原牛仔蓝。",
    fabricPreference: "斜纹棉、帆布、耐磨涤棉、牛仔。",
    priceStrategy: "中价位，推荐将价值集中在耐磨面料和关键口袋。",
    trendPrediction: "工装从重装感转向柔软日常化，建议做轻量帆布和柔化色彩。",
    representativeStyles: [
      {
        id: "pwt-r1",
        title: "轻量工装衬衫夹克",
        season: "2025AW",
        category: "Overshirt",
        tags: ["工装袋", "斜纹", "中性"],
        image: sampleImage("pwt", 1),
        isRepeatOrder: true
      },
      {
        id: "pwt-r2",
        title: "直筒工装裤",
        season: "2026SS",
        category: "Pants",
        tags: ["直筒", "可调节", "耐磨"],
        image: sampleImage("pwt", 2),
        isRepeatOrder: false
      }
    ],
    erpInsight: {
      materialFocus: ["斜纹棉", "轻帆布", "牛仔"],
      craftFocus: ["贴袋", "打枣", "腰部调节"],
      priceBand: "FOB 14-26 USD",
      orderTrend: "外套需求稳定，下装有增长空间。",
      repeatOrderSignal: "卡其色 overshirt 复购信号明显。"
    },
    externalSignals: [
      {
        source: "官网",
        insight: "品牌强调耐穿、可持续和日常劳动感。",
        designAction: "推荐环保棉混纺和可修补细节叙事。"
      },
      {
        source: "消费者评论",
        insight: "吐槽集中在裤长和腰围不友好。",
        designAction: "增加可调节腰袢和多裤长方案。"
      }
    ],
    risks: ["需要补充更完整的历史款标签", "工装口袋数量会影响成本"]
  },
  {
    id: "sewd",
    name: "SEWD",
    erpCode: "SE10",
    market: "英国轻奢女装",
    positioning: "重视精致感、颜色和细节，适合做女性化通勤款。",
    maturity: "数据充足",
    styleTags: ["优雅通勤", "微廓形", "细节褶量", "柔和亮色", "精致领型"],
    silhouette: "收腰或微宽松，强调肩颈和腰线。",
    colorDirection: "奶油白、雾蓝、鼠尾草绿、莓果色。",
    fabricPreference: "垂感梭织、细腻针织、仿醋酸、轻薄羊毛感。",
    priceStrategy: "中高价位，可用领型、褶量和面料垂感提升质感。",
    trendPrediction: "客户风格从甜美转向轻熟通勤，建议做简化装饰与高级色。",
    representativeStyles: [
      {
        id: "sewd-r1",
        title: "褶量衬衫连衣裙",
        season: "2025SS",
        category: "Dress",
        tags: ["收腰", "褶量", "通勤"],
        image: sampleImage("sewd", 1),
        isRepeatOrder: true
      },
      {
        id: "sewd-r2",
        title: "微廓形短外套",
        season: "2026SS",
        category: "Jacket",
        tags: ["短外套", "精致领型", "垂感"],
        image: sampleImage("sewd", 2),
        isRepeatOrder: false
      }
    ],
    erpInsight: {
      materialFocus: ["仿醋酸", "垂感梭织", "细腻针织"],
      craftFocus: ["褶量", "包扣", "精致领型"],
      priceBand: "FOB 20-38 USD",
      orderTrend: "连衣裙保持优势，短外套和套装有增长。",
      repeatOrderSignal: "浅色衬衫裙和收腰款式返单稳定。"
    },
    externalSignals: [
      {
        source: "社媒",
        insight: "消费者喜欢办公室到晚餐场景切换。",
        designAction: "推荐可日夜切换的套装和细节衬衫裙。"
      },
      {
        source: "DTC评价",
        insight: "吐槽集中在易皱和胸腰比例不适配。",
        designAction: "选择抗皱垂感面料，版型增加腰部可调。"
      }
    ],
    risks: ["精致细节需控制打样难度", "浅色垂感面料成本波动"]
  },
  {
    id: "nex",
    name: "NEX",
    market: "北欧基础功能",
    positioning: "理性、环保、简洁，重视基础款生命周期。",
    maturity: "数据充足",
    styleTags: ["北欧极简", "可持续", "基础层搭", "冷色系", "模块化"],
    silhouette: "长线条、直筒、弱结构，适合多季穿搭。",
    colorDirection: "冰灰、深蓝、森林绿、黑、米色。",
    fabricPreference: "再生涤、棉混纺、轻量保暖填充、软壳。",
    priceStrategy: "中价位，以可持续和耐穿叙事支撑。",
    trendPrediction: "基础款会继续强调环保和模块化穿搭，可增加可拆卸细节。",
    representativeStyles: [
      {
        id: "nex-r1",
        title: "再生面料长线马甲",
        season: "2025AW",
        category: "Vest",
        tags: ["再生面料", "长线条", "轻保暖"],
        image: sampleImage("nex", 1),
        isRepeatOrder: true
      },
      {
        id: "nex-r2",
        title: "冷色系直筒风衣",
        season: "2026SS",
        category: "Trench",
        tags: ["直筒", "冷色", "基础层搭"],
        image: sampleImage("nex", 2),
        isRepeatOrder: false
      }
    ],
    erpInsight: {
      materialFocus: ["再生涤", "棉混纺", "软壳"],
      craftFocus: ["可拆卸", "隐藏门襟", "轻填充"],
      priceBand: "FOB 16-30 USD",
      orderTrend: "基础外套稳定，环保面料占比提高。",
      repeatOrderSignal: "冷色系长线马甲复购表现好。"
    },
    externalSignals: [
      {
        source: "官网",
        insight: "可持续材料和可长期穿着是核心表达。",
        designAction: "每款推荐附带材料卖点和搭配生命周期说明。"
      },
      {
        source: "评论",
        insight: "消费者关注保暖但不臃肿。",
        designAction: "用轻薄保暖层和直线条版型平衡。"
      }
    ],
    risks: ["环保材料供应需提前确认", "基础款差异化表达有限"]
  },
  {
    id: "dvh",
    name: "DVH",
    erpCode: "OTTO",
    market: "澳洲度假休闲",
    positioning: "轻松、自然、度假感，重视印花和舒适面料。",
    maturity: "需设计师补标",
    styleTags: ["度假", "宽松", "印花", "天然纤维", "轻盈"],
    silhouette: "宽松长裙、罩衫、阔腿裤，强调飘逸感。",
    colorDirection: "海盐白、珊瑚、沙色、植物绿、浅蓝。",
    fabricPreference: "粘麻、棉麻、轻薄人棉、皱感面料。",
    priceStrategy: "中价位，面料触感和印花完整度决定接受度。",
    trendPrediction: "度假风从大面积印花转向素色肌理和局部图案。",
    representativeStyles: [
      {
        id: "dvh-r1",
        title: "棉麻宽松罩衫",
        season: "2025SS",
        category: "Cover-up",
        tags: ["棉麻", "宽松", "度假"],
        image: sampleImage("dvh", 1),
        isRepeatOrder: true
      },
      {
        id: "dvh-r2",
        title: "植物印花长裙",
        season: "2026SS",
        category: "Dress",
        tags: ["印花", "长裙", "飘逸"],
        image: sampleImage("dvh", 2),
        isRepeatOrder: false
      }
    ],
    erpInsight: {
      materialFocus: ["粘麻", "棉麻", "人棉"],
      craftFocus: ["抽褶", "开衩", "细肩带调节"],
      priceBand: "FOB 10-22 USD",
      orderTrend: "夏季款集中，印花裙和罩衫表现稳定。",
      repeatOrderSignal: "白色罩衫和植物印花长裙复购较好。"
    },
    externalSignals: [
      {
        source: "社媒",
        insight: "消费者偏好海边、旅行、周末生活方式内容。",
        designAction: "生成款式突出可打包、轻量和拍照效果。"
      },
      {
        source: "评论",
        insight: "吐槽集中在透、皱、洗后变形。",
        designAction: "优先测试面料透度和洗后稳定性。"
      }
    ],
    risks: ["印花版权和开发周期需提前确认", "天然面料缩水风险"]
  },
  {
    id: "hup",
    name: "HUP",
    erpCode: "HUPPA",
    market: "德国户外基础",
    positioning: "偏实穿和性价比的户外基础客户，要求稳定交付。",
    maturity: "数据充足",
    styleTags: ["户外基础", "防风", "耐穿", "简洁工艺", "多季节"],
    silhouette: "标准合体到微宽松，适合大众体型。",
    colorDirection: "黑、深灰、宝蓝、橄榄、铁锈红。",
    fabricPreference: "软壳、摇粒绒、防风涤纶、轻填充。",
    priceStrategy: "中低价位，推荐成熟工艺和稳定面料。",
    trendPrediction: "基础户外会增加城市穿着比例，可减少专业户外标识。",
    representativeStyles: [
      {
        id: "hup-r1",
        title: "软壳防风夹克",
        season: "2025AW",
        category: "Softshell",
        tags: ["软壳", "防风", "基础"],
        image: sampleImage("hup", 1),
        isRepeatOrder: true
      },
      {
        id: "hup-r2",
        title: "轻量摇粒绒开衫",
        season: "2026SS",
        category: "Fleece",
        tags: ["摇粒绒", "开衫", "多季节"],
        image: sampleImage("hup", 2),
        isRepeatOrder: true
      }
    ],
    erpInsight: {
      materialFocus: ["软壳", "摇粒绒", "轻填充"],
      craftFocus: ["防风门襟", "拉链口袋", "袖口调节"],
      priceBand: "FOB 11-24 USD",
      orderTrend: "软壳夹克平稳，轻量保暖层需求增加。",
      repeatOrderSignal: "黑色和宝蓝基础夹克返单明显。"
    },
    externalSignals: [
      {
        source: "电商评价",
        insight: "消费者重视尺码准确和实际保暖。",
        designAction: "推荐基础版型和清晰温度场景描述。"
      },
      {
        source: "官网",
        insight: "品牌强调可靠和性价比。",
        designAction: "避免过度复杂设计，突出耐用和稳定。"
      }
    ],
    risks: ["低价位限制创新空间", "需要稳定供应链面料"]
  },
  {
    id: "vg",
    name: "VG",
    market: "新客户验证/社媒女装",
    positioning: "偏年轻化和社媒传播，缺少 ERP 历史数据，需要外部数据补足。",
    maturity: "新客户验证",
    styleTags: ["年轻", "社媒感", "短款", "亮色点缀", "拍照友好"],
    silhouette: "短上衣、修身外套、高腰下装，强调比例。",
    colorDirection: "黑白基础配高饱和粉、钴蓝、银灰。",
    fabricPreference: "弹力针织、仿皮、闪光面料、细腻梭织。",
    priceStrategy: "需根据公开渠道确认，首期用中价位做假设。",
    trendPrediction: "短款、结构感和可拍照细节更适合测试市场反应。",
    representativeStyles: [
      {
        id: "vg-r1",
        title: "短款结构感外套",
        season: "2026SS",
        category: "Jacket",
        tags: ["短款", "结构感", "社媒"],
        image: sampleImage("vg", 1),
        isRepeatOrder: false
      },
      {
        id: "vg-r2",
        title: "高腰微喇长裤",
        season: "2026SS",
        category: "Pants",
        tags: ["高腰", "微喇", "修身"],
        image: sampleImage("vg", 2),
        isRepeatOrder: false
      }
    ],
    erpInsight: {
      materialFocus: ["待补充", "弹力针织假设", "仿皮假设"],
      craftFocus: ["短款比例", "明线", "金属扣"],
      priceBand: "待外部渠道校准",
      orderTrend: "新客户无 ERP 历史，先用公开信息推断。",
      repeatOrderSignal: "暂无返单数据。"
    },
    externalSignals: [
      {
        source: "社媒",
        insight: "年轻消费者更关注拍照效果和上身比例。",
        designAction: "推荐短款外套、高腰下装和强识别细节。"
      },
      {
        source: "官网/电商",
        insight: "需要补充价格带、面料评价和尺码反馈。",
        designAction: "启动外部数据采集后再做二次校准。"
      }
    ],
    risks: ["缺少历史订单验证", "外部信息不足时推荐准确度有限"]
  }
]

export const launchTasks: LaunchTask[] = [
  { date: "6月22日", title: "建群，确认项目成员、试用设计师、数据负责人、沟通节奏", owner: "李慧龙/田经理", status: "进行中" },
  { date: "6月23日", title: "完成 9 家客户资料清单，确认 ERP 导出字段和历史款式图位置", owner: "设计部/ERP对接人", status: "待开始" },
  { date: "6月24日", title: "确认趋势来源、外部监控优先客户、消费者评价来源", owner: "田经理", status: "待开始" },
  { date: "6月25日", title: "完成 1 家客户风格档案样例", owner: "李慧龙", status: "待开始" },
  { date: "6月26日", title: "完成 1 次 AI 定向出款小样，输出 15-20 款测试图", owner: "李慧龙", status: "待开始" },
  { date: "6月27日", title: "完成参考图融合测试", owner: "李慧龙/试用设计师", status: "待开始" },
  { date: "6月28日", title: "组织小评审，确认 V1.0 范围、数据口径、出图质量和开发优先级", owner: "项目组", status: "待开始" }
]
