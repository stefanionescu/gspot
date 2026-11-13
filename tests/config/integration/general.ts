import { STRICT_COMPILER_OPTIONS } from '#tests/config/setup/languages.ts';

// dependencies
export const SYNCPACK_PACKAGE_FILES = {
    'package.json': '{"name":"root","private":true,"dependencies":{"shared-library":"1.0.0"}}\n',
    'packages/app/package.json': '{"name":"app","private":true,"dependencies":{"shared-library":"2.0.0"}}\n',
} as const;

// framework components
export const ANSWER_MODULE = `// A value the test files build on.

/**
The fixed input shared by the component examples.
*/
export const answer = 42;
`;
export const COMPONENT_TSCONFIG = { compilerOptions: STRICT_COMPILER_OPTIONS, include: ['src'] } as const;

// installed files
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

// markdown
export const GUIDE = `# The guide

The worker retries the request three times. Each retry waits one second.
`;

// npm installer
export const NPM_PROJECT_FILES = {
    'other/package.json': '{"private":true,"packageManager":"npm@99.0.0"}',
    'source.js': 'export const greeting="hello";',
    'node_modules/authored.txt': 'keep project dependencies',
} as const;
export const NPM_PROJECT_IGNORES = ['json/v8r', 'javascript/eslint', 'javascript/tsc', 'javascript/knip'] as const;
export const NPM_PROJECT_ROOT_PACKAGE = {
    private: true,
    devDependencies: { eslint: '0.0.0-authored' },
    scripts: { test: 'authored-command' },
    workspaces: ['**'],
} as const;
export const NPM_REGISTRY_TOKEN = 'synthetic-package-install-token';

// secrets
export const API_TOKEN = ['n3K5p7R9', 't2V4w6Y8', 'z1A3c5E7', 'g9I2m4O6'].join('');

// security
export const SEMGREP_SANDBOX = {
    configurations: ['python', 'security', 'fastapi'],
    level: 'all',
    files: BASE_INSTALLED_FILES,
} as const;

// tsc
export const COMPILER_SOURCE = 'export const value = missing;\n';
