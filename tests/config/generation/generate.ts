import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { NPM_CHECK_IGNORES, STYLELINT_FILES } from '#tests/config/setup/configurations.ts';

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
        pointers: {
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
        pointers: {
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

export const NESTED_PYTHON_SETTINGS = {
    scopes: [
        { path: 'linted', configurations: ['python'] },
        { path: 'typed', configurations: ['python'] },
    ],
    tables: '[[ignore]]\ncheck = "python/basedpyright"\npaths = ["linted/**"]\nreason = "This project uses Ruff without a type checker."\n',
} as const;

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

export const LICENSE_TOOL_CASES = [{ configurations: ['licenses'] }, { configurations: [] }] as const;

export const STYLESHEET_CASES = [
    { name: 'plain CSS', configurations: ['css'], files: { 'site.css': 'a { color: red; }' }, needsHtmlParser: true },
    {
        name: 'Vue without Stylelint',
        configurations: ['vue'],
        files: { 'Card.vue': '<template><p>Card</p></template>' },
        needsHtmlParser: false,
    },
] as const;

export const STYLELINT_PACKAGE_FIELDS = {
    project: {
        ...STYLELINT_FILES,
        'app/child/source.css': 'a { opacity: 1; }\n',
        'other/source.css': 'a { opacity: 1; }\n',
    },
    configurations: ['css'],
    tables: '[[scope]]\npath = "app"\n[[scope]]\npath = "app/child"\n[[scope]]\npath = "other"\n',
    unchanged: ['plain/package.json'],
    changes: [
        { path: 'package.json', keys: [{ key: ['stylelint'], value: { extends: './.stylelintrc.yml' } }] },
        {
            path: 'app/child/package.json',
            keys: [
                {
                    key: ['stylelint'],
                    value: { extends: '../../.gspot/configurations/language/css/stylelint.json' },
                },
            ],
        },
        {
            path: 'app/package.json',
            keys: [{ key: ['stylelint'], value: { extends: '../.gspot/configurations/language/css/stylelint.json' } }],
        },
        {
            path: 'other/package.json',
            keys: [{ key: ['stylelint'], value: { extends: '../.gspot/configurations/language/css/stylelint.json' } }],
        },
    ],
};

export const EDITED_STYLELINT_PACKAGE = `{
  "name": "edited-project",
  "private": true,
  "type": "module",
  "stylelint": {"rules":{"property-no-unknown":null}}
}
`;

export const RUNTIME_RULE_CASES = [
    { name: 'a Deno script', runtime: 'deno', dependency: undefined, rules: ['DENO.md'] },
    { name: 'a Node.js script', runtime: 'node', dependency: undefined, rules: ['NODE.md'] },
    { name: 'a Node.js script in a React Native package', runtime: 'node', dependency: 'react-native', rules: [] },
] as const;

export const COMMANDS_HEADING = '## Commands';

export const SWITCH_CASES = [
    { name: 'hooks', path: '.gspot/hooks/pre-commit' },
    { name: 'rule_files', path: '.gspot/rules/WORKING.md' },
    { name: 'ci', path: '.github/workflows/gspot.yml' },
] as const;

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
