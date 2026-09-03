import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Escape HTML special characters to prevent XSS / HTML injection in templates.
 */
export function escapeHtml(unsafe: unknown): string {
  if (unsafe === null || unsafe === undefined) return "";
  const str = String(unsafe);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Sanitize header values to prevent CRLF injection and HTTP response splitting.
 * Strips \r, \n, \0, and control characters (0x00-0x1F, 0x7F).
 */
export function sanitizeHeaderValue(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  const str = String(value);
  // Remove \r, \n, null bytes, and all ASCII control characters
  const cleaned = str.replace(/[\r\n\x00-\x1F\x7F]/g, "").trim();
  return cleaned || fallback;
}

/**
 * Open-redirect guard: Ensures a URL or path is strictly a relative path on the same origin.
 * Rejects:
 *  - external URLs (http://, https://, javascript:, data:)
 *  - scheme-relative URLs (//example.com)
 *  - backslash tricks (/\example.com, \example.com)
 *  - CRLF and null bytes (\r, \n, %00)
 */
export function sanitizeRedirectPath(
  rawPath: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (!rawPath || typeof rawPath !== "string") return fallback;
  const trimmed = rawPath.trim();
  if (!trimmed) return fallback;

  // Must not contain CRLF, null bytes, or backslashes
  if (/[\r\n\x00-\x1F\x7F\\]/.test(trimmed)) return fallback;

  // Must start with single / and NOT // or /\
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return fallback;
  }

  // Must not contain colon before a slash (e.g. "javascript:", "https:")
  const firstSlash = trimmed.indexOf("/");
  const firstColon = trimmed.indexOf(":");
  if (firstColon !== -1 && firstColon < firstSlash) {
    return fallback;
  }

  return trimmed;
}

/**
 * Timing-safe string comparison to protect against cryptographic timing side-channel attacks.
 * Compares two strings in constant time regardless of where mismatches occur.
 */
export function timingSafeCompare(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }

  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);

  // If lengths differ, we still perform comparison against dummy buffer to mitigate timing variance
  const maxLen = Math.max(bufA.length, bufB.length);
  let mismatch = bufA.length === bufB.length ? 0 : 1;

  for (let i = 0; i < maxLen; i++) {
    const byteA = i < bufA.length ? bufA[i] : 0;
    const byteB = i < bufB.length ? bufB[i] : 0;
    mismatch |= byteA ^ byteB;
  }

  return mismatch === 0;
}
