import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/layout/Logo";
import { isAuthConfigured } from "@/lib/auth/entra";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sign in — Operation Help" };

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string }>;
}) {
  const { returnTo = "/dashboard", error } = await searchParams;
  if (await getSession()) redirect(returnTo);

  const configured = isAuthConfigured();
  const signInHref = `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <section className="relative hidden flex-col justify-between bg-canvas p-10 lg:flex">
        <Logo width={190} />
        <div>
          <h2 className="max-w-sm text-3xl leading-tight font-extrabold uppercase">
            Quality, jobs and parts —{" "}
            <span className="text-brand-red">one workspace</span>
          </h2>
          <p className="mt-3 max-w-sm text-sm text-ink-body">
            Operation Help reads live from M1 so the workshop, install crews and
            the office are all looking at the same numbers.
          </p>
        </div>
        <div className="brand-rule h-1 w-40" />
      </section>

      {/* Sign-in panel */}
      <section className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="lg:hidden">
            <Logo width={150} />
          </div>

          <h1 className="mt-8 text-2xl font-bold tracking-tight text-ink lg:mt-0">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Use your remax DOORS work account. Approve the prompt in Microsoft
            Authenticator to finish signing in.
          </p>

          {error ? (
            <p className="mt-5 rounded-lg border border-danger/20 bg-danger-soft px-4 py-2.5 text-[13px] text-danger">
              {error}
            </p>
          ) : null}

          {configured ? (
            <Link href={signInHref} className="mt-6 block">
              <span className="flex h-11 w-full items-center justify-center gap-2.5 rounded-sm bg-ink px-4 text-sm font-bold tracking-wide uppercase text-white transition-colors hover:bg-brand-red">
                <MicrosoftMark />
                Sign in with Microsoft
              </span>
            </Link>
          ) : (
            <div className="mt-6 rounded-lg border border-line bg-canvas px-4 py-3.5">
              <p className="text-[13px] font-semibold text-ink">
                Microsoft sign-in is not configured yet
              </p>
              <p className="mt-1 text-[13px] text-ink-muted">
                Add <code className="text-ink">AZURE_AD_TENANT_ID</code>,{" "}
                <code className="text-ink">AZURE_AD_CLIENT_ID</code>,{" "}
                <code className="text-ink">AZURE_AD_CLIENT_SECRET</code> and{" "}
                <code className="text-ink">AUTH_SECRET</code> to{" "}
                <code className="text-ink">.env.local</code>, then restart the
                dev server.
              </p>
            </div>
          )}

          <p className="mt-8 text-[12px] text-ink-muted">
            Internal tool for remax DOORS staff. Access is logged.
          </p>
        </div>
      </section>
    </main>
  );
}

function MicrosoftMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
      <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}
