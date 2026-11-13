import { SQL_FILES } from '#cli/config/configurations/language.ts';
import { PYTHON_FILES, RUFF_CHECK } from '#cli/config/configurations/python.ts';
import { SWIFT_FILES } from '#cli/config/configurations/swift.ts';
import { GITHUB_WORKFLOW, GITLAB_WORKFLOW } from '#cli/config/generation/files.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { GITATTRIBUTES_FILE } from '#cli/config/repository/files.ts';

// carryover
export const CARRIED_TOOLS: ReadonlySet<string> = new Set([
    'prettier',
    'editorconfig-checker',
    'ruff',
    'markdownlint-cli2',
    'commitlint',
    'typos',
]);
export const CARRYOVER_ROW_START = {
    covered: 0,
    carried: [],
    differing: [],
    reasons: [],
    plugins: [],
    commandChecks: [],
    dropped: [],
} as const;
export const COMMITLINT_CHECK = 'commits/commitlint';
export const COMMITLINT_CONFIG_PATH = /^(?:\.commitlintrc|commitlint\.config)/u;
export const COMMITLINT_TARGET = `${GSPOT_PATHS.configurations}/commits/commitlint.json`;
export const PRETTIER_OVERRIDES_KEY = 'overrides';
export const EDITORCONFIG_WORDS: Readonly<Record<string, string>> = {
    tabWidth: 'indent_size',
    printWidth: 'max_line_length',
    useTabs: 'indent_style',
    singleQuote: 'quote_type',
    [PRETTIER_OVERRIDES_KEY]: 'sections',
};
export const EMPTY_CARRYOVER = { tools: {}, ignore: [], rows: [] } as const;
export const IGNORE_REASON_START = 'Carried over from';
export const MARKDOWNLINT_ALIASES: Readonly<Record<string, string>> = {
    'heading-increment': 'MD001',
    'heading-style': 'MD003',
    'ul-style': 'MD004',
    'list-indent': 'MD005',
    'ul-indent': 'MD007',
    'no-trailing-spaces': 'MD009',
    'no-hard-tabs': 'MD010',
    'no-reversed-links': 'MD011',
    'no-multiple-blanks': 'MD012',
    'line-length': 'MD013',
    'commands-show-output': 'MD014',
    'no-missing-space-atx': 'MD018',
    'no-multiple-space-atx': 'MD019',
    'no-missing-space-closed-atx': 'MD020',
    'no-multiple-space-closed-atx': 'MD021',
    'blanks-around-headings': 'MD022',
    'heading-start-left': 'MD023',
    'no-duplicate-heading': 'MD024',
    'single-title': 'MD025',
    'single-h1': 'MD025',
    'no-trailing-punctuation': 'MD026',
    'no-multiple-space-blockquote': 'MD027',
    'no-blanks-blockquote': 'MD028',
    'ol-prefix': 'MD029',
    'list-marker-space': 'MD030',
    'blanks-around-fences': 'MD031',
    'blanks-around-lists': 'MD032',
    'no-inline-html': 'MD033',
    'no-bare-urls': 'MD034',
    'hr-style': 'MD035',
    'no-emphasis-as-heading': 'MD036',
    'no-space-in-emphasis': 'MD037',
    'no-space-in-code': 'MD038',
    'no-space-in-links': 'MD039',
    'fenced-code-language': 'MD040',
    'first-line-heading': 'MD041',
    'first-line-h1': 'MD041',
    'no-empty-links': 'MD042',
    'required-headings': 'MD043',
    'proper-names': 'MD044',
    'no-alt-text': 'MD045',
    'code-block-style': 'MD046',
    'single-trailing-newline': 'MD047',
    'code-fence-style': 'MD048',
    'emphasis-style': 'MD049',
    'strong-style': 'MD050',
    'link-fragments': 'MD051',
    'reference-links-images': 'MD052',
    'link-image-reference-definitions': 'MD053',
    'link-image-style': 'MD054',
    'table-pipe-style': 'MD055',
    'table-column-count': 'MD056',
    'blanks-around-tables': 'MD058',
    'descriptive-link-text': 'MD059',
    'table-column-style': 'MD060',
};
export const MARKDOWNLINT_CHECK = 'markdown/markdownlint';
export const MARKDOWNLINT_CONFIG_FILES = [
    '.markdownlint.json',
    '.markdownlint.jsonc',
    '.markdownlint.yaml',
    '.markdownlint.yml',
    '.markdownlint-cli2.jsonc',
    '.markdownlint-cli2.yaml',
] as const;
export const MARKDOWNLINT_RETIRED_RULES: ReadonlySet<string> = new Set([
    'MD002',
    'MD006',
    'MD008',
    'MD015',
    'MD016',
    'MD017',
    'MD057',
]);
export const MARKDOWNLINT_RUNNER_FILE = /cli2/u;
export const MARKDOWNLINT_TARGET = `${GSPOT_PATHS.configurations}/markdown/markdownlint.jsonc`;
export const PRETTIER_EXCLUDE_KEY = 'excludeFiles';
export const PYRIGHT_TABLES = ['basedpyright', 'pyright'] as const;
export const RUFF_CHECK_IDS = [RUFF_CHECK, 'python/ruff-format'] as const;
export const RUFF_FORMAT_KEYS = ['line-length', 'indent-width'] as const;
export const RUFF_STYLE_KEYS = ['indent-style', 'quote-style'] as const;
export const SCAN_FIRST_MESSAGE = 'its rules; gspot scan compares them before init';
export const UNREADABLE_CONFIG_MESSAGE = 'the whole file, which gspot could not read';
export const UNREAD_CONFIG_MESSAGE = 'its settings, because init does not read this config';
export const UNREAD_TYPOS_MESSAGE =
    'its words and settings; keep a word with gspot set spelling.allowed_words <word> --reason "<why>"';

// carryover ignore files
export const COMMENT_PATTERN = /^#/u;
export const IGNORE_FILES = [
    { file: '.prettierignore', tool: 'prettier', check: 'format/prettier' },
    { file: '.eslintignore', tool: 'eslint', check: 'javascript/eslint' },
] as const;

// carryover lint rules
export const FIRST_NUMBER = /\d+/u;
export const LIMIT_RULE = /max/u;
export const NOT_COMPARED_MESSAGE = 'its rules, because a tool could not print them';
export const OTHER_CONFIG_MESSAGE = 'its rules, because <tool> reads <path> instead';
export const PRINTED_RULE_TOOLS = [
    {
        tool: 'eslint',
        check: 'javascript/eslint',
        sample: /(?:^|\/)[^./][^/]*(?<!\.config)\.[cm]?[jt]sx?$/u,
        hasSeverity: true,
        gspotArguments: [],
    },
    {
        tool: 'stylelint',
        check: 'css/stylelint',
        sample: /\.css$/u,
        hasSeverity: false,
        gspotArguments: ['--config', `${GSPOT_PATHS.configurations}/css/stylelint.json`],
    },
] as const;
export const PRINT_TIMEOUT_SECONDS = 60;
export const REASON_PLACEHOLDER = '"<why>"';
export const RUFF_ALL_SELECTOR = /\bALL\b/u;
export const RUFF_ANY_PREFIX = '[A-Z]+';
export const RULE_PRINT_FLAG = '--print-config';

// format settings
export const EDITORCONFIG_COMMENT = /^\s*[#;]/u;
export const EDITORCONFIG_FILE = '.editorconfig';
export const EDITORCONFIG_SECTION = /^\s*\[(.+)\]\s*$/u;
export const FORMATTER_DEFAULTS = [
    {
        tag: 'python',
        paths: PYTHON_FILES,
        format: { indent_style: 'space', indent_width: 4, print_width: 88, quotes: 'double' },
    },
    { tag: 'swift', paths: SWIFT_FILES, format: { indent_style: 'space', indent_width: 4, print_width: 120 } },
    { tag: 'sql', paths: SQL_FILES, format: { indent_style: 'space', indent_width: 4, print_width: 80 } },
] as const;
export const PRETTIER_DEFAULTS = { tabWidth: 2, printWidth: 80, singleQuote: false, useTabs: false } as const;
export const PRETTIER_FILE_FORMATS: Readonly<Record<string, 'yaml' | 'json' | 'toml'>> = {
    '.prettierrc': 'yaml',
    '.prettierrc.yml': 'yaml',
    '.prettierrc.yaml': 'yaml',
    '.prettierrc.json': 'json',
    '.prettierrc.json5': 'yaml',
    '.prettierrc.toml': 'toml',
};
export const PRETTIER_PACKAGE_KEY = 'prettier';
export const PRETTIER_SCRIPT_FILE = /\.[cm]?[jt]s$/u;
export const PRETTIER_SCRIPT_NAME = /^(?:\.prettierrc|prettier\.config)\.[cm]?[jt]s$/u;
export const PROSE_TAGS: ReadonlySet<string> = new Set(['text', 'markdown']);
export const PYTHON_TAG = 'python';
export const RUFF_SETTINGS_FILES = ['.ruff.toml', 'ruff.toml', 'pyproject.toml'] as const;

// init plan
export const ADDS_BLOCK_NOTE = 'adds the gspot block';
export const ALWAYS_SELECTED_NOUN = 'always-selected configuration';
export const ATTRIBUTES_ROW = {
    path: GITATTRIBUTES_FILE,
    note: 'marks the generated files and keeps LF line endings',
} as const;
export const CARRYOVER_GROUPS = {
    carried: 'carried over',
    differing: 'other options, to set after init',
    plugins: 'keep with a plugin record',
    commandChecks: 'keep with a command check of your own',
    dropped: 'dropped',
} as const;
export const CARRYOVER_HEADING = 'what init carries from the configs it replaces';
export const CHANGE_LATER_MESSAGE =
    'Change the hooks and rule files later with gspot set hooks.enabled or rule_files.enabled.';
export const CI_FILE_NOTE = 'existing CI file';
export const CI_FILE_NOTES = {
    [GITHUB_WORKFLOW]: 'check workflow',
    [GITLAB_WORKFLOW]: `add include: [{ local: ${GITLAB_WORKFLOW} }] to .gitlab-ci.yml`,
} as const;
export const CI_OFF_MESSAGE =
    'CI is off. To turn it on, run gspot set ci.enabled true; for GitLab, also run gspot set ci.provider gitlab.';
export const COLUMN_GAP = 2;
export const CONFIGURATION_WIDTH = 16;
export const DELETED_RULES_NOTE = '(read them with git show HEAD:<path>; the table below names what init carries)';
export const DROPPED_LINE_SETTINGS =
    /^[ \t]*(?:end_of_line[ \t]*=[ \t]*crlf|insert_final_newline[ \t]*=[ \t]*false)[ \t]*$/imu;
export const DROPPED_LINE_SETTINGS_NOTE =
    'drops its crlf or missing final newline: gspot always writes lf and a final newline';
export const FOREIGN_HOOK_NOTE = 'keeps running your hooks; add the lines of gspot install to call .gspot/hooks';
export const GENERATED_FILE_NOUN = 'generated file';
export const GSPOT_FOLDER_NOTE = 'generated files';
export const INSTALL_LOCKFILE_NOTE = 'lockfile written by gspot install';
export const LINT_COMMANDS_HEADING =
    'lint commands; gspot edits none of them, and gspot/conflicting-configs reports each until it goes';
export const LINT_FOLDERS_HEADING = 'lint folders; delete when nothing calls them';
export const LINT_FOLDER_MESSAGE = 'a folder of lint scripts; check remaining references before deleting it';
export const NPM_PIN_NOUN = 'pinned npm tool';
export const ORIGIN_WIDTH = 12;
export const PRETTIER_SCRIPT_NOTE =
    'gspot could not load this Prettier config, so set format.indent_width and format.print_width by hand';
export const PYTHON_PIN_NOUN = 'pinned Python tool';
export const TOOL_PIN_NOUN = 'tool pin';
export const UNREAD_SUBMODULE_MESSAGE = 'submodule; init does not read it';

// script indent
export const SCRIPT_EXTENSIONS: readonly string[] = ['.sh', '.bash'];
export const SCRIPT_FILES = SCRIPT_EXTENSIONS.map((extension) => `**/*${extension}`);
export const TAB_STEP = 'tab';

// settings template
export const DETECTED_SETTINGS = [
    'swift.xcode_destination',
    'cloudflare.types_file',
    'cloudflare.types_interface',
] as const;
export const LEADING_COMMENTS = /^(?:#[^\n]*\n|[ \t]*\n)*/u;
export const LOCAL_RECORDS = { scope: 'path', import_rule: 'name', command_check: 'id' } as const;
export const UNREAD_SETTING_NOTE = 'no selected configuration reads it';
