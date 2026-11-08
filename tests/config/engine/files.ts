import { GSPOT_PATHS } from '#cli/config/manifests.ts';

export const CRLF_PACKAGE_FILES = {
    'package.json': '{\n    "name": "crlf"\n}\n',
    'bun.lock': '{}\n',
    '.gitignore': 'node_modules/\n',
    'node_modules/example/index.js': 'export const value = 1;',
} as const;

export const LOCKED_NPM_PROJECT_FILES = {
    '.gitignore': 'node_modules/\n',
    'package.json': '{"name":"sample","version":"1.0.0"}\n',
    'package-lock.json': '{"name":"sample","lockfileVersion":3,"packages":{}}\n',
    'source.js': 'export const value = 1;\n',
    'node_modules/item-0/value.js': 'export const value = 2;\n',
} as const;

export const TOOL_PROJECT_FILES = {
    'project/.gspot/package.json': '{}',
    'project/.gspot/bun.lock': '{}',
    'project/.gspot/node_modules/example/index.js': 'export const value = 1;',
    '.gitignore': 'node_modules/\n',
} as const;

export const EXTERNAL_DEPENDENCY_FILES = {
    'package.json': '{}',
    'bun.lock': '{}',
    '.gitignore': 'node_modules/\n',
    'node_modules/example/index.js': 'export const value = 1;',
} as const;

export const BIN_WORKSPACE_FILES = {
    'package.json': '{"workspaces":["packages/*"]}',
    'bun.lock': '{}',
    'packages/cli/package.json': '{"name":"cli","bin":{"cli":"dist/cli.js"}}',
    'packages/cli/dist/cli.js': 'console.log(1);',
    '.gitignore': 'node_modules/\ndist/\n',
} as const;

export const WORKSPACE_LOCK_FILES = {
    'package.json': '{"workspaces":["packages/*"]}',
    'bun.lock': '{}',
    'packages/one/package.json': '{"name":"one"}',
    'packages/two/package.json': '{"name":"two"}',
    'node_modules/root/value.js': 'export const value = 1;',
    'packages/two/node_modules/owned/value.js': 'export const value = 2;',
    '.gitignore': 'node_modules/\n',
} as const;

export const VALUE_ONE_LINE = 'export const value = 1;';

export const DECLARATION_COPY_FILES = {
    'project/.gitignore': 'types/generated.d.ts\n',
    'project/tsconfig.json': '{"include":["src/**/*.ts","types/*.d.ts","../outside.d.ts"]}',
    'project/src/main.ts': 'export const value = 1;\n',
    'project/types/generated.d.ts': 'declare const generated: string;\n',
    'project/types/kept.d.ts': 'declare const kept: number;\n',
    'outside.d.ts': 'declare const outside: boolean;\n',
};

export const WORKSPACE_SOURCE_FILES = {
    'package.json': '{"private":true,"workspaces":["apps/*","packages/*"],"dependencies":{"unused":"workspace:*"}}',
    'bun.lock': '{}',
    '.gitignore': 'node_modules/\ndist/\n',
    'apps/web/package.json': '{"name":"web","dependencies":{"core":"workspace:*"}}',
    'apps/web/main.js': 'import {value} from "core"; console.log(value);',
    'packages/core/package.json':
        '{"name":"core","type":"module","main":"value.js","dependencies":{"utility":"workspace:*"}}',
    'packages/core/value.js': 'import {suffix} from "utility"; export const value = "staged" + suffix;',
    'packages/utility/package.json':
        '{"name":"utility","type":"module","main":"value.js","dependencies":{"core":"workspace:*"}}',
    'packages/utility/value.js': 'export const suffix = " dependency";',
    'packages/unused/package.json': '{"name":"unused","type":"module"}',
    'packages/unused/private.txt': 'Unselected workspace bytes',
    'packages/unused/private.js': 'export const unused = 1;',
    'tsconfig.json':
        '{"compilerOptions":{"allowJs":true,"moduleResolution":"Bundler","module":"ESNext","paths":{"#alias/*":["packages/aliased/*"]}}}',
    'apps/web/tsconfig.json': '{"extends":"../../tsconfig.json","include":["*.js"]}',
    'apps/web/alias.js': 'import {aliasValue} from "#alias/value"; export const value = aliasValue;',
    'packages/aliased/package.json': '{"name":"aliased","type":"module"}',
    'packages/aliased/value.js': 'export const aliasValue = "alias source";',
} as const;

export const TEST_WORKSPACE_FILES = {
    'package.json': '{"private":true,"workspaces":["tests"]}',
    'tests/package.json': '{"name":"tests"}',
    'tests/app.js': 'import "vue";',
    'node_modules/.bun/vue@3/node_modules/vue/package.json': '{"name":"vue"}',
    [GSPOT_PATHS.npmProject]: '{"private":true}',
    [`${GSPOT_PATHS.nodeModules}/prettier/package.json`]: '{"name":"prettier"}',
} as const;

export const GIT_HOOK_REPORT = {
    reports: [
        {
            kind: 'index',
            source: 'selected\n',
            tree: true,
            ownMetadata: true,
            toolMetadata: true,
            paths: ['source.txt'],
            configuration: 'inherited',
            explicit: 'caller',
            cancelled: true,
        },
        {
            kind: 'commit',
            source: 'committed\n',
            tree: true,
            ownMetadata: true,
            toolMetadata: true,
            paths: ['source.txt'],
            configuration: 'inherited',
            explicit: 'caller',
            cancelled: true,
        },
    ],
    headKept: true,
    indexKept: true,
    workingBytes: 'working\n',
} as const;

export const SELECTED_SOURCE = 'selected source';

export const TWO_SCOPES_SETTINGS = `configurations = []
[[scope]]
path = "api"
configurations = []
[[scope]]
path = "web"
configurations = []
`;

export const TSC_PUSH_OPTIONS = { stage: 'push' as const, only: ['typescript/tsc'] };

export const EDITORCONFIG_FILES = {
    'source.py': 'VALUE = 1\n',
} as const;

export const PROJECT_PATH_IGNORES = [
    {
        name: 'a deleted ignored input',
        changed: ['api/ignored.ts'],
        present: false,
        check: 'typescript/tsc',
        rule: undefined,
        files: [],
    },
    {
        name: 'a changed ignored input',
        changed: ['api/ignored.ts'],
        present: true,
        check: 'typescript/tsc',
        rule: undefined,
        files: [],
    },
    {
        name: 'an ignored and an owned input',
        changed: ['api/ignored.ts', 'api/kept.ts'],
        present: true,
        check: 'typescript/tsc',
        rule: undefined,
        files: ['api/kept.ts'],
    },
    {
        name: 'a rule-specific ignore',
        changed: ['api/ignored.ts'],
        present: true,
        check: 'typescript/tsc',
        rule: 'sample',
        files: ['api/ignored.ts', 'api/kept.ts'],
    },
    {
        name: 'another check\u{2019}s path ignore',
        changed: ['api/ignored.ts'],
        present: true,
        check: 'data-files/v8r',
        rule: undefined,
        files: ['api/ignored.ts', 'api/kept.ts'],
    },
] as const;

export const TYPESCRIPT_SCOPES_SETTINGS = TWO_SCOPES_SETTINGS.replace(
    'configurations = []',
    'configurations = ["typescript"]',
);

export const LAYERED_SCOPE_SETTINGS = `level = "all"
configurations = ["format"]
[limits]
max_file_lines = 250
[format]
indent_width = 4
[rule_files]
enabled = false
[[scope]]
path = "api"
configurations = ["bash"]
limits.max_file_lines = 200
format.indent_width = 2
[[scope]]
path = "api/worker"
configurations = ["sql"]
limits.sql.max_file_lines = 30
sql.dialect = "postgres"
`;

export const PROJECT_FINDING_MESSAGE = 'Project finding';

export const LAST_FILE_CHANGES = [
    ['delete', 'staged'],
    ['rename', 'changed'],
];
