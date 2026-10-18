export const HOME_TITLE = 'Lint the code your AI agent writes';
export const TOOLS = [
    { name: 'ESLint', icon: '/tools/eslint.svg' },
    { name: 'Prettier', icon: '/tools/prettier.svg' },
    { name: 'Ruff', icon: '/tools/ruff.svg' },
    { name: 'Stylelint', icon: '/tools/stylelint.svg' },
    { name: 'ShellCheck', icon: '/tools/shellcheck.png' },
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
        tools: '`AGENTS.md` · `.gspot/configurations/`',
    },
] as const;
export const CODE_TOKENS =
    /(?<string>'[^']*')|(?<keyword>\b(?:import type|import|from|export async function|try|catch|await)\b)|(?<type>\bCart\b)|(?<function>\b(?:pay|charge)\b)/gu;
export const SUMMARY_SENTENCE_BREAK = /(?<=\.) /u;
/** The places a long URL may wrap: after each slash that ends a part of the address. */
export const URL_BREAK = /(?<=\/)(?!\/)/u;
export const COMMIT_RECORD = '[main 066501e] feat: Add checkout';

export const INLINE_CODE_SPAN = /(`[^`]+`)/u;
