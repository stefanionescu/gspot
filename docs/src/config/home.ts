// example section
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

// home page
export const BENEFITS = [
    {
        title: 'Catch problems before every commit',
        text: 'When you commit, gspot checks the files you changed, lists each problem, and stops the commit.',
        icon: ['M12 3l7 3v5c0 4.5-3 8.4-7 10-4-1.6-7-5.5-7-10V6l7-3z', 'M9 12l2 2 4-4'],
    },
    {
        title: 'Set up all your linters with one command',
        text: 'Run `gspot init`. It finds the languages and frameworks in your repository, turns on linters and formatters for them, and writes their settings.',
        icon: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M7 9l3 3-3 3', 'M12 15h5'],
    },
    {
        title: 'Run the same tool versions everywhere',
        text: "gspot pins each tool that it installs, so your machine, your teammates' machines, and CI run the same versions.",
        icon: ['M12 16v5', 'M8 3h8l-1 6 3 3v2H6v-2l3-3-1-6z'],
    },
    {
        title: 'Give your coding agent the rules',
        text: 'gspot adds rules to `AGENTS.md` that tell coding agents how to write code that passes the checks.',
        icon: ['M6 3h9l4 4v14H6z', 'M14 3v5h5', 'M9 13h7', 'M9 17h5'],
    },
    {
        title: 'Keep your formatting settings',
        text: '`gspot init` copies the indentation, line width, and quote style from your Prettier, EditorConfig, or Ruff settings. With none of those, it uses the defaults of each formatter.',
        icon: ['M4 6h16', 'M4 12h10', 'M4 18h14'],
    },
    {
        title: 'Keep secrets and vulnerable packages out',
        text: 'A commit that adds an API key or a token stops. A push that changes a lockfile stops when a locked package has a known security hole.',
        icon: ['M4 15a4 4 0 1 0 8 0a4 4 0 1 0-8 0', 'M10.9 12.1L20 3', 'M16 7l3 3', 'M13.5 9.5l2 2'],
    },
] as const;
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

// setup section
export const COPIED_MESSAGE = 'Copied.';
export const COPY_FAILED_MESSAGE = 'Copy failed. Select and copy the text.';
export const URL_BREAK = /(?<=\/)(?!\/)/u;
