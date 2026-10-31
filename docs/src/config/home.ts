export const HOME_TITLE = 'Lint the code your AI agent writes';
export const TOOLS = [
    { name: 'ESLint', icon: 'eslint.svg' },
    { name: 'Prettier', icon: 'prettier.svg' },
    { name: 'Ruff', icon: 'ruff.svg' },
    { name: 'Stylelint', icon: 'stylelint.svg' },
    { name: 'ShellCheck', icon: 'shellcheck.png' },
    { name: 'Semgrep', icon: 'semgrep.svg' },
    { name: 'Knip', icon: 'knip.svg' },
    { name: 'Trivy', icon: 'trivy.svg' },
] as const;
export const USE_CASES = [
    {
        title: 'Blocks bad code',
        text: 'When the checks find bugs, type errors, unsafe code, or code that nothing uses, the Git hooks stop the commit or the push. gspot shows the file, the line, and how to fix it.',
        icon: ['M12 3l7 3v5c0 4.5-3 8.4-7 10-4-1.6-7-5.5-7-10V6l7-3z', 'M9 12l2 2 4-4'],
    },
    {
        title: 'Formats every file',
        text: 'Code, settings, and docs all get the same formatting. `gspot check --fix` does it for you.',
        icon: ['M4 6h16', 'M4 10h11', 'M4 14h16', 'M4 18h11'],
    },
    {
        title: 'Stops leaked passwords and keys',
        text: 'When a staged change holds a password, an API key, or a token, the pre-commit hook stops the commit.',
        icon: ['M4 15a4 4 0 1 0 8 0a4 4 0 1 0-8 0', 'M10.9 12.1L20 3', 'M16 7l3 3', 'M13.5 9.5l2 2'],
    },
    {
        title: 'Checks the packages you install',
        text: 'Before each push, gspot reports packages with known security holes and licenses outside the list you allow.',
        icon: ['M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z', 'M4 7.5l8 4.5 8-4.5', 'M12 12v9'],
    },
    {
        title: 'Tells your agent the rules',
        text: 'gspot writes `AGENTS.md` and a rule file for each language, so your agent knows how to write code that passes.',
        icon: ['M6 3h9l4 4v14H6z', 'M14 3v5h5', 'M9 13h7', 'M9 17h5'],
    },
    {
        title: 'Works the same everywhere',
        text: 'Every tool that gspot installs is locked to one version, so you, your agent, and CI get the same result.',
        icon: ['M12 16v5', 'M8 3h8l-1 6 3 3v2H6v-2l3-3-1-6z'],
    },
] as const;
export const CODE_TOKENS =
    /(?<string>'[^']*')|(?<keyword>\b(?:import type|import|from|export async function|try|catch|await)\b)|(?<type>\bCart\b)|(?<function>\b(?:pay|charge)\b)/gu;
export const SUMMARY_SENTENCE_BREAK = /(?<=\.) /u;
export const URL_BREAK = /(?<=\/)(?!\/)/u;
export const COPY_FAILED_MESSAGE = 'Copy failed. Select and copy the text.';
export const COPIED_MESSAGE = 'Copied.';
