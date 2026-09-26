// The literal values commands/doctor reads: names, patterns, limits, and tables.
import type { ChangeKey } from '#cli/types/commands/doctor.ts';

export const COLUMN_WIDTHS = { label: 9, path: 40, name: 34, note: 30 } as const;
export const DISPLAY_LIMITS = { paths: 4, partial: 8 } as const;

export const VERSION_GAP = 4;

export const CHANGE_SECTIONS: { key: ChangeKey; title: string }[] = [
    { key: 'detectedNotSelected', title: 'detected, not selected' },
    { key: 'recommendedNotSelected', title: 'recommended, not selected' },
    { key: 'configurationNotOwned', title: 'configuration not owned' },
    { key: 'changedOutsideGspot', title: 'changed outside gspot' },
];

export const CHANGE_HEAD_BYTES = 600;
