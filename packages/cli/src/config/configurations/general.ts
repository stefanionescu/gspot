export const GIT_COMMIT_MESSAGE_ARGUMENTS = [
    'log',
    '--stdin',
    '--no-walk=unsorted',
    '--no-show-signature',
    '--format=%H%x00%B%x00',
] as const;

export const COMMIT_FIELD_END = '\0';

export const COMMIT_RECORD_END = '\0\n';

export const MESSAGE_FILE = 'message.txt';

export const COMMIT_SCISSORS = /^. -{24} >8 -{24}\r?$/mu;

export const MESSAGE_REFERENCES = [
    {
        rule: 'session-link',
        pattern: /(?:^Claude-Session:)|claude\.ai\/code\/session_|chatgpt\.com\/(?:c|share)\//iu,
        message: 'links to an AI session. Remove the link: a reader cannot open the chat, and the link shares it.',
    },
    {
        rule: 'finding-id',
        pattern: /\b[A-Z]+\d+-[A-Z]+-\d+\b/u,
        message: 'names a finding ID that a reader of the repository cannot look up. Describe the change itself.',
    },
    {
        rule: 'plan-step',
        pattern: /\b(?:steps? \d+\.\d+|stages? \d{2,})\b/iu,
        message: 'names a step of a plan that a reader of the repository cannot look up. Describe the change itself.',
    },
    {
        rule: 'home-path',
        pattern: /(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\)[\w.-]+/u,
        message: 'names a home folder. Write a path that every reader has.',
    },
    {
        rule: 'issue-footer',
        pattern: /^(?:Refs|Closes):(?!.*#\d)/u,
        message: 'has a Refs: or Closes: footer without an issue number. Write it as `Refs: #123`, or remove it.',
    },
    {
        rule: 'ci-skip',
        pattern: /\[(?:skip ci|ci skip|no ci|skip actions|actions skip)\]|^skip-checks: ?true/imu,
        message: 'stops CI. Remove the marker: every commit runs the checks.',
    },
] as const;

export const JSCPD_TOOL = 'jscpd';

export const JSCPD_CONFIG_FILE = 'jscpd.json';

export const JSCPD_REPORT_FILE = 'jscpd-report.json';

export const JSCPD_ARGUMENTS = ['--reporters', 'json', '--silent'] as const;

export const OUTPUT_FLAG = '--output';

export const CLONE_RULE = 'clone';

export const OSV_SCANNER_NAME = 'osv-scanner';

export const OSV_LICENSE_COMMAND = [
    OSV_SCANNER_NAME,
    'scan',
    'source',
    '--format',
    'json',
    '--all-packages',
    '--allow-no-lockfiles',
] as const;

export const OSV_LOCKFILE_FLAG = '--lockfile=:';

export const OSV_LICENSES_FLAG = '--licenses';

export const OSV_PYTHON_ECOSYSTEM = 'PyPI';

export const OSV_FINDINGS_CODE = 1;

export const ANY_VERSION = '*';

export const EMPTY_SCAN_MESSAGE =
    'The license scan found no packages. Install the selected project dependencies before scanning.';

export const LICENSE_RULES = {
    unusedRecord: 'unused-record',
    disallowedLicense: 'disallowed-license',
    unmatchedIgnore: 'unmatched-ignore',
} as const;

export const GITLEAKS_LOG_OPTIONS = '--diff-merges=separate';

export const SECRET_KEY_NAME = /(?:TOKEN|SECRET|KEY|PASSWORD)/u;

export const ENVIRONMENT_DEFAULT_RULE = 'environment-default';

export const ENV_KEY_LINE = /^(?:#\s*)?(?:export )?(?<key>[A-Z][A-Z0-9_]*)=/u;

export const GITLEAKS_LOG_FLAG = '--log-opts';

export const ENVIRONMENT_READ_LANGUAGES = ['javascript', 'typescript', 'python', 'vue', 'svelte', 'astro'] as const;

export const MISSING_KEY_RULE = 'missing-key';

export const SEMGREP_TOOL = 'semgrep';

export const SEMGREP_RULE_EXTENSION = '.yml';

export const COMMITLINT_ERROR_SEVERITY = 2;

export const COMMITLINT_PARSER_PRESET = {
    parserOpts: {
        headerPattern: String.raw`^(\w*)(?:\((.*)\))?!?: (.*)$`,
        breakingHeaderPattern: String.raw`^(\w*)(?:\((.*)\))?!: (.*)$`,
        headerCorrespondence: ['type', 'scope', 'subject'],
    },
} as const;

export const JSCPD_IMPORT_PATTERNS = [
    String.raw`import\s[^;]*?from\s*['"][^'"]+['"]\s*;`,
    String.raw`(?:^|\n)[\t ]*(?:from[\t ]+(?:\\\r?\n[\t ]*)*[\w.]+[\t ]+(?:\\\r?\n[\t ]*)*)?import[\t ]+(?:\\\r?\n[\t ]*)*(?:\([^;)]*\)|(?:\\\r?\n|[^;\r\n])*)`,
] as const;

export const JSCPD_IGNORED = ['**/*.md', '**/*.mdx'] as const;

export const JSCPD_CHECK = 'structure/jscpd';

export const EDITORCONFIG_FIXED_SECTIONS = {
    // eslint-disable-next-line unicorn/text-encoding-identifier-case -- reason: EditorConfig defines this charset value as utf-8.
    '*': { charset: 'utf-8', end_of_line: 'lf', insert_final_newline: true, trim_trailing_whitespace: true },
    '*.md': { trim_trailing_whitespace: false },
    Makefile: { indent_style: 'tab' },
} as const;

export const UNREPRESENTABLE_SELECTOR = /[\r\n]|[!+?*@]\(/u;

export const PRETTIER_MARKDOWN_OVERRIDE = {
    files: ['*.md', '*.mdx'],
    options: { embeddedLanguageFormatting: 'off' },
} as const;

export const DEFAULT_QUOTES = { prettier: 'single', ruff: 'double' } as const;

export const EDITORCONFIG_ROOT_LINE = 'root = true\n\n';

export const PRETTIER_CHECK = 'format/prettier';

export const MISE_FILES = [
    '.mise.local.toml',
    'mise.local.toml',
    '.mise.toml',
    'mise.toml',
    'mise/config.toml',
    '.mise/config.toml',
    '.config/mise.toml',
    '.config/mise/config.toml',
] as const;
