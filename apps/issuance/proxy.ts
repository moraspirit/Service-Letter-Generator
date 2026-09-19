// First layer of the session guard: redirects signed-out page requests to /login
// and answers signed-out API requests with 401. It only checks the signed session
// cookie; requireAdmin() (lib/require-admin.ts) repeats the check with a database
// lookup inside every page, action and route handler, so proxy is never the only defence.
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const signedIn = Boolean(request.auth);

  if (pathname === "/login") {
    return signedIn ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }
  if (signedIn) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
});

export const config = {
  // Auth.js endpoints, framework internals and the (public) letterhead assets are excluded.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|certificate-assets).*)"],
};
