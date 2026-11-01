import { TEST_VERSION } from '#tests/config/commands/samples.ts';

export const FAILED_CHECK_REPORT = {
    version: TEST_VERSION,
    notes: [] as string[],
    stage: 'all' as const,
    started: '2026-09-18T00:00:00.000Z',
    duration: 10,
    checks: [
        {
            check: 'bash/shellcheck',
            scope: '',
            status: 'failed' as const,
            fileCount: 3,
            duration: 120,
            reproduce: 'gspot check --only bash/shellcheck',
            findings: [
                {
                    check: 'bash/shellcheck',
                    file: 'a.sh',
                    line: 4,
                    column: 3,
                    rule: 'SC2086',
                    message: 'Double quote to prevent globbing.',
                    help: 'Quote it.',
                    fixable: false,
                },
            ],
        },
        { check: 'bash/shfmt', scope: '', status: 'passed' as const, fileCount: 3, duration: 20, findings: [] },
        {
            check: 'format/prettier',
            scope: 'api',
            status: 'missing' as const,
            fileCount: 1,
            duration: 0,
            findings: [],
            note: 'prettier is not installed. Run: mise install',
        },
    ],
    ignores: [{ check: 'bash/shellcheck', rule: 'SC2312', reason: 'why' }],
    unstagedChanges: 0,
    partial: false,
    failed: ['bash/shellcheck', 'format/prettier'],
    exitCode: 1,
} as const;

export const NO_COLOR_SETTINGS = `configurations = []
[[ignore]]
check = "gspot/generated-files"
paths = ["absent/**"]
reason = "This path belongs to an external generated project."
`;

export const VERBOSITY_ARGUMENTS = ['check', '--only', 'example/findings,example/passing', '--base', 'HEAD'] as const;

const FINDING_LINES = Array.from({ length: 201 }, (_, index) => `finding ${String(index + 1)}.`);

export const FINDINGS_TOOL_ARGUMENTS = [...FINDING_LINES.flatMap((line) => ['--line', line]), '--exit', '1'];

export const ENVIRONMENT_CHECK = {
    check: 'python/basedpyright',
    scope: '',
    status: 'missing' as const,
    fileCount: 1,
    duration: 0,
    findings: [],
    note: 'The project environment .venv is missing. Run uv sync, then check again.',
};
