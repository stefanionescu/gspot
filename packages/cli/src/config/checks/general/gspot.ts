import type { Drift } from '#cli/types/lifecycle/apply.ts';

export const CONFLICT_HELP = 'Run gspot apply to write the file again, then gspot install to install what it records.';

export const APPLY_HELP =
    'Change policy in gspot.toml, then run gspot apply. Edited outputs are preserved; move them aside to regenerate.';

export const STRAY_HELP = 'Delete the file, or add the configuration that emits it.';

export const DRIFT_MESSAGES: Record<Drift['kind'], string> = {
    changed: 'This generated file differs from what gspot.toml emits.',
    missing: 'This generated file is missing.',
    stray: 'gspot wrote this file, and no selected configuration writes it now.',
    conflict: 'This generated file holds merge conflict markers, so no tool can read it.',
};

export const DRIFT_HELP: Record<Drift['kind'], string> = {
    changed: APPLY_HELP,
    missing: APPLY_HELP,
    stray: STRAY_HELP,
    conflict: CONFLICT_HELP,
};
