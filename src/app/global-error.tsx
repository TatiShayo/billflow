"use client"; // Error boundaries must be Client Components

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    // global-error must include html and body tags
    <html lang="en">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0a0f0d",
          color: "#e5e7eb",
        }}
      >
        <div style={{ textAlign: "center", padding: 32 }}>
          <h2 style={{ marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 16 }}>
            {error.digest ? `Reference: ${error.digest}` : "An unexpected error occurred."}
          </p>
          <button
            onClick={() => unstable_retry()}
            style={{
              background: "#10b981",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "10px 20px",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
