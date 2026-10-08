import { QUIET_INIT } from '#tests/config/harness/init.ts';
import { WORKFLOW_HEAD } from '#tests/config/samples/actions.ts';
import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { RepositoryScenario } from '#tests/types/harness/repository.ts';

export const ACTIONS_INIT = [
    'init',
    '--yes',
    '--configurations',
    'actions',
    '--no-task',
    '--no-ci',
    '--no-rules',
    '--no-install',
];

export const REPOSITORY: RepositoryScenario = {
    configurations: ['actions'],
    modules: false,

    init: [...QUIET_INIT],
    tools: ['actionlint', 'zizmor'],
    files: { '.github/workflows/build.yml': `${WORKFLOW_HEAD}            - run: echo built\n` },
};

export const CASES: FindingCase[] = [
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
];
