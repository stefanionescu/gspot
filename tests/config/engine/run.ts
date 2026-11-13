import { NPM_CHECK_IGNORES } from '#tests/config/setup/configurations.ts';

// check skips
const NEXT_INTL_PACKAGE = '{"dependencies":{"next-intl":"4.8.3"}}';
export const NEXT_INTL_PROJECTS = [
    {
        name: 'root project',
        scope: '',
        files: { 'package.json': NEXT_INTL_PACKAGE },
        selected: true,
    },
    {
        name: 'unrelated child project',
        scope: '',
        files: { 'app/package.json': NEXT_INTL_PACKAGE },
        selected: false,
    },
] as const;

// check tools
const PYTHON_APP_FILES = {
    'app.py': 'value = 1\n',
    'pyproject.toml': `[project]
name = "app"
version = "1.0.0"
`,
} as const;
export const NODE_REQUIREMENTS = [
    {
        name: 'Python with npm schema peers under mise',
        tables: '',
        configurations: ['python'],
        files: PYTHON_APP_FILES,
        needs: ['node', 'ruff'],
        skips: [],
    },
    {
        name: 'Python with only mise tools',
        tables: `${NPM_CHECK_IGNORES}[[ignore]]
check = "python/basedpyright"
reason = "This sandbox exercises Python without the npm type checker."
[[ignore]]
check = "licenses/allowed"
reason = "This sandbox exercises native tools without the license scanner."
`,
        configurations: ['python'],
        files: PYTHON_APP_FILES,
        needs: ['ruff'],
        skips: ['node', 'eslint', 'typescript'],
    },
] as const;

// fixer results
export const FIXER_RESULTS = [
    {
        name: 'finding exit with original bytes',
        toolArguments: ['--write', 'source.txt=original', '--exit', '3'],
        exit_codes: [3],
        status: 'unchanged',
        after: 'original',
        note: undefined,
    },
    {
        name: 'finding exit with corrected bytes',
        toolArguments: ['--write', 'source.txt=corrected', '--exit', '3'],
        exit_codes: [3],
        status: 'changed',
        after: 'corrected',
        note: undefined,
    },
    {
        name: 'undeclared exit with partial bytes',
        toolArguments: ['--write', 'source.txt=partial', '--exit', '4'],
        exit_codes: [3],
        status: 'failed',
        after: 'partial',
        note: 'sandbox/fixer exited 4',
    },
    {
        name: 'default failure with original bytes',
        toolArguments: ['--exit', '3'],
        exit_codes: undefined,
        status: 'failed',
        after: 'original',
        note: 'sandbox/fixer exited 3',
    },
] as const;

// run plan
export const SCOPE_WIDE_IGNORE_CASES = [
    { paths: ['api/**'], ignored: true },
    { paths: ['api'], ignored: true },
    { paths: ['api/**', '!api/app/**'], ignored: false },
] as const;
