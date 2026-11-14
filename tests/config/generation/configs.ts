import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { GITHUB_WORKFLOW } from '#cli/config/generation/builders.ts';
import { NPM_CHECK_IGNORES } from '#tests/config/setup/configurations.ts';

// generated configs
export const PROJECT_FILES = {
    'package.json': '{"private":true,"type":"module","dependencies":{"next":"1.0.0","react":"1.0.0","zod":"1.0.0"}}',
    'source.js': 'export const value = 1;\n',
    'source.ts': 'export const value: number = 1;\n',
    'source.test.ts': 'test("value", () => expect(1).toBe(1));\n',
    'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
    'page.astro': '<h1>Title</h1>\n',
    'page.svelte': '<h1>Title</h1>\n',
    'page.vue': '<template><h1>Title</h1></template>\n',
    'page.jsx': 'export const page = <h1>Title</h1>;\n',
    'style.css': 'a { color: red; }\n',
    'index.html': '<!doctype html><title>Example</title>\n',
    'README.md': '# Example\n',
    'source.py': 'value = 1\n',
    'test_source.py': 'def test_value():\n    assert 1 == 1\n',
    'pyproject.toml': '[project]\nname = "example"\nversion = "1.0.0"\n',
    'Source.swift': 'let value = 1\n',
    'query.sql': 'SELECT 1;\n',
    'script.sh': '#!/usr/bin/env bash\necho example\n',
    'data.yaml': 'name: example\n',
    Dockerfile: 'FROM scratch\n',
    'openapi.yaml': 'openapi: 3.1.0\ninfo:\n  title: Example\n  version: 1.0.0\npaths: {}\n',
    'supabase/config.toml': 'project_id = "example"\n',
    'supabase/functions/example/index.ts': 'export const value = 1;\n',
    'wrangler.toml': 'name = "example"\nmain = "source.js"\n',
};
export const UNPARSED_CONFIGS = [
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

// ignore files
export const IGNORE_LIST_SETTINGS = {
    level: 'all',
    rules: true,
    scopes: [
        { path: 'apps/web', configurations: ['javascript', 'css'] },
        { path: 'services/api', configurations: ['python'] },
    ],
} as const;
export const LANGUAGE_IGNORES = [
    {
        name: 'Swift without JavaScript',
        configurations: ['format', 'markdown', 'swift'],
        scopes: [],
        ignored: ['.build/', 'DerivedData/', 'Pods/'],
        kept: ['node_modules/', 'package-lock.json', '.venv/', 'uv.lock'],
    },
    {
        name: 'a JavaScript child of Python',
        configurations: ['format', 'markdown', 'python'],
        scopes: [{ path: 'web', configurations: ['javascript'] }],
        ignored: ['.venv/', 'node_modules/'],
        kept: ['.build/', 'Package.resolved'],
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
        configuration: 'structure',
        check: 'structure/jscpd',
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
export const PRETTIER_IGNORE_CASES = [
    { file: 'src/dist/source.ts', ignored: true },
    { file: 'generated/source.ts', ignored: true },
    { file: 'vendored/source.ts', ignored: true },
    { file: 'authored/omitted.ts', ignored: true },
    { file: 'authored/kept.ts', ignored: false },
    { file: 'pnpm-lock.yaml', ignored: true },
] as const;
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

// owned files
const EDITORCONFIG_SETTINGS = `configurations = ["format"]
[[ignore]]
check = "format/prettier"
reason = "This sandbox uses EditorConfig without Prettier."
[rule_files]
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
[rule_files]
enabled = false
`;
export const IGNORED_CHECK_FILES = [
    {
        name: 'ignoring SwiftLint and Periphery keeps SwiftFormat',
        settings: SWIFT_FORMAT_SETTINGS,
        files: { 'main.swift': 'let value = 1\n' },
        kept: [`${GSPOT_PATHS.configurations}/swift/swiftformat`],
        dropped: [
            `${GSPOT_PATHS.configurations}/swift/swiftlint.yml`,
            `${GSPOT_PATHS.configurations}/swift/periphery.yml`,
            GSPOT_PATHS.npmProject,
        ],
    },
    {
        name: 'ignoring Prettier keeps EditorConfig',
        settings: EDITORCONFIG_SETTINGS,
        files: { 'sample.json': '{"value":1}\n' },
        kept: ['.editorconfig'],
        dropped: [`${GSPOT_PATHS.configurations}/format/prettier.json`, '.prettierignore'],
    },
] as const;
export const NESTED_PYTHON_SETTINGS = {
    scopes: [
        { path: 'linted', configurations: ['python'] },
        { path: 'typed', configurations: ['python'] },
    ],
    tables: '[[ignore]]\ncheck = "python/basedpyright"\npaths = ["linted/**"]\nreason = "This project uses Ruff without a type checker."\n',
} as const;

// pointer files
export const DEFAULT_EXPORT = { location: 'the requested module' } as const;
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
        pointers: {
            '.swiftlint.yml': { parent: './.gspot/configurations/swift/swiftlint.yml', overrides: false },
            'AppTests/.swiftlint.yml': {
                parent: '../.gspot/configurations/swift/swiftlint.yml',
                overrides: true,
            },
            'ChildTests/.swiftlint.yml': {
                parent: '../.gspot/configurations/swift/swiftlint.yml',
                overrides: true,
            },
        },
    },
    {
        scope: 'ios # app',
        pointers: {
            'ios # app/.swiftlint.yml': {
                parent: '../.gspot/configurations/swift/swiftlint.yml',
                overrides: false,
            },
            'ios # app/AppTests/.swiftlint.yml': {
                parent: '../../.gspot/configurations/swift/swiftlint.yml',
                overrides: true,
            },
            'ios # app/ChildTests/.swiftlint.yml': {
                parent: '../../.gspot/configurations/swift/swiftlint.yml',
                overrides: true,
            },
        },
    },
    {
        scope: 'AppTests',
        pointers: {
            'AppTests/.swiftlint.yml': {
                parent: '../.gspot/configurations/swift/swiftlint.yml',
                overrides: true,
            },
            'AppTests/ChildTests/.swiftlint.yml': {
                parent: '../../.gspot/configurations/swift/swiftlint.yml',
                overrides: true,
            },
        },
    },
] as const;

// stale files
export const SWITCH_CASES = [
    { name: 'hooks', path: `${GSPOT_PATHS.hooks}/pre-commit` },
    { name: 'rule_files', path: `${GSPOT_PATHS.rules}/WORKING.md` },
    { name: 'ci', path: GITHUB_WORKFLOW },
] as const;

// written files
export const EDITED_STYLELINT_PACKAGE = `{
  "name": "edited-project",
  "private": true,
  "type": "module",
  "stylelint": {"rules":{"property-no-unknown":null}}
}
`;
