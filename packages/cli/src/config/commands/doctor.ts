import type { Colors } from 'picocolors/types';
import type { ToolInspection } from '#cli/types/tools/install.ts';
import type { SuggestionSection } from '#cli/types/commands/doctor.ts';

export const COLUMN_WIDTHS = { label: 9, path: 40, name: 34, note: 30 } as const;

export const VERSION_GAP = 4;

export const SUGGESTION_SECTIONS: SuggestionSection[] = [
    { key: 'detected', title: 'detected, not selected' },
    { key: 'recommended', title: 'recommended, not selected' },
    { key: 'unowned', title: 'configuration not owned' },
    { key: 'authored', title: 'existing lint jobs' },
];

export const HEADER_BYTES = 600;

export const TOOL_STATE_COLORS = {
    ok: 'green',
    error: 'red',
    missing: 'red',
    outdated: 'red',
    newer: 'red',
    host: 'dim',
} as const satisfies Record<ToolInspection['state'], keyof Colors>;
