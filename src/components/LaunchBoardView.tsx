import { useMemo } from "react"
import { launchTasks } from "../data/customers"
import type { LaunchTask } from "../types"
import { Calendar, CheckCircle2, Clock, Flag, User } from "lucide-react"

const statusMeta: Record<LaunchTask["status"], { label: string; className: string }> = {
  "已完成": { label: "已完成", className: "status-done" },
  "进行中": { label: "进行中", className: "status-active" },
  "待开始": { label: "待开始", className: "status-pending" },
}

export function LaunchBoardView() {
  const progress = useMemo(() => {
    const done = launchTasks.filter((t) => t.status === "已完成").length
    const total = launchTasks.length
    const pct = Math.round((done / total) * 100)
    return { done, total, pct }
  }, [])

  const activeTask = useMemo(() => launchTasks.find((t) => t.status === "进行中"), [])

  return (
    <div className="launch-board">
      {/* 总览横幅 */}
      <section className="launch-hero">
        <div className="launch-hero-left">
          <h1>项目上线进度</h1>
          <p className="launch-subtitle">AI赋能服装定向设计 · V1.0 启动计划</p>
        </div>
        <div className="launch-hero-stats">
          <div className="launch-stat">
            <span className="launch-stat-value">{progress.done}/{progress.total}</span>
            <span className="launch-stat-label">任务完成</span>
          </div>
          <div className="launch-stat">
            <span className="launch-stat-value">{progress.pct}%</span>
            <span className="launch-stat-label">总体进度</span>
          </div>
        </div>
      </section>

      {/* 进度条 */}
      <div className="launch-progress-bar" title={`${progress.pct}% 完成`}>
        <div className="launch-progress-fill" style={{ width: `${progress.pct}%` }} />
      </div>

      {/* 当前任务高亮 */}
      {activeTask && (
        <section className="launch-active-card">
          <div className="launch-active-badge">
            <Flag size={16} /> 当前任务
          </div>
          <div className="launch-active-body">
            <span className="launch-active-date">
              <Calendar size={14} /> {activeTask.date}
            </span>
            <h3>{activeTask.title}</h3>
            <span className="launch-active-owner">
              <User size={14} /> {activeTask.owner}
            </span>
          </div>
        </section>
      )}

      {/* 任务清单 */}
      <section className="launch-list">
        <h2 className="launch-list-title">全部任务</h2>
        <div className="launch-timeline">
          {launchTasks.map((task, index) => {
            const isDone = task.status === "已完成"
            const isActive = task.status === "进行中"
            const isLast = index === launchTasks.length - 1

            return (
              <div key={index} className={`launch-task-row ${isDone ? "done" : ""} ${isActive ? "active" : ""}`}>
                {/* 时间线节点 */}
                <div className="launch-timeline-rail">
                  <div className={`launch-dot ${isDone ? "done" : isActive ? "active" : ""}`}>
                    {isDone ? <CheckCircle2 size={18} /> : <Clock size={14} />}
                  </div>
                  {!isLast && <div className={`launch-line ${isDone ? "done" : ""}`} />}
                </div>

                {/* 任务卡片 */}
                <div className="launch-task-card">
                  <div className="launch-task-head">
                    <span className="launch-task-date">
                      <Calendar size={13} /> {task.date}
                    </span>
                    <span className={`launch-task-status ${statusMeta[task.status].className}`}>
                      {statusMeta[task.status].label}
                    </span>
                  </div>
                  <p className="launch-task-title">{task.title}</p>
                  <span className="launch-task-owner">
                    <User size={13} /> {task.owner}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
