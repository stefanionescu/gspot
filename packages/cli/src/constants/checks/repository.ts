// The literal values checks/repository reads: names, patterns, limits, and tables.
import type { DriftEntry } from '#cli/types/lifecycle/lifecycle.ts';

export const KILOBYTE = 1024;
export const FILE_SIZE_KB_DEFAULT = 1024;
export const POLICY_FILE = 'gspot.toml';
export const LANGUAGE_BY_EXTENSION: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.mts': 'typescript',
    '.cts': 'typescript',
    '.js': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
};
export const CONFIG_STATEMENTS = new Set([
    'import_statement',
    'export_statement',
    'lexical_declaration',
    'type_alias_declaration',
    'comment',
    'empty_statement',
]);
export const CONFIG_LOGIC_NODES = new Set([
    'function_declaration',
    'generator_function_declaration',
    'function_expression',
    'arrow_function',
    'class_declaration',
    'if_statement',
    'for_statement',
    'for_in_statement',
    'while_statement',
    'do_statement',
    'switch_statement',
    'try_statement',
    'await_expression',
    'ternary_expression',
]);
export const CONFIG_CALL_ALLOWED = new Set(['Set', 'Map', 'RegExp']);
export const CONFIG_IMPORT_PREFIXES = ['#config/'];
export const MESSAGES: Record<DriftEntry['kind'], string> = {
    changed: 'This generated file differs from what gspot.toml renders.',
    missing: 'This generated file is missing.',
    stray: 'This file carries the gspot header but nothing in the selection renders it.',
    conflict: 'This generated file holds merge conflict markers, so no tool can read it.',
};
export const CONFLICT_HELP = 'Run gspot apply to write the file again, then gspot install to install what it records.';
export const MOVE_HELP =
    'Change policy in gspot.toml, then run gspot apply. Edited outputs are preserved; move them aside to regenerate.';
export const STRAY_HELP = 'Delete the file, or add the configuration that renders it.';
export const GSPOT_SUPPRESSION = {
    marker: 'gspot-ignore +[a-z0-9-]+/[a-z0-9-]+',
    reason: String.raw` -- (?<reason>\S.*)`,
};
