import type { GuideSlug } from '../types/reference.ts';

const CODE_SPAN = /(?<!`)(?<delimiter>`+)(?!`)[\s\S]+?(?<!`)\k<delimiter>(?!`)/u;
const KEPT_TAG = /<\/?(?:h[2-6]|code)(?:\s[^<>]*)?>/u;

export const INLINE_CODE_SPAN = /(`[^`]+`)/u;

export const GUIDES = {
    javascript: 'languages/javascript-typescript',
    python: 'languages/python',
    css: 'languages/css',
    swift: 'languages/swift',
    security: 'checks/security',
    testing: 'checks/testing',
    dependencies: 'checks/dependencies',
    prose: 'checks/prose',
} as const;

export const DETECTION_LABELS = {
    extensions: 'file extensions',
    filenames: 'filenames',
    dependencies: 'dependencies',
    shebangs: 'script interpreters',
    runtimes: 'JavaScript runtimes',
    tags: 'files marked',
    paths: 'file paths',
    project_files: 'project files',
} as const;

export const SCHEMA_TYPE_LABELS = {
    string: 'Text',
    integer: 'Whole number',
    number: 'Number',
    boolean: '`true` or `false`',
    array: 'List',
    object: 'Table',
} as const;

export const CHECK_RUN_LABELS = {
    once: 'once for the repository',
    scope: 'once per scope',
    files: 'per file',
    history: 'once for pushed history',
} as const;

export const CHECK_NEEDS_LABELS = {
    build: 'a build of the project',
    docker: 'Docker, running',
    network: 'network access',
} as const;

export const LEVEL_ADVICE = {
    recommended: 'Choose it for an existing codebase or a first run.',
    all: 'Choose it for a new repository or one that coding agents write.',
} as const;

export const REFERENCE_PATH = '/reference/';
export const REFERENCE_FOLDERS = {
    commands: 'commands',
    settings: 'gspot-toml',
    jsonOutput: 'json-output',
    configurations: 'configurations',
    checks: 'checks',
    eslintPlugin: 'eslint-plugin',
} as const;
export const FIRST_SENTENCE = /^[\s\S]*?\.(?=\s|$)/u;
export const DOCS_SOURCE_NAME = 'gspot-docs';
export const REFERENCE_IDS_KEY = 'reference-ids';
export const PAGES_FOLDER = 'src/content/docs';
export const MARKDOWN_ESCAPES = new RegExp(`${CODE_SPAN.source}|${KEPT_TAG.source}|[<>]`, 'gu');

export const FLAGS_OUTSIDE_CODE = /```[\s\S]*?```|`[^`]*`|(?<![\w-])--[a-z][a-z-]*/gu;

export const HTML_BRACKET_ENTITIES: Readonly<Record<string, string>> = { '<': '&lt;', '>': '&gt;' };

export const SECTION_HEADING = /^## /mu;
export const LISTED_VALUES_LIMIT = 12;
export const SUPPRESSIONS_CHECK = 'gspot/suppressions';

export const MAP_KEY_NAME = '<name>';
export const ANGLE_BRACKETS = /[<>]/gu;
export const TABLE_HEADING_LEVEL = 2;
export const REASONED_VALUE_LABEL = 'a reasoned value `{ value = …, reason = "…" }`';
export const HEADING_ID_DROPPED = /[^\p{L}\p{N} _-]/gu;
export const LANGUAGE_PLACEHOLDER = '<language>';
export const CATEGORY_PLACEHOLDER = '<category>';

export const CONFIGURATION_GUIDES: Readonly<Partial<Record<string, GuideSlug>>> = {
    javascript: GUIDES.javascript,
    typescript: GUIDES.javascript,
    nextjs: GUIDES.javascript,
    'react-native': GUIDES.javascript,
    python: GUIDES.python,
    css: GUIDES.css,
    swift: GUIDES.swift,
    xcode: GUIDES.swift,
    security: GUIDES.security,
    secrets: GUIDES.security,
    jest: GUIDES.testing,
    vitest: GUIDES.testing,
    pytest: GUIDES.testing,
    dependencies: GUIDES.dependencies,
    licenses: GUIDES.dependencies,
    prose: GUIDES.prose,
    spelling: GUIDES.prose,
};

export const ENVIRONMENT_VARIABLES: readonly [name: string, meaning: string][] = [
    ['`NO_COLOR`', 'Any nonempty value turns color off.'],
];

export const LIST_FORMAT = new Intl.ListFormat('en', { type: 'conjunction' });
