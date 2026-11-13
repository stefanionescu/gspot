import { BYTES_PER_MEGABYTE } from '#cli/config/system.ts';
import type { BashForm } from '#cli/types/parsers.ts';

// bash
export const ALL_POSITIONAL_PARAMETERS = new Set(['@', '*', '#']);
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
export const END_OF_OPTIONS = '--';
export const EXPANSION_NODES: readonly string[] = ['simple_expansion', 'expansion'];
export const FOR_HEADER_FIELDS = ['initializer', 'condition', 'update'] as const;
export const GETOPTS_COMMAND = 'getopts';
export const GLOBAL_DECLARATION_FLAG = /^-[a-zA-Z]*g/u;
export const LOCAL_DECLARATION_WORDS = new Set(['local', 'declare', 'typeset']);
export const POSITIONAL_PARAMETER = /^[1-9]\d*$/u;
export const REMOVE_FILE_COMMAND = 'rm';
export const SHIFT_COMMAND = 'shift';
export const TEMPORARY_FILE_COMMAND = 'mktemp';
export const TEMPORARY_VALUE_NODES: ReadonlySet<string> = new Set(['string', 'command_substitution']);

// bash forms and traps
export const BASH_TOKEN_FORMS: Readonly<Record<string, Readonly<Record<string, BashForm>>>> = {
    function_definition: { function: 'function-keyword' },
    declaration_command: { typeset: 'typeset' },
    file_redirect: { '&>': 'combined-redirect', '&>>': 'combined-redirect' },
    pipeline: { '|&': 'combined-pipe' },
    ERROR: { for: 'brace-for' },
};
export const DOWNLOAD_COMMANDS: ReadonlySet<string> = new Set(['curl', 'wget']);
export const ELEVATE_COMMAND = 'sudo';
export const FORWARDED_ARGUMENTS: ReadonlySet<string> = new Set(['"$@"', '"$*"']);
export const IFS_VARIABLE = 'IFS';
export const INLINE_ASSIGNMENT_NODES = ['command', 'declaration_command'] as const;
export const INTERPRETER_COMMANDS: ReadonlySet<string> = new Set(['sh', 'bash', 'dash', 'ash', 'zsh']);
export const SAVED_IFS = /\$\{?IFS\}?/u;
export const SEQUENCE_COMMAND = 'seq';
export const STRING_EXPANSION_NODES = [...EXPANSION_NODES, 'command_substitution', 'arithmetic_expansion'];
export const TRAP_COMMAND = 'trap';
export const TRAP_SOURCE_ROWS = /\n/gu;
export const TRAP_STRING_ESCAPES = /\\(["\\$\u{60}\n])|\n/gu;

// comments
export const ASTRO_EXTENSION = '.astro';
export const ASTRO_FRONT_MATTER = /^\u{FEFF}?---[\t ]*\r?\n((?:[^\n]*\n)*?)---[\t ]*(?:\r?\n|$)/u;
export const BLOCK_COMMENT_END = /\*\/\s*$/u;
export const COMMENT_NODES = ['comment', 'multiline_comment'] as const;
export const HTML_ALTERNATE_COMMENT_END = '--!>';
export const HTML_COMMENT_END = /--!?>\s*$/u;
export const MDX_COMMENT = /\{\/\*[\s\S]*?\*\/\}/gu;
export const MDX_ESM = /^(?:import|export) [\s\S]*?(?=\n[ \t]*\n|$)/gmu;
export const SCRIPT_LANGUAGE_ATTRIBUTE = /\blang\s*=\s*["'](?<language>[^"']+)["']/u;
export const SCRIPT_TAG = 'shell';
export const TSX_LANGUAGES: readonly string[] = ['jsx', 'tsx', 'mtsx'];
export const YAML_SCALAR_TOKENS: ReadonlySet<string> = new Set(['doc-mode', 'flow-error-end', 'scalar']);

// environment reads
export const COMPONENT_EXTENSION = /\.(?:vue|svelte|astro)$/u;
export const JAVASCRIPT_DEFAULT_OPERATORS: ReadonlySet<string> = new Set(['??', '||']);
export const JAVASCRIPT_ENVIRONMENT_FIELDS: ReadonlySet<string> = new Set([
    'process.env',
    'Bun.env',
    'import.meta.env',
]);
export const JAVASCRIPT_ENVIRONMENT_GETTERS: ReadonlySet<string> = new Set(['Deno.env.get']);
export const JAVASCRIPT_LITERAL_NODES: ReadonlySet<string> = new Set(['number', 'regex']);
export const JAVASCRIPT_PROPERTY_NODES: ReadonlySet<string> = new Set([
    'property_identifier',
    'shorthand_property_identifier_pattern',
]);
export const MAXIMUM_CODE_POINT = 0x10_ff_ff;
export const OS_ENVIRONMENT_MEMBERS = { environ: 'environ', getenv: 'getenv' } as const;
export const OS_MODULE = 'os';
export const PYTHON_DECLARATION_NODES = [
    'assignment',
    'for_statement',
    'function_definition',
    'class_definition',
    'parameters',
] as const;
export const PYTHON_IMPORT_NODES = new Set(['import_statement', 'import_from_statement', 'future_import_statement']);
export const PYTHON_LITERAL_NODES: ReadonlySet<string> = new Set(['string', 'integer', 'float', 'true', 'false']);
export const PYTHON_RAW_STRING_PREFIX = /^[BFTU]*R[BFRTU]*["']/iu;
export const PYTHON_SCOPE_NODES: ReadonlySet<string> = new Set(['function_definition', 'class_definition', 'lambda']);
export const PYTHON_STRING_ESCAPE = /\\(?:x([\da-f]{2})|u([\da-f]{4})|U([\da-f]{8})|([0-7]{1,3})|([\s\S]))/giu;
export const PYTHON_STRING_ESCAPES: Readonly<Record<string, string>> = {
    n: '\n',
    r: '\r',
    t: '\t',
    b: '\b',
    f: '\f',
    v: '\v',
    a: '\u{7}',
    '\\': '\\',
    "'": "'",
    '"': '"',
    '\n': '',
};
export const SWIFT_ENVIRONMENT = 'ProcessInfo.processInfo.environment';
export const VARIABLE_NAME = /^[A-Z_][A-Z0-9_]*$/u;

// grammars
export const FENCE_GRAMMARS = ['bash', 'typescript', 'tsx', 'javascript', 'python'] as const;
export const GRAMMAR_NAMES = ['typescript', 'tsx', 'javascript', 'bash', 'python', 'swift', 'html', 'css'] as const;
export const CONFIGURATION_GRAMMARS: Readonly<Record<string, ReadonlyArray<(typeof GRAMMAR_NAMES)[number]>>> = {
    bash: ['bash'],
    css: ['css'],
    'github-actions': ['bash'],
    gspot: ['html'],
    html: ['html'],
    javascript: ['javascript', 'typescript', 'tsx', 'html'],
    markdown: FENCE_GRAMMARS,
    python: ['python'],
    site: ['html'],
    swift: ['swift'],
    typescript: ['javascript', 'typescript', 'tsx', 'html'],
};
export const GRAMMARS_FOLDER = 'grammars';
export const GRAMMAR_ARCHIVE_LIMIT = 32 * BYTES_PER_MEGABYTE;
export const GRAMMAR_EXTENSIONS: Readonly<Record<string, readonly string[]>> = {
    javascript: ['.js', '.mjs', '.cjs', '.jsx'],
    typescript: ['.ts', '.mts', '.cts'],
    tsx: ['.tsx'],
    python: ['.py', '.pyi'],
    swift: ['.swift'],
    bash: ['.sh', '.bash', '.zsh', '.ksh', '.bats'],
};
export const GRAMMAR_FILE_EXTENSION = '.wasm';
export const GRAMMAR_RELEASES: Readonly<Record<(typeof GRAMMAR_NAMES)[number], { sha256: string; url: string }>> = {
    bash: {
        sha256: '8292919c88a0f7d3fb31d0cd0253ca5a9531bc1ede82b0537f2c63dd8abe6a7a',
        url: 'https://github.com/tree-sitter/tree-sitter-bash/releases/download/v0.25.1/tree-sitter-bash.wasm',
    },
    css: {
        sha256: '8a23977fe271357cce6f254ef88c9bebf3854602d8046605aef6a45c02135c59',
        url: 'https://github.com/tree-sitter/tree-sitter-css/releases/download/v0.25.0/tree-sitter-css.wasm',
    },
    html: {
        sha256: 'c48fcd82c7ea8bf943180088ba7f28c48b2bb5287874179168bf9d31e394cf85',
        url: 'https://github.com/tree-sitter/tree-sitter-html/releases/download/v0.23.2/tree-sitter-html.wasm',
    },
    javascript: {
        sha256: '5fb488d0cabb4775a594bab85682de5ad6ce83c0d6ac997a9f82dd084d571240',
        url: 'https://github.com/tree-sitter/tree-sitter-javascript/releases/download/v0.25.0/tree-sitter-javascript.wasm',
    },
    python: {
        sha256: '16108b50df4ee9a30168794252ab55e7c93bfc5765d7fa0aa3e335752c515f47',
        url: 'https://github.com/tree-sitter/tree-sitter-python/releases/download/v0.25.0/tree-sitter-python.wasm',
    },
    typescript: {
        sha256: '778025db5a8be0e70f8ccc3671e486dfeddd048c25d9e8a70c26de2e1bf6f97d',
        url: 'https://github.com/tree-sitter/tree-sitter-typescript/releases/download/v0.23.2/tree-sitter-typescript.wasm',
    },
    tsx: {
        sha256: '79e5da75ea62855a0cd67177685f0164eac87d5f630b3cbe1e0a099751ad30f8',
        url: 'https://github.com/tree-sitter/tree-sitter-typescript/releases/download/v0.23.2/tree-sitter-tsx.wasm',
    },
    swift: {
        sha256: '0258a7ef17303a8079ffe0748b3583d59656b5c3e8653fca7b6451b3e6689eb2',
        url: 'https://github.com/alex-pinkus/tree-sitter-swift/releases/download/0.7.3/tree-sitter-swift.wasm',
    },
};
export const PARSES_BETWEEN_TURNS = 50;
// V8's optimizing tier needs gigabytes of memory to compile the Swift grammar.
export const SWIFT_WASM_FLAGS = ['--no-wasm-tier-up', '--no-wasm-dynamic-tiering'] as const;
export const TAG_GRAMMARS: Readonly<Record<string, (typeof GRAMMAR_NAMES)[number]>> = {
    shell: 'bash',
    python: 'python',
};

// python
export const DOCSTRING_PREFIXES = /^[RU]*[BFT][BFRTU]*["']/iu;
export const PYTHON_EXTENSION = '.py';
export const PYTHON_FROM_STATEMENT = 'import_from_statement';
export const PYTHON_FUNCTION_NODES = ['function_definition', 'lambda'] as const;
export const PYTHON_IMPORT_STATEMENT = 'import_statement';
export const PYTHON_MODULE_SUFFIXES = ['.py', '.pyi', '/__init__.py', '/__init__.pyi'] as const;
export const RELATIVE_IMPORT = 'relative_import';

// sql
export const DOLLAR_TAG_BLOCKER = /[\p{L}\p{N}_$]/u;
export const IDENTIFIER_START = /[A-Za-z_]/u;
export const WORD_CHARACTER = /\w/u;

// swift
export const PRIVATE_SWIFT_VISIBILITIES: ReadonlySet<string> = new Set(['private', 'fileprivate']);
export const SWIFT_ATTRIBUTE_NODE = 'attribute';
export const SWIFT_CALL_NODE = 'call_expression';
export const SWIFT_EXTENSION = '.swift';
export const SWIFT_IDENTIFIER_NODE = 'identifier';
export const SWIFT_IMPORT_NODE = 'import_declaration';
export const SWIFT_IMPORT_TAG = 'swift-import:';
export const SWIFT_TAG_WORDS = /SwiftUI|UIKit|XCTest|Testing|@Test|@Suite|testTarget/u;
export const SWIFT_TEST_ATTRIBUTES: ReadonlySet<string> = new Set(['Test', 'Suite', 'Testing.Test', 'Testing.Suite']);
export const SWIFT_TEST_MODULES: ReadonlySet<string> = new Set(['XCTest', 'Testing']);
export const SWIFT_TEST_TAG = 'swift-test';
export const SWIFT_TEST_TARGET_CALLS: ReadonlySet<string> = new Set(['.testTarget', 'Target.testTarget']);
export const SWIFT_TEST_TARGET_TAG = 'swift-test-target';
export const SWIFT_TYPE_NODE = 'user_type';
