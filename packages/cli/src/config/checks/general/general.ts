import { RUNNER_NAMES } from '#cli/config/repository/repository.ts';

export const GIT_COMMIT_MESSAGE_ARGUMENTS = ['show', '--no-patch', '--no-show-signature', '--format=%B'] as const;

export const MESSAGE_FILE = 'message.txt';

export const COMMITLINT_CHECK = 'commits/commitlint';

export const SCISSORS_LINE = '# ------------------------ >8 ------------------------';

export const COMMENT_PREFIX = '#';

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

const APPLY_HELP = 'Run gspot apply.';

export const GENERATED_FILE_FINDINGS = {
    changed: { message: 'This generated file is out of date.', help: APPLY_HELP },
    missing: { message: 'This generated file is missing.', help: APPLY_HELP },
    stray: {
        message: 'gspot wrote this file, and no selected configuration writes it now.',
        help: 'Run gspot apply to delete it.',
    },
} as const;

export const REASON_ABOVE = /^(?:\/\/|\/\*|#|--|<!--)\s*reason:\s*(?<reason>\S.*)$/u;

export const SUPPRESSION_KIND_MESSAGES = {
    all: 'This comment turns off every rule, including the size limits. Name the rules and give a reason.',
    limit: 'Split the code by its steps, or ask the user to raise the limit in gspot.toml.',
} as const;

export const NEGATED_PATTERN = /^!/u;

export const UNESCAPED_BRACKET = /(?<!\\)[()[\]]/u;

export const BRACKET_HELP = String.raw` If a folder name holds ( ) [ ], escape each with a backslash in a TOML literal string, such as 'app/\(legal\)/**'.`;

export const GSPOT_RULES = {
    unmatchedPath: 'unmatched-path',
    conflictingConfig: 'conflicting-config',
} as const;

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

export const VALE_ARGUMENTS = ['--output', 'JSON', '--no-exit'] as const;

export const SCRIPT_GRAMMAR = { mode: 'stdin', extension: '.py' } as const;

export const VALE_ERROR_LINE = /(?:^E\d+)|(?:not found)|(?:error)/iu;

export const VALE_PACKAGES_MESSAGE = 'The Vale packages are not installed. Run gspot install.';

export const VALE_NAME = 'Vale';

export const NO_OUTPUT = 'no output';

export const REPOSITORY_RULES = {
    pathEncoding: 'path-encoding',
    absoluteLink: 'absolute-link',
    outwardLink: 'outward-link',
    encoding: 'encoding',
    size: 'size',
    trackedFile: 'tracked-file',
} as const;

export const ABSOLUTE_LINK_HELP = 'Use a relative link target inside the repository.';
export const OUTWARD_LINK_HELP = 'Replace the link with the file or folder it points to, or delete it.';

export const GITLEAKS_LOG_OPTIONS = '--diff-merges=separate';

export const ENV_KEY_LINE = /^(?:#\s*)?(?:export )?(?<key>[A-Z][A-Z0-9_]*)=/u;

export const GITLEAKS_LOG_FLAG = '--log-opts';

export const ENVIRONMENT_READ_LANGUAGES = ['javascript', 'typescript', 'python', 'vue', 'svelte', 'astro'] as const;

export const GITLEAKS_STAGED_CHECK = 'secrets/gitleaks-staged';

export const GITLEAKS_STAGED_FLAG = '--staged';

export const MISSING_KEY_RULE = 'missing-key';

export const SEMGREP_TOOL = 'semgrep';

export const SEMGREP_RULE_EXTENSION = '.yml';
