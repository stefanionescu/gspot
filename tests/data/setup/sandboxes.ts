import { AMBIGUOUS_WORD_RULE } from '#tests/data/checks/prose.ts';

export const OFFLINE_ENVIRONMENT = {
    HTTP_PROXY: 'http://127.0.0.1:1',
    HTTPS_PROXY: 'http://127.0.0.1:1',
    ALL_PROXY: 'http://127.0.0.1:1',
    NO_PROXY: '',
    http_proxy: undefined,
    https_proxy: undefined,
    all_proxy: undefined,
    no_proxy: undefined,
} as const;
export const NPM_INSTALL_FLAGS = ['--ignore-scripts', '--no-audit', '--no-fund'] as const;
export const PNPM_WORKSPACE = 'packages:\n  - "**"\n';
/** Committed source and different working-tree bytes for the built-in and command check push tests. */
export const PUSH_CONTENT = {
    base: 'echo base\n',
    reviewed: 'echo reviewed\n',
    broken: 'if then\n',
    working: 'echo repaired only in the working tree\n',
    settings: 'invalid working policy',
} as const;

export const NPM_CHECK_IGNORES = `[[ignore]]
check = "data-files/v8r"
reason = "This sandbox exercises tools without JSON schema checks."
[[ignore]]
check = "format/editorconfig-checker"
reason = "This sandbox exercises tools without the npm editor checker."
[[ignore]]
check = "format/prettier"
reason = "This sandbox exercises tools without the npm formatter."
`;
export const BASE_INSTALLED_FILES = {
    '.gitignore': 'node_modules/\n',
    'package.json': '{"name":"example","private":true,"type":"module"}',
    'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
    'source.ts': 'export const VALUE = 1;\n',
    'source.js': 'export const VALUE = 1;\n',
    'source.py': '"""Example module."""\nVALUE = 1\n',
    'source.sh': '#!/usr/bin/env bash\nset -euo pipefail\nprintf "%s\\n" ready\n',
    'Source.swift': 'let value = 1\n',
    'index.html':
        '<!doctype html><html lang="en"><head><title>Example</title></head><body><p>Example.</p></body></html>',
    'style.css': 'body { color: black; }\n',
    'pyproject.toml': '[project]\nname = "example"\nversion = "1.0.0"\ndependencies = []\n',
} as const;

export const REGISTRY_HOST = '127.0.0.1';
export const NPM_REGISTRY_TOKEN = 'synthetic-package-install-token';

/** The zip options of a regular and an executable Unix file: creator system 3, which means Unix, and the mode in the upper 16 bits. */
export const ZIP_FILE_OPTIONS = {
    regular: { os: 3, attrs: 0o10_0644 * 0x1_00_00 },
    executable: { os: 3, attrs: 0o10_0755 * 0x1_00_00 },
} as const;

export const NPM_PACK_FLAGS = ['--ignore-scripts', '--json'] as const;

export const UPSTREAM_REGISTRY = 'https://registry.npmjs.org/';
export const GSPOT_PACKAGE_SCOPE = '@gspothq/';

/** The publish time the local registry reports for packed packages outside gspot, older than any release hold. */
export const PACKED_PUBLISH_TIME = '2025-01-01T00:00:00.000Z';

export const SANDBOX_PACKAGE_JSON = {
    name: 'example',
    version: '1.0.0',
    private: true,
    description: 'A sandbox.',
    type: 'module',
} as const;

export const SANDBOX_GITIGNORE = 'node_modules\n';
export const VALE_PACKAGE_FILES = {
    ...Object.fromEntries<string>(
        [
            'Google/terms.yml',
            'Microsoft/terms.yml',
            'write-good/terms.yml',
            'proselint/terms.yml',
            'alex/terms.yml',
            'RedHat/terms.yml',
            'Harper/styles/Harper/terms.yml',
        ].map((path) => [path, AMBIGUOUS_WORD_RULE]),
    ),
    'Harper/styles/config/dictionaries/harper.txt': `dictionary fixture
`,
};

// The authored files every package project starts from.
export const NPM_PROJECT_FILES = {
    'other/package.json': '{"private":true,"packageManager":"npm@99.0.0"}',
    'source.js': 'export const greeting="hello";',
    'node_modules/authored.txt': 'keep project dependencies',
} as const;

/** The npm projects test the Prettier and EditorConfig installs, not the code analyzers. */
export const NPM_PROJECT_IGNORES = [
    'data-files/v8r',
    'javascript/eslint',
    'javascript/tsc',
    'javascript/knip',
] as const;

export const NPM_PROJECT_ROOT_PACKAGE = {
    private: true,
    devDependencies: { eslint: '0.0.0-authored' },
    scripts: { test: 'authored-command' },
    workspaces: ['**'],
} as const;

export const YARN_VERSION_THRESHOLD = 2;

/** The authored files that every Python project starts from. */
export const PYTHON_PROJECT_FILES = {
    'pyproject.toml': `[project]
name = "authored"
version = "1.0.0"
dependencies = ["authored-dependency"]
`,
    '.venv/authored.txt': 'keep the project environment',
    'source.py': 'import os\n',
} as const;

// The uv variables redirected to the sandbox.
export const UV_PROJECT_VARIABLES = ['UV_PROJECT', 'UV_WORKING_DIR', 'UV_PROJECT_ENVIRONMENT'] as const;

export const PYTHON_PROJECT_IGNORES = [
    'data-files/v8r',
    'security/semgrep',
    'security/semgrep-registry',
    'format/editorconfig-checker',
    'python/basedpyright',
    'python/pydoclint',
    'python/deptry',
] as const;

export const PYTHON_INDEX_NAME = 'gspot-test';

export const LFS_ATTRIBUTES = '*.bin filter=lfs diff=lfs merge=lfs -text\n';

/** A file outside the scope and a committed source in the nested scope. The file selection and push tests use them. */
export const NESTED_SCOPE_FILES = {
    'outside.txt': 'repository context',
    'nested settings/source.txt': 'committed',
} as const;
