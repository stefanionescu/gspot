export const HOOKS_SETTINGS = '[hooks]\nenabled = true\n';
export const RULE_TESTER_ROOT = '/repo';

export const RULE_TESTER_PARSER_OPTIONS = {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
} as const;

export const SANDBOX_PACKAGE_JSON = {
    name: 'example',
    version: '1.0.0',
    private: true,
    description: 'A sandbox.',
    type: 'module',
} as const;

export const SANDBOX_GITIGNORE = 'node_modules\n';

// Poll child exit and readiness markers within the shared test deadline.
export const POLL_MILLISECONDS = 10;

// One deadline bounds each test and its child processes.
export const TEST_TIMEOUT_MILLISECONDS = 900_000;

export const GSPOT_ENVIRONMENT = { NO_COLOR: '1', CI: '1' } as const;

/** The folder for the npm packages packed before the test workers start. */
export const TEST_RUN_FOLDER_NAME = 'gspot-test-run';

export const TEST_RUN_HASH_LENGTH = 12;

export const TEST_RUN_FOLDER_SCRIPT =
    'const setup = await import(process.argv[1]); console.log(setup.TEST_RUN_FOLDER);';

export const TOOL_PATHS_FILE = 'tool-paths.txt';

export const GSPOT_LAUNCHER_PATH = 'bin/gspot';

export const PACKED_PACKAGES_FILE = 'packages.json';

export const NPM_PACK_FLAGS = ['--ignore-scripts', '--json'] as const;

export const REGISTRY_HOST = '127.0.0.1';

export const UPSTREAM_REGISTRY = 'https://registry.npmjs.org/';

export const GSPOT_PACKAGE_SCOPE = '@gspothq/';

export const PINNED_TOOLS_FILE = 'mise.toml';

export const MISE_TRUST = ['mise', 'trust'] as const;

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

// The authored files every package project starts from.
export const NPM_SANDBOX_FILES = {
    'other/package.json': '{"private":true,"packageManager":"npm@99.0.0"}',
    'source.js': 'export const greeting="hello";',
    'node_modules/authored.txt': 'keep project dependencies',
} as const;

/** Package manager sandboxes test the Prettier and EditorConfig installs, not the code analyzers. */
export const NPM_SANDBOX_IGNORES = ['files/v8r', 'javascript/eslint', 'javascript/tsc', 'javascript/knip'] as const;

export const NPM_REGISTRY_TOKEN = 'synthetic-package-install-token';

export const NPM_SANDBOX_PACKAGE = {
    private: true,
    devDependencies: { eslint: '0.0.0-authored' },
    scripts: { test: 'authored-command' },
    workspaces: ['**'],
} as const;

export const PNPM_WORKSPACE = 'packages:\n  - "**"\n';

export const YARN_VERSION_THRESHOLD = 2;

/** Prints each path it gets, then fails. */
export const REPORT_PROGRAM = 'process.argv.slice(1).forEach((path) => console.log(path)); process.exitCode = 1;';

/** Committed source and different working-tree bytes for the built-in and command check push tests. */
export const PUSH_CONTENT = {
    base: 'echo base\n',
    reviewed: 'echo reviewed\n',
    broken: 'if then\n',
    working: 'echo repaired only in the working tree\n',
    settings: 'invalid working policy',
} as const;

export const GIT_TEST_ARGUMENTS = [
    '-c',
    'user.email=t@t',
    '-c',
    'user.name=t',
    '-c',
    'maintenance.auto=false',
    '-c',
    'gc.auto=0',
    '-c',
    'core.autocrlf=false',
] as const;

export const GIT_TEST_ENVIRONMENT = { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '' } as const;

export const EXECUTABLE_MODE = 0o755;

/** The archive fields for the Python wheel. */
export const ZIP_LAYOUT = {
    local: {
        size: 30,
        signature: 0x04_03_4b_50,
        version: 20,
        versionOffset: 4,
        crcOffset: 14,
        compressedSizeOffset: 18,
        sizeOffset: 22,
        nameLengthOffset: 26,
    },
    central: {
        size: 46,
        signature: 0x02_01_4b_50,
        version: 0x03_14,
        versionOffset: 4,
        localCopyOffset: 6,
        localStart: 4,
        localEnd: 28,
        modeOffset: 38,
        localOffset: 42,
    },
    unix: { executable: 0o10_0755, regular: 0o10_0644, modeShift: 16 },
    end: {
        size: 22,
        signature: 0x06_05_4b_50,
        diskCountOffset: 8,
        countOffset: 10,
        sizeOffset: 12,
        directoryOffset: 16,
    },
} as const;

// The authored files every Python sandbox starts from.
export const PYTHON_SANDBOX_FILES = {
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

export const PYTHON_SANDBOX_IGNORES = [
    'files/v8r',
    'security/semgrep',
    'security/semgrep-registry',
    'format/editorconfig-checker',
    'python/basedpyright',
    'python/pydoclint',
    'python/deptry',
] as const;

export const PYTHON_INDEX_CREDENTIALS = { user: 'gspot', password: 'synthetic-uv-password' } as const;

export const PYTHON_INDEX_NAME = 'gspot-test';

export const RUFF_VERSION_OUTPUT = /^ruff (?<version>\d+\.\d+\.\d[-+\w.]*)$/u;

export const NPM_CHECK_IGNORES = `[[ignore]]
check = "files/v8r"
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

/** The publish time the local registry reports for packed packages outside gspot, older than any release hold. */
export const PACKED_PUBLISH_TIME = '2025-01-01T00:00:00.000Z';
