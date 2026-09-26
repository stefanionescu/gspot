// The literal values commands/doctor reads: names, patterns, limits, and tables.
import type { ChangeKey } from '#cli/types/commands/doctor.ts';

export const DOCTOR_LABEL_WIDTH = 9;
export const VERSION_GAP = 4;
export const PATH_WIDTH = 40;
export const NAME_WIDTH = 34;
export const NOTE_WIDTH = 30;
export const PATHS_SHOWN = 4;
export const PARTIAL_SHOWN = 8;
export const CHANGE_SECTIONS: { key: ChangeKey; title: string }[] = [
    { key: 'detectedNotSelected', title: 'detected, not selected' },
    { key: 'recommendedNotSelected', title: 'recommended, not selected' },
    { key: 'configurationNotOwned', title: 'configuration not owned' },
    { key: 'changedOutsideGspot', title: 'changed outside gspot' },
];
export const CHANGE_HEAD_BYTES = 600;
