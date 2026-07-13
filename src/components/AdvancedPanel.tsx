import { Database, Loader2 } from "lucide-react"
import type { ApiConfig, GenerationSettings } from "../types"

interface AdvancedPanelProps {
  apiConfig: ApiConfig
  onApiChange: (config: ApiConfig) => void
  settings: GenerationSettings
  onSettingsChange: (settings: GenerationSettings) => void
  onReload: () => void
  erpLoading: boolean
}

export function AdvancedPanel({
  apiConfig,
  onApiChange,
  settings,
  onSettingsChange,
  onReload,
  erpLoading,
}: AdvancedPanelProps) {
  return (
    <div className="advanced">
      <div className="advanced-col">
        <h3>出图方式</h3>
        <select value={apiConfig.provider} onChange={(event) => onApiChange({ ...apiConfig, provider: event.target.value as ApiConfig["provider"] })}>
          <option value="ark">火山方舟 Doubao 真实出图</option>
          <option value="local">本地预览（占位图，免费即时）</option>
        </select>
        {apiConfig.provider === "ark" && (
          <label className="mini-field wide">
            <span>火山方舟 ARK API Key</span>
            <input
              type="password"
              placeholder="火山方舟 key（也可用环境变量启动后端）"
              value={apiConfig.arkKey ?? ""}
              onChange={(event) => onApiChange({ ...apiConfig, arkKey: event.target.value })}
            />
          </label>
        )}
        <button className="secondary-btn" onClick={onReload} disabled={erpLoading}>
          {erpLoading ? <Loader2 className="spin" size={15} /> : <Database size={15} />} 重新读取当前客户 ERP
        </button>
        <label className="mini-field wide">
          <span>DeepSeek API Key（AI 分析）</span>
          <input
            type="password"
            placeholder="sk-..."
            value={apiConfig.aiKey ?? ""}
            onChange={(event) => onApiChange({ ...apiConfig, aiKey: event.target.value })}
          />
        </label>
        <label className="mini-field wide">
          <span>联网来源</span>
          <select
            value={apiConfig.intelSource ?? "hybrid"}
            onChange={(event) => onApiChange({ ...apiConfig, intelSource: event.target.value as ApiConfig["intelSource"] })}
          >
            <option value="hybrid">混合：Agent-Reach + Tavily</option>
            <option value="agent-reach">Agent-Reach</option>
            <option value="tavily">Tavily</option>
          </select>
        </label>
        <label className="mini-field wide">
          <span>Tavily API Key（实时联网检索）</span>
          <input
            type="password"
            placeholder="混合或 Tavily 模式可填 tvly-..."
            value={apiConfig.tavilyKey ?? ""}
            onChange={(event) => onApiChange({ ...apiConfig, tavilyKey: event.target.value })}
          />
        </label>
      </div>
      <div className="advanced-col">
        <h3>生成偏好</h3>
        <label className="mini-field wide">
          <span>创意强度：{settings.creativity}</span>
          <input type="range" min={1} max={10} value={settings.creativity} onChange={(event) => onSettingsChange({ ...settings, creativity: Number(event.target.value) })} />
        </label>
        <label className="mini-field wide">
          <span>出图分辨率</span>
          <select
            value={settings.imageSize ?? "2K"}
            onChange={(event) => onSettingsChange({ ...settings, imageSize: event.target.value as "2K" | "4K" })}
          >
            <option value="2K">2K（默认・速度快）</option>
            <option value="4K">4K（细节更锐・较慢较贵）</option>
          </select>
        </label>
        <label className="mini-field wide checkbox-field">
          <input
            type="checkbox"
            checked={settings.useSketchControl ?? false}
            onChange={(event) => onSettingsChange({ ...settings, useSketchControl: event.target.checked })}
          />
          <span>技术线稿结构控制（锁定廓形版型，仅非参考图融合模式生效）</span>
        </label>
        <label className="mini-field wide">
          <span>必须保留</span>
          <input value={settings.mustHave} onChange={(event) => onSettingsChange({ ...settings, mustHave: event.target.value })} />
        </label>
        <label className="mini-field wide">
          <span>避免</span>
          <input value={settings.avoid} onChange={(event) => onSettingsChange({ ...settings, avoid: event.target.value })} />
        </label>
      </div>
    </div>
  )
}
