import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, isValidToken } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  if (await isValidToken(request.cookies.get(AUTH_COOKIE)?.value)) {
    return NextResponse.next();
  }
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Everything except the login page and static assets.
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
