import { NextResponse, type NextRequest } from "next/server";

/**
 * Chequeo optimista: si no hay cookie de sesión, redirige al login.
 * La autorización real (rol, tenant, módulos) se valida en cada layout/acción.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has("ar_session")) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/staff/:path*", "/platform/:path*"],
};
