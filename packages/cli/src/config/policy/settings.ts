import type { SettingSpec } from '#cli/types/configurations.ts';

export const ISO_DATE_LENGTH = 10;

// A category key has two parts after the language: naming.<language>.<category>.<setting>.
export const CATEGORY_KEY_PARTS = 2;

/** The execution deadline applies independently of selected language configurations. */
export const TOOL_DEADLINE = {
    name: 'tool_timeout_seconds',
    validation: {},
    type: 'number',
    direction: 'ceiling',
    default: 600,
    summary: 'The longest one tool run can take, in seconds. gspot stops a longer run and reports an error.',
} as const satisfies SettingSpec;

/** A tool setting key is tools.<tool>.<slot>: two segments before the slot. */
export const TOOL_KEY_DEPTH = 2;

// A problem on one of these fields belongs to the entry or key that holds the field, and reading drops that owner.
export const FIELD_PROBLEMS = new Set(['reason', 'paths', 'path', 'basePath', 'module', 'group']);

export const LANGUAGE_GROUP_TABLES = new Set(['limits', 'naming']);

export const OVERRIDING_KINDS = new Set(['framework', 'platform', 'library', 'database']);

// Rule stability from Ruff 0.16.8 rule --all --output-format json.
export const RUFF_PREVIEW_RULES = new Set([
    'AIR003',
    'AIR004',
    'AIR201',
    'AIR202',
    'AIR304',
    'AIR321',
    'ASYNC119',
    'S401',
    'S402',
    'S403',
    'S404',
    'S405',
    'S406',
    'S407',
    'S408',
    'S409',
    'S411',
    'S412',
    'S413',
    'S415',
    'B043',
    'B901',
    'B903',
    'B909',
    'PT029',
    'TID254',
    'TID255',
    'TC008',
    'E111',
    'E112',
    'E113',
    'E114',
    'E115',
    'E116',
    'E117',
    'E201',
    'E202',
    'E203',
    'E204',
    'E211',
    'E221',
    'E222',
    'E223',
    'E224',
    'E225',
    'E226',
    'E227',
    'E228',
    'E231',
    'E241',
    'E242',
    'E251',
    'E252',
    'E261',
    'E262',
    'E265',
    'E266',
    'E271',
    'E272',
    'E273',
    'E274',
    'E275',
    'E301',
    'E302',
    'E303',
    'E304',
    'E305',
    'E306',
    'E502',
    'W391',
    'DOC102',
    'DOC201',
    'DOC202',
    'DOC402',
    'DOC403',
    'DOC501',
    'DOC502',
    'D420',
    'D421',
    'PLC1901',
    'PLC2701',
    'PLC2801',
    'PLE1141',
    'PLE4703',
    'PLR0202',
    'PLR0203',
    'PLR0904',
    'PLR0914',
    'PLR0916',
    'PLR1702',
    'PLR1712',
    'PLR6104',
    'PLR6201',
    'PLR6301',
    'PLW0244',
    'PLW0717',
    'PLW1514',
    'PLW3201',
    'UP048',
    'UP051',
    'FURB101',
    'FURB103',
    'FURB113',
    'FURB118',
    'FURB131',
    'FURB140',
    'FURB142',
    'FURB145',
    'FURB148',
    'FURB152',
    'FURB154',
    'FURB156',
    'FURB180',
    'FURB189',
    'RUF027',
    'RUF029',
    'RUF031',
    'RUF038',
    'RUF039',
    'RUF045',
    'RUF047',
    'RUF050',
    'RUF052',
    'RUF054',
    'RUF055',
    'RUF056',
    'RUF065',
    'RUF066',
    'RUF067',
    'RUF069',
    'RUF070',
    'RUF071',
    'RUF072',
    'RUF073',
    'RUF074',
    'RUF075',
    'RUF077',
    'RUF105',
    'RUF106',
    'RUF201',
]);

export const REASON_WORDS_MIN = 2;

export const INDENT_MAX = 8;

export const PRINT_WIDTH_MIN = 40;

export const PRINT_WIDTH_MAX = 400;

export const STRUCTURED_POLICY_TABLES = new Set(['limits', 'naming', 'format', 'structure', 'architecture', 'prose']);

/** Where a test file lives: in a test folder, or named for a test runner. */
export const DEFAULT_TEST_PATTERNS = [
    '**/test/**',
    '**/tests/**',
    '**/__tests__/**',
    '**/*.test.*',
    '**/*.spec.*',
    '**/test_*.py',
    '**/*_test.py',
    '**/conftest.py',
    '**/Tests/**',
    '**/*Tests.swift',
];
