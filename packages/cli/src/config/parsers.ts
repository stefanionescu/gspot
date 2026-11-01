import { NODE_MODULES } from '#cli/config/system.ts';

export const GSPOT_FOLDER = '.gspot';

export const PARSES_BETWEEN_TURNS = 50;

export const PBXPROJ_FILE = 'project.pbxproj';

export const SWIFT_EXTENSION = '.swift';

export const PBXPROJ_SUFFIX = `.xcodeproj/${PBXPROJ_FILE}`;

export const NPM_PACKAGE_FOLDER = `${NODE_MODULES}/`;

export const LEADING_SLASH = /^\//u;

export const ALL_POSITIONAL_PARAMETERS = new Set(['@', '*', '#']);

export const LOCAL_DECLARATION_WORDS = new Set(['local', 'declare', 'typeset']);

export const POSITIONAL_PARAMETER = /^[1-9]\d*$/u;

export const SHIFT_COMMAND = 'shift';

export const GETOPTS_COMMAND = 'getopts';

export const TEMPORARY_VALUE_NODES: ReadonlySet<string> = new Set(['string', 'command_substitution']);

export const TEMPORARY_FILE_COMMAND = 'mktemp';

export const END_OF_OPTIONS = '--';

export const REMOVE_COMMAND = 'rm';

export const BASH_BRANCH_NODES: readonly string[] = [
    'if_statement',
    'elif_clause',
    'case_item',
    'while_statement',
    'for_statement',
    'c_style_for_statement',
];

export const BASH_COMPOUND_NODES: readonly string[] = [
    'if_statement',
    'while_statement',
    'for_statement',
    'c_style_for_statement',
    'case_statement',
];

export const FOR_HEADER_FIELDS = ['initializer', 'condition', 'update'] as const;

export const EXPANSION_NODES: readonly string[] = ['simple_expansion', 'expansion'];

export const NOT_LINE_BREAK = /[^\r\n]/gu;

export const YAML_SCALAR_TOKENS: ReadonlySet<string> = new Set(['doc-mode', 'flow-error-end', 'scalar']);

export const HTML_ALTERNATE_COMMENT_END = '--!>';

export const COMMENT_NODES = ['comment', 'multiline_comment'] as const;

export const BLOCK_COMMENT_END = /\*\/\s*$/u;

export const HTML_COMMENT_END = /--!?>\s*$/u;

export const ASTRO_FRONT_MATTER = /^\u{FEFF}?---[\t ]*\r?\n((?:[^\n]*\n)*?)---[\t ]*(?:\r?\n|$)/u;

export const ASTRO_EXTENSION = '.astro';

export const TSX_LANGUAGES: readonly string[] = ['jsx', 'tsx', 'mtsx'];

export const MDX_ESM = /^(?:import|export) [\s\S]*?(?=\n[ \t]*\n|$)/gmu;

export const MDX_COMMENT = /\{\/\*[\s\S]*?\*\/\}/gu;

export const JAVASCRIPT_ENVIRONMENT_FIELDS: ReadonlySet<string> = new Set([
    'process.env',
    'Bun.env',
    'import.meta.env',
]);

export const JAVASCRIPT_ENVIRONMENT_GETTERS: ReadonlySet<string> = new Set(['Deno.env.get']);

export const OS_ENVIRONMENT_MEMBERS = { environ: 'environ', getenv: 'getenv' } as const;

export const PYTHON_IMPORT_NODES = new Set(['import_statement', 'import_from_statement', 'future_import_statement']);

export const PYTHON_SCOPE_NODES: ReadonlySet<string> = new Set(['function_definition', 'class_definition', 'lambda']);

export const OS_MODULE = 'os';

export const SWIFT_ENVIRONMENT = 'ProcessInfo.processInfo.environment';

export const VARIABLE_NAME = /^[A-Z_][A-Z0-9_]*$/u;

export const PYTHON_STRING_ESCAPE = /\\(?:x([\da-f]{2})|u([\da-f]{4})|U([\da-f]{8})|([0-7]{1,3})|([\s\S]))/giu;

export const PYTHON_STRING_ESCAPES: Readonly<Record<string, string>> = {
    n: '\n',
    r: '\r',
    t: '\t',
    b: '\b',
    f: '\f',
    v: '\v',
    a: '\u0007',
    '\\': '\\',
    "'": "'",
    '"': '"',
    '\n': '',
};

export const COMPONENT_EXTENSION = /\.(?:vue|svelte|astro)$/u;

export const COMPONENT_SCRIPT = /<script(?<attributes>[^>]*)>(?<body>[\s\S]*?)<\/script\s*>/giu;

export const SCRIPT_LANGUAGE = /\blang\s*=\s*["'](?<language>[^"']+)["']/iu;

export const MAXIMUM_CODE_POINT = 0x10_ff_ff;

export const GRAMMAR_NAMES = ['typescript', 'tsx', 'javascript', 'bash', 'python', 'swift', 'html', 'css'] as const;

export const GRAMMAR_CONFIGURATIONS: ReadonlySet<string> = new Set([
    'bash',
    'swift',
    'python',
    'javascript',
    'typescript',
] satisfies readonly (typeof GRAMMAR_NAMES)[number][]);

export const GRAMMAR_EXTENSIONS: Readonly<Record<string, readonly string[]>> = {
    javascript: ['.js', '.mjs', '.cjs', '.jsx'],
    typescript: ['.ts', '.mts', '.cts'],
    tsx: ['.tsx'],
    python: ['.py', '.pyi'],
    swift: ['.swift'],
    bash: ['.sh', '.bash', '.zsh', '.ksh', '.bats'],
};

export const GRAMMAR_FILE_EXTENSION = '.wasm';

export const GRAMMARS_FOLDER = 'grammars';

export const PYTHON_EXTENSION = '.py';

export const PYTHON_FUNCTION_NODES = ['function_definition', 'lambda'] as const;

export const DOCSTRING_PREFIXES = /^[RU]*[BFT][BFRTU]*["']/iu;

export const FROZEN_ALL = 'all';

export const FROZEN_NONE = 'none';

export const MIGRATION_VERSION = /^V?(?<version>\d+(?:[._]\d+)*)/u;

export const IDENTIFIER_START = /[A-Za-z_]/u;

export const WORD_CHARACTER = /\w/u;

export const DOLLAR_TAG_BLOCKER = /[\p{L}\p{N}_$]/u;

export const PRISMA_MIGRATION_FILE = 'migration.sql';

export const SWIFT_ATTRIBUTE_NODE = 'attribute';

export const SWIFT_TEST_MODULES: ReadonlySet<string> = new Set(['XCTest', 'Testing']);

export const SWIFT_TYPE_NODE = 'user_type';

export const SWIFT_TEST_ATTRIBUTES: ReadonlySet<string> = new Set(['Test', 'Suite', 'Testing.Test', 'Testing.Suite']);

export const SWIFT_CALL_NODE = 'call_expression';

export const SWIFT_TEST_TARGET_CALLS: ReadonlySet<string> = new Set(['.testTarget', 'Target.testTarget']);

export const SWIFT_IMPORT_TAG = 'swift-import:';

export const SWIFT_TEST_TAG = 'swift-test';

export const SWIFT_TEST_TARGET_TAG = 'swift-test-target';

export const SWIFT_IDENTIFIER_NODE = 'identifier';

export const SWIFT_IMPORT_NODE = 'import_declaration';

export const FORWARDED_ARGUMENTS: ReadonlySet<string> = new Set(['"$@"', '"$*"']);

export const TRAP_COMMAND = 'trap';

export const TRAP_EXPANSION_NODES = [...EXPANSION_NODES, 'command_substitution', 'arithmetic_expansion'];

export const TRAP_STRING_ESCAPES = /\\(["\\$\u{60}\n])|\n/gu;

export const TRAP_SOURCE_ROWS = /\n/gu;

export const MESSAGE_END = /[.:]$/u;

export const JSONC_OPTIONS = { allowTrailingComma: true } as const;

export const LEADING_NEWLINE = /^\r?\n/u;

export const MARKERS = {
    markdown: { start: '<!-- >>> gspot managed >>> -->', end: '<!-- <<< gspot managed <<< -->', gap: '\n\n' },
    hash: { start: '# >>> gspot managed >>>', end: '# <<< gspot managed <<<', gap: '\n' },
} as const;

export const BLOCK_STYLES = { 'AGENTS.md': 'markdown', '.gitattributes': 'hash' } as const;

export const NGINX_ESCAPES: Readonly<Record<string, string>> = {
    t: '\t',
    r: '\r',
    n: '\n',
    '"': '"',
    "'": "'",
    '\\': '\\',
};

export const WORD_START_STOPS = /[\s"'{};#\\]/u;

export const WORD_STOPS = /[\s{};\\]/u;

export const NGINX_PUNCTUATION = new Set([';', '{', '}']);

export const ESCAPE_LENGTH = 2;

export const QUOTED_ARGUMENT = /^(["'])([\s\S]*)\1$/u;

export const ESCAPED_CHARACTER = /\\([trn"'\\])/gu;

export const WHITESPACE_CHARACTER = /\s/u;

export const PATCH_FORMAT = { inlineTableStart: 2, bracketSpacing: false, trailingComma: false } as const;

export const MISSING_RANGE_MESSAGE = 'The TOML parser omitted a source range.';

export const TABLE_PROPERTY_FLAGS = { enumerable: true, writable: true, configurable: true } as const;

export const REQUIREMENT_NAME_END = /[\s<>=!~;[@]/u;

export const JAVASCRIPT_RUNTIMES = ['node', 'bun', 'deno'] as const;

export const RUNTIME_COMMAND = /^\s*(node|bun|deno)(?:\s|$)/u;

export const PACKAGE_JSON = 'package.json';

export const PYPROJECT_TOML = 'pyproject.toml';

export const PACKAGE_SWIFT = 'Package.swift';

export const REQUIREMENT_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/u;

export const LINE_CONTINUATION = /\\\r?\n/gu;

export const INLINE_COMMENT = /\s#/u;

export const GIT_SUFFIX = '.git';

export const PYTHON_NAME_SEPARATORS = /[._-]+/gu;

export const PIPFILE = 'Pipfile';

export const REQUIREMENTS_TXT = 'requirements.txt';

export const PYTEST_TABLE = 'tool.pytest';

export const PNPM_ROOT_IMPORTER = '.';

export const PYTHON_LOCKFILES = ['uv.lock'] as const;

export const JAVASCRIPT_LOCKFILES = [
    'bun.lock',
    'pnpm-lock.yaml',
    'yarn.lock',
    'package-lock.json',
    'npm-shrinkwrap.json',
] as const;

export const PNPM_PEER_START = '(';

export const IMPORTER_LOCKFILES = ['bun.lock', 'package-lock.json', 'pnpm-lock.yaml'] as const;

export const DEPENDENCY_SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies'] as const;

export const LOCKFILE_URL_FIELDS = ['resolved', 'tarball', 'repo', 'resolution'];

export const YARN_CLASSIC_PROPERTY = /^[\t ]+(?:version|resolved|integrity)[\t ]+"/mu;

export const YARN_CLASSIC_HEADER = '# yarn lockfile v1\n';

export const TS_EMPTY_FILES_CODE = 18_002;

export const TS_NO_FILES_CODE = 18_003;

export const TSCONFIG_FILE = 'tsconfig.json';

export const MISSING_EXTENDED_CONFIG = /^File '([^']+)' not found\.$/u;

export const SETTING_REFERENCE = /\$[({]/u;

export const PROJECT_TOKENS = [
    /\s+/y,
    /\/\*[\s\S]*?\*\//y,
    /\/\/[^\r\n]*/y,
    /"(?:\\[\s\S]|[^"\\])*"/y,
    /[{}()=;,]/y,
    /(?:\/(?![*/])|[^\s{}()=;,"/])+/y,
] as const;

export const PROJECT_PUNCTUATION: ReadonlySet<string> = new Set(['{', '}', '(', ')', '=', ';', ',']);

export const PROJECT_ESCAPE = /\\(U[\dA-Fa-f]{4}|[0-7]{1,3}|[\s\S])/gu;

export const PROJECT_ESCAPES: Readonly<Record<string, string>> = {
    a: '\u{7}',
    b: '\b',
    f: '\f',
    n: '\n',
    r: '\r',
    t: '\t',
    v: '\v',
    '"': '"',
    "'": "'",
    '\\': '\\',
    '\n': '\n',
};

export const GROUP_CYCLE_MESSAGE = 'The Xcode project contains a group cycle.';

export const MISSING_FILE_REF_MESSAGE = 'An Xcode source build entry has no file reference.';

export const MISSING_ROOT_MESSAGE = 'The Xcode project has no project root.';

export const MISSING_MAIN_GROUP_MESSAGE = 'The Xcode project has no main group.';

export const INVALID_STRING_MESSAGE = 'The Xcode project has an invalid string.';

export const TRAILING_TEXT_MESSAGE = 'The Xcode project has text after its root dictionary.';

export const OCTAL_ESCAPE_START = /^[0-7]/u;

export const SCRIPT_TAG = 'shell';

export const WHITESPACE_RUN = /\s+/gu;

export const LINE_BREAK = /\r?\n/u;

export const OCTAL_RADIX = 8;

export const HEXADECIMAL_RADIX = 16;
