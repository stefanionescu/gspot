export const DOC_TASK_FILES = {
    'root.md': `Run \`mise run root-mise\`, \`npm run root-js\`, \`pnpm run root-js\`, \`yarn run root-js\`, and \`bun run root-js\`.
Run \`mise run root-js\`, \`bun run root-mise\`, and \`npm run child-js\`.
`,
    'package.json': '{"private":true,"scripts":{"root-js":"true"}}\n',
    'mise.toml': '[tasks.root-mise]\nrun = "true"\n',
    'app/guide.md': `Run \`mise run root-mise\`, \`mise run child-mise\`, \`npm run child-js\`, and \`yarn run child-js\`.
Run \`npm run root-js\` and \`bun run sibling-js\`.
`,
    'app/package.json': '{"private":true,"scripts":{"child-js":"true"}}\n',
    'app/mise.toml': '[tasks.child-mise]\nrun = "true"\n',
    'app/nested/guide.md': 'Run `npm run child-js` and `bun run child-js`.\n',
    'app/empty/guide.md': 'Run `npm run child-js`.\n',
    'app/empty/package.json': '{"private":true}\n',
    'sibling/guide.md': 'Run `npm run sibling-js`.\nRun `pnpm run child-js` and `mise run child-mise`.\n',
    'sibling/package.json': '{"private":true,"scripts":{"sibling-js":"true"}}\n',
} as const;

export const DOC_TASK_SCOPES = ['app', 'app/nested', 'app/empty', 'sibling'].map((path) => ({
    path,
    configurations: [],
}));

export const DOC_TASK_FINDINGS = [
    { file: 'app/empty/guide.md', line: 1, rule: 'missing-task', message: 'npm run child-js names no task or script.' },
    { file: 'app/guide.md', line: 2, rule: 'missing-task', message: 'npm run root-js names no task or script.' },
    { file: 'app/guide.md', line: 2, rule: 'missing-task', message: 'bun run sibling-js names no task or script.' },
    { file: 'root.md', line: 2, rule: 'missing-task', message: 'mise run root-js names no task or script.' },
    { file: 'root.md', line: 2, rule: 'missing-task', message: 'bun run root-mise names no task or script.' },
    { file: 'root.md', line: 2, rule: 'missing-task', message: 'npm run child-js names no task or script.' },
    { file: 'sibling/guide.md', line: 2, rule: 'missing-task', message: 'pnpm run child-js names no task or script.' },
    {
        file: 'sibling/guide.md',
        line: 2,
        rule: 'missing-task',
        message: 'mise run child-mise names no task or script.',
    },
] as const;

export const DOC_FENCE_PATH_CASES = [
    { info: 'title="example.sh"', language: 'sh', reported: false },
    { info: 'title="example.sql"', language: 'sql', reported: false },
    { info: 'title="example.custom"', language: 'custom', reported: false },
    { info: 'start=1\ttitle="example.sh"', language: 'sh', reported: false },
    { info: '', language: 'text', reported: false },
    { info: '', language: 'sh', reported: true },
    { info: 'notitle="example.sh"', language: 'bash', reported: true },
    { info: 'description="title=example.sh"', language: 'console', reported: true },
] as const;

export const MISE_TASK_SOURCES = [
    {
        name: 'default file tasks in an alternate task folder',
        tasks: ['docs'],
        files: { 'mise-tasks/docs/_default': '#!/usr/bin/env bash\ntrue\n' },
    },
    {
        name: 'task aliases in mise.toml',
        tasks: ['compile', 'verify', 'validate'],
        files: {
            'mise.toml':
                '[tasks.build]\nalias = "compile"\nrun = "true"\n[tasks.test]\nalias = ["verify", "validate"]\nrun = "true"\n',
        },
    },
    {
        name: 'file tasks with nested names',
        tasks: ['setup', 'docs:build'],
        files: {
            '.mise/tasks/setup': '#!/usr/bin/env bash\ntrue\n',
            '.mise/tasks/docs/build': '#!/usr/bin/env bash\ntrue\n',
        },
    },
    {
        name: 'tasks in .mise/config.toml, mise.local.toml, and conf.d files, beside a .tool-versions file',
        tasks: ['config-task', 'local-task', 'included-task'],
        files: {
            '.mise/config.toml': '[tasks.config-task]\nrun = "true"\n',
            'mise.local.toml': '[tasks.local-task]\nrun = "true"\n',
            '.mise/conf.d/project.toml': '[tasks.included-task]\nrun = "true"\n',
            '.tool-versions': 'node 22\n',
        },
    },
] as const;

export const MALFORMED_TASK_FILES = [
    {
        path: 'package.json',
        message: 'package.json:1:2 is not valid JSON: InvalidSymbol. Fix the file.',
        text: '{broken',
        document: 'a.md',
        scopes: [],
        files: { 'a.md': 'Run `bun run build`.\n', 'package.json': '{}' },
    },
    {
        path: 'mise.toml',
        message: 'mise.toml:1:7 is not valid TOML: Expected table closing "]", found end of file. Fix the file.',
        text: '[tasks',
        document: 'a.md',
        scopes: [],
        files: { 'a.md': 'Run `bun run build`.\n', 'mise.toml': '' },
    },
    {
        path: 'app/package.json',
        message: 'app/package.json:1:2 is not valid JSON: InvalidSymbol. Fix the file.',
        text: '{broken',
        document: 'app/nested/guide.md',
        scopes: DOC_TASK_SCOPES,
        files: DOC_TASK_FILES,
    },
    {
        path: 'app/mise.toml',
        message: 'app/mise.toml:1:7 is not valid TOML: Expected table closing "]", found end of file. Fix the file.',
        text: '[tasks',
        document: 'app/nested/guide.md',
        scopes: DOC_TASK_SCOPES,
        files: DOC_TASK_FILES,
    },
] as const;

export const LICENSE_FILE_CASES = [
    { name: 'LICENSE', findings: [] },
    { name: 'COPYING', findings: [] },
    { name: 'LICENCE', findings: [] },
    { name: 'LICENSE-MIT', findings: [] },
    { name: 'LICENSE.rst', findings: [] },
    {
        name: 'NOTICE',
        findings: [{ file: 'LICENSE', rule: 'missing-license', message: 'The root has no LICENSE file.' }],
    },
] as const;

export const MDX_GUIDE = `import Example from './example.ts';

# Guide

Read \`./missing.ts\`.

<Example />
`;

export const RELATIVE_PATH_FINDINGS: (string | number)[][] = [
    [2, './examples/gone.ts names no tracked file or folder.'],
    [2, '../src/gone.ts names no tracked file or folder.'],
    [3, './src/here.ts names no tracked file or folder.'],
    [3, './missing/ names no tracked file or folder.'],
];

export const RELATIVE_PATH_FILES = {
    'docs/guide.md':
        'See `./examples/good.ts`, `../src/here.ts`, and `src/here.ts`.\nSee `./examples/gone.ts` and `../src/gone.ts`.\nSee `./src/here.ts` and `./missing/`.\n',
    'docs/examples/good.ts': '',
    'src/here.ts': '',
} as const;

export const IGNORED_PATH_FILES = {
    'a.md': 'Build `output/report.json` and `app/cache`.\nSee `app/absent.ts`, `app/private.ts`, `.next/types/routes.d.ts`, and `src/gone.ts`.\n',
    '.gitignore': '/output/report.json\n.next/\n',
    'app/.gitignore': 'cache/\n*.ts\n!private.ts\n',
    'src/here.ts': '',
} as const;

export const MDX_MISSING_PATH_FINDINGS = [
    {
        file: 'docs/guide.mdx',
        line: 5,
        rule: 'missing-path',
        message: './missing.ts names no tracked file or folder.',
    },
] as const;

export const COVERAGE_CHECK_TABLES = `[[command_check]]
id = "tests/coverage"
command = ["true"]
paths = ["tests/**"]
stage = "manual"
`;

export const SRC_MISSING_MESSAGE = 'src/missing.ts names no tracked file or folder.';

export const SRC_GONE_MESSAGE = 'src/gone.ts names no tracked file or folder.';
