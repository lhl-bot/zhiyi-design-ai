import type { CustomerTrend } from "../types"

interface TrendSectionProps {
  customerName: string
  trend: CustomerTrend
}

export function TrendSection({ customerName: _customerName, trend }: TrendSectionProps) {
  const maxAmount = Math.max(...trend.years.map((y) => y.totalAmount), 1)
  const maxContracts = Math.max(...trend.years.map((y) => y.contracts), 1)

  return (
    <div className="trend-section">
      <div className="trend-head">
        <strong>风格演变趋势</strong>
        <span>ERP 近 {trend.years.length} 年数据</span>
      </div>
      <p className="trend-summary">{trend.evolution}</p>

      <div className="trend-charts">
        <div className="trend-chart">
          <h4>合同趋势</h4>
          <div className="trend-bars">
            {trend.years.map((y) => (
              <div className="trend-bar-group" key={y.year}>
                <div className="trend-bar-contracts" style={{ height: `${Math.max(4, (y.contracts / maxContracts) * 100)}%` }} title={`${y.year}：${y.contracts} 笔`} />
                <span className="trend-bar-val">{y.contracts}</span>
                <span className="trend-bar-year">{y.year}</span>
              </div>
            ))}
          </div>
          <div className="trend-legend"><span className="legend-dot contracts" /> 合同笔数</div>
        </div>

        <div className="trend-chart">
          <h4>金额趋势（万元）</h4>
          <div className="trend-bars">
            {trend.years.map((y) => (
              <div className="trend-bar-group" key={y.year}>
                <div className="trend-bar-amount" style={{ height: `${Math.max(4, (y.totalAmount / maxAmount) * 100)}%` }} title={`${y.year}：${(y.totalAmount / 10000).toFixed(1)} 万`} />
                <span className="trend-bar-val">{(y.totalAmount / 10000).toFixed(1)}</span>
                <span className="trend-bar-year">{y.year}</span>
              </div>
            ))}
          </div>
          <div className="trend-legend"><span className="legend-dot amount" /> 合同总额</div>
        </div>
      </div>

      <div className="trend-details">
        <div className="trend-table-wrap">
          <h4>面料演变（Top 3 / 年）</h4>
          <table className="trend-table">
            <thead><tr>{trend.years.map((y) => <th key={y.year}>{y.year}</th>)}</tr></thead>
            <tbody>
              {Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  {trend.years.map((y) => (
                    <td key={y.year}>{y.fabrics[i]?.name ?? "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="trend-table-wrap">
          <h4>色彩演变（Top 3 / 年）</h4>
          <table className="trend-table">
            <thead><tr>{trend.years.map((y) => <th key={y.year}>{y.year}</th>)}</tr></thead>
            <tbody>
              {Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  {trend.years.map((y) => (
                    <td key={y.year}>{y.colors[i]?.name ?? "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="trend-table-wrap">
          <h4>订单类型演变（%）</h4>
          <table className="trend-table">
            <thead><tr>{trend.years.map((y) => <th key={y.year}>{y.year}</th>)}</tr></thead>
            <tbody>
              <tr>
                {trend.years.map((y) => (
                  <td key={y.year}>
                    {y.orderTypes.slice(0, 2).map((ot) => (
                      <div key={ot.name} className="order-type-chip">{ot.name} {ot.share}%</div>
                    ))}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
