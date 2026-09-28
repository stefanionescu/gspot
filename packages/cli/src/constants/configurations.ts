// The literal values configurations reads: names, patterns, limits, and tables.
import type { SettingSpec } from '#cli/types/configurations.ts';

export const MANIFEST_CONFIG_PLACEHOLDER = /\{config:([a-z0-9-]+)\}/gu;
export const MAX_EXIT_CODE = 255;
export const SENTENCE_MIN = 12;
export const SHEBANG_TAG = 'shebang:';
export const GLOB_CHARS = /[*?{]/u;
/** Strict source coverage applies independently of selected configurations and run filters. */
export const COVERAGE_STRICT = {
    name: 'coverage.strict',
    kind: 'boolean',
    direction: 'tightening',
    default: false,
    summary:
        'Fail checks when a supported source file has no enabled configured check. Message hooks do not enforce source coverage.',
} as const satisfies SettingSpec;
/** The execution deadline applies independently of selected language configurations. */
export const TOOL_DEADLINE = {
    name: 'limits.tool_seconds',
    kind: 'number',
    direction: 'ceiling',
    default: 600,
    summary: 'The longest one tool run can take, in seconds. gspot stops a longer run and reports an error.',
} as const satisfies SettingSpec;
/** Nonzero statuses documented by a checker or correction tool as source findings. */
export const LAST_EXIT_CODE = 255;
/** The Vale input mode, source grammar, and comment format for each file extension. */
// Known source grammars parse Markdown inside comments. Module extensions without a native grammar use stdin
// with the corresponding language extension. Other comment-compatible formats are mapped through [formats].
export const PROSE_GRAMMARS: Record<string, { mode: 'path' | 'stdin'; extension: string; format?: string }> = {
    '.md': { mode: 'path', extension: '.md' },
    '.mdx': { mode: 'path', extension: '.md' },
    '.ts': { mode: 'path', extension: '.ts', format: 'md' },
    '.tsx': { mode: 'path', extension: '.ts', format: 'md' },
    '.mts': { mode: 'stdin', extension: '.ts' },
    '.cts': { mode: 'stdin', extension: '.ts' },
    '.js': { mode: 'path', extension: '.js', format: 'md' },
    '.mjs': { mode: 'stdin', extension: '.js' },
    '.cjs': { mode: 'stdin', extension: '.js' },
    '.jsx': { mode: 'path', extension: '.js', format: 'md' },
    '.swift': { mode: 'path', extension: '.swift', format: 'md' },
    '.py': { mode: 'path', extension: '.py', format: 'md' },
    '.css': { mode: 'path', extension: '.css', format: 'md' },
    '.sh': { mode: 'path', extension: '.sh', format: 'py' },
    '.bash': { mode: 'path', extension: '.bash', format: 'py' },
    '.zsh': { mode: 'path', extension: '.zsh', format: 'py' },
    '.sql': { mode: 'path', extension: '.sql', format: 'lua' },
    '.pgsql': { mode: 'path', extension: '.pgsql', format: 'lua' },
    '.psql': { mode: 'path', extension: '.psql', format: 'lua' },
};
/** URLs and documentation-tag syntax are code. Tag descriptions and suppression reasons remain prose. */
export const TOKEN_IGNORES = [
    String.raw`(https?://[^\s)]+)`,
    String.raw`(@(?:param|template|typedef)\s+(?:\{[^}\n]*\}\s+)?(?:\[[^\]\n]*\]|\S+))`,
    String.raw`(@(?:returns?|throws|type|see|example|deprecated)\b(?:\s+\{[^}\n]*\})?)`,
];
/** Front matter is not prose. */
export const BLOCK_IGNORES = [String.raw`(?s)^---\n.*?\n---\n`];
/** The name Vale gives stdin, followed by the grammar extension. */
export const VALE_STDIN = 'stdin';
/** The style directory under .gspot and the style Vale reads from it. */
export const STYLES_DIRECTORY = '.gspot/config/vale/styles';
export const GSPOT_STYLE = 'gspot';
/** Maps the three documentation length-rule filenames to their limit keys. */
export const LENGTH_RULES: Record<string, string> = {
    'sentence-length': 'docs.sentence_words',
    'step-length': 'docs.list_item_words',
    'paragraph-length': 'docs.paragraph_sentences',
};
export const VALE_CONFIG = '.gspot/config/vale.ini';
export const FORMAT_PREFIX = 'format.';
// The pin fields a manifest may leave out, copied when declared.
export const OPTIONAL_TOOL_KEYS = [
    'version',
    'floor',
    'provider',
    'version_command',
    'version_exit_code',
    'version_regex',
    'crash_pattern',
    'rule_page',
    'suppression',
    'env',
    'takeover',
    'query_packs',
    'prettier',
] as const;
