import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';
import { NPM_CHECK_IGNORES } from '#tests/config/ignores.ts';

export const SPECIAL_CHARACTER_FILES = {
    'package.json': '{"name":"serialization-sample","private":true,"type":"module"}',
    'sample.ts': 'export const value = 1;',
    'sample.md': '# Sample',
    Dockerfile: 'FROM alpine:3.22',
    'sample.yaml': 'value: true',
    'Sample.swift': 'let value = 1',
} as const;

export const SPECIAL_CHARACTER_SETTINGS = {
    configurations: ['typescript', 'format', 'markdown', 'data-files', 'docker', 'swift', 'xcode'],
    tools: {
        markdownlint: { rules: { MD044: { names: ['custom"key\\name\ncafé', 'yes: # quoted "value"'] } } },
        yamllint: { rules: { truthy: { 'allowed-values': ['yes', 'no'] } } },
        hadolint: { trusted_registries: ['null', 'registry.example.com:5000'] as const },
    },
    swift: {
        xcode_project: 'ios/App # café.xcodeproj',
        xcode_scheme: 'null',
    },
} as const;

export const PRETTIER_IGNORE_SETTINGS = {
    configurations: ['format', 'javascript'],
    ignore: [
        {
            check: 'format/prettier',
            paths: ['authored/omitted.ts'],
            reason: 'This output retains its authored layout.',
        },
    ],
} as const;

export const PRETTIER_IGNORE_CASES = [
    { file: 'src/dist/source.ts', ignored: true },
    { file: 'generated/source.ts', ignored: true },
    { file: 'authored/omitted.ts', ignored: true },
    { file: 'authored/kept.ts', ignored: false },
    { file: 'pnpm-lock.yaml', ignored: true },
] as const;

export const LANGUAGE_IGNORES = [
    {
        name: 'Python without JavaScript',
        configurations: ['format', 'markdown', 'python'],
        scopes: [],
        ignored: [{ path: '.venv/', pattern: '**/.venv/**' }],
        absent: ['.build/', 'Package.resolved'],
    },
    {
        name: 'Swift without JavaScript',
        configurations: ['format', 'markdown', 'swift'],
        scopes: [],
        ignored: [
            { path: '.build/', pattern: '.build/' },
            { path: 'DerivedData/', pattern: 'DerivedData/' },
            { path: 'Pods/', pattern: '**/Pods/**' },
        ],
        absent: ['**/node_modules/**', 'package-lock.json', '**/.venv/**', 'uv.lock'],
    },
    {
        name: 'JavaScript',
        configurations: ['format', 'markdown', 'javascript'],
        scopes: [],
        ignored: [{ path: 'node_modules/', pattern: '**/node_modules/**' }],
        absent: ['.build/', 'Package.resolved', '**/.venv/**', 'uv.lock'],
    },
    {
        name: 'a JavaScript child of Python',
        configurations: ['format', 'markdown', 'python'],
        scopes: [{ path: 'web', configurations: ['javascript'] }],
        ignored: [
            { path: '.venv/', pattern: '**/.venv/**' },
            { path: 'node_modules/', pattern: '**/node_modules/**' },
        ],
        absent: ['.build/', 'Package.resolved'],
    },
] as const;

export const PATH_IGNORE_CASES = [
    {
        configuration: 'spelling',
        check: 'spelling/typos',
        file: 'typos.toml',
        nativePath: ['files', 'extend-exclude'],
    },
    {
        configuration: 'duplication',
        check: 'duplication/jscpd',
        file: 'jscpd.json',
        nativePath: ['ignore'],
    },
    {
        configuration: 'javascript',
        check: 'javascript/knip',
        file: 'knip.json',
        nativePath: ['ignore'],
    },
] as const;

export const IGNORE_LIST_SETTINGS = {
    level: 'all',
    rules: true,
    scopes: [
        { path: 'apps/web', configurations: ['javascript', 'css'] },
        { path: 'services/api', configurations: ['python'] },
    ],
} as const;

export const IGNORE_LIST_FILES = {
    'apps/web/package.json': '{"name":"web","private":true}\n',
    'apps/web/source.js': 'export const value = 1;\n',
    'apps/web/style.css': 'a { color: red; }\n',
    'services/api/pyproject.toml': '[project]\nname = "api"\nversion = "0.1.0"\n',
    'services/api/source.py': 'VALUE = 1\n',
    'README.md': '# Example\n',
    'source.js': 'export const other = 2;\n',
} as const;

export const MARKDOWNLINT_SCOPE_TABLES = `[[scope]]
path = "same"

[[scope]]
path = "other"
[scope.tools.markdownlint.rules]
MD046 = { style = "indented" }
`;

export const XCTEST_LINK_FILE_CASES = [
    {
        scope: '',
        linkFiles: {
            '.swiftlint.yml': { parent: './.gspot/configurations/language/swift/swiftlint.yml', overrides: false },
            'AppTests/.swiftlint.yml': {
                parent: '../.gspot/configurations/language/swift/swiftlint.yml',
                overrides: true,
            },
            'ChildTests/.swiftlint.yml': {
                parent: '../.gspot/configurations/language/swift/swiftlint.yml',
                overrides: true,
            },
        },
    },
    {
        scope: 'ios # app',
        linkFiles: {
            'ios # app/.swiftlint.yml': {
                parent: '../.gspot/configurations/language/swift/swiftlint.yml',
                overrides: false,
            },
            'ios # app/AppTests/.swiftlint.yml': {
                parent: '../../.gspot/configurations/language/swift/swiftlint.yml',
                overrides: true,
            },
            'ios # app/ChildTests/.swiftlint.yml': {
                parent: '../../.gspot/configurations/language/swift/swiftlint.yml',
                overrides: true,
            },
        },
    },
    {
        scope: 'AppTests',
        linkFiles: {
            'AppTests/.swiftlint.yml': {
                parent: '../.gspot/configurations/language/swift/swiftlint.yml',
                overrides: true,
            },
            'AppTests/ChildTests/.swiftlint.yml': {
                parent: '../../.gspot/configurations/language/swift/swiftlint.yml',
                overrides: true,
            },
        },
    },
] as const;

export const DEFAULT_EXPORT = { location: 'the requested module' } as const;

export const INACTIVE_RULE_OPTIONS = [
    {
        configuration: 'markdown',
        rule: 'MD013',
        tables: '[tools.markdownlint.rules.MD013]\nline_length = 100\n',
        message: 'gspot runs MD013 at no level, so it takes no options.',
    },
    {
        configuration: 'data-files',
        rule: 'line-length',
        tables: '[tools.yamllint.rules.line-length]\nmax = 100\n',
        message:
            'gspot.toml:3: tools.yamllint.rules.line-length: There is no yamllint rule called line-length. The yamllint rules are anchors, key-duplicates, octal-values, truthy.',
    },
] as const;

export const NESTED_PYTHON_SETTINGS = {
    scopes: [
        { path: 'linted', configurations: ['python'] },
        { path: 'typed', configurations: ['python'] },
    ],
    tables: '[[ignore]]\ncheck = "python/basedpyright"\npaths = ["linted/**"]\nreason = "This project uses Ruff without a type checker."\n',
} as const;

export const CONFIG_FILE_PROJECT = {
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

export const UNPARSED_CONFIG_FILES = [
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

const EDITORCONFIG_SETTINGS = `configurations = ["format"]
[[ignore]]
check = "format/prettier"
reason = "This sandbox uses EditorConfig without Prettier."
[rules]
enabled = false
`;

const SWIFT_FORMAT_SETTINGS = `configurations = ["swift"]
${NPM_CHECK_IGNORES}[[ignore]]
check = "swift/swiftlint"
reason = "SwiftFormat owns this sandbox's formatting."
[[ignore]]
check = "swift/swiftlint-analyze"
reason = "This sandbox has no analyzer build log."
[[ignore]]
check = "swift/periphery"
reason = "This sandbox has no Xcode project."
[rules]
enabled = false
`;

export const IGNORED_CHECK_FILES = [
    {
        name: 'ignoring SwiftLint and Periphery keeps SwiftFormat',
        settings: SWIFT_FORMAT_SETTINGS,
        files: { 'main.swift': 'let value = 1\n' },
        kept: [`${GSPOT_PATHS.configurations}/language/swift/swiftformat`],
        dropped: [
            `${GSPOT_PATHS.configurations}/language/swift/swiftlint.yml`,
            `${GSPOT_PATHS.configurations}/language/swift/periphery.yml`,
            GSPOT_PATHS.npmProject,
        ],
    },
    {
        name: 'ignoring Prettier keeps EditorConfig',
        settings: EDITORCONFIG_SETTINGS,
        files: { 'sample.json': '{"value":1}\n' },
        kept: ['.editorconfig'],
        dropped: [`${GSPOT_PATHS.configurations}/general/format/prettier.json`, '.prettierignore'],
    },
] as const;
