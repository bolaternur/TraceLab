export type StudyRow = Record<string, string>;

export interface StudyNumericStats {
  n: number;
  median: number | null;
  q1: number | null;
  q3: number | null;
  iqr: number | null;
  missing: number;
  invalid: number;
}

export interface StudyBinaryStats {
  n: number;
  successes: number;
  rate: number | null;
  missing: number;
  invalid: number;
}

export interface StudyConditionSummary {
  /** Accepted observations with at least one valid outcome; use metric-specific n for denominators. */
  n: number;
  numeric: Record<string, number | null>;
  binary: Record<string, number | null>;
  numericStats?: Record<string, StudyNumericStats>;
  binaryStats?: Record<string, StudyBinaryStats>;
}

export interface StudyDiagnostics {
  inputRows: number;
  discardedRows: number;
  unpairedRows: number;
  /** Row indexes are 1-based data rows, excluding the CSV header. */
  discarded: Array<{ row: number; reason: "invalid_condition" | "missing_identifier" | "ambiguous_duplicate" | "no_valid_outcome"; fields?: string[] }>;
  unpaired: Array<{ row: number; condition: "baseline" | "tracelab" }>;
  ambiguousGroups: Array<{ rows: number[] }>;
  invalidMeasurements: Array<{ row: number; field: string }>;
}

export interface StudySummary {
  rows: number;
  baseline: StudyConditionSummary;
  /** Legacy API key: contains both iznera and tracelab condition inputs. */
  tracelab: StudyConditionSummary;
  matchedPairs: number;
  pairedDelta: Record<string, number | null>;
  pairedDeltaStats?: Record<string, StudyNumericStats>;
  diagnostics?: StudyDiagnostics;
}

export interface DetailedStudyConditionSummary extends StudyConditionSummary {
  numericStats: Record<string, StudyNumericStats>;
  binaryStats: Record<string, StudyBinaryStats>;
}

export interface DetailedStudySummary extends StudySummary {
  baseline: DetailedStudyConditionSummary;
  tracelab: DetailedStudyConditionSummary;
  pairedDeltaStats: Record<string, StudyNumericStats>;
  diagnostics: StudyDiagnostics;
}

export function parseCsv(text: string): StudyRow[];
export function median(values: number[]): number | null;
export function summarizeStudy(rows: StudyRow[]): DetailedStudySummary;
export function renderMarkdown(summary: StudySummary, sourceName?: string): string;
