// missing paths
// missing paths
// missing paths
export const COVERAGE_CHECK_TABLES = `[[command_check]]
id = "tests/coverage"
command = ["true"]
paths = ["tests/**"]
stage = "manual"
`;
export const DOC_FENCE_PATH_CASES = [
    { info: 'title="example.sh"', language: 'sh', reported: false },
    { info: 'start=1\ttitle="example.sh"', language: 'sh', reported: false },
    { info: '', language: 'text', reported: false },
    { info: '', language: 'sh', reported: true },
    { info: 'description="title=example.sh"', language: 'console', reported: true },
] as const;
export const DOC_TASK_FILES = {
    'root.md': `Run \`mise run root-mise\`, \`npm run root-js\`, and \`bun run root-js\`.
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
export const DOC_TASK_FINDINGS = [
    { file: 'app/empty/guide.md', line: 1, command: 'npm run child-js' },
    { file: 'app/guide.md', line: 2, command: 'npm run root-js' },
    { file: 'app/guide.md', line: 2, command: 'bun run sibling-js' },
    { file: 'root.md', line: 2, command: 'mise run root-js' },
    { file: 'root.md', line: 2, command: 'bun run root-mise' },
    { file: 'root.md', line: 2, command: 'npm run child-js' },
    { file: 'sibling/guide.md', line: 2, command: 'pnpm run child-js' },
    { file: 'sibling/guide.md', line: 2, command: 'mise run child-mise' },
] as const;
export const EXTERNAL_COMMAND_GUIDE = `Run commands from the repository root.

\`\`\`shell
gspot init --from ../api/gspot.toml
curl -fsSL -o ../team.toml https://raw.githubusercontent.com/acme/policies/<commit>/gspot.toml
gh api "repos/acme/policies/contents/gspot.toml?ref=<commit>" -H "Accept: application/vnd.github.raw" > ../team.toml
cat ./src/here.ts ./src/missing.ts
\`\`\`

An Accept: application/vnd.github.raw header does not hide src/absent.ts.
See \`../src/missing.ts\` beside \`../src/here.ts\`.
`;
export const MALFORMED_TASK_FILES = [
    {
        path: 'package.json',
        text: '{broken',
        files: { 'a.md': 'Run `bun run build`.\n', 'package.json': '{}' },
    },
    {
        path: 'mise.toml',
        text: '[tasks',
        files: { 'a.md': 'Run `bun run build`.\n', 'mise.toml': '' },
    },
] as const;
export const MDX_GUIDE = `import Example from './example.ts';

# Guide

Read \`./missing.ts\`.

<Example />
`;
export const MISE_TASK_SOURCES = [
    {
        name: 'default file tasks in an alternate task folder',
        tasks: ['docs'],
        files: { 'mise-tasks/docs/_default': '#!/usr/bin/env bash\ntrue\n' },
    },
    {
        name: 'string tasks, command lists, and task aliases in mise.toml',
        tasks: ['lint', 'format', 'compile', 'verify', 'validate'],
        files: {
            'mise.toml':
                'tasks.lint = "true"\ntasks.format = ["true"]\n[tasks.build]\nalias = "compile"\nrun = "true"\n[tasks.test]\nalias = ["verify", "validate"]\nrun = "true"\n',
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
        name: 'tasks in conf.d files',
        tasks: ['included-task'],
        files: {
            '.mise/conf.d/project.toml': '[tasks.included-task]\nrun = "true"\n',
        },
    },
] as const;
export const RELATIVE_PATH_FILES = {
    'docs/guide.md':
        'See `./examples/good.ts`, `../src/here.ts`, and `src/here.ts`.\nSee `./examples/gone.ts` and `../src/gone.ts`.\nSee `./src/here.ts` and `./missing/`.\n',
    'docs/examples/good.ts': '',
    'src/here.ts': '',
} as const;

// required files
export const LICENSE_FILE_CASES = [
    { name: 'COPYING', findings: [] },
    { name: 'LICENSE-MIT', findings: [] },
    { name: 'NOTICE', findings: [{ file: 'LICENSE', rule: 'missing-license' }] },
] as const;
