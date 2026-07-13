import { useMemo, useState } from "react"
import type { CustomerProfile, GeneratedLook } from "../types"
import { ArrowRight, Equal } from "lucide-react"
import { SCORE_THRESHOLD } from "../constants"
import { competitorIntelOf } from "../utils/competitorIntel"

interface Props {
  profiles: CustomerProfile[]
  looks: GeneratedLook[]
}

export function ComparisonView({ profiles, looks }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [tab, setTab] = useState<"overview" | "tags" | "price" | "trends" | "competitors">("overview")

  const toggleCustomer = (id: string) => {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter((c) => c !== id)
      }
      if (current.length >= 3) {
        return [...current.slice(1), id]
      }
      return [...current, id]
    })
  }

  const selectedProfiles = useMemo(
    () => profiles.filter((p) => selectedIds.includes(p.id)),
    [profiles, selectedIds]
  )

  const comparisonData = useMemo(() => {
    return selectedProfiles.map((profile) => {
      const customerLooks = looks.filter((l) => l.customerId === profile.id)
      const selectedCount = customerLooks.filter((l) => l.selected).length
      const avgScore = customerLooks.length > 0
        ? Math.round(customerLooks.reduce((sum, l) => sum + l.score, 0) / customerLooks.length)
        : 0

      return {
        profile,
        totalLooks: customerLooks.length,
        selectedCount,
        avgScore,
      }
    })
  }, [selectedProfiles, looks])

  // 找出3个客户之间的共性
  const commonalities = useMemo(() => {
    if (selectedProfiles.length < 2) return null
    const allTags = selectedProfiles.map((p) => new Set(p.styleTags))
    const intersection = [...allTags[0]].filter((tag) => allTags.every((s) => s.has(tag)))

    const allFabrics = selectedProfiles.map((p) => p.fabricPreference.split("、").map((f) => f.trim()).filter(Boolean))
    const commonFabrics = allFabrics[0].filter((f) => allFabrics.every((fs) => fs.some((ff) => ff.includes(f) || f.includes(ff))))

    return {
      tags: intersection,
      fabrics: commonFabrics,
    }
  }, [selectedProfiles])

  // 找出差异
  const differences = useMemo(() => {
    if (selectedProfiles.length < 2) return null
    const allTags = selectedProfiles.map((p) => new Set(p.styleTags))
    const union = new Set(selectedProfiles.flatMap((p) => p.styleTags))
    const uniqueTags = selectedProfiles.map((p, i) => {
      const otherTags = new Set(
        selectedProfiles.filter((_, j) => j !== i).flatMap((pp) => pp.styleTags)
      )
      return {
        name: p.name,
        tags: p.styleTags.filter((t) => !otherTags.has(t)),
      }
    })

    return { uniqueTags }
  }, [selectedProfiles])

  const tabs = [
    { key: "overview" as const, label: "总览" },
    { key: "tags" as const, label: "风格标签" },
    { key: "price" as const, label: "价格策略" },
    { key: "trends" as const, label: "趋势判断" },
    { key: "competitors" as const, label: "竞对情报" },
  ]

  // 竞对情报数据
  const competitorData = useMemo(() => {
    return selectedProfiles.map((profile) => ({
      profile,
      intel: competitorIntelOf(profile.id),
    })).filter((d) => d.intel && d.intel.competitors.length > 0)
  }, [selectedProfiles])

  // 共同趋势信号（跨客户相同 topic）
  const commonTrendSignals = useMemo(() => {
    if (competitorData.length < 2) return []
    const topicMap = new Map<string, { topic: string; direction: string; description: string; customers: string[] }>()
    for (const { profile, intel } of competitorData) {
      if (!intel) continue
      for (const t of intel.trendSignals) {
        const existing = topicMap.get(t.topic)
        if (existing) {
          existing.customers.push(profile.name)
        } else {
          topicMap.set(t.topic, {
            topic: t.topic,
            direction: t.direction,
            description: t.description,
            customers: [profile.name],
          })
        }
      }
    }
    return [...topicMap.values()].filter((t) => t.customers.length >= 2)
  }, [competitorData])

  const trendArrow = (direction: string) => {
    if (direction === "上升") return "↑"
    if (direction === "下降") return "↓"
    return "→"
  }

  if (selectedProfiles.length === 0) {
    return (
      <div className="comparison-view">
        <div className="comparison-header">
          <h2>客户对比视图</h2>
          <p>选择 2-3 个客户，并排对比其风格标签、价格带、面料偏好等核心维度</p>
        </div>
        <div className="comparison-selector">
          <h3>选择要对比的客户（最多3个）</h3>
          <div className="comparison-grid">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                className={`comparison-chip ${selectedIds.includes(profile.id) ? "active" : ""}`}
                onClick={() => toggleCustomer(profile.id)}
              >
                <strong>{profile.name}</strong>
                <span>{profile.market}</span>
                {selectedIds.includes(profile.id) && <small>已选</small>}
              </button>
            ))}
          </div>
        </div>
        <div className="comparison-empty">
          <p>👆 请先在上方选择要对比的客户</p>
        </div>
      </div>
    )
  }

  return (
    <div className="comparison-view">
      <div className="comparison-header">
        <h2>客户对比视图</h2>
        <button className="secondary-btn compact-btn" onClick={() => setSelectedIds([])}>
          重新选择
        </button>
      </div>

      {/* 选择器 */}
      <div className="comparison-selector mini">
        {profiles.map((profile) => (
          <button
            key={profile.id}
            className={`comparison-chip ${selectedIds.includes(profile.id) ? "active" : ""}`}
            onClick={() => toggleCustomer(profile.id)}
          >
            <strong>{profile.name}</strong>
          </button>
        ))}
      </div>

      {/* Tab 切换 */}
      <div className="comparison-tabs">
        {tabs.map((t) => (
          <button key={t.key} className={tab === t.key ? "active" : ""} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 总览 */}
      {tab === "overview" && (
        <div className="comparison-content">
          {/* 侧边对比表 */}
          <div className="compare-table-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th>维度</th>
                  {comparisonData.map((d) => (
                    <th key={d.profile.id}>{d.profile.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>市场</td>
                  {comparisonData.map((d) => (
                    <td key={d.profile.id}>{d.profile.market}</td>
                  ))}
                </tr>
                <tr>
                  <td>成熟度</td>
                  {comparisonData.map((d) => (
                    <td key={d.profile.id}>{d.profile.maturity}</td>
                  ))}
                </tr>
                <tr>
                  <td>定位</td>
                  {comparisonData.map((d) => (
                    <td key={d.profile.id} className="compare-desc">{d.profile.positioning}</td>
                  ))}
                </tr>
                <tr>
                  <td>出款数</td>
                  {comparisonData.map((d) => (
                    <td key={d.profile.id}><strong>{d.totalLooks}</strong> 款</td>
                  ))}
                </tr>
                <tr>
                  <td>平均分</td>
                  {comparisonData.map((d) => (
                    <td key={d.profile.id}>
                      <strong className={d.avgScore >= SCORE_THRESHOLD ? "score-high" : d.avgScore >= 70 ? "score-mid" : "score-low"}>
                        {d.avgScore || "—"}
                      </strong>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>已选入</td>
                  {comparisonData.map((d) => (
                    <td key={d.profile.id}>{d.selectedCount} 款</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* 共性与差异 */}
          {commonalities && (
            <div className="compare-insight">
              <div className="compare-insight-block common">
                <h4><Equal size={15} /> 共性</h4>
                {commonalities.tags.length > 0 && (
                  <p className="compare-tag-row">
                    <span>共同标签：</span>
                    {commonalities.tags.map((t) => (
                      <em key={t}>{t}</em>
                    ))}
                  </p>
                )}
                {commonalities.fabrics.length > 0 && (
                  <p className="compare-tag-row">
                    <span>共同面料：</span>
                    {commonalities.fabrics.map((f) => (
                      <em key={f}>{f}</em>
                    ))}
                  </p>
                )}
                {commonalities.tags.length === 0 && commonalities.fabrics.length === 0 && (
                  <p className="muted">这些客户之间没有明显的风格或面料共性，适合做差异化出款。</p>
                )}
              </div>
              {differences && (
                <div className="compare-insight-block diff">
                  <h4><ArrowRight size={15} /> 差异</h4>
                  {differences.uniqueTags.map((u) => (
                    <p key={u.name} className="compare-tag-row">
                      <span>{u.name} 独有：</span>
                      {u.tags.length > 0 ? u.tags.map((t) => <em key={t}>{t}</em>) : <small className="muted">无明显独有标签</small>}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 风格标签对比 */}
      {tab === "tags" && (
        <div className="comparison-content">
          <div className="compare-columns">
            {comparisonData.map((d) => (
              <div key={d.profile.id} className="compare-col">
                <h3>{d.profile.name}</h3>
                <div className="compare-col-section">
                  <small>风格标签</small>
                  <div className="style-tags">
                    {d.profile.styleTags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                </div>
                <div className="compare-col-section">
                  <small>面料偏好</small>
                  <p>{d.profile.fabricPreference}</p>
                </div>
                <div className="compare-col-section">
                  <small>色彩方向</small>
                  <p>{d.profile.colorDirection}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 价格策略对比 */}
      {tab === "price" && (
        <div className="comparison-content">
          <div className="compare-columns">
            {comparisonData.map((d) => (
              <div key={d.profile.id} className="compare-col">
                <h3>{d.profile.name}</h3>
                <div className="compare-col-section">
                  <small>价格策略</small>
                  <p className="big">{d.profile.priceStrategy}</p>
                </div>
                <div className="compare-col-section">
                  <small>市场定位</small>
                  <p>{d.profile.market} · {d.profile.maturity}</p>
                </div>
                <div className="compare-col-section">
                  <small>出款统计</small>
                  <p>{d.totalLooks} 款 / 平均 {d.avgScore} 分 / 已选 {d.selectedCount}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 趋势判断对比 */}
      {tab === "trends" && (
        <div className="comparison-content">
          <div className="compare-columns">
            {comparisonData.map((d) => (
              <div key={d.profile.id} className="compare-col">
                <h3>{d.profile.name}</h3>
                <div className="compare-col-section">
                  <small>趋势预测</small>
                  <p>{d.profile.trendPrediction}</p>
                </div>
                <div className="compare-col-section">
                  <small>ERP 洞察</small>
                  {d.profile.erpInsight ? (
                    <>
                      <p>{d.profile.erpInsight.orderTrend}</p>
                      <p className="muted">{d.profile.erpInsight.repeatOrderSignal}</p>
                    </>
                  ) : (
                    <p className="muted">暂无 ERP 数据</p>
                  )}
                </div>
                <div className="compare-col-section">
                  <small>风险信号</small>
                  <ul className="risk-list">
                    {d.profile.risks.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 竞对情报对比 */}
      {tab === "competitors" && (
        <div className="comparison-content">
          {competitorData.length === 0 ? (
            <div className="comparison-empty">
              <p>所选客户暂无竞对情报数据。</p>
            </div>
          ) : (
            <>
              <div className="compare-columns">
                {competitorData.map(({ profile, intel }) => (
                  <div key={profile.id} className="compare-col">
                    <h3>{profile.name}</h3>
                    {intel && (
                      <>
                        <div className="compare-col-section">
                          <small>竞对品牌（{intel.competitors.length}）</small>
                          <table className="compare-table competitor-mini-table">
                            <thead>
                              <tr>
                                <th>品牌</th>
                                <th>类型</th>
                                <th>定位</th>
                                <th>价格带</th>
                              </tr>
                            </thead>
                            <tbody>
                              {intel.competitors.map((c) => (
                                <tr key={c.name}>
                                  <td><strong>{c.name}</strong></td>
                                  <td>{c.competitorType}</td>
                                  <td className="compare-desc">{c.positioning}</td>
                                  <td>{c.priceBand || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="compare-col-section">
                          <small>优势 / 劣势</small>
                          {intel.competitors.map((c) => (
                            <div key={c.name} style={{ marginBottom: 8 }}>
                              <p style={{ fontWeight: 600, fontSize: "13px" }}>{c.name}</p>
                              <p style={{ fontSize: "12.5px", color: "var(--ok)" }}>优势：{c.strengths.join("、")}</p>
                              <p style={{ fontSize: "12.5px", color: "var(--warn-ink)" }}>劣势：{c.weaknesses.join("、")}</p>
                            </div>
                          ))}
                        </div>
                        {intel.trendSignals.length > 0 && (
                          <div className="compare-col-section">
                            <small>趋势信号</small>
                            <ul className="risk-list">
                              {intel.trendSignals.map((t, i) => (
                                <li key={i}>
                                  <b>{t.topic}</b>{" "}
                                  <span style={{
                                    fontWeight: 700,
                                    color: t.direction === "上升" ? "var(--ok)" : t.direction === "下降" ? "var(--warn-ink)" : "var(--muted)",
                                  }}>{trendArrow(t.direction)} {t.direction}</span>
                                  <br />
                                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>{t.description}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>

              {commonTrendSignals.length > 0 && (
                <div className="compare-insight">
                  <div className="compare-insight-block common">
                    <h4><Equal size={15} /> 共同趋势信号</h4>
                    {commonTrendSignals.map((t, i) => (
                      <p key={i} className="compare-tag-row">
                        <span><b>{t.topic}</b>{" "}
                          <em style={{
                            fontStyle: "normal",
                            fontWeight: 700,
                            color: t.direction === "上升" ? "var(--ok)" : t.direction === "下降" ? "var(--warn-ink)" : "var(--muted)",
                          }}>{trendArrow(t.direction)} {t.direction}</em>
                        </span>
                        <small style={{ color: "var(--muted)" }}>（{[...new Set(t.customers)].join("、")}）</small>
                        <br />
                        <small>{t.description}</small>
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
