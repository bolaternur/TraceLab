export type StudyRow = Record<string, string>;

export interface StudyConditionSummary {
  n: number;
  numeric: Record<string, number | null>;
  binary: Record<string, number | null>;
}

export interface StudySummary {
  rows: number;
  baseline: StudyConditionSummary;
  tracelab: StudyConditionSummary;
  matchedPairs: number;
  pairedDelta: Record<string, number | null>;
}

export function parseCsv(text: string): StudyRow[];
export function median(values: number[]): number | null;
export function summarizeStudy(rows: StudyRow[]): StudySummary;
export function renderMarkdown(summary: StudySummary, sourceName?: string): string;
