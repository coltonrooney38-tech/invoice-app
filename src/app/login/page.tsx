import { Suspense } from "react";
import { BUSINESS } from "@/invoice/business";
import { login } from "./actions";

type SearchParams = Promise<{ error?: string }>;

// searchParams is only known at request time, so with cacheComponents it is
// read inside a Suspense boundary instead of at the top of the page.
async function WrongPassword({ searchParams }: { searchParams: SearchParams }) {
  const { error } = await searchParams;
  return error ? <p className="text-sm text-[var(--danger)]">Wrong password.</p> : null;
}

export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm items-center px-4">
      <form action={login} className="card w-full space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Invoices</h1>
          <p className="text-sm text-[var(--muted)]">{BUSINESS.name}</p>
        </div>
        <label className="field">
          <span>Password</span>
          <input type="password" name="password" autoFocus required autoComplete="current-password" />
        </label>
        <Suspense fallback={null}>
          <WrongPassword searchParams={searchParams} />
        </Suspense>
        <button type="submit" className="btn-primary w-full">Sign in</button>
      </form>
    </main>
  );
}
