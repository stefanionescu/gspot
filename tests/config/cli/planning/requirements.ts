import { NATIVE_MISE_POLICY } from '#tests/config/samples/npm.ts';

const PYTHON_PROJECT = {
    'app.py': 'value = 1\n',
    'pyproject.toml': '[project]\nname = "app"\nversion = "1.0.0"\n',
};

/** The tool runtime follows applicable npm checks, independently of the repository's language runtime. */
export const NODE_REQUIREMENTS = [
    {
        name: 'Python with npm schema peers under mise',
        tables: 'runner = "mise"\n',
        configurations: ['python'],
        files: PYTHON_PROJECT,
        node: true,
    },
    {
        name: 'Python with native mise tools',
        tables: NATIVE_MISE_POLICY,
        configurations: ['python'],
        files: PYTHON_PROJECT,
        node: false,
    },
    {
        name: 'Python with the npm EditorConfig wrapper',
        tables: 'runner = "npm"\n',
        configurations: ['python'],
        files: PYTHON_PROJECT,
        node: true,
    },
    {
        name: 'Python with Markdown',
        tables: 'runner = "mise"\n',
        configurations: ['python', 'markdown'],
        files: { 'app.py': 'value = 1\n', 'guide.md': '# Guide\n' },
        node: true,
    },
    {
        name: 'Bun with TypeScript',
        tables: 'runner = "mise"\n',
        configurations: ['typescript'],
        files: {
            'app.ts': 'export const value = 1;\n',
            'package.json': '{"private":true,"engines":{"bun":"1.4.2"}}\n',
        },
        node: true,
    },
];

/** Native modules apply at both levels. Roles and selected test paths apply at all. */
export const ROLE_REQUIREMENTS = [
    {
        name: 'root modules',
        tables: '[[architecture.modules]]\nname = "runtime"\npaths = ["src/**"]\n',
        boundary: { recommended: true, all: true },
    },
    {
        name: 'child modules',
        tables: '[[scope.app.architecture.modules]]\nname = "runtime"\npaths = ["src/**"]\n',
        boundary: { recommended: true, all: true },
    },
    {
        name: 'empty authored role paths retain selected defaults',
        tables: '[architecture.roles]\nruntime = []\n',
        boundary: { recommended: false, all: true },
    },
    {
        name: 'root role paths',
        tables: '[architecture.roles]\nruntime = ["src/**"]\n',
        boundary: { recommended: false, all: true },
    },
    {
        name: 'child role paths',
        tables: '[scope.app.architecture.roles]\nruntime = ["src/**"]\n',
        boundary: { recommended: false, all: true },
    },
];
