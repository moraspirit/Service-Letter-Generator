/**
 * Best-effort client address for rate limiting. Only trustworthy behind our own
 * reverse proxy, which must overwrite X-Forwarded-For (Phase 8); direct access
 * falls back to a shared bucket rather than to a spoofable header.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headers.get("x-real-ip")?.trim() || "unknown";
  return ip.slice(0, 45);
}
