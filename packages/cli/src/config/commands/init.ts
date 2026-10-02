// The literal values commands/init reads: names, patterns, limits, and tables.
import type { InitAnswers } from '#cli/types/commands/init.ts';

export const DETECTION_LABEL_WIDTH = 13;
export const NO_KITS = 'none';
export const SCHEMA_LINE = '#:schema https://gspot.dev/schema/gspot.schema.json';
export const PROFILE_HEAD = new Set(['profile', 'selection', 'kits']);
export const HOOK_CHOICES: { value: InitAnswers['hooks']; label: string }[] = [
    { value: 'gspot', label: 'hook scripts in .gspot/hooks' },
    { value: 'none', label: 'no hooks' },
];
export const CI_CHOICES: { value: InitAnswers['ci']; label: string }[] = [
    { value: 'github', label: '.github/workflows/gspot.yml' },
    { value: 'gitlab', label: '.gitlab/ci/gspot.yml (include from .gitlab-ci.yml)' },
    { value: 'none', label: 'no workflow' },
];
export const COLUMN_GAP = 2;
export const KIT_WIDTH = 16;
export const REASON_WIDTH = 12;
export const ALREADY_INSTALLED =
    'This repository already has a gspot.toml. Run `gspot doctor` to see what changed since the install and the command that applies each change.\n';

/** The plan row of the hooks folder. */
export const HOOKS_ROW = {
    path: '.gspot/hooks',
    note: 'gspot install points core.hooksPath here; a repository that already runs hooks gets the lines to add instead',
};
export const GAP_WIDTH = 3;
export const KIND_ROWS: { label: string; kind: string }[] = [
    { label: 'frameworks', kind: 'framework' },
    { label: 'platforms', kind: 'platform' },
    { label: 'databases', kind: 'database' },
    { label: 'tools', kind: 'tool' },
    { label: 'libraries', kind: 'library' },
];

export const CI_SETUP = {
    commands: ['npm install --global "@gspothq/cli@$(cat .gspot/version)"', 'gspot install', 'gspot check'],
};
