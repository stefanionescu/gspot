import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { InstalledScenario } from '#tests/types/harness/repository.ts';
import { MATH, PROJECT, ARITHMETIC_TESTS } from '#tests/config/samples/python.ts';

export const REPOSITORY: InstalledScenario = {
    configurations: ['python', 'pytest', 'naming'],
    tools: ['ruff'],
    files: {
        'pyproject.toml': PROJECT,
        'example/__init__.py': '"""The package."""\n',
        'example/math.py': MATH,
        'tests/__init__.py': '"""Arithmetic tests."""\n',
        'tests/test_math.py': ARITHMETIC_TESTS,
    },
};

export const CASES: FindingCase[] = [
    {
        check: 'pytest/coverage',
        files: { 'tests/test_math.py': ARITHMETIC_TESTS },
        policy: '[coverage]\nlines = 95\n',
        expected: { message: 'Required test coverage of 95%' },
        corrected: { files: { 'tests/test_math.py': ARITHMETIC_TESTS } },
    },
];

export const PROVIDER_FLOORS = [
    ['recommended', 80],
    ['recommended', 0],
    ['all', 80],
    ['all', 0],
] as const;
