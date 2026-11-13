import type { CI_PROVIDERS } from '#cli/config/settings/schema.ts';

// doctor
export const CI_FILE_SUFFIXES = {
    github: '',
    gitlab: ' (include from .gitlab-ci.yml)',
} as const satisfies Record<(typeof CI_PROVIDERS)[number], string>;
export const CI_OFF_NOTES = {
    github: 'off; gspot set ci.enabled true writes the check workflow',
    gitlab: 'off; gspot set ci.enabled true and gspot set ci.provider gitlab write the check workflow',
} as const satisfies Record<(typeof CI_PROVIDERS)[number], string>;
export const LABEL_WIDTH = 9;
export const ORIGIN_URL_SETTING = 'remote.origin.url';
export const REMOTE_URL_SCHEME = /^(?:https?|ssh):\/\//u;
export const REMOTE_URL_USER = /^[^@/]+@/u;
export const TOOL_STATE_COLORS = {
    ok: 'green',
    error: 'red',
    missing: 'red',
    outdated: 'red',
    newer: 'red',
    system: 'dim',
} as const;
export const VERSION_GAP = 4;

// explain check
export const LINT_RULE_LABELS = [
    ['description', 'What it looks for'],
    ['why', 'Why'],
    ['fix', 'What to do'],
    ['example', 'Example'],
] as const;
export const REPOSITORY_COMMAND = 'repository command';
export const RUN_IN_COPY_MESSAGE = 'Runs on a copy of the selected files in a temporary folder.';
export const SELECTED_YES_MESSAGE = 'Selected in this repository: yes';

// explain configuration
export const DETECTED_BY = 'Detected by';
export const ESLINT_FILES_MESSAGE = 'the file types of the selected ESLint plugins';
export const LANGUAGE_FILES_MESSAGE = 'every file a language configuration selects';
export const PRETTIER_FILES_MESSAGE = 'the file types of the selected Prettier plugins';
export const TEST_FILES_MESSAGE = 'the files that test_files names';
export const TOOL_PINS = 'Tools it pins';

// explain path
export const BINARY_ELIGIBLE_MESSAGE = 'binary: eligible for secrets and size checks';
export const GENERATED_ELIGIBLE_MESSAGE = 'generated: eligible for secret checks and checks for stale generated files';
export const IGNORED_FILE_MESSAGE =
    'An ignore in gspot.toml covers this file. To check it, run gspot unignore --paths <path> with the path that the ignore names.';
export const MARK_GENERATED_MESSAGE =
    'Mark generated or copied files linguist-generated or linguist-vendored in .gitattributes, or run gspot add <configuration>.';
export const MISSING_SETTINGS_MESSAGE =
    'This repository has no gspot.toml, so gspot cannot explain a file. Run gspot init.';
export const UNCHECKED_REASON = 'no selected check reads this file';
export const VENDORED_ELIGIBLE_MESSAGE = 'vendored: eligible for secrets, license, and security checks';

// explain setting
export const REASON_HELP =
    'If you set this value, give a reason: write it as { value = ..., reason = "..." }, or run gspot set with --reason.';
export const REASON_OPTION_TEXT = ' [--reason "<why>"]';

// list
export const KEY_GAP = 2;
export const LIST_ARGUMENT = '[configurations|settings]';
export const LIST_KINDS = ['configurations', 'settings'] as const;
export const NOT_SET = 'not set';
export const REASON_CONDITIONS = {
    adding: 'you add items',
    lowering: 'you lower it',
    raising: 'you raise it',
} as const;
export const REASON_HEADER = 'needs a reason when';
export const SCOPES_NAMED = 3;
export const VALUE_WIDTH = 28;
