import { useEffect, useState } from "react"
import { fetchProductionFeasibility } from "../services/erp"
import type { ProductionFeasibility } from "../types"
import { Database, Factory, Loader2, Package, Truck } from "lucide-react"

interface Props {
  customerCode: string
  customerName: string
}

export function ProductionPanel({ customerCode, customerName }: Props) {
  const [data, setData] = useState<ProductionFeasibility | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!customerCode) return
    setLoading(true)
    setError(null)
    fetchProductionFeasibility(customerCode)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [customerCode])

  if (loading) {
    return (
      <section className="card production-card">
        <div className="step-head">
          <span className="step-no"><Loader2 className="spin" size={16} /></span>
          <h2>生产可行性</h2>
          <span className="badge loading">查询 ERP…</span>
        </div>
      </section>
    )
  }

  if (error || !data?.ok) {
    return (
      <section className="card production-card">
        <div className="step-head">
          <span className="step-no"><Factory size={16} /></span>
          <h2>生产可行性</h2>
          <span className="badge warn">ERP 查询失败</span>
        </div>
        <p className="inline-note warn">{error || "无法获取生产数据，请确认 ERP 连接正常"}</p>
      </section>
    )
  }

  const { summary, fabrics, accessories, recentContracts } = data

  return (
    <section className="card production-card">
      <div className="step-head">
        <span className="step-no"><Factory size={16} /></span>
        <h2>生产可行性 — {customerName}</h2>
        <span className="badge erp">ERP 真实数据</span>
      </div>

      <div className="prod-kpis">
        <div className="prod-kpi">
          <Database size={16} />
          <strong>{summary.fabricCount}</strong>
          <span>常用面料</span>
        </div>
        <div className="prod-kpi">
          <Package size={16} />
          <strong>{summary.accessoryCount}</strong>
          <span>常用辅料</span>
        </div>
        <div className="prod-kpi">
          <Truck size={16} />
          <strong>{summary.contractCount}</strong>
          <span>近2年合同</span>
        </div>
        <div className="prod-kpi">
          <strong>
            {summary.currency === "USD" ? "$" : "¥"}
            {(summary.avgContractAmount / 10000).toFixed(1)}万
          </strong>
          <span>均价</span>
        </div>
      </div>

      {fabrics.length > 0 && (
        <div className="prod-section">
          <h3>面料库（ERP 历史用量 Top {fabrics.length}）</h3>
          <div className="prod-table-wrap">
            <table className="prod-table">
              <thead>
                <tr>
                  <th>面料名</th>
                  <th>成分</th>
                  <th>门幅/克重</th>
                  <th>历史价</th>
                  <th>用量</th>
                  <th>供应商</th>
                </tr>
              </thead>
              <tbody>
                {fabrics.map((f, i) => (
                  <tr key={i}>
                    <td><strong>{f.name}</strong></td>
                    <td>{f.composition || "—"}</td>
                    <td>{[f.width, f.weight].filter(Boolean).join(" / ") || "—"}</td>
                    <td>{f.avgPrice > 0 ? `¥${Number(f.avgPrice).toFixed(2)}` : "—"}</td>
                    <td>{f.usageCount}次</td>
                    <td>{f.supplier || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {accessories.length > 0 && (
        <div className="prod-section">
          <h3>辅料库（ERP 历史用量 Top {accessories.length}）</h3>
          <div className="prod-table-wrap">
            <table className="prod-table">
              <thead>
                <tr>
                  <th>辅料名</th>
                  <th>规格</th>
                  <th>历史价</th>
                  <th>用量</th>
                  <th>供应商</th>
                </tr>
              </thead>
              <tbody>
                {accessories.map((a, i) => (
                  <tr key={i}>
                    <td><strong>{a.name}</strong></td>
                    <td>{a.spec || "—"}</td>
                    <td>{a.avgPrice > 0 ? `¥${Number(a.avgPrice).toFixed(2)}` : "—"}</td>
                    <td>{a.usageCount}次</td>
                    <td>{a.supplier || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {recentContracts.length > 0 && (
        <div className="prod-section">
          <h3>近期合同参考</h3>
          <div className="prod-contracts">
            {recentContracts.map((c, i) => (
              <div key={i} className="prod-contract-item">
                <div className="prod-contract-amount">
                  {c.currency === "USD" ? "$" : "¥"}
                  {Number(c.amount).toLocaleString()}
                </div>
                <div className="prod-contract-meta">
                  <span>{c.billNo}</span>
                  <span>{c.tradeType || "外贸"}</span>
                  <span>交期：{c.deliveryDate ? new Date(c.deliveryDate).toLocaleDateString("zh-CN") : "—"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {fabrics.length === 0 && accessories.length === 0 && (
        <p className="inline-note">暂无 {customerName} 的历史面料/辅料数据，可能当前简称未命中 ERP。</p>
      )}
    </section>
  )
}
