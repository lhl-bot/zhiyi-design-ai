import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { GeneratedLook } from "../types"
import { Plus, Trash2, Move, Download, X, ImagePlus, GripHorizontal, Layers } from "lucide-react"

interface InspirationTags {
  category: string
  silhouette: string
  colorFamily: string
  fabric: string
  craft: string
  season: string
  customer: string
}

interface MoodItem {
  id: string
  image: string
  caption: string
  source: string
  tags: InspirationTags
  palette: string[]
  note: string
  x: number
  y: number
  w: number
  h: number
}

interface MoodBoard {
  id: string
  name: string
  items: MoodItem[]
  createdAt: string
}

interface Props {
  looks: GeneratedLook[]
  customerNames: Record<string, string>
}

const STORAGE_KEY = "mood-boards-v1"
const GRID_SIZE = 20
const DEFAULT_W = 200
const DEFAULT_H = 250

export function MoodBoardView({ looks, customerNames }: Props) {
  const [boards, setBoards] = useState<MoodBoard[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as MoodBoard[]
        if (parsed.length > 0) return parsed.map(normalizeBoard)
      }
    } catch { /* ignore */ }

    // 默认创建第一个看板
    return [{
      id: generateId(),
      name: "灵感板 1",
      items: [],
      createdAt: new Date().toLocaleString("zh-CN"),
    }]
  })

  const [activeBoardId, setActiveBoardId] = useState(boards[0]?.id ?? "")
  const [editingCaption, setEditingCaption] = useState<string | null>(null)
  const [captionText, setCaptionText] = useState("")
  const [draggingItem, setDraggingItem] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [showLookPicker, setShowLookPicker] = useState(false)
  const [showNewBoard, setShowNewBoard] = useState(false)
  const [newBoardName, setNewBoardName] = useState("")
  const boardRef = useRef<HTMLDivElement>(null)
  const [boardSize, setBoardSize] = useState({ w: 1200, h: 800 })

  const activeBoard = useMemo(
    () => boards.find((b) => b.id === activeBoardId) ?? boards[0],
    [boards, activeBoardId]
  )

  // 持久化
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(boards))
  }, [boards])

  // 获取所有已有出款图片（供添加到灵感板）
  const availableLooks = useMemo(() => {
    return looks
      .filter((l) => l.image)
      .map((l) => ({
        id: l.id,
        image: l.image,
        caption: `${customerNames[l.customerId] ?? "未知客户"} · ${l.title}`,
        source: "AI 生成",
      }))
  }, [looks, customerNames])

  function updateBoard(updater: (board: MoodBoard) => MoodBoard) {
    setBoards((current) =>
      current.map((b) => (b.id === activeBoardId ? updater(b) : b))
    )
  }

  function addItem(item: Omit<MoodItem, "x" | "y" | "w" | "h">) {
    // 放在看板中心附近，加随机偏移避免重叠
    const x = Math.max(20, (boardSize.w / 2 - DEFAULT_W / 2) + (Math.random() - 0.5) * 200)
    const y = Math.max(20, (boardSize.h / 2 - DEFAULT_H / 2) + (Math.random() - 0.5) * 200)
    updateBoard((board) => ({
      ...board,
      items: [...board.items, { ...item, x, y, w: DEFAULT_W, h: DEFAULT_H }],
    }))
  }

  function addLookToBoard(lookId: string) {
    const look = availableLooks.find((l) => l.id === lookId)
    if (!look) return
    addItem({
      id: generateId(),
      image: look.image,
      caption: look.caption,
      source: look.source,
      tags: autoTagAsset(look.caption, look.source, Object.values(customerNames)),
      palette: [],
      note: "",
    })
    setShowLookPicker(false)
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    void addUploadedFile(file)
    event.target.value = ""
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const files = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith("image/"))
    files.forEach((file) => void addUploadedFile(file))
  }

  async function addUploadedFile(file: File) {
    const reader = new FileReader()
    reader.onload = async () => {
      if (typeof reader.result === "string") {
        const palette = await extractPalette(reader.result)
        addItem({
          id: generateId(),
          image: reader.result,
          caption: file.name,
          source: "本地上传",
          tags: autoTagAsset(file.name, "本地上传", Object.values(customerNames), palette),
          palette,
          note: "",
        })
      }
    }
    reader.readAsDataURL(file)
  }

  function deleteItem(itemId: string) {
    updateBoard((board) => ({
      ...board,
      items: board.items.filter((i) => i.id !== itemId),
    }))
    if (editingCaption === itemId) setEditingCaption(null)
  }

  function updateCaption(itemId: string, caption: string) {
    updateBoard((board) => ({
      ...board,
      items: board.items.map((i) => (i.id === itemId ? { ...i, caption } : i)),
    }))
  }

  function updateItemNote(itemId: string, note: string) {
    updateBoard((board) => ({
      ...board,
      items: board.items.map((i) => (i.id === itemId ? { ...i, note } : i)),
    }))
  }

  // --- 拖拽逻辑 ---
  function startDrag(itemId: string, e: React.MouseEvent) {
    e.preventDefault()
    const item = activeBoard.items.find((i) => i.id === itemId)
    if (!item || !boardRef.current) return

    const boardRect = boardRef.current.getBoundingClientRect()
    setDraggingItem(itemId)
    setDragOffset({
      x: e.clientX - boardRect.left - item.x,
      y: e.clientY - boardRect.top - item.y,
    })
  }

  useEffect(() => {
    if (!draggingItem) return

    function onMove(e: MouseEvent) {
      if (!boardRef.current) return
      setBoards((current) =>
        current.map((board) => {
          if (board.id !== activeBoardId) return board
          const boardRect = boardRef.current!.getBoundingClientRect()
          const x = e.clientX - boardRect.left - dragOffset.x
          const y = e.clientY - boardRect.top - dragOffset.y
          return {
            ...board,
            items: board.items.map((item) =>
              item.id === draggingItem ? { ...item, x, y } : item
            ),
          }
        })
      )
    }

    function onUp() {
      setDraggingItem(null)
    }

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
  }, [draggingItem, dragOffset, activeBoardId])

  // --- 看板管理 ---
  function createBoard() {
    if (!newBoardName.trim()) return
    const board: MoodBoard = {
      id: generateId(),
      name: newBoardName.trim(),
      items: [],
      createdAt: new Date().toLocaleString("zh-CN"),
    }
    setBoards((current) => [...current, board])
    setActiveBoardId(board.id)
    setNewBoardName("")
    setShowNewBoard(false)
  }

  function deleteBoard(boardId: string) {
    if (boards.length <= 1) return
    const confirmed = window.confirm("确认删除这个灵感板？不可恢复。")
    if (!confirmed) return
    setBoards((current) => current.filter((b) => b.id !== boardId))
    if (activeBoardId === boardId) {
      const remaining = boards.filter((b) => b.id !== boardId)
      if (remaining.length > 0) setActiveBoardId(remaining[0].id)
    }
  }

  function exportBoardAsImage() {
    if (!boardRef.current) return
    // 简单提醒：通过截图或打印
    const confirmed = window.confirm("将用浏览器打印功能导出当前灵感板为 PDF。继续？")
    if (confirmed) window.print()
  }

  return (
    <div className="moodboard-view">
      {/* 顶部工具栏 */}
      <div className="moodboard-toolbar">
        <div className="moodboard-tabs">
          {boards.map((board) => (
            <div key={board.id} className={`moodboard-tab ${board.id === activeBoardId ? "active" : ""}`}>
              <button onClick={() => setActiveBoardId(board.id)} title={board.name}>
                <Layers size={15} />
                {board.name}
                <small>({board.items.length})</small>
              </button>
              {boards.length > 1 && (
                <button className="tab-delete" onClick={() => deleteBoard(board.id)} title="删除此板">
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
          <button className="moodboard-tab new" onClick={() => setShowNewBoard(true)} title="新建灵感板">
            <Plus size={15} />
          </button>
        </div>

        <div className="moodboard-actions">
          <label className="secondary-btn compact-btn">
            <ImagePlus size={15} /> 上传参考图
            <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: "none" }} />
          </label>
          <button className="secondary-btn compact-btn" onClick={() => setShowLookPicker(true)}>
            <Plus size={15} /> 添加出款图
          </button>
          <button className="secondary-btn compact-btn" onClick={exportBoardAsImage}>
            <Download size={15} /> 导出
          </button>
        </div>
      </div>

      {/* 新建看板弹窗 */}
      {showNewBoard && (
        <div className="moodboard-overlay" onClick={() => setShowNewBoard(false)}>
          <div className="moodboard-modal" onClick={(e) => e.stopPropagation()}>
            <h3>新建灵感板</h3>
            <input
              type="text"
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              placeholder="输入看板名称"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && createBoard()}
            />
            <div className="moodboard-modal-actions">
              <button className="secondary-btn compact-btn" onClick={() => setShowNewBoard(false)}>取消</button>
              <button className="primary-btn compact-btn" onClick={createBoard} disabled={!newBoardName.trim()}>创建</button>
            </div>
          </div>
        </div>
      )}

      {/* 添加出款图弹窗 */}
      {showLookPicker && (
        <div className="moodboard-overlay" onClick={() => setShowLookPicker(false)}>
          <div className="moodboard-modal wide" onClick={(e) => e.stopPropagation()}>
            <h3>选择要添加的出款图</h3>
            <div className="moodboard-look-grid">
              {availableLooks.length === 0 ? (
                <p className="muted">暂无已生成的款式图，请先在「工作台」生成一些款式。</p>
              ) : (
                availableLooks.map((look) => (
                  <button key={look.id} className="moodboard-look-item" onClick={() => addLookToBoard(look.id)}>
                    <img src={look.image} alt={look.caption} />
                    <span>{look.caption}</span>
                  </button>
                ))
              )}
            </div>
            <div className="moodboard-modal-actions">
              <button className="secondary-btn compact-btn" onClick={() => setShowLookPicker(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* 看板画布 */}
      <div
        className="moodboard-canvas"
        ref={boardRef}
        style={{ minHeight: `${boardSize.h}px` }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        {activeBoard.items.length === 0 ? (
          <div className="moodboard-empty">
            <Move size={40} />
            <h3>{activeBoard.name} 还是空的</h3>
            <p>点击上方「添加出款图」或「上传参考图」开始收集灵感</p>
            <p className="muted">所有图片可以在看板上自由拖拽排列</p>
          </div>
        ) : (
          activeBoard.items.map((item) => (
            <div
              key={item.id}
              className={`moodboard-item ${draggingItem === item.id ? "dragging" : ""}`}
              style={{
                left: item.x,
                top: item.y,
                width: item.w,
              }}
            >
              <div className="moodboard-item-handle" onMouseDown={(e) => startDrag(item.id, e)}>
                <GripHorizontal size={14} />
              </div>
              <div className="moodboard-item-image">
                <img src={item.image} alt={item.caption} draggable={false} />
                <button className="moodboard-item-delete" onClick={() => deleteItem(item.id)} title="移除">
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="moodboard-item-caption">
                {editingCaption === item.id ? (
                  <input
                    type="text"
                    value={captionText}
                    onChange={(e) => setCaptionText(e.target.value)}
                    onBlur={() => {
                      updateCaption(item.id, captionText)
                      setEditingCaption(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        updateCaption(item.id, captionText)
                        setEditingCaption(null)
                      }
                      if (e.key === "Escape") setEditingCaption(null)
                    }}
                    autoFocus
                  />
                ) : (
                  <span
                    onClick={() => {
                      setEditingCaption(item.id)
                      setCaptionText(item.caption)
                    }}
                    title="点击编辑标注"
                  >
                    {item.caption || "点击添加标注"}
                  </span>
                )}
                <small className="source-tag">{item.source}</small>
                <div className="asset-palette" aria-label="提取主色">
                  {item.palette.map((color) => (
                    <span key={color} style={{ backgroundColor: color }} title={color} />
                  ))}
                </div>
                <div className="asset-tags" aria-label="自动标签">
                  {Object.entries(item.tags).map(([key, value]) => (
                    <span key={key}>{tagLabel(key)}：{value}</span>
                  ))}
                </div>
                <textarea
                  value={item.note}
                  onChange={(e) => updateItemNote(item.id, e.target.value)}
                  placeholder="图片备注"
                  rows={2}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function generateId() {
  return `mb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function normalizeBoard(board: MoodBoard): MoodBoard {
  return {
    ...board,
    items: board.items.map((item) => ({
      ...item,
      tags: item.tags ?? autoTagAsset(item.caption, item.source, []),
      palette: item.palette ?? [],
      note: item.note ?? "",
    })),
  }
}

function autoTagAsset(text: string, source: string, customers: string[], palette: string[] = []): InspirationTags {
  const lower = `${text} ${source}`.toLowerCase()
  const match = (rules: Array<[RegExp, string]>, fallback: string) => rules.find(([rule]) => rule.test(lower))?.[1] ?? fallback
  const customer = customers.find((name) => lower.includes(name.toLowerCase())) ?? "通用客户"
  return {
    category: match([
      [/jacket|夹克|外套|coat|parka|风衣|softshell|软壳|羽绒/, "外套"],
      [/pants|trouser|裤|shorts/, "裤装"],
      [/dress|skirt|裙/, "裙装"],
      [/knit|sweater|针织|套头/, "针织"],
      [/hoodie|sweatshirt|卫衣/, "卫衣"],
    ], "参考图"),
    silhouette: match([
      [/oversize|宽松|落肩|箱型/, "宽松箱型"],
      [/slim|修身|收腰/, "合体修身"],
      [/a-line|a字|伞型/, "A字廓形"],
      [/straight|直筒/, "直身廓形"],
    ], "常规廓形"),
    colorFamily: palette[0] ? colorFamilyFromHex(palette[0]) : match([
      [/black|黑|墨/, "黑色系"],
      [/grey|gray|灰|燕麦/, "灰色系"],
      [/brown|咖|棕|camel|卡其/, "大地色"],
      [/green|绿|olive/, "绿色系"],
      [/blue|蓝|navy/, "蓝色系"],
      [/white|ivory|cream|白|米/, "浅色系"],
    ], "待提取"),
    fabric: match([
      [/denim|牛仔/, "牛仔"],
      [/knit|针织|sweater/, "针织"],
      [/wool|羊毛|呢/, "羊毛混纺"],
      [/nylon|尼龙|softshell|软壳/, "尼龙功能面料"],
      [/cotton|棉|canvas|帆布/, "棉/帆布"],
      [/down|羽绒/, "羽绒"],
    ], "待确认面料"),
    craft: match([
      [/quilt|绗|压线/, "绗缝"],
      [/drawstring|抽绳/, "抽绳"],
      [/zip|拉链/, "拉链"],
      [/rib|罗纹/, "罗纹"],
      [/seam|拼接|patchwork/, "拼接"],
    ], "常规工艺"),
    season: match([
      [/aw|fw|fall|winter|秋冬|羽绒|羊毛|呢/, "秋冬"],
      [/ss|spring|summer|春夏|亚麻|短袖/, "春夏"],
    ], "跨季"),
    customer,
  }
}

async function extractPalette(src: string): Promise<string[]> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas")
        const size = 72
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext("2d")
        if (!ctx) return resolve([])
        ctx.drawImage(image, 0, 0, size, size)
        const data = ctx.getImageData(0, 0, size, size).data
        const buckets = new Map<string, number>()
        for (let i = 0; i < data.length; i += 16) {
          const alpha = data[i + 3]
          if (alpha < 180) continue
          const r = Math.round(data[i] / 32) * 32
          const g = Math.round(data[i + 1] / 32) * 32
          const b = Math.round(data[i + 2] / 32) * 32
          if (r > 235 && g > 235 && b > 235) continue
          const hex = rgbToHex(Math.min(r, 255), Math.min(g, 255), Math.min(b, 255))
          buckets.set(hex, (buckets.get(hex) ?? 0) + 1)
        }
        resolve([...buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([hex]) => hex))
      } catch {
        resolve([])
      }
    }
    image.onerror = () => resolve([])
    image.src = src
  })
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`
}

function colorFamilyFromHex(hex: string) {
  const value = hex.replace("#", "")
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  if (Math.max(r, g, b) < 70) return "深色系"
  if (Math.min(r, g, b) > 185) return "浅色系"
  if (r > g + 25 && r > b + 25) return "红棕色系"
  if (g > r + 18 && g > b + 18) return "绿色系"
  if (b > r + 18 && b > g + 18) return "蓝色系"
  if (r > 120 && g > 95 && b < 105) return "大地色"
  return "中性色"
}

function tagLabel(key: string) {
  const labels: Record<string, string> = {
    category: "品类",
    silhouette: "廓形",
    colorFamily: "色系",
    fabric: "面料",
    craft: "工艺",
    season: "季节",
    customer: "客户",
  }
  return labels[key] ?? key
}
