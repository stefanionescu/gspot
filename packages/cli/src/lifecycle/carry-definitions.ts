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
