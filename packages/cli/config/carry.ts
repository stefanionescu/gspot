// What takeover carries from old configuration files: which check a tool's disabled rules land on, and the typos exclusions every repository has.

/** The check that receives the rules a tool's old configuration turned off. */
export const CHECK_BY_TOOL: Record<string, string> = {
    shellcheck: 'bash/shellcheck',
    sqlfluff: 'sql/sqlfluff',
    squawk: 'postgres/squawk',
    swiftlint: 'swift/swiftlint',
    markdownlint: 'markdown/markdownlint',
    stylelint: 'css/stylelint',
    eslint: 'typescript/eslint',
    ruff: 'python/ruff',
    hadolint: 'docker/hadolint',
    typos: 'spelling/typos',
    gitleaks: 'secrets/gitleaks',
    osv: 'dependencies/osv',
    licenses: 'licenses/npm',
};

/** Exclusions every typos configuration holds; carrying them says nothing about the repository. */
export const TYPOS_DEFAULT_EXCLUDES = [
    'node_modules',
    'dist',
    'build',
    'coverage',
    '.lock',
    'DerivedData',
    'Pods',
    '.build',
    '*.png',
    '*.jpg',
    '*.jpeg',
    '*.gif',
    '*.svg',
    '*.mp3',
    '*.mp4',
    '*.ttf',
    '*.woff',
    '*.woff2',
    '*.ico',
    '*.zip',
    '*.pdf',
];
