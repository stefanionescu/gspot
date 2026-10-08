export const POLICY_PATHS = ['gspot.toml', '.gspot/config/lychee.toml'];

export const LINK_POLICY = `configurations = ["docs"]
[scope."api"]
configurations = ["docs"]
[[ignore]]
check = "docs/lychee"
paths = ["ignored/**"]
reason = "These pages are evaluated only after the documentation build."
`;

export const COMPONENTS = [
    { path: 'src/Card.vue', source: '<template><p>Card</p></template><style>p { color: red; }</style>' },
    { path: 'src/Card.svelte', source: '<p>Card</p><style>p { color: red; }</style>' },
];

/** The tool runtime follows applicable npm checks, independently of the repository's language runtime. */
export const NODE_REQUIREMENTS = [
    {
        name: 'Python with native mise tools',
        runner: 'mise',
        configurations: ['python'],
        files: { 'app.py': 'value = 1\n', 'pyproject.toml': '[project]\nname = "app"\nversion = "1.0.0"\n' },
        node: false,
    },
    {
        name: 'Python with the npm EditorConfig wrapper',
        runner: 'npm',
        configurations: ['python'],
        files: { 'app.py': 'value = 1\n', 'pyproject.toml': '[project]\nname = "app"\nversion = "1.0.0"\n' },
        node: true,
    },
    {
        name: 'Python with Markdown',
        runner: 'mise',
        configurations: ['python', 'markdown'],
        files: { 'app.py': 'value = 1\n', 'guide.md': '# Guide\n' },
        node: true,
    },
    {
        name: 'Bun with TypeScript',
        runner: 'mise',
        configurations: ['typescript'],
        files: {
            'app.ts': 'export const value = 1;\n',
            'package.json': '{"private":true,"engines":{"bun":"1.4.2"}}\n',
        },
        node: true,
    },
];

/** The SDK-only root has no app; the child app owns its complete build inputs. */
export const NEXT_BUILD_FILES = {
    'package.json': '{"dependencies":{"next":"16.3.5"}}',
    'library.ts': 'export const count = 1;\n',
    'web/package.json': '{"dependencies":{"next":"16.3.5"}}',
    'web/tsconfig.json': '{}',
    'web/src/data.ts': 'export const count = 1;\n',
};

export const NEXT_BUILD_TABLES = `[scope."web"]
configurations = ["nextjs"]
`;

/** Next.js accepts either router at the project root or under src. */
export const NEXT_BUILD_ROUTES = ['app/page.tsx', 'src/app/page.tsx', 'pages/index.tsx', 'src/pages/index.tsx'];

/** Coverage choices stay constant while language selections and the level change. */
export const AUTOMATIC_CHECKS = [
    'security/semgrep',
    'security/semgrep-registry',
    'security/codeql',
    'duplication/jscpd',
    'licenses/packages',
];

/** Empty and named manual language lists both retain common checks. */
export const MANUAL_SELECTIONS = [
    { configurations: undefined },
    { configurations: [] },
    { configurations: ['python'] },
];
