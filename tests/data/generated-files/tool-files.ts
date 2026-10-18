import { EDITORCONFIG_SETTINGS } from '#tests/data/checks/format.ts';
import { SWIFT_FORMAT_SETTINGS } from '#tests/data/checks/swift/projects.ts';

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

export const ESLINT_FILE = '.gspot/configurations/language/javascript/eslint.mjs';

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
    'accept.txt',
    'shellcheckrc',
    'swiftformat',
    'trivyignore',
] as const;

export const RECOMMENDED_VALE_FILES = [
    '.gspot/configurations/general/prose/styles/gspot/alt-text.yml',
    '.gspot/configurations/general/prose/styles/gspot/dates.yml',
    '.gspot/configurations/general/prose/styles/gspot/link-text.yml',
    '.gspot/configurations/general/prose/styles/LICENSES.md',
    '.gspot/configurations/general/prose/vale.ini',
] as const;

/** A whole-check ignore drops the files of that check and keeps those of the other checks of its configuration. */
export const IGNORED_CHECK_FILES = [
    {
        name: 'ignoring SwiftLint and Periphery keeps SwiftFormat',
        settings: SWIFT_FORMAT_SETTINGS,
        files: { 'main.swift': 'let value = 1\n' },
        kept: ['.gspot/configurations/language/swift/swiftformat'],
        dropped: [
            '.gspot/configurations/language/swift/swiftlint.yml',
            '.gspot/configurations/language/swift/periphery.yml',
            '.gspot/package.json',
        ],
    },
    {
        name: 'ignoring Prettier keeps EditorConfig',
        settings: EDITORCONFIG_SETTINGS,
        files: { 'sample.json': '{"value":1}\n' },
        kept: ['.editorconfig'],
        dropped: ['.gspot/configurations/general/format/prettier.json', '.prettierignore'],
    },
] as const;

/** Two Markdown scopes: one with the rules of the root, one with its own code block style. */
export const MARKDOWNLINT_SCOPE_TABLES = `[[scope]]
path = "same"

[[scope]]
path = "other"
[scope.tools.markdownlint.rules]
MD046 = { style = "indented" }
`;
