import { SANDBOX_PACKAGES } from '#tests/config/setup/sandboxes.ts';
import { ARITHMETIC_MODULE } from '#tests/config/integration/checks/samples.ts';

export const MATH_SOURCE = `function total(values) { let sum = 0; for (const value of values) { if (value > 0) sum += value; } return sum; }
function triple(value) { return value * 3; }
module.exports = { total, triple };
`;

export const MATH_TEST_SOURCE = `const { total, triple } = require("./math.cjs");
test("adds positive values", () => { expect(total([2, -1, 3])).toBe(5); });
`;

export const CORRECTED_MATH_TEST_SOURCE = `${MATH_TEST_SOURCE}test("triples an integer", () => { expect(triple(2)).toBe(6); });\n`;

export const JEST_PROJECT_FILES = {
    'package.json': `${JSON.stringify({ name: 'jest-acceptance', private: true, devDependencies: { jest: SANDBOX_PACKAGES.jest } })}\n`,
    'math.cjs': MATH_SOURCE,
    'authored.txt': 'preserved source\n',
    'coverage/authored.txt': 'preserved report\n',
} as const;

export const JEST_COVERAGE_TABLES = `[coverage]
lines = 80
branches = 80
functions = 80
statements = 80
`;

export const COVERAGE_THRESHOLD_MESSAGE = 'coverage threshold for lines (80%) not met: ';

export const PYTEST_PYPROJECT = `[project]
name = "example"
version = "1.0.0"
requires-python = ">=3.12"
dependencies = ["pytest==9.1.1", "pytest-cov==7.1.0"]

[tool.pytest.ini_options]
pythonpath = ["."]
`;

const ARITHMETIC_TESTS = `"""Tests of the arithmetic."""

from example.math import double, triple

def test_multiplication() -> None:
    """Both functions multiply."""
    assert double(2) == 4
    assert triple(2) == 6
`;

export const PYTEST_SANDBOX = {
    configurations: ['python', 'pytest', 'naming'],
    files: {
        'pyproject.toml': PYTEST_PYPROJECT,
        'example/__init__.py': '"""The package."""\n',
        'example/math.py': ARITHMETIC_MODULE,
        'tests/__init__.py': '"""Arithmetic tests."""\n',
        'tests/test_math.py': ARITHMETIC_TESTS,
    },
} as const;

const HALF_COVERED_SOURCE =
    'def first():\n    return 1\ndef second():\n    return 2\ndef third():\n    return 3\ndef fourth():\n    return 4\n';

export const PYTEST_CASES = [
    {
        check: 'pytest/coverage',
        files: {
            'example/__init__.py': '',
            'example/math.py': HALF_COVERED_SOURCE,
            'tests/test_math.py': `from example.math import first, second, third, fourth\n\ndef test_functions():\n${Array.from({ length: 40 }, () => '    assert callable(first) and callable(second) and callable(third) and callable(fourth)').join('\n')}\n`,
        },
        settings: '[coverage]\nlines = 80\n',
        expected: {},
        corrected: {
            files: {
                'example/__init__.py': '',
                'example/math.py': HALF_COVERED_SOURCE,
                'tests/test_math.py':
                    'from example.math import first, second, third, fourth\n\ndef test_functions():\n    assert [first(), second(), third(), fourth()] == [1, 2, 3, 4]\n',
            },
        },
    },
] as const;

export const COVERAGE_LIMIT_CASES = [
    {
        limit: 80,
        coverage: '[coverage]\nlines = 80\n',
        code: 2,
        result: {
            status: 'missing',
            note: 'pytest-cov is not installed. Install pytest-cov in the Python environment used by pytest.',
            coverage: undefined,
        },
    },
    {
        limit: 0,
        coverage:
            '[coverage]\nlines = { value = 0, reason = "This test checks execution without coverage collection." }\n',
        code: 0,
        result: { status: 'passed', note: undefined, coverage: false },
    },
] as const;

export const VITEST_SOURCE = `// Arithmetic the test tests call.

/**
Adds positive values.
@param values the values to total
@returns the positive total
*/
export function positiveTotal(values: number[]): number {
    let total = 0;
    for (const value of values) {
        if (value > 0) total += value;
    }
    return total;
}
`;

export const UNTESTED_SOURCE = `${VITEST_SOURCE}
/**
Triples a number.
@param value the number.
@returns three times the number.
*/
export function triple(value: number): number {
    return value * 3;
}
`;

const VITEST_MATH_TEST = `import { test, expect } from 'vitest';
import { positiveTotal } from './public.js';

test('adds only positive values', () => {
    expect(positiveTotal([2, 3])).toBe(5);
    expect(positiveTotal([-2, 3])).toBe(3);
    expect(positiveTotal([])).toBe(0);
});
`;

export const VITEST_PROJECT_FILES = {
    '.gitignore': 'node_modules\ncoverage\n',
    'vitest.config.mjs': "export default { test: { include: ['src/*.test.ts'] } };\n",
    'src/public.ts': VITEST_SOURCE,
    'src/math.test.ts': VITEST_MATH_TEST,
} as const;
