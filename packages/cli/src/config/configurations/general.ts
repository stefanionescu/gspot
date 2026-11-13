import { LOCKFILES } from '#cli/config/parsers/projects.ts';

// agents checks
export const NESTED_AGENTS_MESSAGE = 'Move these rules into the AGENTS.md at the root of the repository.';
export const NESTED_AGENTS_RULE = 'nested-agents-file';

// commits checks
export const COMMIT_FIELD_END = '\0';
export const COMMIT_RECORD_END = '\0\n';
export const COMMIT_SCISSORS = /^. -{24} >8 -{24}\r?$/mu;
export const GIT_COMMIT_MESSAGE_ARGUMENTS = [
    'log',
    '--stdin',
    '--no-walk=unsorted',
    '--no-show-signature',
    '--format=%H%x00%B%x00',
] as const;
export const MESSAGE_FILE = 'message.txt';
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

// commits generated config
export const COMMITLINT_ERROR_SEVERITY = 2;
export const COMMITLINT_PARSER_PRESET = {
    parserOpts: {
        headerPattern: String.raw`^(\w*)(?:\((.*)\))?!?: (.*)$`,
        breakingHeaderPattern: String.raw`^(\w*)(?:\((.*)\))?!: (.*)$`,
        headerCorrespondence: ['type', 'scope', 'subject'],
    },
} as const;

// format generated config
export const EDITORCONFIG_FIXED_SECTIONS = {
    // eslint-disable-next-line unicorn/text-encoding-identifier-case -- reason: EditorConfig defines this charset value as utf-8.
    '*': { charset: 'utf-8', end_of_line: 'lf', insert_final_newline: true, trim_trailing_whitespace: true },
    '*.md': { trim_trailing_whitespace: false },
    Makefile: { indent_style: 'tab' },
} as const;
export const EDITORCONFIG_ROOT_LINE = 'root = true\n\n';
export const PRETTIER_CHECK = 'format/prettier';
export const PRETTIER_MARKDOWN_OVERRIDE = {
    files: ['*.md', '*.mdx'],
    options: { embeddedLanguageFormatting: 'off' },
} as const;
export const SHFMT_CONFIGURATION = 'bash';
// shfmt reads these keys, and no other tool does. They sit under [*] because shell scripts may have no extension.
export const SHFMT_EDITORCONFIG_OPTIONS = { switch_case_indent: true, simplify: true } as const;
export const UNREPRESENTABLE_SELECTOR = /[\r\n]|[!+?*@]\(/u;

// licenses checks
export const ANY_VERSION = '*';
export const EMPTY_SCAN_MESSAGE =
    'The license scan found no packages. Install the selected project dependencies before scanning.';
export const LICENSE_RULES = {
    unusedRecord: 'unused-record',
    disallowedLicense: 'disallowed-license',
    unmatchedIgnore: 'unmatched-ignore',
} as const;
export const OSV_FINDINGS_CODE = 1;
export const OSV_LICENSES_FLAG = '--licenses';
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
export const OSV_PYTHON_ECOSYSTEM = 'PyPI';

// mise config files
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

// repository checks
export const ABSOLUTE_LINK_HELP = 'Use a relative link target inside the repository.';
export const OUTWARD_LINK_HELP = 'Replace the link with the file or folder it points to, or delete it.';
export const REPOSITORY_RULES = {
    pathEncoding: 'path-encoding',
    absoluteLink: 'absolute-link',
    outwardLink: 'outward-link',
    conflictMarker: 'conflict-marker',
    encoding: 'encoding',
    size: 'size',
    trackedFile: 'tracked-file',
} as const;

// security checks
export const SEMGREP_TOOL = 'semgrep';

// spelling generated config
export const ENGLISH_LOCALE_GLOBS = ['en', 'en[-_]*'] as const;
export const EXTEND_EXCLUDE_LINE = 'extend-exclude = [';
export const LOCKFILE_EXTENSION = '.lock';
export const LOCKFILE_GLOB = '*.lock';
export const MESSAGE_FILES_TITLE = 'Message files of other languages than English';
export const TYPOS_CHECK = 'spelling/typos';
export const TYPOS_FORMAT_GLOBS = ['*.pbxproj', '*.xcstrings', '*.svg', '*.min.js', '*.min.css'] as const;
export const TYPOS_IGNORE_PATTERNS = [
    String.raw`\b[0-9a-f]{7,40}\b`,
    String.raw`\b[A-Za-z0-9+/]{40,}={0,2}\b`,
] as const;
export const TYPOS_LOCKFILE_GLOBS = [LOCKFILE_GLOB, ...LOCKFILES.map(({ file }) => file)];

// swift type nodes
export const TYPE_NODES = ['class_declaration', 'protocol_declaration', 'typealias_declaration'] as const;
