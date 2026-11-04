export const HOME_TITLE = 'Lint the code your AI agent writes';
export const TOOLS = [
    { name: 'ESLint', icon: 'eslint.svg' },
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
    added: { file: 'docs/package.json', table: 'dependencies', name: 'mermaid-isomorphic', version: '3.1.0' },
    pulled: { name: 'katex', version: '0.16.47' },
    check: 'dependencies/osv-scanner',
    lockfile: 'bun.lock',
    advisory: 'GHSA-238p-pmpm-9mq7',
    summary: 'Existing prototype pollution can bypass trust restrictions',
    fix: { file: 'package.json', table: 'overrides', name: 'katex', version: '0.18.11' },
    fixedIn: '0.18.2',
} as const;
export const URL_BREAK = /(?<=\/)(?!\/)/u;
export const COPY_FAILED_MESSAGE = 'Copy failed. Select and copy the text.';
export const COPIED_MESSAGE = 'Copied.';
