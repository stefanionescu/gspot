export const COLUMN_WIDTHS = { label: 9, path: 40, name: 34, note: 30 } as const;

export const VERSION_GAP = 4;

export const SUGGESTION_SECTIONS = [
    { key: 'detected', title: 'detected, not selected' },
    { key: 'suggested', title: 'suggested, not selected' },
    { key: 'undetected', title: 'selected, but no matching files found' },
    { key: 'unowned', title: 'tool files gspot does not own' },
    { key: 'lintJobs', title: 'existing lint jobs' },
] as const;

export const HEADER_BYTES = 600;

export const TOOL_STATE_COLORS = {
    ok: 'green',
    error: 'red',
    missing: 'red',
    outdated: 'red',
    newer: 'red',
    system: 'dim',
} as const;
