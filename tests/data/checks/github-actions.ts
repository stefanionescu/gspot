const CALLED_WORKFLOW = '.github/workflows/called.yml';

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
      - uses: actions/checkout@08c6903cd8c0fde910a37f88322edcfb5dd907a8 # v5.0.0
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
    [
        'actions/checkout@08c6903cd8c0fde910a37f88322edcfb5dd907a8 # v5.0.0',
        'actions/checkout@08c6903cd8c0fde910a37f88322edcfb5dd907a8 # v5.0.0',
    ],
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

export { CALLED_WORKFLOW, ACTIONLINT_EXITS, COMPOSITE_ACTION, CHECKOUT_WORKFLOW, CALLED_WORKFLOW_REFERENCES };
