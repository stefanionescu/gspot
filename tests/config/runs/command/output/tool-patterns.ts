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
