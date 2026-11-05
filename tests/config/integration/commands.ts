import { dirname } from 'node:path';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';

export const SUPABASE_SANDBOX = {
    install: false,
    configurations: ['supabase'],

    without: ['typescript'],
    files: {
        'supabase/config.toml': `project_id = "example"

[functions.greet]
verify_jwt = true
`,
        'supabase/functions/greet/index.ts': 'Deno.serve(() => new Response("hello"));\n',
    },
} as const;

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

export const UNQUOTED_FINDING_PREFIX = '  scripts/b.sh:2:6  SC2086  ';

export const UNQUOTED_SCRIPT = '#!/usr/bin/env bash\necho $1\n';

export const HOOKS_OFF_SETTINGS = '[hooks]\nenabled = false\n';

export const PYTHON_INDEX_CREDENTIALS = { user: 'gspot', password: 'synthetic-uv-password' } as const;

export const UV_RELEASE_CUTOFF_LINE = /^exclude-newer = .*$/mu;

export const ZIP_FILE_OPTIONS = {
    regular: { os: 3, attrs: 0o10_0644 * 0x1_00_00 },
    executable: { os: 3, attrs: 0o10_0755 * 0x1_00_00 },
} as const;

export const STRAY_STYLE_PATH = `${dirname(GSPOT_PATHS.valeConfig)}/styles/Google/legacy.yml`;

export const AUTHORED_VALE_FILES = {
    files: { 'authored.txt': 'keep\n', [STRAY_STYLE_PATH]: 'stray style bytes\n' },
} as const;

export const GOOGLE_RULE_PATH = `${GSPOT_PATHS.valePackages}/Google/Passive.yml`;

export const VALE_INSTALL_FAILURES = [
    {
        name: 'timeout',
        fakeArguments: ['--wait'],
        named: '(1s)',
        settings: 'tool_timeout_seconds = 1\n',
    },
    {
        name: 'its error',
        fakeArguments: [
            '--stderr',
            'Registry request failed: https://alex:synthetic-password@example.com/styles.zip',
            '--exit',
            '7',
        ],
        named: 'https://[redacted]@example.com/styles.zip',
        settings: '',
    },
] as const;

export const PACKAGE_MANAGER_CASES = [
    ['npm', 'package.json'],
    ['bun', 'package.json'],
    ['pnpm', 'package.json'],
    ['npm', 'apps/web/package.json'],
] as const;
