import { GSPOT_FOLDER } from '#cli/config/parsers.ts';

export const SESSION_FILES = {
    'package.json': '{"private":true,"packageManager":"bun@1.2.3"}\n',
    'entry.js': 'export const target = 1;\n',
    [`${GSPOT_FOLDER}/.keep`]: '',
};

export const FAILED_RUN = { code: 1 } as const;

export const BASE_CHECK = {
    id: 'sandbox/diagnostic',
    command: ['tool'],
    level: 'basic' as const,
    stage: 'commit' as const,
    runs: 'files' as const,
    summary: '',
    why: '',
    help: '',
    output: { format: 'regex' as const, pattern: '(?<message>.+)' },
};

export const LOCATED_CHECK = {
    ...BASE_CHECK,
    output: { format: 'regex', pattern: '^(?<file>[^:]+): (?<message>.*)$' },
} as const;

export const CHILD_SCOPE_SETTINGS = {
    rules: true,
    scopes: [
        { path: 'api', configurations: [] },
        { path: 'web', configurations: [] },
    ],
    tables: '\n[[command_check]]\nid = "project/syntax"\ncommand = ["bash", "-n", "{files}"]\noutput.format = "none"\npaths = ["**/*.sh"]\nstage = "push"\n',
} as const;

export const PENDING_NOTE_RESULTS = [
    {
        check: 'notes/no-pending',
        status: 'failed',
        findings: [{ file: 'notes/plan.txt', line: 2, message: 'PENDING later' }],
    },
] as const;

export const MISSING_LOCATED_FILE = {
    code: 1,
    stdout: 'notes/reported.txt:1:A defect.',
    stderr: '',
    missing: false,
    duration: 1,
} as const;

export const ESLINT_CRASH = { code: 1, stderr: 'Oops! Something went wrong\n' } as const;

export const ESLINT_MANIFEST_TOOL = {
    name: 'eslint',
    installers: {},
    kind: 'program' as const,
    crash_pattern: '^Oops! Something went wrong',
} as const;

export const FILELESS_CHECKS = [
    {
        ...BASE_CHECK,
        id: 'sandbox/coverage',
        output: { format: 'regex', pattern: '^ERROR: (?<message>.*)$' },
    },
    { ...BASE_CHECK, id: 'sandbox/plain', output: { format: 'regex', pattern: '(?<message>.+)' } },
] as const;

export const REGEX_OUTPUT_CASES = [
    {
        title: 'regex output that names no real file on a failed run is a check error',
        result: { ...FAILED_RUN, stdout: '2026-09-19T02: FATAL\n' },
        expected: { note: 'tool failed with exit 1:\n2026-09-19T02: FATAL' },
    },
    {
        title: 'a failed run that prints nothing is a check error',
        result: FAILED_RUN,
        expected: { note: 'tool failed with exit 1 and printed nothing.' },
    },
    {
        title: 'regex output with one real file on a failed run keeps every finding',
        result: { ...FAILED_RUN, stdout: '2026-09-19T02: FATAL\nsource.txt: located defect\n' },
        expected: {
            findings: [
                { check: LOCATED_CHECK.id, file: '2026-09-19T02', message: 'FATAL', help: '', fixable: false },
                { check: LOCATED_CHECK.id, file: 'source.txt', message: 'located defect', help: '', fixable: false },
            ],
        },
    },
    { title: 'a passing run that prints nothing has no findings', result: {}, expected: { findings: [] } },
];

export const GENERATE_ARGUMENTS = [process.execPath, 'generate.ts', '', 'two words'];

export const WORKSPACE_SCOPE_CASES = [
    { scope: '', expected: [] },
    { scope: 'package', expected: ['--workspace', 'package'] },
    { scope: 'docs', expected: [] },
    { scope: 'source', expected: [] },
] as const;

export const ASTRO_CHECK_SUMMARY = [
    '\u{1B}[1mResult (1 file): \u{1B}[22m',
    '- \u{1B}[1m\u{1B}[31m1 error\u{1B}[39m\u{1B}[22m',
].join('\n');

export const ASTRO_CHECK_OUTPUT = [
    "\u{1B}[96msrc/env.ts\u{1B}[0m:\u{1B}[93m1\u{1B}[0m:\u{1B}[93m14\u{1B}[0m - \u{1B}[91merror\u{1B}[0m\u{1B}[90m ts(2322): \u{1B}[0mType 'string' is not assignable to type 'number'.",
    '',
    "\u{1B}[7m1\u{1B}[0m export const count: number = 'three';",
    '\u{1B}[7m \u{1B}[0m \u{1B}[91m             ~~~~~\u{1B}[0m',
    '',
    ASTRO_CHECK_SUMMARY,
].join('\n');

export const FILE_LINE_PATTERN = String.raw`^(?<file>[^:]+):(?<line>\d+): (?<message>.*)$`;

export const CAFE_SOURCE_PATH = 'inputs/café source.txt';

export const CRASH_TAIL_CASES = [
    {
        name: 'frames after the cause',
        stdout: '',
        stderr: 'Error: Cannot find package example\n    at load (loader.js:1:2)\n    at start (main.js:2:3)',
        expected: 'Error: Cannot find package example',
        verbose: 'Error: Cannot find package example\n    at load (loader.js:1:2)\n    at start (main.js:2:3)',
    },
    {
        name: 'frames at the start of both streams',
        stdout: '    at output (stdout.js:1:2)\nError: stdout cause',
        stderr: '    at error (stderr.js:2:3)\nError: stderr cause',
        expected: 'Error: stderr cause\nError: stdout cause',
        verbose: 'at error (stderr.js:2:3)\nError: stderr cause\nat output (stdout.js:1:2)\nError: stdout cause',
    },
] as const;

export const BATCH_CHECK = {
    id: 'project/batches',
    stage: 'commit',
    paths: ['*.txt'],
    output: { format: 'json', fields: { file: 'file', rule: 'rule', message: 'message' } },
};

export const BATCH_FINDINGS = [
    { file: 'one.txt', rule: 'kept', message: 'Kept finding.' },
    { file: 'outside.txt', rule: 'outside', message: 'Outside finding.' },
];

export const BATCH_IGNORE = {
    check: 'project/batches',
    rule: 'kept',
    reason: 'This case verifies ignores on error results.',
};

export const COVERAGE_PROJECT_FILES = [
    { name: 'generated defaults', files: {}, generated: true },
    { name: '.coveragerc', files: { '.coveragerc': '[run]\nomit = custom/**\n' }, generated: false },
    {
        name: 'pyproject coverage',
        files: { 'pyproject.toml': '[tool.coverage.run]\nomit = ["custom/**"]\n' },
        generated: false,
    },
    { name: 'setup.cfg coverage', files: { 'setup.cfg': '[coverage:run]\nomit = custom/**\n' }, generated: false },
    { name: 'tox.ini coverage', files: { 'tox.ini': '[coverage:run]\nomit = custom/**\n' }, generated: false },
] as const;

export const FILELESS_COVERAGE_CASES = [
    {
        check: 'vitest/tests',
        code: 1,
        output: 'ERROR: Coverage for lines (50%) does not meet global threshold (80%)',
        message: 'Coverage for lines (50%) does not meet global threshold (80%)',
    },
    {
        check: 'pytest/tests',
        code: 1,
        output: 'FAIL Required test coverage of 80% not reached. Total coverage: 50%',
        message: 'FAIL Required test coverage of 80% not reached. Total coverage: 50%',
    },
    { check: 'pytest/tests', code: 5, output: 'no tests ran in 0.01s', message: 'no tests ran in 0.01s' },
    { check: 'jest/tests', code: 1, output: '  ● Test suite failed to run', message: '● Test suite failed to run' },
] as const;

export const TOOL_PATTERN_CASES = [
    {
        check: 'dependencies/syncpack',
        code: 1,
        output: 'Versions differ\n  ✘ lodash 1.0.0 in packages/app/package.json at dependencies.lodash (HighestSemverMismatch)\n  ✘ lodash 2.0.0 in package.json at dependencies.lodash (SemverRangeMismatch)\n2 issues found',
        expected: [
            {
                file: 'packages/app/package.json',
                rule: 'HighestSemverMismatch',
                message: 'lodash 1.0.0 in packages/app/package.json at dependencies.lodash',
                fixable: false,
            },
            {
                file: 'package.json',
                rule: 'SemverRangeMismatch',
                message: 'lodash 2.0.0 in package.json at dependencies.lodash',
                fixable: false,
            },
        ],
    },
    {
        check: 'format/prettier',
        code: 2,
        output: '[warn] source.ts\n[warn] Code style issues found in the above file. Run Prettier with --write to fix.\n[error] broken.ts: SyntaxError: Expression expected. (2:7)',
        expected: [
            { file: 'source.ts', message: 'Not formatted the way Prettier formats it.', fixable: true },
            { file: 'broken.ts', line: 2, column: 7, message: 'Expression expected.', fixable: false },
        ],
    },
    {
        check: 'python/deptry',
        code: 1,
        output: "pyproject.toml: DEP002 'unused' defined as a dependency but not used in the codebase\nsource.py:3:1: DEP001 'missing' imported but missing from the dependency definitions",
        expected: [
            {
                file: 'pyproject.toml',
                rule: 'DEP002',
                message: "'unused' defined as a dependency but not used in the codebase",
                fixable: false,
            },
            {
                file: 'source.py',
                line: 3,
                column: 1,
                rule: 'DEP001',
                message: "'missing' imported but missing from the dependency definitions",
                fixable: false,
            },
        ],
    },
] as const;

export const LOWERCASE_SELECT_SQL = 'select 1;\n';

export const TYPE_ERROR_MESSAGE = "Type 'string' is not assignable to type 'number'.";
