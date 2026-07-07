import { useEffect, useMemo, useState } from "react"
import { Check, Clipboard, Download, FileText, GitBranch, Loader2, MessageCircle, Printer, Sparkles, X } from "lucide-react"
import type { ComparisonResult, CostEstimate, GeneratedLook } from "../types"
import { copyText, imageStatusMeta, reviewStatusOf, statusTone, type ReviewStatus } from "../utils/helpers"
import { SketchChat } from "./SketchChat"

interface LookDetailProps {
  look: GeneratedLook
  onClose: () => void
  onToggle: () => void
  onReviewStatus: (status: ReviewStatus) => void
  onModificationNote: (note: string) => void
  onDownload: () => void
  onExportTechPack: () => void
  onExportPDF: () => void
  onIterate: (modification: string) => void
  onSketchModified: (updatedLook: GeneratedLook) => void
  comparison: ComparisonResult
  allLooks: GeneratedLook[]
  cost: CostEstimate
}

export function LookDetail({
  look, onClose, onToggle, onReviewStatus, onModificationNote, onDownload,
  onExportTechPack, onExportPDF, onIterate, onSketchModified, comparison, allLooks, cost,
}: LookDetailProps) {
  const status = imageStatusMeta(look)
  const reviewStatus = reviewStatusOf(look)
  const hasImage = Boolean(look.image && look.image.length > 0)
  const [showIterate, setShowIterate] = useState(false)
  const [showSketchChat, setShowSketchChat] = useState(false)
  const [modText, setModText] = useState("")
  const [compareMode, setCompareMode] = useState(false)
  const [showVersionTree, setShowVersionTree] = useState(false)

  const versionChain = useMemo(() => {
    if (!look.parentId && !look.version) return [look]
    const chain: GeneratedLook[] = [look]
    let cursor = look
    while (cursor.parentId) {
      const parent = allLooks.find((l) => l.id === cursor.parentId)
      if (!parent) break
      chain.unshift(parent)
      cursor = parent
    }
    return chain
  }, [look, allLooks])

  const childVersions = useMemo(
    () => allLooks.filter((l) => l.parentId === look.id).sort((a, b) => (a.version ?? 1) - (b.version ?? 1)),
    [look.id, allLooks],
  )

  const prevVersion = versionChain.length >= 2 ? versionChain[versionChain.length - 2] : null

  const diffs = useMemo(() => {
    if (!prevVersion) return null
    const added = look.keyDetails.filter((d) => !prevVersion.keyDetails.includes(d))
    const removed = prevVersion.keyDetails.filter((d) => !look.keyDetails.includes(d))
    const colorChanged = JSON.stringify(look.palette) !== JSON.stringify(prevVersion.palette)
    const fabricChanged = (look.designDirection || "") !== (prevVersion.designDirection || "")
    return { added, removed, colorChanged, fabricChanged }
  }, [look, prevVersion])

  async function handleCopyPrompt() {
    await copyText(look.prompt)
  }

  function handleIterateSubmit() {
    if (!modText.trim()) return
    onIterate(modText.trim())
  }

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [onClose])

  const modPresets = [
    { label: "改领型", text: "将领型改为小方领，保持原有门襟结构" },
    { label: "换配色", text: "更换配色方案为暖咖色系，主色深棕，辅色米白" },
    { label: "换面料", text: "将主面料换成羊毛混纺，增加垂感和质感" },
    { label: "调廓形", text: "廓形调整为更宽松的箱型，缩短衣长2cm" },
  ]

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox" onClick={(event) => event.stopPropagation()}>
        <button className="lightbox-close" onClick={onClose}><X size={22} /></button>

        <div className={`lightbox-image${compareMode && prevVersion ? " compare-split" : ""}`}>
          {compareMode && prevVersion ? (
            <>
              <div className="compare-half">
                {prevVersion.image ? <img src={prevVersion.image} alt={prevVersion.title} /> : <div className="image-skeleton" style={{ aspectRatio: "4/5" }}><Loader2 className="spin" size={36} /></div>}
                <span className="compare-label prev">V{prevVersion.version ?? 1}</span>
              </div>
              <div className="compare-divider">VS</div>
              <div className="compare-half">
                {hasImage ? <img src={look.image} alt={look.title} /> : <div className="image-skeleton" style={{ aspectRatio: "4/5" }}><Loader2 className="spin" size={36} /></div>}
                <span className="compare-label curr">V{look.version ?? 1}</span>
              </div>
            </>
          ) : (
            <>
              {hasImage ? (
                <img src={look.image} alt={look.title} />
              ) : (
                <div className="image-skeleton" style={{ aspectRatio: "4/5" }}>
                  <div className="skeleton-shimmer" />
                  <Loader2 className="spin" size={36} />
                  <span className="skeleton-label">{status.label}</span>
                </div>
              )}
              <span className={`image-status ${status.tone}`}>{status.label}</span>
              {hasImage && <span className="score">{look.score}</span>}
              {look.version && look.version > 1 && (
                <span className="version-badge lightbox-version" title={`基于 V${look.version - 1} 迭代`}>V{look.version}</span>
              )}
            </>
          )}
        </div>

        <div className="lightbox-body">
          <div className="lightbox-head">
            <div>
              <h2>{look.title}</h2>
              <span>{look.sourceMode} · {look.createdAt}{look.version ? ` · V${look.version}` : ""}</span>
            </div>
            <div className="lightbox-scores">
              <div><span>综合</span><strong>{look.score}</strong></div>
              <div><span>趋势</span><strong>{look.trendScore}</strong></div>
              <div><span>商业</span><strong>{look.commercialScore}</strong></div>
              <div><span>FOB</span><strong>${cost.fobLow}~${cost.fobHigh}</strong></div>
            </div>
          </div>

          <div className="lightbox-section review-section">
            <h3>款式评审</h3>
            <div className="review-status-row large" aria-label="款式评审状态">
              {(["待看", "入选", "待修改", "淘汰"] as ReviewStatus[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={reviewStatus === item ? `active ${statusTone(item)}` : ""}
                  onClick={() => onReviewStatus(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <textarea
              className="review-note-input"
              value={look.modificationNote ?? ""}
              onChange={(event) => onModificationNote(event.target.value)}
              placeholder="写修改意见，例如：袖口改罗纹；下摆加抽绳；颜色换燕麦灰"
              rows={3}
            />
          </div>

          <div className="lightbox-section cost-section">
            <h3>成本估算 · 品类({cost.category}) · 复杂度 {cost.complexity}x</h3>
            <div className="cost-grid">
              <div className="cost-item"><span>面料</span><strong>${cost.fabricCost}</strong></div>
              <div className="cost-item"><span>辅料</span><strong>${cost.accessoryCost}</strong></div>
              <div className="cost-item"><span>工时</span><strong>${cost.laborCost}</strong></div>
              <div className="cost-item"><span>杂费</span><strong>${cost.overhead}</strong></div>
              <div className="cost-item total"><span>FOB</span><strong>${cost.fobLow} ~ ${cost.fobHigh}</strong></div>
              {cost.historicalMin && (
                <div className="cost-item erp"><span>ERP 历史</span><strong>${cost.historicalMin} ~ ${cost.historicalMax}</strong></div>
              )}
            </div>
            {cost.historicalMin && cost.historicalMax && cost.fobLow > cost.historicalMax && (
              <p className="cost-warn">估算偏高：当前 FOB 超出历史最高 ${cost.historicalMax}，建议核对面料与工艺复杂度</p>
            )}
            {cost.historicalMin && cost.historicalMax && cost.fobHigh < cost.historicalMin && (
              <p className="cost-note">估算偏低：当前 FOB 低于历史最低 ${cost.historicalMin}，可能工艺设定不足</p>
            )}
          </div>

          {versionChain.length >= 2 && (
            <div className="version-tree-section">
              <div className="vt-head">
                <h3>版本链</h3>
                <button className="link-btn" onClick={() => setShowVersionTree((v) => !v)}>
                  {showVersionTree ? "收起" : "展开"}
                </button>
              </div>
              <div className={`version-tree${showVersionTree ? " open" : " collapsed"}`}>
                {versionChain.map((v, i) => (
                  <div key={v.id} className={v.id === look.id ? "vt-node current" : "vt-node"}>
                    <span className="vt-dot" />
                    <span className="vt-label">V{v.version ?? 1}</span>
                    <span className="vt-title">{v.title}</span>
                    <span className="vt-score">{v.score}</span>
                    {i < versionChain.length - 1 && <span className="vt-arrow">→</span>}
                  </div>
                ))}
              </div>
              {prevVersion && (
                <button className="secondary-btn compact-btn" onClick={() => setCompareMode((v) => !v)}>
                  {compareMode ? "退出对比" : `对比 V${prevVersion.version ?? 1} → V${look.version ?? 1}`}
                </button>
              )}
            </div>
          )}

          {compareMode && diffs && (
            <div className="diff-panel">
              <h3>版本差异</h3>
              {diffs.colorChanged && <p className="diff-item changed"><span className="diff-tag">配色</span>已变更</p>}
              {diffs.fabricChanged && <p className="diff-item changed"><span className="diff-tag">方向</span>设计方向已调整</p>}
              {diffs.added.length > 0 && diffs.added.map((d, i) => (
                <p key={`add-${i}`} className="diff-item added"><span className="diff-tag">新增</span>{d}</p>
              ))}
              {diffs.removed.length > 0 && diffs.removed.map((d, i) => (
                <p key={`rem-${i}`} className="diff-item removed"><span className="diff-tag">移除</span>{d}</p>
              ))}
              {diffs.added.length === 0 && diffs.removed.length === 0 && !diffs.colorChanged && !diffs.fabricChanged && (
                <p className="diff-item same">无明显细节差异</p>
              )}
            </div>
          )}

          {childVersions.length > 0 && (
            <div className="lightbox-section child-versions">
              <h3>迭代子版本</h3>
              <div className="child-list">
                {childVersions.map((cv) => (
                  <div key={cv.id} className="child-item">
                    {cv.image && <img src={cv.image} alt={cv.title} className="child-thumb" />}
                    <div>
                      <strong>V{cv.version ?? "?"} — {cv.title}</strong>
                      <span>综合 {cv.score} · {cv.createdAt}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="lightbox-section compare-section">
            <h3>历史爆款对比</h3>
            <div className="compare-summary">
              <div className="compare-overall">
                <strong className={comparison.overallScore >= 60 ? "high" : comparison.overallScore >= 30 ? "mid" : "low"}>{comparison.overallScore}%</strong>
                <span>综合相似度</span>
              </div>
              <div className="compare-breakdown">
                <div className={comparison.categoryMatch ? "match" : "no-match"}>
                  <span>品类匹配</span>
                  <strong>{comparison.categoryMatch ? "命中" : "未中"}</strong>
                </div>
                <div className={comparison.fabricOverlap > 0 ? "match" : "no-match"}>
                  <span>面料重合</span>
                  <strong>{comparison.fabricOverlap}%</strong>
                </div>
                <div className={comparison.colorOverlap > 0 ? "match" : "no-match"}>
                  <span>色彩重合</span>
                  <strong>{comparison.colorOverlap}%</strong>
                </div>
                <div className={comparison.silhouetteMatch ? "match" : "no-match"}>
                  <span>廓形匹配</span>
                  <strong>{comparison.silhouetteMatch ? "命中" : "未中"}</strong>
                </div>
              </div>
            </div>
            {comparison.matchedStyles.length > 0 && (
              <p className="compare-detail">命中历史款：{comparison.matchedStyles.join("、")}</p>
            )}
            {comparison.matchedFabrics.length > 0 && (
              <p className="compare-detail">命中面料：{comparison.matchedFabrics.join("、")}</p>
            )}
            {comparison.matchedColors.length > 0 && (
              <p className="compare-detail">命中色彩：{comparison.matchedColors.join("、")}</p>
            )}
            <div className="compare-risks">
              {comparison.overallScore < 30 && (
                <p className="compare-warn">品类偏离风险：此款与客户核心品类差异较大，建议评审后再决定是否推款</p>
              )}
              {comparison.overallScore >= 70 && (
                <p className="compare-ok">高返单概率：此款与客户历史爆款高度一致，优先推荐给客户</p>
              )}
            </div>
          </div>

          <div className="lightbox-section">
            <h3>配色</h3>
            <div className="palette-row" aria-label="配色">
              {look.palette.map((color) => (
                <span key={color} style={{ backgroundColor: color }} title={color} />
              ))}
            </div>
          </div>

          <div className="lightbox-section">
            <h3>关键细节</h3>
            <div className="chip-row">
              {look.keyDetails.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>

          <div className="lightbox-section">
            <h3>修改建议</h3>
            <p>{look.revisionAdvice}</p>
          </div>

          <div className="lightbox-section">
            <h3>提示词</h3>
            <pre className="prompt-box">{look.prompt}</pre>
          </div>

          <div className="lightbox-actions">
            <button className="secondary-btn" onClick={handleCopyPrompt}>
              <Clipboard size={16} /> 复制提示词
            </button>
            <button className="secondary-btn" onClick={onExportTechPack}>
              <FileText size={16} /> 导出 Excel 工艺单
            </button>
            <button className="secondary-btn" onClick={onExportPDF}>
              <Printer size={16} /> 导出 PDF 工艺单
            </button>
            <button className="secondary-btn" onClick={() => setShowIterate((v) => !v)}>
              <GitBranch size={16} /> 微调迭代
            </button>
            {look.sourceMode === "线稿图" && hasImage && (
              <button className="primary-btn sketch-chat-trigger" onClick={() => setShowSketchChat(true)}>
                <MessageCircle size={16} /> 线稿对话
              </button>
            )}
            {hasImage && (
              <button className="secondary-btn" onClick={onDownload}>
                <Download size={16} /> 下载图片
              </button>
            )}
            <button className={look.selected ? "primary-btn" : "secondary-btn"} onClick={onToggle}>
              {look.selected ? <><Check size={16} /> 已选入精修池</> : "选入精修池"}
            </button>
          </div>

          {showIterate && (
            <div className="iterate-panel">
              <h3>迭代微调</h3>
              <div className="iterate-presets">
                {modPresets.map((p) => (
                  <button key={p.label} className="chip-btn" onClick={() => setModText(p.text)}>{p.label}</button>
                ))}
              </div>
              <textarea
                value={modText}
                onChange={(e) => setModText(e.target.value)}
                placeholder="描述要修改的方向，如：将领型改为立领，面料换成摇粒绒"
                rows={3}
              />
              <button className="primary-btn" onClick={handleIterateSubmit} disabled={!modText.trim()}>
                <Sparkles size={15} /> 生成 V{(look.version ?? 1) + 1}
              </button>
            </div>
          )}
        </div>
      </div>

      {showSketchChat && (
        <SketchChat
          look={look}
          onClose={() => setShowSketchChat(false)}
          onSketchModified={onSketchModified}
        />
      )}
    </div>
  )
}
