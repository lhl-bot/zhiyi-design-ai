import { useEffect, useState } from "react"
import { Download, ImageIcon, Loader2, RefreshCw, Trash2, User, X } from "lucide-react"
import { fetchSavedImages, deleteSavedImage, type SavedImageMeta } from "../services/erp"

export function ImageGalleryView() {
  const [images, setImages] = useState<SavedImageMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<SavedImageMeta | null>(null)

  async function loadImages() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchSavedImages()
      setImages(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadImages() }, [])

  async function handleDelete(img: SavedImageMeta) {
    if (!window.confirm(`确认删除图片「${img.title || img.file}」吗？`)) return
    await deleteSavedImage(img.url)
    setImages((prev) => prev.filter((i) => i.file !== img.file))
  }

  function handleDownload(img: SavedImageMeta) {
    const a = document.createElement("a")
    a.href = img.url
    a.download = img.file
    a.click()
  }

  function formatDate(iso: string | null) {
    if (!iso) return ""
    try { return new Date(iso).toLocaleString("zh-CN") } catch { return iso }
  }

  const grouped = images.reduce<Record<string, SavedImageMeta[]>>((acc, img) => {
    const key = img.customerName || img.customerId || "未关联客户"
    if (!acc[key]) acc[key] = []
    acc[key].push(img)
    return acc
  }, {})

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="logo">SD</span>
          <div><strong>图片库</strong><small>所有已生成的 AI 款式图永久保存于此</small></div>
        </div>
        <div className="topbar-right">
          <span className="image-count-badge">{images.length} 张图片</span>
          <button className="secondary-btn compact-btn" onClick={loadImages} disabled={loading}>
            <RefreshCw size={16} className={loading ? "spin" : ""} /> 刷新
          </button>
        </div>
      </header>

      {loading && (
        <div className="loading-state">
          <Loader2 className="spin" size={32} />
          <p>加载已保存的图片…</p>
        </div>
      )}

      {error && (
        <div className="error-state">
          <p>{error}</p>
          <button className="secondary-btn" onClick={loadImages}>重试</button>
        </div>
      )}

      {!loading && !error && images.length === 0 && (
        <div className="empty-state">
          <ImageIcon size={48} />
          <p>暂无已保存的图片</p>
          <p className="hint">在工作台生成款式后，图片会自动保存到这里</p>
        </div>
      )}

      {!loading && !error && images.length > 0 && (
        <div className="gallery-content">
          {Object.entries(grouped).map(([customer, items]) => (
            <section key={customer} className="gallery-group">
              <h2 className="gallery-group-title">
                <User size={18} /> {customer}
                <span className="gallery-group-count">{items.length} 张</span>
              </h2>
              <div className="gallery-grid">
                {items.map((img) => (
                  <div key={img.file} className="gallery-card">
                    <div className="gallery-card-img" onClick={() => setPreview(img)}>
                      <img src={img.url} alt={img.title || img.file} loading="lazy" />
                    </div>
                    <div className="gallery-card-info">
                      <p className="gallery-card-title" title={img.title || img.file}>
                        {img.title || "未命名"}
                      </p>
                      <p className="gallery-card-date">{formatDate(img.createdAt)}</p>
                      <div className="gallery-card-actions">
                        <button className="icon-btn" onClick={() => handleDownload(img)} title="下载">
                          <Download size={14} />
                        </button>
                        <button className="icon-btn danger" onClick={() => handleDelete(img)} title="删除">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* 大图预览 */}
      {preview && (
        <div className="gallery-preview-overlay" onClick={() => setPreview(null)}>
          <div className="gallery-preview-container" onClick={(e) => e.stopPropagation()}>
            <button className="gallery-preview-close" onClick={() => setPreview(null)}>
              <X size={24} />
            </button>
            <img src={preview.url} alt={preview.title || preview.file} />
            <div className="gallery-preview-meta">
              <h3>{preview.title || "未命名"}</h3>
              <p>客户：{preview.customerName || preview.customerId || "未关联"}</p>
              <p>生成时间：{formatDate(preview.createdAt)}</p>
              {preview.prompt && (
                <details>
                  <summary>查看提示词</summary>
                  <pre>{preview.prompt}</pre>
                </details>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
