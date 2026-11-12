import { NODE_MODULES } from '#cli/config/system.ts';

// dependency files

export const GIT_SUFFIX = '.git';

export const INLINE_COMMENT = /\s#/u;

export const JAVASCRIPT_RUNTIMES = ['node', 'bun', 'deno'] as const;

export const LINE_CONTINUATION = /\\\r?\n/gu;

export const PYTEST_TABLE = 'tool.pytest';

export const REQUIREMENT_NAME = /^[A-Za-z0-9](?:[\w.-]*[A-Za-z0-9])?$/u;

export const REQUIREMENT_NAME_END = /[\s<>=!~;[@]/u;

export const RUNTIME_COMMAND = new RegExp(String.raw`^\s*(${JAVASCRIPT_RUNTIMES.join('|')})(?:\s|$)`, 'u');

// lockfiles

export const DEPENDENCY_SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies'] as const;

export const LOCKFILES = [
    { file: 'bun.lock', configuration: 'javascript', packageManager: 'bun', toolProject: true, copied: true },
    { file: 'bun.lockb', configuration: 'javascript', packageManager: 'bun', binary: true },
    { file: 'pnpm-lock.yaml', configuration: 'javascript', packageManager: 'pnpm', toolProject: true, copied: true },
    { file: 'yarn.lock', configuration: 'javascript', packageManager: 'yarn', copied: true },
    { file: 'package-lock.json', configuration: 'javascript', packageManager: 'npm', toolProject: true, copied: true },
    { file: 'npm-shrinkwrap.json', configuration: 'javascript', packageManager: 'npm' },
    { file: 'uv.lock', configuration: 'python', packageManager: 'uv', copied: true },
    { file: 'poetry.lock', configuration: 'python', packageManager: 'poetry' },
    { file: 'pdm.lock', configuration: 'python', packageManager: 'pdm' },
    { file: 'Cargo.lock', packageManager: 'cargo' },
    { file: 'go.sum', packageManager: 'go' },
    { file: 'Gemfile.lock', packageManager: 'bundler' },
    { file: 'Package.resolved', configuration: 'swift', packageManager: 'swift', copied: true },
    { file: 'Podfile.lock', packageManager: 'cocoapods' },
] as const;

export const IMPORTER_LOCKFILES = ['bun.lock', 'package-lock.json', 'pnpm-lock.yaml'] as const satisfies ReadonlyArray<
    (typeof LOCKFILES)[number]['file']
>;

export const JAVASCRIPT_LOCKFILES = LOCKFILES.flatMap((row) =>
    'configuration' in row && row.configuration === 'javascript' && !('binary' in row) ? [row.file] : [],
);

export const LOCKFILE_URL_FIELDS = ['resolved', 'tarball', 'repo', 'resolution'];

export const NPM_PACKAGE_FOLDER = `${NODE_MODULES}/`;

export const PNPM_PEER_START = '(';

export const PNPM_ROOT_IMPORTER = '.';

export const PYTHON_NAME_SEPARATORS = /[._-]+/gu;

export const YARN_CLASSIC_HEADER = '# yarn lockfile v1\n';

export const YARN_CLASSIC_PROPERTY = /^[\t ]+(?:version|resolved|integrity)[\t ]+"/mu;

// project file names

export const JSCONFIG_FILE = 'jsconfig.json';

export const PACKAGE_JSON = 'package.json';

export const PACKAGE_SWIFT = 'Package.swift';

export const PBXPROJ_FILE = 'project.pbxproj';

export const PBXPROJ_SUFFIX = `.xcodeproj/${PBXPROJ_FILE}`;

export const PIPFILE = 'Pipfile';

export const PYPROJECT_TOML = 'pyproject.toml';

export const REQUIREMENTS_TXT = 'requirements.txt';

export const TSCONFIG_FILE = 'tsconfig.json';

// tsconfig

export const MISSING_EXTENDED_CONFIG = /^File '([^']+)' not found\.$/u;

export const TS_EMPTY_FILES_CODE = 18_002;

export const TS_NO_FILES_CODE = 18_003;

export const TS_UNKNOWN_VALUE_CODE = 6046;

// xcode project

export const GROUP_CYCLE_MESSAGE = 'The Xcode project contains a group cycle.';

export const INVALID_STRING_MESSAGE = 'The Xcode project has an invalid string.';

export const MISSING_FILE_REF_MESSAGE = 'An Xcode source build entry has no file reference.';

export const MISSING_MAIN_GROUP_MESSAGE = 'The Xcode project has no main group.';

export const MISSING_ROOT_MESSAGE = 'The Xcode project has no project root.';

export const OCTAL_ESCAPE_START = /^[0-7]/u;

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

export const PROJECT_PUNCTUATION: ReadonlySet<string> = new Set(['{', '}', '(', ')', '=', ';', ',']);

export const PROJECT_TOKENS = [
    /\s+/y,
    /\/\*[\s\S]*?\*\//y,
    /\/\/[^\r\n]*/y,
    /"(?:\\[\s\S]|[^"\\])*"/y,
    /[{}()=;,]/y,
    /(?:\/(?![*/])|[^\s{}()=;,"/])+/y,
] as const;

export const SETTING_REFERENCE = /\$[({]/u;

export const STRICT_CONCURRENCY = 'complete';

export const SWIFT_SIX_PREFIX = '6';

export const TRAILING_TEXT_MESSAGE = 'The Xcode project has text after its root dictionary.';
