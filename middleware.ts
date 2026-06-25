import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Run on everything except Next internals and static asset files.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)"],
};

// HTTP Basic Auth gate for /admin (server-only ADMIN_PASSWORD).
function adminGate(req: NextRequest): NextResponse | null {
  if (!req.nextUrl.pathname.startsWith("/admin")) return null;

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return new NextResponse("admin access is not configured", { status: 503 });
  }
  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const decoded = atob(header.slice("Basic ".length));
    const password = decoded.slice(decoded.indexOf(":") + 1);
    if (password === expected) return null; // authorized — fall through
  }
  return new NextResponse("authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="admin", charset="UTF-8"' },
  });
}

export async function middleware(req: NextRequest) {
  const blocked = adminGate(req);
  if (blocked) return blocked;

  // Refresh the Supabase session and propagate refreshed cookies.
  let response = NextResponse.next({ request: req });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          response = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );
  await supabase.auth.getUser();
  return response;
}
