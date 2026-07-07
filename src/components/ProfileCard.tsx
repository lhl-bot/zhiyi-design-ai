import { Database, Globe, Loader2, MessageSquareText, Sparkles } from "lucide-react"
import type { ApiConfig, CustomerProfile, CustomerTrend, IntelResult } from "../types"
import { brandIntel } from "../data/brandIntel"
import { TrendSection } from "./TrendSection"
import { intelSourceLabel, safeHost, srcClass } from "../utils/helpers"
import { userReviewSignalsOf } from "../utils/customerReviews"

type DataSource = "erp" | "master-only" | "none" | "loading" | "error"

interface ProfileCardProps {
  customer: CustomerProfile
  dataSource: DataSource
  erpContracts: number
  erpQuotations: number
  erpApplied: boolean
  erpError: string | null
  onRetry: () => void
  intel: IntelResult | null
  intelLoading: boolean
  intelError: string | null
  onAnalyze: () => void
  intelSource: NonNullable<ApiConfig["intelSource"]>
  trend: CustomerTrend | null
}

export function ProfileCard({
  customer,
  dataSource,
  erpContracts,
  erpQuotations,
  erpApplied,
  erpError,
  onRetry,
  intel,
  intelLoading,
  intelError,
  onAnalyze,
  intelSource,
  trend,
}: ProfileCardProps) {
  const brand = brandIntel[customer.id]
  const sourceLabel = intelSourceLabel(intelSource)
  const reviewSignals = userReviewSignalsOf(customer)
  const verifiedReviewCount = reviewSignals.filter((review) => review.status === "verified").length
  const channelSignals = customer.externalSignals.filter((signal) => !/评论|评价|反馈/.test(signal.source))
  const reviewStatusLabel = (status: typeof reviewSignals[number]["status"]) => {
    if (status === "verified") return "已采集"
    if (status === "identity-only") return "已确认主体"
    return "待采集"
  }
  const tile = (label: string, value: string) => (
    <div className="info-tile">
      <span>{label}</span>
      <p>{value || "—"}</p>
    </div>
  )
  const srcTile = (label: string, value: string, sources: string[]) => (
    <div className="info-tile">
      <span>
        {label}
        {sources.map((s) => <em key={s} className={`src src-${srcClass(s)}`}>{s}</em>)}
      </span>
      <p>{value || "—"}</p>
    </div>
  )

  const erpLabel = dataSource === "erp" ? "ERP" : "示例"
  const mergedTags = [...new Set(
    [...(customer.styleTags ?? []), ...((brand?.signatureProducts) ?? [])]
      .map((t) => t.trim())
      .filter(Boolean)
  )]
  const consumerText = intel?.consumer || brand?.consumer || ""
  const consumerSrc = intel?.consumer ? ["联网", "AI"] : brand?.consumer ? ["官网"] : []
  const aestheticText = intel?.aesthetic || brand?.aesthetic || ""
  const aestheticSrc = intel?.aesthetic ? ["联网", "AI"] : brand?.aesthetic ? ["官网"] : []
  const trendCombined = [
    customer.erpInsight?.orderTrend ? `工厂端：${customer.erpInsight.orderTrend} ${customer.erpInsight.repeatOrderSignal ?? ""}`.trim() : "",
    intel?.trendDirection ? `市场端：${intel.trendDirection}` : ""
  ].filter(Boolean).join("　｜　")
  const trendSrc = [erpLabel, intel ? "联网" : null].filter(Boolean) as string[]

  return (
    <section className="card profile-card">
      <div className="step-head">
        <span className="step-no">1</span>
        <h2>{customer.name} 客户画像</h2>
        {dataSource === "erp" && <span className="badge erp">ERP 真实数据 · 合同{erpContracts}/报价{erpQuotations}</span>}
        {dataSource === "loading" && <span className="badge loading"><Loader2 className="spin" size={13} /> 读取 ERP…</span>}
        {dataSource === "master-only" && <span className="badge warn">有主数据·无订单</span>}
        {dataSource === "none" && <span className="badge warn">ERP未命中</span>}
        {dataSource === "error" && <span className="badge warn">ERP读取失败</span>}
      </div>

      <p className="positioning">{customer.positioning}</p>

      {dataSource === "master-only" && (
        <div className="inline-note warn">ERP 里有 {customer.name} 的客户主数据但没有成衣订单，订单可能挂在别的名称下，需业务确认下单主体；以下为示例画像。</div>
      )}
      {dataSource === "none" && !erpError && (
        <div className="inline-note warn">{customer.name} 当前简称未命中 ERP，需要业务/设计部提供「简称→ERP 全称」映射；以下为示例画像。</div>
      )}
      {erpError && (
        <div className="inline-note warn">
          ERP 读取失败：{erpError}（确认只读 API 是否在 8787 端口运行）
          <button className="link-btn" onClick={onRetry}>重试</button>
        </div>
      )}

      <div className="synth-head">
        <strong>综合画像 · 多源去重汇总</strong>
        <div className="src-legend">
          <em className={`src src-${srcClass(erpLabel)}`}>{erpLabel === "ERP" ? "ERP 真实订单" : "示例画像"}</em>
          {brand && <em className="src src-web">品牌公开信息</em>}
          {reviewSignals.length > 0 && <em className="src src-review">用户评价数据{verifiedReviewCount ? "" : "待补"}</em>}
          <em className={intel ? "src src-live" : "src src-muted"}>{intel ? "AI 联网分析" : "AI 联网分析未拉取"}</em>
        </div>
      </div>

      <div className="style-tags">
        {mergedTags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>

      <div className="info-grid">
        {brand && srcTile("目标人群（定向核心）", `${brand.gender} · ${consumerText || brand.consumer}`, ["品牌"])}
        {!brand && srcTile("目标消费者", consumerText, consumerSrc)}
        {brand && srcTile("风格调性", aestheticText, aestheticSrc)}
        {!brand && srcTile("风格调性", aestheticText, aestheticSrc)}
        {srcTile("面料偏好", customer.fabricPreference, [erpLabel])}
        {srcTile("色彩方向", customer.colorDirection, [erpLabel])}
        {srcTile("价格策略", customer.priceStrategy, [erpLabel])}
        {srcTile("趋势判断", trendCombined, trendSrc)}
      </div>

      {intel?.designDirections && intel.designDirections.length > 0 ? (
        <div className="design-directions synth-directions">
          <strong>综合设计方向（AI 基于 ERP 订单 + 实时联网）</strong>
          <ul>
            {intel.designDirections.map((dir, index) => (
              <li key={index}>{dir}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="source-foot">想把品牌官网定位、当季趋势和用户评价也并入上面的汇总？点下方「AI 联网智能分析」，结果会自动合并到这里。</p>
      )}

      {reviewSignals.length > 0 && (
        <div className="review-data-panel">
          <div className="review-data-head">
            <MessageSquareText size={15} />
            <strong>客户产品评价来源 → 设计修正</strong>
            <span>{verifiedReviewCount ? `${verifiedReviewCount} 个强约束` : "弱约束辅助出图"}</span>
          </div>
          <div className="review-data-grid">
            {reviewSignals.slice(0, 2).map((review) => (
              <article key={`${review.source}-${review.designAction}`} className={`review-data-card review-status-${review.status}`}>
                <div className="review-data-title">
                  {review.sourceUrl ? (
                    <a href={review.sourceUrl} target="_blank" rel="noreferrer">{review.source}</a>
                  ) : (
                    <span>{review.source}</span>
                  )}
                  <em className={`conf conf-${review.confidence}`}>可信度 {review.confidence}</em>
                </div>
                <div className="review-meta">
                  <span>{reviewStatusLabel(review.status)}</span>
                  <span>{review.productScope}</span>
                </div>
                <p><b>样本：</b>{review.sampleLabel}</p>
                <p><b>好评点：</b>{review.praised.join("、") || "待采集真实商品评价"}</p>
                <p><b>痛点：</b>{review.painPoints.join("、") || "待采集真实商品评价"}</p>
                <small>{review.designAction}</small>
                {review.status !== "verified" && <small className="review-pending-note">该记录会以弱约束进入 AI 出图提示词，用于提醒采集缺口，不会被当作真实评价。</small>}
              </article>
            ))}
          </div>
        </div>
      )}

      <div className="decision-grid">
        <div className="decision-panel">
          <strong>外部信号 → 设计动作</strong>
          {channelSignals.slice(0, 3).map((signal) => (
            <div className="signal-row" key={`${signal.source}-${signal.designAction}`}>
              <span>{signal.source}</span>
              <p>{signal.insight}</p>
              <small>{signal.designAction}</small>
            </div>
          ))}
          {!channelSignals.length && (
            <div className="signal-row">
              <span>待补充</span>
              <p>暂无可核验的品牌/渠道外部信号。</p>
              <small>用户评价请以上方“客户产品评价来源”为准。</small>
            </div>
          )}
        </div>
        <div className="decision-panel risk-panel">
          <strong>本批风险</strong>
          <ul>
            {customer.risks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        </div>
      </div>

      {dataSource === "erp" && erpApplied && (
        <p className="source-foot"><Database size={13} /> 上面的画像由 ERP 历史订单自动生成，生成款式时会作为依据。</p>
      )}

      {trend && trend.years.length >= 2 && (
        <TrendSection customerName={customer.name} trend={trend} />
      )}

      {brand && (
        <div className="brand-intel">
          <div className="brand-intel-head">
            <Globe size={15} />
            <strong>品牌情报（公开信息）</strong>
            <span className={`conf conf-${brand.confidence}`}>可信度 {brand.confidence}</span>
            {brand.website && (
              <a href={brand.website} target="_blank" rel="noreferrer">官网 ↗</a>
            )}
          </div>
          <p className="brand-line"><b>{brand.brand}</b> · {brand.origin} · <b className="gender-tag">{brand.gender}</b> · {brand.segment}</p>
          <div className="info-grid">
            {tile("目标消费者", brand.consumer)}
            {tile("风格调性", brand.aesthetic)}
            {tile("代表品类", brand.signatureProducts.join("、"))}
            {tile("趋势方向", brand.trendNotes)}
          </div>
        </div>
      )}

      <div className="intel-run">
        <button className="secondary-btn" onClick={onAnalyze} disabled={intelLoading}>
          {intelLoading ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
          AI 联网智能分析{intel ? "·重新分析" : ""}
        </button>
        <small>{sourceLabel} + DeepSeek 结合 ERP 生成趋势判断与设计方向。需在「高级」配置 DeepSeek；Tavily 模式另需 Tavily Key。</small>
      </div>
      {intelError && <div className="inline-note warn">{intelError}</div>}

      {intel && (
        <div className="intel-result">
          <div className="brand-intel-head">
            <Globe size={15} />
            <strong>AI 联网智能分析</strong>
            <span className="badge erp">DeepSeek + {sourceLabel}</span>
          </div>
          {intel.brandSummary && <p className="positioning">{intel.brandSummary}</p>}
          <div className="info-grid">
            {intel.consumer && tile("消费者", intel.consumer)}
            {intel.aesthetic && tile("风格调性", intel.aesthetic)}
            {intel.trendDirection && tile("趋势判断", intel.trendDirection)}
            {intel.fabricColorNotes && tile("面料与色彩", intel.fabricColorNotes)}
          </div>
          {intel.styleTrends && intel.styleTrends.length > 0 && (
            <div className="design-directions style-trends">
              <strong>当季款式趋势分析</strong>
              <ul>
                {intel.styleTrends.map((trend, index) => (
                  <li key={index}>{trend}</li>
                ))}
              </ul>
            </div>
          )}
          {intel.officialImages && intel.officialImages.length > 0 && (
            <div className="official-imgs">
              <strong>官网视觉参考（实时抓取）</strong>
              <div className="official-imgs-row">
                {intel.officialImages.slice(0, 8).map((src, index) => (
                  <a key={index} href={src} target="_blank" rel="noreferrer" title="点击看大图">
                    <img src={src} alt={`官网图 ${index + 1}`} loading="lazy" />
                  </a>
                ))}
              </div>
            </div>
          )}
          {intel.designDirections && intel.designDirections.length > 0 && (
            <div className="design-directions">
              <strong>建议出款方向</strong>
              <ul>
                {intel.designDirections.map((dir, index) => (
                  <li key={index}>{dir}</li>
                ))}
              </ul>
            </div>
          )}
          {intel.sources && intel.sources.length > 0 && (
            <p className="source-foot">
              <Globe size={13} /> 来源：
              {intel.sources.slice(0, 4).map((url, index) => (
                <a key={index} href={url} target="_blank" rel="noreferrer">{safeHost(url)}</a>
              ))}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
