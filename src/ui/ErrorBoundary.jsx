import React from "react";

class ErrorBoundaryClass extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo,
    });
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    const { hasError, error, errorInfo } = this.state;

    if (hasError) {
      return (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "#0b1a30",
          padding: 20,
        }}>
          <div style={{
            background: "#1a2332",
            border: "2px solid #e53e3e",
            borderRadius: 14,
            padding: 40,
            maxWidth: 500,
            textAlign: "center",
            color: "#ffffff",
          }}>
            <div style={{ fontSize: 40, marginBottom: 12, color: "#e53e3e" }}>
              ⚠️
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#ffffff", margin: "0 0 10px 0" }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: 13, color: "#999999", margin: "0 0 20px 0", lineHeight: 1.6 }}>
              An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.
            </p>

            {process.env.NODE_ENV === "development" && error && (
              <details style={{
                textAlign: "left",
                fontSize: 11,
                background: "#232d3f",
                borderRadius: 9,
                padding: 12,
                marginBottom: 20,
                cursor: "pointer",
                color: "#999999",
              }}>
                <summary style={{ fontWeight: 600, marginBottom: 8, cursor: "pointer", color: "#ffffff" }}>
                  Error details (development only)
                </summary>
                <pre style={{
                  background: "#1a2332",
                  borderRadius: 6,
                  padding: 8,
                  overflow: "auto",
                  maxHeight: 150,
                  margin: "8px 0 0 0",
                  fontFamily: "JetBrains Mono, monospace",
                  color: "#e0e0e0",
                }}>
                  {error?.toString()}
                  {"\n"}
                  {errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  background: "#4CAF50",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 9,
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Refresh Page
              </button>
              <button
                onClick={() => window.location.href = "/"}
                style={{
                  background: "transparent",
                  color: "#999999",
                  border: "1px solid #444444",
                  borderRadius: 9,
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function ErrorBoundary({ children }) {
  return <ErrorBoundaryClass>{children}</ErrorBoundaryClass>;
}
