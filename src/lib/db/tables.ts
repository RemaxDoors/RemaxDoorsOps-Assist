import "server-only";
import { sql } from "@/lib/db/client";

/**
 * Table registry â€” the app can only touch what is declared here.
 * `readable` columns may be selected/filtered, `writable` columns may be
 * inserted/updated. Anything else is rejected before a query is built.
 *
 * These are M1's own tables, so everything is registered read-only until a
 * write policy is agreed; giving a table a `writable` list is the only step
 * needed to opt it in.
 */
export type ColumnType =
  | "int"
  | "smallint"
  | "decimal"
  | "string"
  | "text"
  | "datetime"
  | "bit";

export type TableDef = {
  schema: string;
  name: string;
  primaryKey: string;
  columns: Record<string, ColumnType>;
  readable: readonly string[];
  writable: readonly string[];
};

const schema = process.env.DB_SCHEMA ?? "dbo";

export const tables = {
  /** M1 non-conformance records. */
  ncr: {
    schema,
    name: "NonConformances",
    primaryKey: "qarNonConformanceID",
    columns: {
      qarNonConformanceID: "string",
      qarJobID: "string",
      qarPartID: "string",
      qarPartShortDescription: "string",
      qarNonConformanceCategoryID: "string",
      qarNonConformanceCodeID: "string",
      qarNonConformanceCauseID: "string",
      qarCorrectiveActionComplete: "bit",
      qarCorrectiveActionDate: "datetime",
      qarCorrectiveActionText: "text",
      qarNonConformanceText: "text",
      qarQuantity: "decimal",
      qarReportedByEmployeeID: "string",
      uqarAssignedToEmployeeID: "string",
      qarCreatedBy: "string",
      qarCreatedDate: "datetime",
      // User-defined columns; see m1/M1-Setup.md. The app checks they exist
      // before writing, so it works before a DBA has added them.
      uqarSimproTaskID: "string",
      uqarSimproJobID: "string",
    },
    readable: [
      "qarNonConformanceID",
      "qarJobID",
      "qarPartID",
      "qarPartShortDescription",
      "qarNonConformanceCategoryID",
      "qarNonConformanceCodeID",
      "qarNonConformanceCauseID",
      "qarCorrectiveActionComplete",
      "qarCorrectiveActionDate",
      "qarCorrectiveActionText",
      "qarNonConformanceText",
      "qarQuantity",
      "qarReportedByEmployeeID",
      "uqarAssignedToEmployeeID",
      "qarCreatedBy",
      "qarCreatedDate",
      "uqarSimproTaskID",
      "uqarSimproJobID",
    ],
    // Opened for the Add NCR wizard. The ID itself is allocated by the
    // gateway's insertRowWithAllocatedId, not passed in by callers.
    writable: [
      "qarNonConformanceID",
      "qarJobID",
      "qarPartID",
      "qarPartShortDescription",
      "qarNonConformanceCategoryID",
      "qarNonConformanceCodeID",
      "qarNonConformanceCauseID",
      "qarCorrectiveActionComplete",
      "qarNonConformanceText",
      "qarQuantity",
      "qarReportedByEmployeeID",
      "uqarAssignedToEmployeeID",
      "qarCreatedBy",
      "qarCreatedDate",
      "uqarSimproTaskID",
      "uqarSimproJobID",
    ],
  },

  /** M1 attachments. Files are referenced by path — cmaBLOB is unused here. */
  attachment: {
    schema,
    name: "Attachments",
    primaryKey: "cmaAttachmentID",
    columns: {
      cmaAttachmentID: "string",
      cmaAttachmentTypeID: "string",
      cmaDate: "datetime",
      cmaShortDescription: "string",
      cmaFileLocation: "string",
      cmaFilename: "string",
      cmaNonConformanceID: "string",
      cmaJobID: "string",
      cmaPartID: "string",
      cmaUploadedFromWeb: "bit",
      ucmaSimproLink: "string",
      cmaCreatedBy: "string",
      cmaCreatedDate: "datetime",
    },
    readable: [
      "cmaAttachmentID",
      "cmaAttachmentTypeID",
      "cmaDate",
      "cmaShortDescription",
      "cmaFileLocation",
      "cmaFilename",
      "cmaNonConformanceID",
      "ucmaSimproLink",
      "cmaCreatedBy",
      "cmaCreatedDate",
    ],
    writable: [
      "cmaAttachmentID",
      "cmaAttachmentTypeID",
      "cmaDate",
      "cmaShortDescription",
      "cmaFileLocation",
      "cmaFilename",
      "cmaNonConformanceID",
      "cmaJobID",
      "cmaPartID",
      "cmaUploadedFromWeb",
      "ucmaSimproLink",
      "cmaCreatedBy",
      "cmaCreatedDate",
    ],
  },

  /**
   * M1's own ID allocator: one row per table holding the next number to use.
   * Writes go through it so numbers stay in step with M1 itself.
   */
  nextId: {
    schema,
    name: "NextIDs",
    primaryKey: "xanTable",
    columns: {
      xanTable: "string",
      xanNextID: "string",
    },
    readable: ["xanTable", "xanNextID"],
    writable: ["xanNextID"],
  },

  /** M1 job header — read-only, used by the job search in the NCR wizard. */
  job: {
    schema,
    name: "Jobs",
    primaryKey: "jmpJobID",
    columns: {
      jmpJobID: "string",
      jmpPartID: "string",
      jmpPartShortDescription: "string",
      jmpCustomerOrganizationID: "string",
      ujmpJobType: "string",
      jmpJobDate: "datetime",
      jmpClosed: "bit",
    },
    readable: [
      "jmpJobID",
      "jmpPartID",
      "jmpPartShortDescription",
      "jmpCustomerOrganizationID",
      "ujmpJobType",
      "jmpJobDate",
      "jmpClosed",
    ],
    writable: [],
  },

  /** Staff lookup for "reported by" / "assigned to". */
  employee: {
    schema,
    name: "Employees",
    primaryKey: "lmeEmployeeID",
    columns: {
      lmeEmployeeID: "string",
      lmeEmployeeName: "string",
      lmeWorkEmailAddress: "string",
      lmeTerminationDate: "datetime",
    },
    readable: [
      "lmeEmployeeID",
      "lmeEmployeeName",
      "lmeWorkEmailAddress",
      "lmeTerminationDate",
    ],
    writable: [],
  },

  ncrCategory: {
    schema,
    name: "NonConformanceCategories",
    primaryKey: "qagNonConformanceCategoryID",
    columns: {
      qagNonConformanceCategoryID: "string",
      qagDescription: "string",
    },
    readable: ["qagNonConformanceCategoryID", "qagDescription"],
    writable: [],
  },

  ncrCode: {
    schema,
    name: "NonConformanceCodes",
    primaryKey: "qacNonConformanceCodeID",
    columns: {
      qacNonConformanceCodeID: "string",
      qacDescription: "string",
      qacNonConformanceCategoryID: "string",
    },
    readable: [
      "qacNonConformanceCodeID",
      "qacDescription",
      "qacNonConformanceCategoryID",
    ],
    writable: [],
  },

  ncrCause: {
    schema,
    name: "NonConformanceCauses",
    primaryKey: "qauNonConformanceCauseID",
    columns: {
      qauNonConformanceCauseID: "string",
      qauDescription: "string",
    },
    readable: ["qauNonConformanceCauseID", "qauDescription"],
    writable: [],
  },
} as const satisfies Record<string, TableDef>;

export type TableKey = keyof typeof tables;

export function sqlTypeFor(type: ColumnType) {
  switch (type) {
    case "int":
      return sql.Int;
    case "smallint":
      return sql.SmallInt;
    case "decimal":
      return sql.Decimal(18, 4);
    case "string":
      return sql.NVarChar(400);
    case "text":
      return sql.NVarChar(sql.MAX);
    case "datetime":
      return sql.DateTime2;
    case "bit":
      return sql.Bit;
  }
}

export function qualified(def: TableDef) {
  return `[${def.schema}].[${def.name}]`;
}
