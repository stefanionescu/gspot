const CALLED_WORKFLOW = '.github/workflows/called.yml';

// Shared workflow text for github-actions checks.
const WORKFLOW_HEAD = `name: test
on: [push]
permissions:
    contents: read
jobs:
    build:
        runs-on: ubuntu-24.04
        steps:
`;

const GITHUB_ACTIONS_SANDBOX = {
    configurations: ['github-actions'],

    tools: ['actionlint', 'zizmor'],
    files: { '.github/workflows/build.yml': `${WORKFLOW_HEAD}            - run: echo built\n` },
} as const;

const GITHUB_ACTIONS_CASES = [
    {
        check: 'github-actions/actionlint',
        files: {
            '.github/workflows/broken.yml': `${WORKFLOW_HEAD}            - run: echo "\${{ nothing.here }}"\n`,
        },
        expected: { file: '.github/workflows/broken.yml', rule: 'expression', line: 9, column: 30 },
        corrected: {
            files: { '.github/workflows/broken.yml': `${WORKFLOW_HEAD}            - run: echo corrected\n` },
        },
    },
    {
        check: 'github-actions/zizmor',
        files: {
            '.github/workflows/unpinned.yml': `${WORKFLOW_HEAD}            - uses: actions/checkout@v4\n            - run: echo "\${{ github.event.pull_request.title }}"\n`,
        },
        expected: { file: '.github/workflows/unpinned.yml', rule: 'template-injection', line: 10 },
        corrected: {
            files: { '.github/workflows/unpinned.yml': `${WORKFLOW_HEAD}            - run: echo corrected\n` },
        },
    },
] as const;

const COMPOSITE_ACTION = `name: Greet
inputs:
    message:
        description: Message to print
        required: true
runs:
    using: composite
    steps:
        - shell: bash
          run: echo "\${{ inputs.message }}"
`;

const CHECKOUT_WORKFLOW = `on: workflow_dispatch
permissions: {}
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: false
`;

const CALLED_WORKFLOW_REFERENCES = [
    [`$/${CALLED_WORKFLOW}`, `./${CALLED_WORKFLOW}`],
    [`"$/${CALLED_WORKFLOW}"`, `"./${CALLED_WORKFLOW}"`],
    [`'$/${CALLED_WORKFLOW}'`, `'./${CALLED_WORKFLOW}'`],
    [String.raw`"\x24/` + `${CALLED_WORKFLOW}"`, String.raw`"\x2e/` + `${CALLED_WORKFLOW}"`],
    [String.raw`"\u0024/` + `${CALLED_WORKFLOW}"`, String.raw`"\u002e/` + `${CALLED_WORKFLOW}"`],
    [String.raw`"\U00000024/` + `${CALLED_WORKFLOW}"`, String.raw`"\U0000002e/` + `${CALLED_WORKFLOW}"`],
    [`|-\n          $/${CALLED_WORKFLOW}`, `|-\n          ./${CALLED_WORKFLOW}`],
    [`|- # $comment\n          $/${CALLED_WORKFLOW}`, `|- # $comment\n          ./${CALLED_WORKFLOW}`],
    ['$/.github/workflows/$called.yml', './.github/workflows/$called.yml'],
    ['actions/checkout@v4', 'actions/checkout@v4'],
] as const;

const ACTIONLINT_EXITS = [
    { code: 0, status: 'passed', findings: [], note: undefined },
    {
        code: 1,
        status: 'failed',
        findings: [{ file: '.github/workflows/caller.yml', rule: 'workflow-call' }],
        note: undefined,
    },
    { code: 3, status: 'error', findings: [], note: 'exit 3' },
] as const;

export {
    CALLED_WORKFLOW,
    COMPOSITE_ACTION,
    ACTIONLINT_EXITS,
    CHECKOUT_WORKFLOW,
    GITHUB_ACTIONS_CASES,
    GITHUB_ACTIONS_SANDBOX,
    CALLED_WORKFLOW_REFERENCES,
};
