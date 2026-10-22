/** Sibling Python projects with different enabled tools. */

import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { NPM_CHECK_IGNORES } from '#tests/config/setup/sandboxes.ts';

export const NESTED_PYTHON_GSPOT_TOML = `configurations = []\n[[ignore]]\ncheck = "python/basedpyright"\npaths = ["linted/**"]\nreason = "This project uses Ruff without a type checker."\n[[scope]]\npath = "linted"\n\nconfigurations = ["python"]\n[[scope]]\npath = "typed"\n\nconfigurations = ["python"]\n[rules]\nenabled = false\n`;

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

/** The format configuration with Prettier ignored, so only editorconfig-checker runs. */
const EDITORCONFIG_SETTINGS = `configurations = ["format"]
[[ignore]]
check = "format/prettier"
reason = "This sandbox uses EditorConfig without Prettier."
[rules]
enabled = false
`;

/** SwiftFormat stays active when an ignore skips both other external Swift checks. */
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

export const JSCONFIG_TITLE_IGNORE_PROJECT = {
    'gspot.toml': buildSandboxSettings(['javascript'], {
        level: 'all',
        rules: true,
        tables: '[[ignore]]\npaths = ["legacy/**"]\nreason = "Build output"\n',
    }),
    'source.js': 'export const value = 1;\n',
    'legacy/source.js': 'export const legacy = 1;\n',
} as const;
