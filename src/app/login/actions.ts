"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, safeEqual, tokenFor } from "@/lib/auth";

export async function login(formData: FormData) {
  const expected = process.env.FORM_PASSWORD;
  const given = String(formData.get("password") ?? "");
  if (!expected || !safeEqual(await tokenFor(given), await tokenFor(expected))) {
    redirect("/login?error=1");
  }
  (await cookies()).set(AUTH_COOKIE, await tokenFor(expected), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/");
}
