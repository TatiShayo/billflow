# BillFlow — Learnings & Known Issues

## Next.js 16 Notes
- Middleware file convention is deprecated in Next.js 16 — use "proxy" instead
- Turbopack is the default bundler

## Monetary Calculations
- Using Math.round(amount * 100) / 100 pattern for all money calculations

## @react-pdf/renderer
- Must be server-only — keep in Route Handlers (route.ts), never import in client components
- Use dynamic imports to avoid bundling into client

## Issues Encountered
