const CALLED_WORKFLOW = '.github/workflows/called.yml';

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
        note: '<actionlint> failed with exit 3:\n.github/workflows/caller.yml:4:11: located defect [workflow-call]',
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
export const CI_INJECTION_SETTINGS =
    '[ci]\nenabled = true\nsetup_command = ["echo", "${{ github.event.pull_request.title }}"]\n';

export const CI_SOURCE_WORKFLOW =
    'on: workflow_dispatch\npermissions: {}\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo safe\n';

export const GENERATED_WORKFLOW_CHECKS = [
    {
        tool: 'actionlint',
        code: 1,
        rule: 'expression',
        stdout: '.github/workflows/gspot.yml:56:24: untrusted expression [expression]\n',
    },
    {
        tool: 'zizmor',
        code: 14,
        rule: 'template-injection',
        stdout: '::error file=.github/workflows/gspot.yml,line=56,title=template-injection::untrusted expression\n',
    },
] as const;

export const OUTSIDE_GITHUB_ACTIONS = {
    '.github/workflows/caller.yml':
        'on: workflow_dispatch\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: $/actions/setup\n',
    'action.yml': 'name: Root\nruns:\n  using: composite\n  steps:\n    - uses: $/actions/setup\n',
    'actions/setup/action.yml':
        'name: Setup\nruns:\n  using: composite\n  steps:\n    - shell: bash\n      run: echo safe\n',
} as const;
