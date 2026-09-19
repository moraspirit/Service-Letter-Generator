// Rate limit in front of /verify/*: runs before the page, so a blocked request never touches MySQL.
import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit, clientIp, getLimiter } from "@/lib/rate-limit";

const TOO_MANY = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Too many requests</title></head><body style="font-family:system-ui,sans-serif;max-width:28rem;margin:4rem auto;padding:0 1rem"><h1>Too many requests</h1><p>Please try again in a minute.</p></body></html>`;

export default async function proxy(request: NextRequest) {
  const result = await checkRateLimit(getLimiter(), clientIp(request.headers));
  if (!result.blocked) return NextResponse.next();

  return new NextResponse(TOO_MANY, {
    status: 429,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Retry-After": String(result.retryAfterSeconds),
      "Cache-Control": "no-store",
    },
  });
}

export const config = { matcher: ["/verify/:path*"] };
