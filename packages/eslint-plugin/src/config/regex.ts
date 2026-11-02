import type { JSONSchema4 } from '@typescript-eslint/utils/json-schema';

export const STRING_PATTERN_METHODS: ReadonlySet<string> = new Set(['match', 'matchAll', 'search']);

export const REGEXP_CONSTRUCTOR = 'RegExp';

export const MATCH_METHODS: ReadonlySet<string | null> = new Set(['match', 'matchAll']);

export const EXEC_METHOD = 'exec';

export const GROUPS_PROPERTY = 'groups';

export const INDICES_PROPERTY = 'indices';

export const STATEFUL_REGEX_METHODS: ReadonlySet<string | null> = new Set(['exec', 'test']);

export const EMPTY_STRING_TEXTS: ReadonlySet<string> = new Set(["''", '""']);

export const ANCHOR_KINDS: ReadonlySet<string> = new Set(['start', 'end']);

export const LOOKAROUND_KINDS: ReadonlySet<string> = new Set(['lookahead', 'lookbehind']);

export const CHOICE_BASE = 2;

export const DEFAULT_REGEX_COMPLEXITY = 20;

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

export const ANCHOR_PAIR = 2;

export const ENDING_PAIR = 2;

export const DISTINCT_SUBJECTS = 2;
