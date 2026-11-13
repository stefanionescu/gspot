import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { PYTHON_TOOL_PROJECT as PYTHON_PROJECT } from '#cli/config/tools/installers.ts';

// foreign hooks
const HUSKY_STUBS = {
    '.husky/_/.gitignore': '*\n',
    '.husky/_/h': '#!/usr/bin/env sh\n',
    '.husky/_/pre-commit': '#!/usr/bin/env sh\n. "$(dirname "$0")/h"\n',
};
const NPM_PROJECT_PACKAGE =
    '{"private":true,"packageManager":"npm@11.10.1","devDependencies":{"@gspothq/cli":"0.1.0"}}';
export const HOOK_REPOSITORIES = [
    {
        name: 'another hooks folder',
        location: '.githooks',
        files: { '.githooks/pre-commit': '#!/bin/sh\n' },
        setting: ['config', 'core.hooksPath', '.githooks'],
        gitHook: false,
    },
    {
        name: 'a Husky folder',
        location: '.husky',
        files: {
            'package.json': NPM_PROJECT_PACKAGE,
            '.husky/pre-commit': 'npm test\n',
        },
        setting: ['config', 'core.hooksPath', '.husky'],
        gitHook: false,
    },
    {
        name: 'a Husky 9 folder',
        location: '.husky',
        files: {
            'package.json': NPM_PROJECT_PACKAGE,
            '.husky/pre-commit': 'npm test\n',
            ...HUSKY_STUBS,
        },
        setting: ['config', 'core.hooksPath', '.husky/_'],
        gitHook: false,
    },
    {
        name: 'a script in the Git hooks folder',
        location: '.git/hooks',
        files: {
            'package.json': NPM_PROJECT_PACKAGE,
        },
        setting: undefined,
        gitHook: true,
    },
] as const;

// gspot hooks
export const STOCK_LFS_PRE_PUSH = String.raw`#!/bin/sh
command -v git-lfs >/dev/null 2>&1 || { printf >&2 "\n%s\n\n" "This repository is configured for Git LFS but 'git-lfs' was not found on your path. If you no longer wish to use Git LFS, remove this hook by deleting the 'pre-push' file in the hooks directory (set by 'core.hookspath'; usually '.git/hooks')."; exit 2; }
git lfs pre-push "$@"
`;

// package inspection
export const SYSTEM_PLUGIN_REPORTS = [
    {
        name: 'installed',
        stdout: 'registered third-party plugins:\n  pytest-cov-7.1.0 at /project/.venv/pytest_cov/plugin.py',
        code: 0,
        inspection: { state: 'system', found: '7.1.0', minimumVersion: undefined },
        noted: undefined,
    },
    {
        name: 'absent',
        stdout: 'pytest 9.1.1',
        code: 0,
        inspection: { state: 'missing' },
        noted: 'pytest-cov',
    },
] as const;

// pypi installer
export const INVALID_UV_SETTINGS = [
    { file: 'uv.toml', field: 'find-links', text: 'find-links = "https://example.com/wheels"\n' },
    {
        file: 'pyproject.toml',
        field: 'tool.uv.find-links',
        text: '[tool.uv]\nfind-links = "https://example.com/wheels"\n',
    },
];
export const PYPROJECT_UV_INDEX = `[project]
name = "authored-project"

[tool.uv]
index-url = "https://example.com/simple"
find-links = ["wheels"]
`;
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
requires-python = "${PYTHON_PROJECT['requires-python']}"
dependencies = ["Example.Package==1.2.3", "second-package==4.0.0"]

[tool.uv]
package = false
constraint-dependencies = ["transitive.package>=2.0.0"]
`;
export const PYTHON_TOOL_LOCKFILE = `version = 1
requires-python = "${PYTHON_PROJECT['requires-python']}"

[manifest]
constraints = [{ name = "transitive-package", specifier = ">=2.0.0" }]

[[package]]
name = "tools"
version = "0.0.0"
source = { virtual = "." }
metadata = { requires-dist = [{ name = "second_package", specifier = "==4.0.0" }, { name = "example-package", specifier = "==1.2.3" }] }
`;
export const PYTHON_INSTALL_FILES = {
    'gspot.toml': 'configurations = []\n[rule_files]\nenabled = false\n',
    [GSPOT_PATHS.pythonProject]: PYTHON_TOOL_PROJECT,
    [GSPOT_PATHS.uvLockfile]: PYTHON_TOOL_LOCKFILE,
    'uv.toml': UV_TOML,
};
export const UV_LOCKFILE_MISMATCHES = [
    ['Python version', PYTHON_PROJECT['requires-python'], '==0.0.0'],
    ['pin', '==4.0.0', '==5.0.0'],
    ['virtual root', 'virtual = "."', 'virtual = "elsewhere"'],
] as const;
export const UV_LOCKFILE_ORIGINS = [
    {
        name: 'the PyPI index and its file host',
        registry: 'https://pypi.org/simple',
        url: 'https://files.pythonhosted.org/example.whl',
        expected: true,
        indexes: {},
    },
    {
        name: 'an index outside the default',
        registry: 'https://attacker.example/simple',
        url: 'https://files.pythonhosted.org/example.whl',
        expected: false,
        indexes: {},
    },
    {
        name: 'an artifact host outside PyPI',
        registry: 'https://pypi.org/simple',
        url: 'https://attacker.example/example.whl',
        expected: false,
        indexes: {},
    },
    {
        name: 'the PyPI index after index-url replaces it',
        registry: 'https://pypi.org/simple',
        url: 'https://files.pythonhosted.org/example.whl',
        expected: false,
        indexes: { 'index-url': 'https://packages.example/simple' },
    },
    {
        name: 'the index and artifact host that index-url names',
        registry: 'https://packages.example/simple',
        url: 'https://packages.example/example.whl',
        expected: true,
        indexes: { 'index-url': 'https://packages.example/simple' },
    },
    {
        name: 'the PyPI index after a default index replaces it',
        registry: 'https://pypi.org/simple',
        url: 'https://files.pythonhosted.org/example.whl',
        expected: false,
        indexes: { index: [{ url: 'https://packages.example/simple', default: true }] },
    },
    {
        name: 'the default index and an artifact on the PyPI file host',
        registry: 'https://packages.example/simple',
        url: 'https://files.pythonhosted.org/example.whl',
        expected: true,
        indexes: { index: [{ url: 'https://packages.example/simple', default: true }] },
    },
    {
        name: 'the PyPI index beside an added index',
        registry: 'https://pypi.org/simple',
        url: 'https://files.pythonhosted.org/example.whl',
        expected: true,
        indexes: { index: [{ url: 'https://packages.example/simple' }] },
    },
] satisfies Array<{ name: string; registry: string; url: string; expected: boolean; indexes: Record<string, unknown> }>;

// tool pins
const PNPM_TYPESCRIPT_LOCK =
    "lockfileVersion: '9.0'\n\nimporters:\n\n  .:\n    devDependencies:\n      typescript:\n        specifier: ^6.0.3\n        version: 6.0.3\n";
const RANGE_PACKAGE = '{"name":"example","private":true,"devDependencies":{"typescript":"^6.0.3"}}\n';
export const TOOL_PROJECT_PACKAGES = [
    {
        name: 'npm',
        tool: 'linter',
        version: '1.0.0',
        system: false,
        installers: { npm: { name: 'linter', version: '1.0.0' } },
        expected: { kind: 'npm', name: 'linter', version: '1.0.0', requires: ['node'] },
    },
    {
        name: 'Python',
        tool: 'formatter',
        version: '3.0.0',
        system: false,
        installers: {
            pypi: { name: 'formatter', version: '3.0.0' },
            mise: { name: 'formatter', version: '3.0.0', checksums: {} },
        },
        expected: { kind: 'python', name: 'formatter', version: '3.0.0' },
    },
    {
        name: 'a system tool with a pypi pin',
        tool: 'checker',
        version: '5.0.0',
        system: true,
        installers: { pypi: { name: 'checker', version: '5.0.0' } },
        expected: undefined,
    },
] as const;
export const TYPESCRIPT_PIN_CASES = [
    {
        name: 'an exact version',
        files: { 'package.json': '{"name":"example","private":true,"devDependencies":{"typescript":"6.0.3"}}\n' },
        untracked: [],
        isProjectPin: true,
    },
    {
        name: 'a range that the tracked lockfile resolves',
        files: { 'package.json': RANGE_PACKAGE, 'pnpm-lock.yaml': PNPM_TYPESCRIPT_LOCK },
        untracked: [],
        isProjectPin: true,
    },
    {
        name: 'a range with an untracked lockfile',
        files: { 'package.json': RANGE_PACKAGE, 'pnpm-lock.yaml': PNPM_TYPESCRIPT_LOCK },
        untracked: ['pnpm-lock.yaml'],
        isProjectPin: false,
    },
    {
        name: 'a version that typescript-eslint does not support',
        files: { 'package.json': '{"name":"example","private":true,"devDependencies":{"typescript":"3.9.10"}}\n' },
        untracked: [],
        isProjectPin: false,
    },
] as const;

// tool versions
export const VERSION_OUTPUTS = [
    {
        name: 'text without a version',
        toolArguments: ['--line', 'unrecognized output'],
        state: 'error',
        found: undefined,
        note: 'unrecognized output',
    },
    {
        name: 'a version on stderr',
        toolArguments: ['--stderr', '3.8.1\n'],
        state: 'system',
        found: '3.8.1',
        note: undefined,
    },
    {
        name: 'a version between color codes',
        toolArguments: ['--line', 'version-teller \u{1B}[1;36m3.8.1\u{1B}[0m using more'],
        state: 'system',
        found: '3.8.1',
        note: undefined,
    },
] as const;
