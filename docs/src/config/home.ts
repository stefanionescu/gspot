export const HOME_TITLE = 'Lint the code your AI agent writes';
export const HOME_DESCRIPTION =
    'gspot installs linters and agent rules for your repository, then runs them on every commit.';
export const TOOLS = [
    { name: 'ESLint', icon: '/tools/eslint.svg' },
    { name: 'Prettier', icon: '/tools/prettier.svg' },
    { name: 'Ruff', icon: '/tools/ruff.svg' },
    { name: 'Stylelint', icon: '/tools/stylelint.svg' },
    { name: 'ShellCheck', icon: '/tools/shellcheck-line.png' },
    { name: 'Semgrep', icon: '/tools/semgrep.svg' },
    { name: 'Knip', icon: '/tools/knip.svg' },
    { name: 'Trivy', icon: '/tools/trivy.svg' },
] as const;
export const CHECK_AREAS = [
    {
        title: 'Linters and formatters',
        text: 'Lint, format, and type checks for TypeScript, JavaScript, Python, Swift, CSS, HTML, Bash, SQL, and Markdown, with rules for React, Next.js, Vue, Svelte, Astro, FastAPI, and more.',
        tools: 'ESLint · Prettier · Ruff · SwiftLint · ShellCheck',
    },
    {
        title: 'Secrets and dependencies',
        text: 'Leaked keys, vulnerable dependencies, licenses, broken links, spelling, and security patterns.',
        tools: 'Gitleaks · TruffleHog · Semgrep · Lychee · typos',
    },
    {
        title: 'Agent rules',
        text: '`AGENTS.md` and one rule file per language and topic, so your agent writes code that passes the checks.',
        tools: '`AGENTS.md` · `.gspot/rules/`',
    },
] as const;
export const CODE_TOKENS =
    /(?<string>'[^']*')|(?<keyword>\b(?:import type|import|from|export async function|try|catch|await)\b)|(?<type>\bCart\b)|(?<function>\b(?:pay|charge)\b)/gu;
export const PASSED_CHECK = /^\S+(?=\s+passed\s)/gmu;
export const REPORT_SUMMARY =
    /^Failed: \d+ checks? with \d+ findings?\. Passed: \d+ checks?\. Skipped: \d+ checks?\./gmu;
export const PASSED_CHECK_LIMIT = 10;
export const SUMMARY_SENTENCE_BREAK = /(?<=\.) /u;
export const COMMIT_RECORD = '[main 066501e] feat: Add checkout';

export const INLINE_CODE_SPAN = /(`[^`]+`)/u;
