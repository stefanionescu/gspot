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
