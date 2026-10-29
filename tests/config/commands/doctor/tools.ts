export const ZERO_COVERAGE_TABLES = `[coverage]
lines = { value = 0, reason = "This sandbox tests optional coverage." }
branches = { value = 0, reason = "This sandbox tests optional coverage." }
functions = { value = 0, reason = "This sandbox tests optional coverage." }
statements = { value = 0, reason = "This sandbox tests optional coverage." }
`;

export const MISSING_REPORT_TOOLS = [
    ['ajv', 'project'],
    ['dotenv-linter', 'mise'],
    ['editorconfig-checker', 'mise'],
    ['gitleaks', 'mise'],
    ['lychee', 'mise'],
    [
        'node',
        'Install Node.js 24.2.0 or newer. On macOS, run brew install node@24. On Windows, run winget install OpenJS.NodeJS.LTS.',
    ],
    ['osv-scanner', 'mise'],
    ['prettier', 'project'],
    ['taplo', 'mise'],
    ['typos', 'mise'],
    ['v8r', 'project'],
    ['vale', 'mise'],
    ['xmllint', 'Install xmllint.'],
    ['yamllint', 'project'],
] as const;
