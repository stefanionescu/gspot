// The literal values commands/doctor reads: names, patterns, limits, and tables.
import type { ChangeKey } from '#cli/types/commands/commands.ts';

export const COLUMN_WIDTHS = { label: 9, path: 40, name: 34, note: 30 } as const;

export const VERSION_GAP = 4;

export const CHANGE_SECTIONS: { key: ChangeKey; title: string }[] = [
    { key: 'detected', title: 'detected, not selected' },
    { key: 'recommended', title: 'recommended, not selected' },
    { key: 'unowned', title: 'configuration not owned' },
    { key: 'authored', title: 'changed outside gspot' },
];

export const HEADER_BYTES = 600;
