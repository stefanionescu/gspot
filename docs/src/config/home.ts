export const HOME_TITLE = 'Lint the code your AI agent writes';
export const TOOLS = [
    { name: 'ESLint', icon: 'eslint.svg' },
    { name: 'TypeScript', icon: 'typescript.svg' },
    { name: 'Prettier', icon: 'prettier.svg' },
    { name: 'Ruff', icon: 'ruff.svg' },
    { name: 'Stylelint', icon: 'stylelint.svg' },
    { name: 'ShellCheck', icon: 'shellcheck.png' },
    { name: 'Knip', icon: 'knip.svg' },
    { name: 'Gitleaks', icon: 'gitleaks.png' },
    { name: 'OSV-Scanner', icon: 'osv-scanner.svg' },
    { name: 'Trivy', icon: 'trivy.svg' },
] as const;
export const CAUGHT_EXAMPLE = {
    file: 'eslint-plugin.ts',
    lines: [114, 115],
    rule: 'unicorn/no-unsafe-string-replacement',
    message: 'Do not use a non-literal replacement value with `String#replace()`.',
    before: [
        `page.replace('## Install\\n', \`## Install\\n\\n\${requirements}\\n\`)`,
        `page.replace('## Use\\n', \`## Use\\n\\n\${presets}\\n\`)`,
    ],
    after: [
        `page.replace('## Install\\n', () => \`## Install\\n\\n\${requirements}\\n\`)`,
        `page.replace('## Use\\n', () => \`## Use\\n\\n\${presets}\\n\`)`,
    ],
} as const;
export const URL_BREAK = /(?<=\/)(?!\/)/u;
export const COPY_FAILED_MESSAGE = 'Copy failed. Select and copy the text.';
export const COPIED_MESSAGE = 'Copied.';
