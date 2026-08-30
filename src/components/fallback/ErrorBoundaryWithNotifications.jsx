import { Component } from 'react'
import { useErrorReporter } from '../../api/useNotifications'
import Error500 from './Error500'

/**
 * Error Boundary wrapper that notifies admin of caught errors
 * Usage: Wrap your app with <ErrorBoundaryWithNotifications><App /></ErrorBoundaryWithNotifications>
 */
class ErrorBoundaryWithNotifications extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    // Notify admin of the caught error via the notification hook
    // Note: Hooks cannot be called directly from class components,
    // so we use a ref to the hook's report function passed via props
    if (this.props.reportError) {
      this.props.reportError(
        error.name || 'React Error',
        error.message || 'Unknown error',
        window.location.href,
        `${error.stack}\n\nComponent Stack:\n${errorInfo.componentStack}`
      ).catch((err) => {
        console.error('Failed to report error to admin:', err)
      })
    }

    // Also log to console for development
    console.error('Error caught by ErrorBoundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return <Error500 error={this.state.error} />
    }

    return this.props.children
  }
}

/**
 * Functional wrapper that provides the reportError function to the class component
 */
export function ErrorBoundaryWithNotificationsWrapper({ children }) {
  const { report: reportError } = useErrorReporter()

  return (
    <ErrorBoundaryWithNotifications reportError={reportError}>
      {children}
    </ErrorBoundaryWithNotifications>
  )
}

export default ErrorBoundaryWithNotifications
