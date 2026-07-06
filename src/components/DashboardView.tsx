import { useMemo, useState } from "react"
import type { CustomerProfile, GeneratedLook } from "../types"
import { ArrowRight, CheckCircle, Clock, Eye } from "lucide-react"

interface Props {
  profiles: CustomerProfile[]
  looks: GeneratedLook[]
  onSelectCustomer: (id: string) => void
  onSwitchToWorkbench: () => void
}

const seasons = ["全部", "2026AW", "2026SS", "2025AW", "2025SS"]

export function DashboardView({ profiles, looks, onSelectCustomer, onSwitchToWorkbench }: Props) {
  const [seasonFilter, setSeasonFilter] = useState("全部")
  const [marketFilter, setMarketFilter] = useState("全部")

  const markets = useMemo(() => ["全部", ...new Set(profiles.map((p) => p.market))], [profiles])

  const stats = useMemo(() => {
    const totalLooks = looks.length
    const selectedLooks = looks.filter((l) => l.selected).length
    const avgScore = totalLooks > 0
      ? Math.round(looks.reduce((sum, l) => sum + l.score, 0) / totalLooks)
      : 0

    // 每位客户的统计
    const perCustomer = profiles.map((profile) => {
      const customerLooks = looks.filter((l) => l.customerId === profile.id)
      const selected = customerLooks.filter((l) => l.selected).length
      return {
        profile,
        total: customerLooks.length,
        selected,
        avgScore: customerLooks.length > 0
          ? Math.round(customerLooks.reduce((sum, l) => sum + l.score, 0) / customerLooks.length)
          : 0,
        latestLooks: customerLooks.slice(-4).reverse(),
      }
    })

    return { totalLooks, selectedLooks, avgScore, perCustomer }
  }, [profiles, looks])

  // 总览：按客户和季节的矩阵
  const matrixData = useMemo(() => {
    const filteredProfiles = marketFilter === "全部"
      ? profiles
      : profiles.filter((p) => p.market === marketFilter)

    return filteredProfiles.map((profile) => {
      const customerLooks = looks.filter((l) => l.customerId === profile.id)
      const seasonBreakdown: Record<string, { total: number; selected: number }> = {}
      customerLooks.forEach((l) => {
        // 出款 look 可能包含 season 信息，但 GeneratedLook 中没有直接的 season 字段
        // 所以所有款都归入「全部」
        if (!seasonBreakdown["全部"]) seasonBreakdown["全部"] = { total: 0, selected: 0 }
        seasonBreakdown["全部"].total++
        if (l.selected) seasonBreakdown["全部"].selected++
      })
      const selected = customerLooks.filter((l) => l.selected).length
      return {
        profile,
        total: customerLooks.length,
        selected,
        seasonBreakdown,
      }
    })
  }, [profiles, looks, marketFilter])

  function handleCustomerClick(profileId: string) {
    onSelectCustomer(profileId)
    onSwitchToWorkbench()
  }

  return (
    <div className="dashboard-view">
      {/* 标题 */}
      <div className="dashboard-header">
        <h2>多客户出款看板</h2>
        <p>一览全部客户的本季出款状态、进度与精选情况</p>
      </div>

      {/* 全局统计卡片 */}
      <div className="dashboard-kpis">
        <div className="dashboard-kpi">
          <span>总出款</span>
          <strong>{stats.totalLooks}</strong>
        </div>
        <div className="dashboard-kpi">
          <span>已选入精修</span>
          <strong>{stats.selectedLooks}</strong>
        </div>
        <div className="dashboard-kpi">
          <span>平均分</span>
          <strong>{stats.avgScore || "—"}</strong>
        </div>
        <div className="dashboard-kpi">
          <span>覆盖客户</span>
          <strong>{stats.perCustomer.filter((c) => c.total > 0).length}/{profiles.length}</strong>
        </div>
      </div>

      {/* 筛选 */}
      <div className="dashboard-filters">
        <label className="sort-control">
          <span>市场</span>
          <select value={marketFilter} onChange={(e) => setMarketFilter(e.target.value)}>
            {markets.map((m) => (
              <option key={m} value={m}>{m === "全部" ? "全部市场" : m}</option>
            ))}
          </select>
        </label>
      </div>

      {/* 客户出款网格 */}
      <div className="dashboard-grid">
        {matrixData.map(({ profile, total, selected, seasonBreakdown }) => (
          <div key={profile.id} className="dashboard-card" onClick={() => handleCustomerClick(profile.id)}>
            <div className="dashboard-card-head">
              <div>
                <strong>{profile.name}</strong>
                <span>{profile.market}</span>
              </div>
              <ArrowRight size={16} />
            </div>

            {/* 进度条 */}
            <div className="dashboard-progress">
              <div className="dashboard-progress-bar">
                <div
                  className="dashboard-progress-fill"
                  style={{ width: total > 0 ? `${Math.round((selected / Math.max(total, 1)) * 100)}%` : "0%" }}
                />
              </div>
              <span>{selected}/{total} 已选</span>
            </div>

            {/* 统计数字 */}
            <div className="dashboard-card-stats">
              <div className="dashboard-stat">
                <Eye size={14} />
                <strong>{total}</strong>
                <span>总出款</span>
              </div>
              <div className="dashboard-stat">
                <CheckCircle size={14} />
                <strong>{selected}</strong>
                <span>已选</span>
              </div>
              <div className="dashboard-stat">
                <Clock size={14} />
                <strong>{seasonBreakdown["全部"]?.total ?? 0}</strong>
                <span>当季</span>
              </div>
            </div>

            {/* 最近款式缩略图 */}
            {stats.perCustomer.find((c) => c.profile.id === profile.id)?.latestLooks.length! > 0 ? (
              <div className="dashboard-thumbs">
                {stats.perCustomer
                  .find((c) => c.profile.id === profile.id)!
                  .latestLooks.map((look) => (
                    <div key={look.id} className="dashboard-thumb" title={look.title}>
                      {look.image ? (
                        <img src={look.image} alt={look.title} />
                      ) : (
                        <div className="dashboard-thumb-placeholder" />
                      )}
                      {look.selected && <div className="dashboard-thumb-pick" />}
                    </div>
                  ))}
              </div>
            ) : (
              <div className="dashboard-empty-hint">
                <span>尚未生成款式</span>
              </div>
            )}

            {/* 成熟度 badge */}
            <div className="dashboard-meta">
              <span className={`maturity-badge ${profile.maturity === "数据充足" ? "high" : profile.maturity === "需设计师补标" ? "mid" : "low"}`}>
                {profile.maturity}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
