import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Private-link gate. When SITE_PASSWORD is set (e.g. in Vercel env vars), the
 * whole site requires HTTP Basic Auth — so the deployed URL is private even
 * though it's reachable. When SITE_PASSWORD is unset (local dev), no gate.
 *
 * Enter any username + the password you set as SITE_PASSWORD.
 */
export function middleware(req: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next();

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice(6));
      const provided = decoded.slice(decoded.indexOf(":") + 1);
      if (provided === password) return NextResponse.next();
    } catch {
      /* fall through to 401 */
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Private — Nasdaq dashboard"' },
  });
}

export const config = {
  // Gate everything except Next.js internals + the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
