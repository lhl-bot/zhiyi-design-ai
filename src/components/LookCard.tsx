import { Check, Clipboard, Download, FileText, GitBranch, ImagePlus, Loader2, MessageCircle, Printer, TrendingUp, X } from "lucide-react"
import type { ComparisonResult, CostEstimate, GeneratedLook } from "../types"
import { imageStatusMeta, reviewStatusOf, statusTone, type ReviewStatus } from "../utils/helpers"

interface LookCardProps {
  look: GeneratedLook
  onToggle: () => void
  onNote: (note: string) => void
  onReviewStatus: (status: ReviewStatus) => void
  onModificationNote: (note: string) => void
  onCopyPrompt: () => void
  onDetail: () => void
  onDelete: () => void
  onDownload: () => void
  onExportTechPack: () => void
  onExportPDF: () => void
  onVectorize?: () => void
  comparison: ComparisonResult
  cost: CostEstimate
}

export function LookCard({
  look,
  onToggle,
  onNote,
  onReviewStatus,
  onModificationNote,
  onCopyPrompt,
  onDetail,
  onDelete,
  onDownload,
  onExportTechPack,
  onExportPDF,
  onVectorize,
  comparison,
  cost,
}: LookCardProps) {
  const imageStatus = imageStatusMeta(look)
  const reviewStatus = reviewStatusOf(look)

  function handleDelete() {
    if (window.confirm(`确认删除「${look.title}」？删除后不可恢复。`)) {
      onDelete()
    }
  }

  return (
    <article className={look.selected ? "look selected" : "look"}>
      <div className="look-img-actions">
        {look.image && (
          <button className="img-action" onClick={onDownload} title="下载这张图"><Download size={15} /></button>
        )}
        <button className="img-action danger" onClick={handleDelete} title="删除此款"><X size={15} /></button>
      </div>
      <div className="look-img" onClick={look.image ? onDetail : undefined} title={look.image ? "点击查看大图与详情" : "出图处理中"}>
        {look.image ? (
          <img src={look.image} alt={look.title} />
        ) : (
          <div className="image-skeleton">
            <div className="skeleton-shimmer" />
            <span className="skeleton-icon">
              {imageStatus.tone === "pending" ? <Loader2 className="spin" size={28} /> : <ImagePlus size={28} />}
            </span>
            <span className="skeleton-label">{imageStatus.label}</span>
          </div>
        )}
        {look.image && <span className="score">{look.score}</span>}
        {look.version && look.version > 1 && <span className="version-badge" title={`基于 V${look.version - 1} 迭代`}>V{look.version}</span>}
        {comparison && (
          <span className={`compare-badge ${comparison.overallScore >= 60 ? "high" : comparison.overallScore >= 30 ? "mid" : "low"}`} title={`与历史爆款相似度 ${comparison.overallScore}%`}>
            <TrendingUp size={11} /> {comparison.overallScore}%
          </span>
        )}
        {comparison.overallScore < 30 && (
          <span className="risk-badge danger" title="此款与客户核心品类偏离较大">品类偏离风险</span>
        )}
        {comparison.overallScore >= 70 && (
          <span className="risk-badge ok" title="此款与客户历史爆款高度一致">高返单概率</span>
        )}
        <span className={`image-status ${imageStatus.tone}`}>{imageStatus.label}</span>
      </div>
      <div className="look-body">
        <div className="look-title-row">
          <strong>{look.title}</strong>
          <span>{look.sourceMode}</span>
        </div>
        <div className="review-status-row" aria-label="款式评审状态">
          {(["待看", "入选", "待修改", "淘汰"] as ReviewStatus[]).map((status) => (
            <button
              key={status}
              className={reviewStatus === status ? `active ${statusTone(status)}` : ""}
              onClick={() => onReviewStatus(status)}
              type="button"
            >
              {status}
            </button>
          ))}
        </div>
        <div className="look-sub">
          <small>趋势 {look.trendScore}</small>
          <small>商业 {look.commercialScore}</small>
          <small title={`估算：$${cost.fobLow} ~ $${cost.fobHigh}${cost.historicalMin ? ` | ERP历史：$${cost.historicalMin} ~ $${cost.historicalMax}` : ""}`}>
            FOB ${cost.fobLow}~${cost.fobHigh}
          </small>
        </div>
        <div className="cost-mini">
          <span className="cost-tag" title={`面料 $${cost.fabricCost} + 辅料 $${cost.accessoryCost} + 工时 $${cost.laborCost} + 杂费 $${cost.overhead}`}>
            面料${cost.fabricCost} · 工时${cost.laborCost} · 辅${cost.accessoryCost}
          </span>
          {cost.historicalMin && <span className="cost-tag erp" title={`ERP历史区间 $${cost.historicalMin} ~ $${cost.historicalMax}`}>ERP ${cost.historicalMin}~${cost.historicalMax}</span>}
        </div>
        {comparison && (
          <div className="compare-row" onClick={onDetail} title="点击查看对比详情">
            <span className={`compare-bar ${comparison.overallScore >= 60 ? "high" : comparison.overallScore >= 30 ? "mid" : "low"}`}>
              <span style={{ width: `${comparison.overallScore}%` }} />
            </span>
            <small>历史相似度 {comparison.overallScore}%</small>
          </div>
        )}
        <div className="chip-row">
          {look.keyDetails.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
        <div className="palette-row" aria-label="配色">
          {look.palette.map((color) => (
            <span key={color} style={{ backgroundColor: color }} title={color} />
          ))}
        </div>
        <textarea value={look.note} onChange={(event) => onNote(event.target.value)} placeholder="设计师备注：保留 / 调整 / 淘汰原因" />
        <input
          className="modification-input"
          value={look.modificationNote ?? ""}
          onChange={(event) => onModificationNote(event.target.value)}
          placeholder="修改意见：如袖口改罗纹、下摆加抽绳、颜色换燕麦灰"
        />
        {look.imageStatus === "model-failed" && look.imageError && <p className="image-error">出图失败：{look.imageError}</p>}
        <p className="revision-advice">{look.revisionAdvice}</p>
        <small className="created-at">{look.createdAt}</small>
        <div className="look-actions-row">
          <button className="copy-btn" onClick={onCopyPrompt}>
            <Clipboard size={14} /> 提示词
          </button>
          <button className="copy-btn" onClick={onExportTechPack} title="导出 Excel 工艺单">
            <FileText size={14} /> Excel 工艺单
          </button>
          <button className="copy-btn" onClick={onExportPDF} title="导出 PDF 工艺单">
            <Printer size={14} /> PDF 工艺单
          </button>
          {onVectorize && (
            <button className="copy-btn" onClick={onVectorize} title="将位图线稿转为可编辑的 SVG 矢量" style={{ color: "var(--accent-deep)" }}>
              <GitBranch size={14} /> 转矢量
            </button>
          )}
          {look.sourceMode === "线稿图" && look.image && (
            <button className="copy-btn sketch-card-chat-btn" onClick={onDetail} title="用自然语言对话修改线稿">
              <MessageCircle size={14} /> 线稿对话
            </button>
          )}
        </div>
        <button className={look.selected ? "pick-btn picked" : "pick-btn"} onClick={onToggle}>
          {look.selected ? <><Check size={15} /> 已选入</> : "选入精修池"}
        </button>
      </div>
    </article>
  )
}
