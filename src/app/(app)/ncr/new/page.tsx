import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { DbError } from "@/components/ui/DbError";
import { PageHeader } from "@/components/layout/PageHeader";
import { NcrWizard } from "@/app/(app)/ncr/new/NcrWizard";
import { ServiceGuard } from "@/components/ui/ServiceGuard";
import { listClassifications } from "@/lib/repositories/ncr.repo";
import { listEmployees } from "@/lib/repositories/employee.repo";
import { isSimproConfigured } from "@/lib/simpro/client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Add NCR — Operation Help" };

export default async function AddNcrPage() {
  try {
    const [{ categories, codes, causes }, employees] = await Promise.all([
      listClassifications(),
      listEmployees(),
    ]);

    return (
      <>
        <PageHeader
          title="Add NCR"
          description="Raises a new non-conformance directly in M1."
          actions={
            <Link href="/ncr">
              <Button variant="secondary">Cancel</Button>
            </Link>
          }
        />
        <ServiceGuard>
          <NcrWizard
            categories={categories}
            codes={codes}
            causes={causes}
            employees={employees}
            simproConnected={isSimproConfigured()}
          />
        </ServiceGuard>
      </>
    );
  } catch (error) {
    return <DbError error={error} />;
  }
}
