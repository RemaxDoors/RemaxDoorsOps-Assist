import { PageHeader } from "@/components/layout/PageHeader";
import { SupportReport } from "@/components/support/SupportReport";
import { APP_NAME, versionLabel } from "@/lib/version";

export const dynamic = "force-dynamic";

export const metadata = { title: `Support — ${APP_NAME}` };

/**
 * One page to go to when something goes wrong.
 *
 * The version is resolved here rather than in the client component: it comes
 * from package.json, and importing that into the browser bundle to print one
 * string is not worth it.
 */
export default function SupportPage() {
  return (
    <>
      <PageHeader
        title="Support"
        description="Check what is working, and send a fault report with the detail already filled in."
      />
      <SupportReport version={versionLabel()} />
    </>
  );
}
