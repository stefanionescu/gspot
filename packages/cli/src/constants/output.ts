// The literal values output reads: names, patterns, limits, and tables.
import type { OutputOptions } from '#cli/types/output.ts';

export const MESSAGE_JSON_INDENT = 2;
export const LEVELS: Record<OutputOptions['verbosity'], number> = { quiet: 1, normal: 3, verbose: 4 };
export const MS_PER_SECOND = 1000;
export const SCOPE_WIDTH_MIN = 4;
export const ID_WIDTH_MIN = 8;
export const STATUS_WIDTH = 9;
export const FILES_WIDTH = 11;
export const FINDINGS_SHOWN = 200;
export const NOTE_STATUSES = new Set(['missing', 'error', 'skipped']);
export const QUIET_HIDES = new Set(['ok', 'cache']);
