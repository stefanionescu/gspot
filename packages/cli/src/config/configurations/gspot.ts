import {
    BASE_RULES,
    ENVIRONMENT_RULES,
    IMPORT_LAYOUT_RULES,
    JAVASCRIPT_RULES,
    NODE_RULES,
    PACKAGE_JSON_RULES,
} from '#cli/config/configurations/javascript/rules.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { LOCKFILES } from '#cli/config/parsers/projects.ts';
import { GSPOT_FOLDER } from '#cli/config/system.ts';

// conflicting-configs check
export const GSPOT_RULES = {
    unmatchedPath: 'unmatched-path',
    conflictingConfig: 'conflicting-config',
    detectedConfiguration: 'detected-configuration',
    lintCommand: 'lint-command',
} as const;

// generated-files check
const REWRITE_HELP = 'Run gspot check --fix or gspot install.';
export const GENERATED_FILE_FINDINGS = {
    changed: { message: 'This generated file is out of date.', help: REWRITE_HELP },
    absent: { message: 'This generated file is absent.', help: REWRITE_HELP },
    stray: {
        message: 'gspot wrote this file, and no selected configuration writes it now.',
        help: 'Run gspot check --fix or gspot install to delete it.',
    },
} as const;
export const TOOL_LOCKFILES = new Set([
    ...LOCKFILES.map(({ file }) => `${GSPOT_FOLDER}/${file}`),
    GSPOT_PATHS.miseLockfile,
]);

// ignores
export const EVERY_CHECK = 'every check';

// suppressions check
// The help of the check tells the user to add a reason, which a tool with no accepted suppression never takes.
export const FORBIDDEN_SUPPRESSION_HELP =
    'Remove the suppression and fix the finding. gspot accepts no suppression comment of this tool, with or without a reason.';
export const REASON_ABOVE = /^(?:\/\/|\/\*|#|--|<!--)\s*reason:\s*(?<reason>\S.*)$/u;
export const SETTINGS_REASON = /\breason\s*=\s*"(?<reason>(?:[^"\\]|\\.)*)"/gu;
export const SUPPRESSION_KIND_MESSAGES = {
    all: 'This comment turns off every rule, including the size limits. Name the rules and give a reason.',
    limit: 'Split the code by its steps, or ask the user to raise the limit in gspot.toml.',
} as const;

// unmatched-paths check
export const BRACKET_HELP = String.raw` If a folder name holds ( ) [ ], escape each with a backslash in a TOML literal string, such as 'app/\(legal\)/**'.`;
export const NEGATED_PATTERN = /^!/u;
export const UNESCAPED_BRACKET = /(?<!\\)[()[\]]/u;

// weakenings check
// Only these tables hold ESLint options that apply in every scope. gspot computes the others from the settings.
export const SHIPPED_ESLINT_RULES: Readonly<Record<string, unknown>> = {
    ...BASE_RULES,
    ...JAVASCRIPT_RULES,
    ...IMPORT_LAYOUT_RULES,
    ...NODE_RULES,
    ...PACKAGE_JSON_RULES,
    ...ENVIRONMENT_RULES,
};
export const WEAKENING_RULES = {
    configuration: 'configuration',
    hooks: 'hooks',
    ignore: 'ignore',
    importRule: 'import-rule',
    level: 'level',
    ruleFiles: 'rule-files',
    ruleOptions: 'rule-options',
    setting: 'setting',
} as const;
export const WEAKENING_FIXES = {
    [WEAKENING_RULES.configuration]: 'Run `gspot remove <configuration> --reason "<why>"`, or select it again.',
    [WEAKENING_RULES.importRule]:
        'Restore the record of the base revision, or run `gspot ignore gspot/weakenings --rule import-rule --reason "<why>"`.',
    [WEAKENING_RULES.ruleOptions]:
        'Repeat each shipped key with its shipped value in the options, or run `gspot ignore gspot/weakenings --rule rule-options --reason "<why>"`.',
    [WEAKENING_RULES.setting]:
        'Run `gspot set <key> <value> --reason "<why>"`, or restore the value of the base revision.',
} as const;
export const WEAKENING_IGNORE_HELP =
    'Undo the change, or run `gspot ignore gspot/weakenings --rule {rule} --reason "<why>"`.';
