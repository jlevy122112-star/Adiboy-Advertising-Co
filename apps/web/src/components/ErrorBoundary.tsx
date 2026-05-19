import { Component, type ReactNode, type ErrorInfo } from 'react'
import './error-boundary.css'

interface Props {
  children: ReactNode
  label?: string
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', this.props.label ?? 'panel', error, info.componentStack)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="eb-root">
        <div className="eb-icon">⚠</div>
        <p className="eb-title">{this.props.label ?? 'This panel'} encountered an error</p>
        <p className="eb-msg">{this.state.error.message}</p>
        <button className="eb-retry" onClick={this.reset}>Try again</button>
      </div>
    )
  }
}
