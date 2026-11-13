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

export const SYNCPACK_PACKAGE_FILES = {
    'package.json': '{"name":"root","private":true,"dependencies":{"shared-library":"1.0.0"}}\n',
    'packages/app/package.json': '{"name":"app","private":true,"dependencies":{"shared-library":"2.0.0"}}\n',
} as const;

export const API_TOKEN = ['n3K5p7R9', 't2V4w6Y8', 'z1A3c5E7', 'g9I2m4O6'].join('');

export const SEMGREP_SANDBOX = {
    configurations: ['python', 'security', 'fastapi'],
    level: 'all',
    files: BASE_INSTALLED_FILES,
} as const;
