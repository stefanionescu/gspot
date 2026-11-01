import { RUNNER_NAMES } from '#cli/config/repository/setup.ts';

export const YAML_REQUIRED_NAMES = new Set([
    'action.yaml',
    'analysis_options.yaml',
    'Chart.yaml',
    'compose.yaml',
    'compose.override.yaml',
    'docker-compose.yaml',
    'docker-compose.override.yaml',
    'kustomization.yaml',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    '.pre-commit-config.yaml',
    '.pre-commit-hooks.yaml',
    'pubspec.yaml',
    'values.yaml',
]);

export const YAML_TRUTHY = /^(?:[Yy][Ee][Ss]|[Nn][Oo]|[Oo][Nn]|[Oo][Ff][Ff]|True|TRUE|False|FALSE)$/u;

export const YAML_LEADING_ZERO = /^[+-]?(?:0\d+|0o[0-7]+)$/u;

export const YAML_TRAILING_ZERO = /^[+-]?\d+\.\d*0$/u;

export const YAML_GENERATED_ANCHOR = /^[a-z]?\d+$/iu;

export const YAML_COMMIT_USE = /^\s*(?:-\s+)?uses:\s*['"]?[^'"#\s]+@[\da-f]{40}['"]?\s*$/iu;

export const YAML_VERSION_COMMENT = /^#\s*v?\d+(?:\.\d+)*(?:[-+][\w.-]+)?\s*$/u;

export const YAML_RULES = {
    syntax: 'syntax',
    duplicate: 'key-duplicates',
    anchors: 'anchors',
    truthy: 'truthy',
    octal: 'octal-values',
    documents: 'documents',
    merge: 'merge-keys',
    anchorNames: 'anchor-names',
    version: 'version-numbers',
    comments: 'comments',
    extension: 'file-extension',
} as const;

export const YAML_MESSAGES = {
    extension: 'Use the .yml extension unless the consumer requires this .yaml file name.',
    documents:
        'Keep one YAML document per file. Accept this rule with a reason only when the consumer requires a stream.',
    merge: 'Do not use the << merge key. Write the mapping keys explicitly.',
    truthy: 'Quote this string, or write a boolean as true or false.',
    octal: 'Quote a value with a leading zero, or write the number in decimal without leading zeros.',
    version: 'Quote this value to preserve its trailing zero.',
    comments:
        'Move this comment above the key. Only a version comment after a uses value pinned to a full commit is allowed.',
};

export const GIT_COMMIT_MESSAGE_ARGUMENTS = ['show', '--no-patch', '--no-show-signature', '--format=%B'] as const;

export const MESSAGE_FILE = 'message.txt';

export const COMMITLINT_CHECK = 'commits/commitlint';

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

export const STALE_LOCKFILE_SECTIONS = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
] as const;

export const DOWNLOAD_PROTOCOLS: ReadonlySet<string> = new Set([
    'http:',
    'https:',
    'git:',
    'git+http:',
    'git+https:',
    'git+ssh:',
]);

export const NPM_TOOL_PREFIX = 'npm:';

export const LOCKFILE_UPDATE_COMMANDS = {
    'bun.lock': 'bun install',
    'package-lock.json': 'npm install',
    'pnpm-lock.yaml': 'pnpm install',
} as const;

export const PACKAGE_MANAGER_HASH_SEPARATOR = '+';

export const PACKAGE_MANAGER_VERSION_SEPARATOR = '@';

export const DEPENDENCY_RULES = {
    packageManagerPin: 'package-manager-pin',
    staleLockfile: 'stale-lockfile',
    host: 'host',
    foreignLockfile: 'foreign-lockfile',
} as const;

export const LOCKFILE_KEY_SUFFIX = /^["']?:[ \t]*(?:\r?\n|$)/u;

export const MARKDOWN_EXTENSIONS = ['.md', '.mdx'] as const;

export const FILE_EXTENSION = /\.[a-z0-9]+$/iu;

export const TRAILING_PUNCTUATION = '.,;:';

export const PATH_CHARACTERS = /^[\w./-]+$/u;

export const TOKEN_SEPARATORS = /[\s`'"()[\],;:!?<>|]+/u;

export const COMMAND_FENCES = new Set(['sh', 'bash', 'console', 'shell', 'zsh', 'shellsession']);

export const PATH_TOKEN_SKIPS = [/^\.\.?\/?$/u, /^\d+\/\d+$/u, /^\//u] as const;

export const REMOTE_ARGUMENTS = [
    /\bgh\s+api\s+(?:"[^"\n]*"|'[^'\n]*'|[^\s`]+)/gu,
    /\b(?:Accept|Content-Type):\s*[a-z]+\/[a-z0-9!#$&^_.+-]+/giu,
] as const;

export const INLINE_LINK_TARGET = /`[^`\n]*`|\]\(<?[^\s()<>]+/gu;

export const CODE_SPAN_START = '`';

export const MISE_RUN = 'mise run ';

export const BUN_RUN = 'bun run ';

export const MISE_CONF_FILES = '.mise/conf.d/*.toml';

export const README_FILE = 'README.md';

export const LICENSE_PATH = 'LICENSE';

export const TITLE_ATTRIBUTE = 'title=';

export const EMPHASIS_MARKERS = ['**', '*'] as const;

export const RELATIVE_PATH_PREFIXES = ['./', '../'] as const;

export const RUN_COMMAND = new RegExp(
    String.raw`\b(?:${RUNNER_NAMES.join('|')}) run (?:--[\w-]+\s+)*[\w./][\w:/.-]*`,
    'gu',
);

export const MISSING_LICENSE_MESSAGE = 'The root has no LICENSE file.';

export const DOCS_RULES = {
    missingTask: 'missing-task',
    missingReadme: 'missing-readme',
    missingLicense: 'missing-license',
    missingPath: 'missing-path',
} as const;

export const JSCPD_TOOL = 'jscpd';

export const JSCPD_CONFIG_FILE = 'jscpd.json';

export const JSCPD_REPORT_FILE = 'jscpd-report.json';

export const JSCPD_ARGUMENTS = ['--reporters', 'json', '--silent'] as const;

export const OUTPUT_FLAG = '--output';

export const CLONE_RULE = 'clone';

export const UNKNOWN_LICENSE = 'UNKNOWN';

export const LICENSE_CHOICE = ' OR ';

export const CLASSIFIER_SEPARATOR = '; ';

export const TROVE_LICENSES: Readonly<Record<string, string>> = {
    'MIT License': 'MIT',
    'Apache Software License': 'Apache-2.0',
    'BSD License': 'BSD-3-Clause',
    'ISC License (ISCL)': 'ISC',
    'Python Software Foundation License': 'PSF-2.0',
    'Mozilla Public License 2.0 (MPL 2.0)': 'MPL-2.0',
    'GNU Lesser General Public License v3 or later (LGPLv3+)': 'LGPL-3.0-or-later',
    'GNU Lesser General Public License v3 (LGPLv3)': 'LGPL-3.0-only',
    'GNU General Public License v3 (GPLv3)': 'GPL-3.0-only',
    'GNU General Public License v3 or later (GPLv3+)': 'GPL-3.0-or-later',
    'The Unlicense (Unlicense)': 'Unlicense',
    'Zope Public License': 'ZPL-2.1',
};

export const ANY_VERSION = '*';

export const EMPTY_SCAN_MESSAGE =
    'The license scan found no packages. Install the selected project dependencies before scanning.';

export const NO_ALLOWED_LICENSES_NOTE = 'Set licenses.allowed to check licenses.';

export const LICENSE_RULES = { unusedRecord: 'unused-record', disallowedLicense: 'disallowed-license' } as const;

export const GITLEAKS_LOG_OPTIONS = '--diff-merges=separate';

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

export const TAPLO_FORMATTING = {
    array_auto_expand: false,
    array_auto_collapse: false,
} as const;

export const V8R_NOTES = ['# The other selected tools check files without a known schema.'];

export const OSV_SCANNER_NOTES = [
    '# This file stops OSV-Scanner from reading an osv-scanner.toml next to a lockfile.',
    '# Accept a vulnerability with gspot ignore dependencies/osv-scanner --rule <ID> and a reason.',
];

export const BUNFIG_FILE = 'bunfig.toml';

export const SCANNER_KEY = ['install', 'security', 'scanner'] as const;

export const OSV_SCANNER_CHECK = 'dependencies/osv-scanner';

export const LYCHEE_REPOSITORY_LINKS = 'file://$1/';

export const LYCHEE_ROOT_LINKS = String.raw`^file://(.*)/\.gspot/root-links/`;

export const LYCHEE_MDX_EXPRESSION = '%7B[^/]*%7D';

export const LYCHEE_NOTES = [
    '# This file stops lychee from reading a lychee.toml in the folder where it runs.',
    '# Allow a URL with the docs.allowed_urls setting.',
];

export const LYCHEE_ROOT_NOTE = '# A link that starts with / starts at the repository root, as on GitHub.';

export const LYCHEE_SITE_NOTE = '# A link that starts with / names a route of the site, so lychee skips it.';

export const JSCPD_IMPORT_PATTERNS = [
    String.raw`import\s[^;]*?from\s*['"][^'"]+['"]\s*;`,
    String.raw`(?:^|\n)[\t ]*(?:from[\t ]+(?:\\\r?\n[\t ]*)*[\w.]+[\t ]+(?:\\\r?\n[\t ]*)*)?import[\t ]+(?:\\\r?\n[\t ]*)*(?:\([^;)]*\)|(?:\\\r?\n|[^;\r\n])*)`,
] as const;

export const JSCPD_IGNORED = ['**/*.md', '**/*.mdx'] as const;

export const JSCPD_CHECK = 'duplication/jscpd';

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

export const MISE_TASK_FOLDERS = [
    'mise-tasks',
    '.mise-tasks',
    'mise/tasks',
    '.mise/tasks',
    '.config/mise/tasks',
] as const;

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

export const SITE_CONFIGURATION = 'site';
