export const RULE_PAGES = [
    ['no-var', 'https://eslint.org/docs/latest/rules/no-var'],
    ['eslint/no-var', 'https://eslint.org/docs/latest/rules/no-var'],
    ['gspot/no-trivial-functions', 'https://generativespotting.com/reference/eslint-plugin/no-trivial-functions/'],
    ['@typescript-eslint/no-explicit-any', 'https://typescript-eslint.io/rules/no-explicit-any'],
    [
        'unicorn/prefer-set-has',
        'https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-set-has.md',
    ],
    [
        'eslint/unicorn/prefer-set-has',
        'https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-set-has.md',
    ],
    ['eslint/@typescript-eslint/no-explicit-any', 'https://typescript-eslint.io/rules/no-explicit-any'],
    ['eslint/sonarjs/no-identical-functions', null],
] as const;

export const CHILD_RULE_PAGE = {
    tool: 'swiftlint',
    rule: 'type_body_length',
    check: 'swift/swiftlint',
    page: 'https://realm.github.io/SwiftLint/type_body_length.html',
} as const;

export const ROOT_RULE_PAGE = {
    tool: 'ruff',
    rule: 'F401',
    check: 'python/ruff',
    page: 'https://docs.astral.sh/ruff/rules/F401/',
} as const;

export const RULE_PAGE_SETTINGS = `level = "all"
configurations = ["python"]
[[scope]]
path = "app"
configurations = ["swift"]
`;

export const NPM_SCOPE_RULE_PAGE = {
    subject: 'eslint/@next/next/no-html-link-for-pages',
    tool: 'eslint',
    rule: '@next/next/no-html-link-for-pages',
    page: null,
} as const;

export const UNKNOWN_RULE_PREFIX = {
    kind: 'lint-rule',
    tool: 'eslint',
    rule: 'unknown/no-such-rule',
    page: null,
} as const;

export const SHELLCHECK_RULE_PAGE = {
    kind: 'lint-rule',
    tool: 'shellcheck',
    rule: 'SC2086',
    page: 'https://www.shellcheck.net/wiki/SC2086',
} as const;
