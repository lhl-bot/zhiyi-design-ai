import { useEffect, useRef, useState } from "react"
import { ArrowLeft, Download, History, Loader2, MessageCircle, RefreshCw, Scissors, Send, Shirt, Sparkles, X } from "lucide-react"
import type { GeneratedLook, SketchChatMessage, SketchEditStep } from "../types"
import { fetchGenImages } from "../services/erp"

interface SketchChatProps {
  look: GeneratedLook
  onClose: () => void
  /** 当线稿图被修改后，通知父组件更新 looks 列表 */
  onSketchModified: (updatedLook: GeneratedLook) => void
}

/** 快捷指令模板 */
const QUICK_COMMANDS = [
  { icon: Scissors, label: "改领型", prompt: "把领型改成{target}，保持原有门襟和廓形" },
  { icon: Shirt, label: "换面料", prompt: "把面料改成{target}面料质感，保持款式不变" },
  { icon: RefreshCw, label: "调长短", prompt: "把衣长{target}，其他部位比例不变" },
  { icon: Sparkles, label: "加口袋", prompt: "在{target}位置加一个贴袋/挖袋" },
  { icon: Sparkles, label: "改袖型", prompt: "把袖子改成{target}袖型" },
  { icon: Sparkles, label: "调配色", prompt: "把配色方案调整为{target}" },
]

function buildModifyPrompt(originalPrompt: string, instruction: string): string {
  return `技术线稿修改：在原黑白线稿基础上，${instruction}。
要求：纯黑白钢笔线条技术草图（CAD风格），白色背景，无填充色、无阴影、无渐变、无模特、无文字、无logo、无水印。
正面平铺视图，清晰展示缝线、省道、口袋、拉链、领型、袖口、下摆等工艺细节。`
}

export function SketchChat({ look, onClose, onSketchModified }: SketchChatProps) {
  const [messages, setMessages] = useState<SketchChatMessage[]>([])
  const [editHistory, setEditHistory] = useState<SketchEditStep[]>([])
  const [currentImage, setCurrentImage] = useState(look.image)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const [compareStep, setCompareStep] = useState<SketchEditStep | null>(null)
  const [activeCommand, setActiveCommand] = useState<string | null>(null)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // 初始化：显示系统欢迎消息
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: `已打开「${look.title}」的线稿编辑对话。你可以用自然语言描述修改需求，例如"把领子改成中式立领"、"下摆加宽5cm"、"袖口加罗纹"。`,
        timestamp: new Date().toLocaleString("zh-CN"),
      }])
    }
  }, [look.title])

  // 自动滚动到底部
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // 聚焦输入框
  useEffect(() => {
    inputRef.current?.focus()
  }, [loading])

  async function handleSend(instruction?: string) {
    const text = (instruction ?? input).trim()
    if (!text || loading) return

    setInput("")
    setError(null)
    setActiveCommand(null)
    setLoading(true)

    const userMsg: SketchChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleString("zh-CN"),
    }
    setMessages((prev) => [...prev, userMsg])

    try {
      const modifyPrompt = buildModifyPrompt(look.prompt, text)
      const images = await fetchGenImages({
        prompt: modifyPrompt,
        count: 1,
        referenceImage: currentImage,
      })

      if (!images.length) throw new Error("AI 未返回图片")

      const newImage = images[0]
      const step: SketchEditStep = {
        id: `step-${Date.now()}`,
        image: newImage,
        instruction: text,
        prompt: modifyPrompt,
        timestamp: new Date().toLocaleString("zh-CN"),
        beforeImage: currentImage,
      }

      setEditHistory((prev) => [...prev, step])
      setCurrentImage(newImage)

      const assistantMsg: SketchChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: `已按「${text}」生成修改后的线稿。`,
        image: newImage,
        timestamp: new Date().toLocaleString("zh-CN"),
        editStepId: step.id,
      }
      setMessages((prev) => [...prev, assistantMsg])

      // 通知父组件更新
      onSketchModified({ ...look, image: newImage, modificationNote: text })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "修改失败"
      setError(msg)
      setMessages((prev) => [...prev, {
        id: `e-${Date.now()}`,
        role: "assistant",
        content: `❌ 修改失败：${msg}。请重试或换个描述方式。`,
        timestamp: new Date().toLocaleString("zh-CN"),
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleUndo(step: SketchEditStep) {
    setCurrentImage(step.beforeImage)
    setEditHistory((prev) => prev.filter((s) => {
      const stepIdx = prev.findIndex((p) => p.id === step.id)
      const currentIdx = prev.findIndex((p) => p.id === step.id)
      return prev.indexOf(s) < currentIdx
    }))
    setMessages((prev) => [...prev, {
      id: `undo-${Date.now()}`,
      role: "assistant",
      content: `已撤销「${step.instruction}」，恢复到上一步。`,
      timestamp: new Date().toLocaleString("zh-CN"),
    }])
    setCompareMode(false)
    setCompareStep(null)
  }

  function handleCompare(step: SketchEditStep) {
    setCompareStep(step)
    setCompareMode(true)
  }

  function handleDownload() {
    const a = document.createElement("a")
    a.href = currentImage
    a.download = `${look.title.replace(/[\\/:*?"<>|]/g, "_")}_modified.png`
    a.click()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const canUndo = editHistory.length > 0

  return (
    <div className="sketch-chat-overlay" onClick={onClose}>
      <div className="sketch-chat-panel" onClick={(e) => e.stopPropagation()}>
        {/* 头部 */}
        <div className="sketch-chat-header">
          <button className="sketch-chat-back" onClick={onClose} title="关闭">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2><MessageCircle size={18} /> 线稿对话</h2>
            <span>{look.title}</span>
          </div>
          <div className="sketch-chat-header-actions">
            <button
              className={`sketch-chat-icon-btn ${showHistory ? "active" : ""}`}
              onClick={() => setShowHistory((v) => !v)}
              title="修改历史"
            >
              <History size={18} />
            </button>
            <button className="sketch-chat-icon-btn" onClick={handleDownload} title="下载当前线稿">
              <Download size={18} />
            </button>
            <button className="sketch-chat-close" onClick={onClose} title="关闭">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="sketch-chat-body">
          {/* 左侧：线稿预览 + 对比 */}
          <div className="sketch-chat-preview">
            {compareMode && compareStep ? (
              <div className="sketch-compare-view">
                <div className="sketch-compare-half">
                  <span className="sketch-compare-label">修改前</span>
                  <img src={compareStep.beforeImage} alt="修改前" />
                </div>
                <div className="sketch-compare-divider">VS</div>
                <div className="sketch-compare-half">
                  <span className="sketch-compare-label">修改后</span>
                  <img src={compareStep.image} alt="修改后" />
                </div>
              </div>
            ) : (
              <div className="sketch-preview-main">
                {currentImage ? (
                  <img src={currentImage} alt={look.title} />
                ) : (
                  <div className="sketch-preview-empty">
                    <Loader2 className="spin" size={36} />
                    <span>线稿加载中…</span>
                  </div>
                )}
                {editHistory.length > 0 && (
                  <span className="sketch-preview-badge">已修改 {editHistory.length} 次</span>
                )}
              </div>
            )}
          </div>

          {/* 右侧：对话区 */}
          <div className="sketch-chat-conversation">
            {/* 消息列表 */}
            <div className="sketch-chat-messages">
              {messages.map((msg) => (
                <div key={msg.id} className={`sketch-chat-msg ${msg.role}`}>
                  <div className="sketch-chat-msg-bubble">
                    <p>{msg.content}</p>
                    {msg.image && (
                      <div className="sketch-chat-msg-image">
                        <img src={msg.image} alt="修改结果" />
                      </div>
                    )}
                    <span className="sketch-chat-msg-time">{msg.timestamp}</span>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="sketch-chat-msg assistant">
                  <div className="sketch-chat-msg-bubble loading">
                    <Loader2 className="spin" size={16} />
                    <span>AI 正在修改线稿…</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="sketch-chat-msg assistant">
                  <div className="sketch-chat-msg-bubble error">{error}</div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* 输入区 */}
            <div className="sketch-chat-input-area">
              {/* 快捷指令 */}
              <div className="sketch-chat-quick-commands">
                {QUICK_COMMANDS.map((cmd) => (
                  <button
                    key={cmd.label}
                    className={`sketch-chat-quick-btn ${activeCommand === cmd.label ? "active" : ""}`}
                    onClick={() => {
                      setActiveCommand(cmd.label)
                      setInput(cmd.prompt)
                      inputRef.current?.focus()
                    }}
                    title={cmd.prompt}
                  >
                    <cmd.icon size={14} />
                    {cmd.label}
                  </button>
                ))}
              </div>

              {/* 输入框 */}
              <div className="sketch-chat-input-row">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="描述你要修改的内容，如：把领子改成中式立领，袖口加罗纹…"
                  rows={2}
                  disabled={loading}
                />
                <button
                  className="sketch-chat-send-btn"
                  onClick={() => handleSend()}
                  disabled={loading || !input.trim()}
                  title="发送"
                >
                  {loading ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 修改历史侧边栏 */}
        {showHistory && (
          <div className="sketch-chat-history-panel">
            <div className="sketch-chat-history-head">
              <h3><History size={16} /> 修改历史</h3>
              <button onClick={() => setShowHistory(false)}><X size={16} /></button>
            </div>
            {editHistory.length === 0 ? (
              <p className="sketch-chat-history-empty">暂无修改记录</p>
            ) : (
              <div className="sketch-chat-history-list">
                {[...editHistory].reverse().map((step, i) => (
                  <div key={step.id} className="sketch-chat-history-item">
                    <div className="sketch-chat-history-thumb">
                      <img src={step.image} alt={`第 ${editHistory.length - i} 步`} />
                    </div>
                    <div className="sketch-chat-history-info">
                      <span className="sketch-chat-history-step">第 {editHistory.length - i} 步</span>
                      <p>{step.instruction}</p>
                      <span className="sketch-chat-history-time">{step.timestamp}</span>
                    </div>
                    <div className="sketch-chat-history-actions">
                      <button
                        onClick={() => handleCompare(step)}
                        title="对比修改前后"
                      >
                        对比
                      </button>
                      {i === 0 && (
                        <button
                          className="undo"
                          onClick={() => handleUndo(step)}
                          title="撤销此步"
                        >
                          撤销
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
