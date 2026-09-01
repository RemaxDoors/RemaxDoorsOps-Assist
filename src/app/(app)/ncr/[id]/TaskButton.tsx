"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CreateTaskDialog, type TaskContext } from "@/components/ui/CreateTaskDialog";

/** Opens the Simpro task window for an NCR that already exists. */
export function TaskButton({ context }: { context: TaskContext }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Create Simpro task
      </Button>
      {open ? (
        <CreateTaskDialog context={context} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
