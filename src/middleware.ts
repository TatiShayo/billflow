import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set({ name, value, ...options });
            supabaseResponse.cookies.set({ name, value, ...options });
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const protectedPaths = [
    "/dashboard",
    "/api/ai",
    "/api/clients",
    "/api/expenses",
    "/api/settings",
  ];

  // These are the only unauthenticated entries into /api/invoices. Both are
  // authorised by possession of an unguessable token (share token or
  // `payment_token`), which the route handlers verify themselves.
  //
  // `/api/invoices` was in `protectedPaths` wholesale, which 307-redirected
  // guests to /login before the route's own share-token branch could run —
  // making every share-link PDF dead. The route self-guards, so only the two
  // genuinely public suffixes are exempted here.
  const publicInvoicePaths = [
    /^\/api\/invoices\/[^/]+\/pdf(?:\/.*)?$/,
    /^\/api\/invoices\/[^/]+\/send(?:\/.*)?$/,
  ];

  const pathname = request.nextUrl.pathname;
  const isProtected =
    protectedPaths.some((path) => pathname.startsWith(path)) ||
    (pathname.startsWith("/api/invoices") &&
      !publicInvoicePaths.some((pattern) => pattern.test(pathname)));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
