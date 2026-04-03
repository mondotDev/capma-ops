import fs from "node:fs";
import { doc, getDoc, writeBatch } from "firebase/firestore";
import { resolveCliFilePath } from "@/lib/cli-paths";
import {
  inferBootstrapIssue,
  inferBootstrapWaitingOn,
  mapBootstrapLinkedEvent,
  mapBootstrapStatus
} from "@/lib/native-action-item-bootstrap";
import { loadLocalScriptEnv } from "@/lib/script-env";
import { getFirestoreDb, isFirebaseConfigured } from "@/lib/firebase";
import { initialEventInstances, initialEventPrograms, initialEventSubEvents } from "@/lib/event-instances";
import { mapActionItemToFirestoreDocument } from "@/lib/firestore-native-action-item-store";
import { nativeActionItemMutator } from "@/lib/native-action-item-mutator";
import { createActionNoteEntry, DEFAULT_OWNER, LOCAL_FALLBACK_NOTE_AUTHOR } from "@/lib/ops-utils";
import type { ActionItem } from "@/lib/sample-data";

type CsvRow = Record<string, string>;

type ImportMode = "dry-run" | "write";

type ImportableRow = {
  sourceRowLink: string;
  raw: CsvRow;
  item: ActionItem;
  docId: string;
};

type RowOutcome =
  | { kind: "accepted"; rowLink: string; docId: string; title: string }
  | { kind: "skipped"; rowLink: string | null; reason: string }
  | { kind: "failed"; rowLink: string | null; reason: string };

const ACTION_ITEMS_COLLECTION = "actionItems";
const REQUIRED_HEADERS = [
  "Task",
  "Linked Event",
  "Status",
  "Status (Auto)",
  "Due Date",
  "Notes",
  "Row_Link",
  "Vendor Deadline",
  "Print_Deadline"
] as const;

function main() {
  loadLocalScriptEnv();
  const options = parseArgs(process.argv.slice(2));
  const csvPath = resolveCliFilePath(options.filePath);
  const csvText = fs.readFileSync(csvPath, "utf8");
  const rows = parseCsv(csvText);
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  assertHeaders(headers);

  const importableRows: ImportableRow[] = [];
  const outcomes: RowOutcome[] = [];

  for (const row of rows) {
    const rowResult = mapCsvRowToImportableActionItem(row);

    if (rowResult.kind === "accepted") {
      importableRows.push(rowResult.value);
      outcomes.push({
        kind: "accepted",
        rowLink: rowResult.value.sourceRowLink,
        docId: rowResult.value.docId,
        title: rowResult.value.item.title
      });
      continue;
    }

    outcomes.push(rowResult);
  }

  const summary = {
    csvPath,
    mode: options.mode,
    totalRowsRead: rows.length,
    accepted: outcomes.filter((entry) => entry.kind === "accepted").length,
    skipped: outcomes.filter((entry) => entry.kind === "skipped").length,
    failed: outcomes.filter((entry) => entry.kind === "failed").length
  };

  if (summary.failed > 0) {
    printSummary(summary, outcomes);
    throw new Error("CSV import contains malformed required data. Fix the failed rows before writing to Firestore.");
  }

  if (options.mode === "dry-run") {
    printSummary({ ...summary, documentsWritten: 0, documentsUnchanged: 0 }, outcomes);
    return;
  }

  writeImport(importableRows, outcomes, summary).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

async function writeImport(importableRows: ImportableRow[], outcomes: RowOutcome[], summary: {
  csvPath: string;
  mode: ImportMode;
  totalRowsRead: number;
  accepted: number;
  skipped: number;
  failed: number;
}) {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured. Set the NEXT_PUBLIC_FIREBASE_* values before running the bootstrap import.");
  }

  const firestore = getFirestoreDb();

  if (!firestore) {
    throw new Error("Firestore is unavailable. The native action-item bootstrap import cannot continue.");
  }

  const batch = writeBatch(firestore);
  let documentsWritten = 0;
  let documentsUnchanged = 0;

  for (const row of importableRows) {
    const docRef = doc(firestore, ACTION_ITEMS_COLLECTION, row.docId);
    const nextDocument = mapActionItemToFirestoreDocument(row.item);
    const existingSnapshot = await getDoc(docRef);

    if (existingSnapshot.exists()) {
      const existingDocument = existingSnapshot.data();

      if (stableStringify(existingDocument) === stableStringify(nextDocument)) {
        documentsUnchanged += 1;
        continue;
      }
    }

    batch.set(docRef, nextDocument);
    documentsWritten += 1;
  }

  if (documentsWritten > 0) {
    await batch.commit();
  }

  printSummary(
    {
      ...summary,
      documentsWritten,
      documentsUnchanged
    },
    outcomes
  );
}

function parseArgs(args: string[]) {
  let filePath = "";
  let mode: ImportMode = "dry-run";

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];

    if (current === "--file") {
      filePath = args[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (current === "--write") {
      mode = "write";
      continue;
    }

    if (current === "--dry-run") {
      mode = "dry-run";
      continue;
    }
  }

  if (!filePath) {
    throw new Error("Missing required --file <path-to-csv> argument.");
  }

  return { filePath, mode };
}

function assertHeaders(headers: string[]) {
  const missing = REQUIRED_HEADERS.filter((header) => !headers.includes(header));

  if (missing.length > 0) {
    throw new Error(`CSV is missing required headers: ${missing.join(", ")}`);
  }
}

function mapCsvRowToImportableActionItem(
  row: CsvRow
):
  | { kind: "accepted"; value: ImportableRow }
  | { kind: "skipped"; rowLink: string | null; reason: string }
  | { kind: "failed"; rowLink: string | null; reason: string } {
  const title = row.Task?.trim() ?? "";
  const rowLink = row.Row_Link?.trim() ?? "";

  if (!title) {
    return { kind: "skipped", rowLink: rowLink || null, reason: "Blank Task row" };
  }

  if (!rowLink) {
    return { kind: "failed", rowLink: null, reason: `Row "${title}" is missing Row_Link.` };
  }

  const status = mapBootstrapStatus(row["Status (Auto)"]?.trim() ?? "");

  if (!status) {
    return {
      kind: "failed",
      rowLink,
      reason: `Row ${rowLink} has unsupported Status (Auto) value "${row["Status (Auto)"] ?? ""}".`
    };
  }

  const linkedEvent = row["Linked Event"]?.trim() ?? "";
  const linkedEventMapping = mapBootstrapLinkedEvent(linkedEvent);

  if (!linkedEventMapping) {
    return {
      kind: "failed",
      rowLink,
      reason: `Row ${rowLink} has unsupported Linked Event value "${linkedEvent}".`
    };
  }

  const dueDate = normalizeCsvDate(row["Due Date"]?.trim() ?? "");
  const vendorDeadline = normalizeCsvDate(row["Vendor Deadline"]?.trim() ?? "");
  const printDeadline = normalizeCsvDate(row.Print_Deadline?.trim() ?? "");
  const waitingOn = inferBootstrapWaitingOn(status, row.Notes?.trim() ?? "");
  const issue = inferBootstrapIssue(linkedEventMapping.workstream, dueDate, title);
  const noteEntries = buildImportedNoteEntries({
    notes: row.Notes?.trim() ?? "",
    vendorDeadline,
    printDeadline
  });
  const today = new Date().toISOString().slice(0, 10);

  const normalizedItem = nativeActionItemMutator.normalizeLoaded(
    [
      {
        id: getBootstrapDocumentId(rowLink),
        title,
        type: "Task",
        workstream: linkedEventMapping.workstream,
        dueDate,
        status,
        owner: DEFAULT_OWNER,
        waitingOn,
        lastUpdated: today,
        noteEntries,
        eventInstanceId: linkedEventMapping.eventInstanceId,
        operationalBucket: linkedEventMapping.operationalBucket,
        issue: issue || undefined,
        blockedBy: undefined,
        isBlocked: undefined,
        subEventId: undefined,
        archivedAt: undefined
      }
    ],
    {
      eventInstances: initialEventInstances,
      eventPrograms: initialEventPrograms,
      eventSubEvents: initialEventSubEvents
    }
  )[0];

  return {
    kind: "accepted",
    value: {
      sourceRowLink: rowLink,
      raw: row,
      item: normalizedItem,
      docId: getBootstrapDocumentId(rowLink)
    }
  };
}

function normalizeCsvDate(value: string) {
  if (!value) {
    return "";
  }

  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (!match) {
    return value.trim();
  }

  const [, month, day, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function buildImportedNoteEntries(input: {
  notes: string;
  vendorDeadline: string;
  printDeadline: string;
}) {
  const parts: string[] = [];

  if (input.notes) {
    parts.push(input.notes);
  }

  if (input.vendorDeadline) {
    parts.push(`Vendor deadline: ${input.vendorDeadline}`);
  }

  if (input.printDeadline) {
    parts.push(`Print deadline: ${input.printDeadline}`);
  }

  const entry = createActionNoteEntry(parts.join("\n"), {
    author: LOCAL_FALLBACK_NOTE_AUTHOR
  });

  return entry ? [entry] : [];
}

function getBootstrapDocumentId(rowLink: string) {
  return `kanban-row-${rowLink}`;
}

function printSummary(
  summary: {
    csvPath: string;
    mode: ImportMode;
    totalRowsRead: number;
    accepted: number;
    skipped: number;
    failed: number;
    documentsWritten?: number;
    documentsUnchanged?: number;
  },
  outcomes: RowOutcome[]
) {
  console.log("Native action-item CSV bootstrap summary");
  console.log(JSON.stringify(summary, null, 2));

  const skipped = outcomes.filter((entry) => entry.kind === "skipped");
  const failed = outcomes.filter((entry) => entry.kind === "failed");

  if (skipped.length > 0) {
    console.log("\nSkipped rows:");
    for (const entry of skipped.slice(0, 20)) {
      console.log(`- ${entry.rowLink ?? "no-row-link"}: ${entry.reason}`);
    }
  }

  if (failed.length > 0) {
    console.log("\nFailed rows:");
    for (const entry of failed.slice(0, 20)) {
      console.log(`- ${entry.rowLink ?? "no-row-link"}: ${entry.reason}`);
    }
  }
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortObject(value));
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortObject(entry)])
    );
  }

  return value;
}

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        currentCell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }

      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  const headers = normalizeHeaders(rows[0] ?? []);
  const records: CsvRow[] = [];

  for (const row of rows.slice(1)) {
    if (row.every((entry) => entry.trim().length === 0)) {
      continue;
    }

    const record: CsvRow = {};

    headers.forEach((header, index) => {
      record[header] = (row[index] ?? "").trim();
    });

    records.push(record);
  }

  return records;
}

function normalizeHeaders(headers: string[]) {
  return headers.map((header, index) => header.trim() || `__extra_${index}`);
}

main();
