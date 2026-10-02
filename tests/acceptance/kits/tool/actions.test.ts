// Planted repository for the actions kit: a workflow with an unknown expression context and one open to template injection.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { commitAll } from '#tests/harness/cli/git.ts';
import { WORKFLOW_HEAD } from '#tests/samples/actions.ts';
import { spawnGspot } from '#tests/harness/cli/command.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { plantedCases } from '#tests/harness/planted/cases.ts';
import { install, toolsPath } from '#tests/harness/tools/install.ts';

const ACTIONS_INIT = ['init', '--yes', '--kits', 'actions', '--no-runner', '--no-ci', '--no-guides', '--no-install'];

plantedCases(
    'the actions kit',
    {
        kits: ['actions'],
        modules: false,
        without: [],
        init: ['--no-runner', '--no-ci', '--no-guides', '--no-install', '--no-hooks'],
        tools: ['actionlint', 'zizmor'],
        files: {},
    },
    [
        {
            check: 'actions/actionlint',
            files: {
                '.github/workflows/broken.yml': `${WORKFLOW_HEAD}            - run: echo "\${{ nothing.here }}"\n`,
            },
            expected: { file: '.github/workflows/broken.yml', rule: 'expression', line: 9, column: 30 },
            corrected: {
                files: { '.github/workflows/broken.yml': `${WORKFLOW_HEAD}            - run: echo corrected\n` },
            },
        },
        {
            check: 'actions/zizmor',
            files: {
                '.github/workflows/unpinned.yml': `${WORKFLOW_HEAD}            - uses: actions/checkout@v4\n            - run: echo "\${{ github.event.pull_request.title }}"\n`,
            },
            expected: { file: '.github/workflows/unpinned.yml', rule: 'template-injection', line: 10 },
            corrected: {
                files: { '.github/workflows/unpinned.yml': `${WORKFLOW_HEAD}            - run: echo corrected\n` },
            },
        },
    ],
);

test(
    'the actions kit: GitHub initialization writes a workflow accepted by actionlint',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'README.md': '# Workflow test\n' });
        commitAll(sandbox.path);
        const environment = { PATH: toolsPath(['actionlint']) };
        await install(sandbox.path, [...ACTIONS_INIT, '--ci', 'github', '--no-hooks'], environment);
        const selected = await spawnGspot(sandbox.path, ['set', 'level', 'all'], environment);
        expect(selected.code, selected.stdout + selected.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, '.github/workflows/gspot.yml')).exists()).toBe(true);
        const result = await processes.run(['actionlint', '-no-color', '.github/workflows/gspot.yml'], {
            cwd: sandbox.path,
            env: environment,
        });
        expect(result.code, result.stderr + result.stdout).toBe(0);
    },
    PLANTED_TIMEOUT_MS,
);
