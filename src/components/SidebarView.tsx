import { Image, LayoutDashboard, Palette, Sparkles, Users } from "lucide-react"

type ViewType = "workbench" | "dashboard" | "comparison" | "moodboard" | "gallery"

interface SidebarViewProps {
  activeView: ViewType
  onNavigate: (view: ViewType) => void
}

export function SidebarView({ activeView, onNavigate }: SidebarViewProps) {
  const items: { key: ViewType; label: string; icon: React.ReactNode }[] = [
    { key: "workbench", label: "工作台", icon: <Sparkles size={20} /> },
    { key: "dashboard", label: "出款看板", icon: <LayoutDashboard size={20} /> },
    { key: "comparison", label: "客户对比", icon: <Users size={20} /> },
    { key: "moodboard", label: "灵感板", icon: <Palette size={20} /> },
    { key: "gallery", label: "图片库", icon: <Image size={20} /> },
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="logo">3S</div>
      </div>
      <nav className="sidebar-nav">
        {items.map((item) => (
          <button
            key={item.key}
            className={`sidebar-item ${activeView === item.key ? "active" : ""}`}
            onClick={() => onNavigate(item.key)}
            title={item.label}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  )
}
