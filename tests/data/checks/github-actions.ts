const CALLED_WORKFLOW = '.github/workflows/called.yml';

export const COMPOSITE_ACTION = `name: Greet
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

export const CHECKOUT_WORKFLOW = `on: workflow_dispatch
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

export const ACTIONLINT_EXITS = [
    { code: 0, status: 'passed', findings: [], note: undefined },
    {
        code: 1,
        status: 'failed',
        findings: [{ file: '.github/workflows/caller.yml', rule: 'workflow-call' }],
        note: undefined,
    },
    {
        code: 3,
        status: 'error',
        findings: [],
        note: '<actionlint> crashed with exit 3.\n.github/workflows/caller.yml:4:11: located defect [workflow-call]',
    },
] as const;

export const WORKFLOW_TEXT_CASES = [
    ...CALLED_WORKFLOW_REFERENCES.map(([reference, expected]) => ({
        path: '.github/workflows/caller.yml',
        before: `on: workflow_dispatch\njobs:\n  caller:\n    uses: ${reference}\n`,
        expected: `on: workflow_dispatch\njobs:\n  caller:\n    uses: ${expected}\n`,
    })),
    {
        path: '.github/workflows/caller.yml',
        before: `on: workflow_dispatch\nenv:\n  WORKFLOW: &workflow $/${CALLED_WORKFLOW}\njobs:\n  caller:\n    uses: *workflow\n`,
        expected: `on: workflow_dispatch\nenv:\n  WORKFLOW: &workflow ./${CALLED_WORKFLOW}\njobs:\n  caller:\n    uses: *workflow\n`,
    },
    { path: '.github/workflows/caller.yml', before: 'uses: [$/unclosed\n', expected: 'uses: [$/unclosed\n' },
    ...['action.yml', 'action.yaml'].map((filename) => ({
        path: `.github/actions/setup/${filename}`,
        before: 'name: Setup\nruns:\n  using: composite\n  steps:\n    - uses: $/.github/actions/cache\n',
        expected: 'name: Setup\nruns:\n  using: composite\n  steps:\n    - uses: ./.github/actions/cache\n',
    })),
];

/** A reusable workflow that requires the greeting input. */
export const REQUIRED_INPUT_WORKFLOW = `on:
  workflow_call:
    inputs:
      greeting:
        type: string
        required: true
jobs:
  greet:
    runs-on: ubuntu-latest
    steps:
      - run: echo hello
`;
