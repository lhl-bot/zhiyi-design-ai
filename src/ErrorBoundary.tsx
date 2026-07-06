import { Component, type ReactNode } from "react"

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  handleReset = () => {
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <h1>页面出错了</h1>
          <p className="error-message">{this.state.error.message || "未知错误"}</p>
          <details className="error-details">
            <summary>详情</summary>
            <pre>{this.state.error.stack}</pre>
          </details>
          <button className="primary-btn" onClick={this.handleReset}>重试</button>
        </div>
      )
    }
    return this.props.children
  }
}
