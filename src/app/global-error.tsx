"use client"; // Error boundaries must be Client Components

export default function GlobalError({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
}) {
  const handleRetry = () => {
    if (typeof reset === "function") {
      reset();
    } else if (typeof unstable_retry === "function") {
      unstable_retry();
    } else if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    // global-error must include html and body tags
    <html lang="en" className="dark">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          background: "#0a0f0d",
          color: "#e5e7eb",
          margin: 0,
          padding: 16,
          boxSizing: "border-box",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 420, padding: 32, borderRadius: 12, background: "#111a17", border: "1px solid #1c2e28" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px 0" }}>Application Error</h2>
          <p style={{ color: "#9ca3af", fontSize: 14, margin: "0 0 16px 0", lineHeight: 1.5 }}>
            {error?.message || "An unexpected error occurred in the application."}
          </p>
          {error?.digest && (
            <p style={{ color: "#6b7280", fontSize: 12, margin: "0 0 20px 0", fontFamily: "monospace" }}>
              Digest: {error.digest}
            </p>
          )}
          <button
            onClick={handleRetry}
            style={{
              background: "#10b981",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "10px 24px",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
