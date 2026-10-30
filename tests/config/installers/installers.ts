import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';
import { HUSKY_STUBS } from '#tests/config/repository/repository.ts';
import { PYTHON_VERSION } from '#cli/config/installers/installers.ts';

export const REGISTRY_PASSWORDS = [
    ['https://example.com/simple', []],
    ['https://alex@example.com/simple', []],
    ['https://alex:test%2Bpassword@example.com/simple', ['test%2Bpassword', 'test+password']],
    ['https://alex:password@example.com/simple', ['password', 'password']],
] as const;

export const LEAKED_LOCKFILES = [
    'password = "synthetic/password+with spaces"',
    'url = "https://alex:synthetic%2Fpassword%2Bwith%20spaces@example.com/simple"',
] as const;

const NPM_PROJECT_PACKAGE =
    '{"private":true,"packageManager":"npm@11.10.1","devDependencies":{"@gspothq/cli":"0.1.0"}}';

export const HOOK_REPOSITORIES = [
    {
        name: 'another hooks folder',
        location: '.githooks',
        startProgram: 'mise',
        files: { '.githooks/pre-commit': '#!/bin/sh\n' },
        setting: ['config', 'core.hooksPath', '.githooks'],
        gitHook: false,
    },
    {
        name: 'a Husky folder',
        location: '.husky',
        startProgram: 'npm',
        files: {
            'package.json': NPM_PROJECT_PACKAGE,
            '.husky/pre-commit': 'npm test\n',
        },
        setting: undefined,
        gitHook: false,
    },
    {
        name: 'a Husky 9 folder',
        location: '.husky',
        startProgram: 'npm',
        files: {
            'package.json': NPM_PROJECT_PACKAGE,
            '.husky/pre-commit': 'npm test\n',
            ...HUSKY_STUBS,
        },
        setting: ['config', 'core.hooksPath', '.husky/_'],
        gitHook: false,
    },
    {
        name: 'a Lefthook configuration',
        location: 'lefthook.yml',
        startProgram: 'npm',
        files: {
            'package.json': NPM_PROJECT_PACKAGE,
            'lefthook.yml': 'pre-commit:\n',
        },
        setting: undefined,
        gitHook: false,
    },
    {
        name: 'a script in the Git hooks folder',
        location: '.git/hooks',
        startProgram: 'npm',
        files: {
            'package.json': NPM_PROJECT_PACKAGE,
        },
        setting: undefined,
        gitHook: true,
    },
] as const;

export const STOCK_LFS_PRE_PUSH = String.raw`#!/bin/sh
command -v git-lfs >/dev/null 2>&1 || { printf >&2 "\n%s\n\n" "This repository is configured for Git LFS but 'git-lfs' was not found on your path. If you no longer wish to use Git LFS, remove this hook by deleting the 'pre-push' file in the hooks directory (set by 'core.hookspath'; usually '.git/hooks')."; exit 2; }
git lfs pre-push "$@"
`;

export const HOOK_CONFIGURATION_CASES = [
    {
        path: '.pre-commit-config.yaml',
        oneHook:
            'repos:\n  - repo: local\n    hooks:\n      - id: gspot-commit\n        name: gspot commit\n        language: system\n        entry: gspot check --hook pre-commit\n',
        bothHooks:
            'repos:\n  - repo: local\n    hooks:\n      - id: gspot-commit\n        name: gspot commit\n        language: system\n        entry: gspot check --hook pre-commit\n      - id: gspot-push\n        name: gspot push\n        language: system\n        entry: gspot check --hook pre-push\n        stages: [pre-push]\n      - id: gspot-message\n        name: gspot message\n        language: system\n        entry: gspot check --hook commit-msg\n        stages: [commit-msg]\n',
    },
    {
        path: 'package.json',
        oneHook: '{"simple-git-hooks":{"pre-commit":"gspot check --hook pre-commit"}}',
        bothHooks:
            '{"simple-git-hooks":{"pre-commit":"gspot check --hook pre-commit","pre-push":"gspot check --hook pre-push","commit-msg":"gspot check --hook commit-msg"}}',
    },
] as const;

export const YARN_CLIENTS = [
    {
        packageManager: { name: 'yarn', version: '1.22.22' },
    },
    {
        packageManager: { name: 'yarn', version: '4.12.0' },
    },
] as const;

export const UV_TOML = `index-url = "https://alex:test%2Bpassword@example.com/simple"
find-links = ["wheels", "https://example.com/wheels"]
offline = true
resolution = "lowest-direct"

[[index]]
name = "local"
url = "packages"
`;

export const PYTHON_TOOL_PROJECT = `[project]
name = "tools"
version = "0.0.0"
requires-python = "==${PYTHON_VERSION}"
dependencies = ["Example.Package==1.2.3", "second-package==4.0.0"]

[tool.uv]
package = false
constraint-dependencies = ["transitive.package>=2.0.0"]
`;

export const PYTHON_TOOL_LOCKFILE = `version = 1
requires-python = "==${PYTHON_VERSION}"

[manifest]
constraints = [{ name = "transitive-package", specifier = ">=2.0.0" }]

[[package]]
name = "tools"
version = "0.0.0"
source = { virtual = "." }
metadata = { requires-dist = [{ name = "second_package", specifier = "==4.0.0" }, { name = "example-package", specifier = "==1.2.3" }] }
`;

export const UV_LOCKFILE_MISMATCHES = [
    ['Python version', `==${PYTHON_VERSION}`, '==3.13.15'],
    ['pin', '==4.0.0', '==5.0.0'],
    ['virtual root', 'virtual = "."', 'virtual = "elsewhere"'],
] as const;

export const UV_LOCKFILE_ORIGINS = [
    ['https://pypi.org/simple', 'https://files.pythonhosted.org/example.whl', true, {}],
    ['https://attacker.example/simple', 'https://files.pythonhosted.org/example.whl', false, {}],
    ['https://pypi.org/simple', 'https://attacker.example/example.whl', false, {}],
    [
        'https://pypi.org/simple',
        'https://files.pythonhosted.org/example.whl',
        false,
        { 'index-url': 'https://packages.example/simple' },
    ],
    [
        'https://packages.example/simple',
        'https://packages.example/example.whl',
        true,
        { 'index-url': 'https://packages.example/simple' },
    ],
    [
        'https://pypi.org/simple',
        'https://files.pythonhosted.org/example.whl',
        false,
        { index: [{ url: 'https://packages.example/simple', default: true }] },
    ],
    [
        'https://packages.example/simple',
        'https://files.pythonhosted.org/example.whl',
        true,
        { index: [{ url: 'https://packages.example/simple', default: true }] },
    ],
    [
        'https://pypi.org/simple',
        'https://files.pythonhosted.org/example.whl',
        true,
        { index: [{ url: 'https://packages.example/simple' }] },
    ],
] satisfies [string, string, boolean, Record<string, unknown>][];

export const LOCKFILE_PASSWORD_ERROR = {
    name: 'GspotError',
    code: 'install',
    message:
        'The uv lockfile holds the index credentials of the repository. gspot kept the existing files. Remove the credentials from the index URL.',
} as const;

export const PYPROJECT_UV_INDEX = `[project]
name = "authored-project"

[tool.uv]
index-url = "https://example.com/simple"
find-links = ["wheels"]
`;

export const INVALID_UV_SETTINGS = [
    { file: 'uv.toml', field: 'find-links', text: 'find-links = "https://example.com/wheels"\n' },
    { file: 'uv.toml', field: 'index', text: 'index = "x"\n' },
    {
        file: 'pyproject.toml',
        field: 'tool.uv.find-links',
        text: '[tool.uv]\nfind-links = "https://example.com/wheels"\n',
    },
    { file: 'pyproject.toml', field: 'tool.uv.index', text: '[tool.uv]\nindex = "x"\n' },
];

export const PYTHON_INSTALL_FILES = {
    'gspot.toml': 'configurations = []\n[rules]\nenabled = false\n',
    [GSPOT_PATHS.pythonProject]: PYTHON_TOOL_PROJECT,
    [GSPOT_PATHS.uvLockfile]: PYTHON_TOOL_LOCKFILE,
    'uv.toml': UV_TOML,
};

export const PREVIOUS_BYTES = 'previous bytes\n';
