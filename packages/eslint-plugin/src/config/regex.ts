import type { JSONSchema4 } from '@typescript-eslint/utils/json-schema';

// max-regex-complexity rule
export const CHOICE_BASE = 2;
export const DEFAULT_REGEX_COMPLEXITY = 20;
export const LOOKAROUND_KINDS: ReadonlySet<string> = new Set(['lookahead', 'lookbehind']);
export const REGEX_COMPLEXITY_OPTIONS_SCHEMA = {
    type: 'object',
    properties: {
        threshold: {
            description: 'The highest complexity a regular expression may have.',
            type: 'integer',
            minimum: 0,
        },
    },
    additionalProperties: false,
} satisfies JSONSchema4;

// no-ambiguous-anchors rule
export const ANCHOR_KINDS: ReadonlySet<string> = new Set(['start', 'end']);
export const ANCHOR_PAIR = 2;

// no-lazy-before-optional rule
export const ENDING_PAIR = 2;

// no-stateful-regex rule
export const DISTINCT_SUBJECTS = 2;
export const EMPTY_STRING_TEXTS: ReadonlySet<string> = new Set(["''", '""']);
export const STATEFUL_REGEX_METHODS: ReadonlySet<string | null> = new Set(['exec', 'test']);

// no-string-regex-pattern rule
export const STRING_PATTERN_METHODS: ReadonlySet<string | null> = new Set(['match', 'matchAll', 'search']);

// no-unknown-regex-group rule
export const GROUPS_PROPERTY = 'groups';
export const INDICES_PROPERTY = 'indices';
export const MATCH_METHODS: ReadonlySet<string | null> = new Set(['match', 'matchAll']);

// regex construction
export const REGEXP_CONSTRUCTOR = 'RegExp';

// regex methods
export const EXEC_METHOD = 'exec';
