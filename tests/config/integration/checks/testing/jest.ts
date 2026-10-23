export const MATH_SOURCE = `function total(values) { let sum = 0; for (const value of values) { if (value > 0) sum += value; } return sum; }
function triple(value) { return value * 3; }
module.exports = { total, triple };
`;

export const MATH_TEST_SOURCE = `const { total, triple } = require("./math.cjs");
test("adds positive values", () => { expect(total([2, -1, 3])).toBe(5); });
`;

export const CORRECTED_MATH_TEST_SOURCE = `${MATH_TEST_SOURCE}test("triples an integer", () => { expect(triple(2)).toBe(6); });\n`;

export const JEST_PROJECT_FILES = {
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

export const JEST_MISSING_IMPORT = `jest failed with exit 1:
FAIL ./math.test.cjs
  ● Test suite failed to run

    Cannot find module './missing-test-dependency.cjs' from 'math.test.cjs'
`;
