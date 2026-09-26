// The literal values commands/init reads: names, patterns, limits, and tables.
import type { InitAnswers } from '#cli/types/commands/init.ts';

export const DETECTION_LABEL_WIDTH = 13;
export const NO_CONFIGURATIONS = 'none';
export const SCHEMA_LINE = '#:schema https://gspot.dev/schema/gspot.schema.json';
export const PROFILE_HEAD = new Set(['version', 'profile', 'selection', 'configurations']);
export const HOOK_CHOICES: { value: InitAnswers['hooks']; label: string }[] = [
    { value: 'gspot', label: 'gspot installs hooks in the Git-resolved directory' },
    { value: 'lefthook', label: 'a block in lefthook.yml' },
    { value: 'husky', label: 'lines in .husky/' },
    { value: 'pre-commit', label: 'a local hook in .pre-commit-config.yaml' },
    { value: 'simple-git-hooks', label: 'commands in package.json simple-git-hooks' },
    { value: 'none', label: 'no hooks' },
];
export const CI_CHOICES: { value: InitAnswers['ci']; label: string }[] = [
    { value: 'github', label: '.github/workflows/gspot.yml' },
    { value: 'gitlab', label: '.gitlab/ci/gspot.yml (include from .gitlab-ci.yml)' },
    { value: 'none', label: 'no workflow' },
];
export const PROJECT_SUFFIX = '.xcodeproj';
export const SCHEME_SUFFIX = '.xcscheme';
export const PERIPHERY_FILE = '.periphery.yml';
export const INCOMPLETE_INSTALL_EXIT = 2;
export const COLUMN_GAP = 2;
export const CONFIGURATION_WIDTH = 16;
export const REASON_WIDTH = 12;
export const UNREADABLE_EXIT = 2;
export const ALREADY_INSTALLED =
    'This repository already has a gspot.toml. Run `gspot doctor` to see what changed since the install and the command that applies each change.\n';
export const CURSOR_RULE = '.cursor/rules/gspot.mdc';
export const HOOKS_ROW = {
    path: 'Git-resolved hooks directory',
    note: 'gspot install creates dispatchers; existing executables are retained as .gspot-original siblings; tracked hooks require hook-manager integration',
};
export const GAP_WIDTH = 3;
export const KIND_ROWS: { label: string; kind: string }[] = [
    { label: 'frameworks', kind: 'framework' },
    { label: 'platforms', kind: 'platform' },
    { label: 'databases', kind: 'database' },
    { label: 'tools', kind: 'tool' },
    { label: 'libraries', kind: 'library' },
];
