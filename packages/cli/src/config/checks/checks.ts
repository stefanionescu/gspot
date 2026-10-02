// The literal values checks reads: names, patterns, limits, and tables.
import type { Drift } from '#cli/types/lifecycle/lifecycle.ts';

const CONFLICT_HELP = 'Run gspot apply to write the file again, then gspot install to install what it records.';
const MOVE_HELP =
    'Change policy in gspot.toml, then run gspot apply. Edited outputs are preserved; move them aside to regenerate.';
const STRAY_HELP = 'Delete the file, or add the configuration that renders it.';

// The strings of a TOML file, read whole: triple-quoted ones span lines, and a backslash escapes inside a
// basic string.
export const TOML_STRINGS = /"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'[^'\n]*'/u;

export const SHOWN_LINES = 3;

export const MESSAGES: Record<Drift['kind'], string> = {
    changed: 'This generated file differs from what gspot.toml renders.',
    missing: 'This generated file is missing.',
    stray: 'This file carries the gspot header but nothing in the selection renders it.',
    conflict: 'This generated file holds merge conflict markers, so no tool can read it.',
};
export const DRIFT_HELP: Record<Drift['kind'], string> = {
    changed: MOVE_HELP,
    missing: MOVE_HELP,
    stray: STRAY_HELP,
    conflict: CONFLICT_HELP,
};

/** How many header lines the contract asks for. */
export const HEADER_LINES = 4;
