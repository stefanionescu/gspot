export const ODD_KEY = 'custom"key\\name\ncafé';

export const ODD_VALUE = 'yes: # quoted "value"';

export const XCODE_PROJECT = 'ios/App # café.xcodeproj';

export const XCODE_SCHEME = 'null';

export const REGISTRIES = ['null', 'registry.example.com:5000'] as const;

export const ODD_VALUE_SETTINGS = {
    configurations: ['typescript', 'format', 'markdown', 'files', 'docker', 'swift', 'xcode'],
    tools: {
        prettier: { extra: { value: { [ODD_KEY]: ODD_VALUE }, reason: 'An upstream option.' } },
        knip: { extra: { value: { [ODD_KEY]: ODD_VALUE }, reason: 'An upstream option.' } },
        markdownlint: { rules: { MD044: { names: [ODD_KEY, ODD_VALUE] } } },
        yamllint: { rules: { truthy: { 'allowed-values': ['yes', 'no'] }, indentation: { spaces: 'consistent' } } },
        hadolint: { trusted_registries: REGISTRIES },
    },
    swift: {
        xcode_project: XCODE_PROJECT,
        xcode_scheme: XCODE_SCHEME,
    },
} as const;

export const ODD_VALUE_FILES = {
    'package.json': '{"name":"serialization-fixture","private":true,"type":"module"}',
    'sample.ts': 'export const value = 1;',
    'sample.md': '# Sample',
    Dockerfile: 'FROM alpine:3.22',
    'sample.yaml': 'value: true',
    'Sample.swift': 'let value = 1',
} as const;

/** Uniform Resource Identifier delimiters and Unicode must remain literal module target names. */
export const MODULE_TARGETS = ['100%', '#fragment', '?query', "author's", 'café'] as const;

export const MODULE_VALUE = { location: 'the requested module' } as const;

export const ESLINT_FILE = '.gspot/config/eslint.config.mjs';

export const TOOL_FILE_PROJECT = {
    '.github/workflows/check.yml': `name: Check
on: push
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - run: echo example
`,
    'package.json': '{"name":"example","private":true,"type":"module"}\n',
    'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src"]}\n',
    'pyproject.toml': `[project]
name = "example"
version = "1.0.0"
`,
    'src/index.ts': 'export const answer = 42;\n',
    'query.sql': 'SELECT 1;\n',
    'nginx.conf': 'events {}\nhttp {}\n',
    'source.swift': 'let answer = 42\n',
    'script.sh': '#!/usr/bin/env bash\nprintf "example\\n"\n',
} as const;

export const PLAIN_TOOL_FILES = [
    'LICENSES.md',
    'no-gerunds-in-titles.tengo',
    '.editorconfig',
    'prettierignore',
    '.prettierignore',
    '.semgrepignore',
    'accept.txt',
    'shellcheckrc',
    'swiftformat',
    'trivyignore',
] as const;
