export const SOURCE =
    'function total(values) { let sum = 0; for (const value of values) { if (value > 0) sum += value; } return sum; }\nfunction triple(value) { return value * 3; }\nmodule.exports = { total, triple };\n';

export const TEST_SOURCE =
    'const { total, triple } = require("./math.cjs");\nconst { writeFileSync } = require("node:fs");\ntest("adds positive values", () => { writeFileSync("authored.txt", "isolated test output"); expect(total([2, -1, 3])).toBe(5); });\n';

/** The second test covers the function left untested by the initial source. */
export const CORRECTED_TEST_SOURCE = `${TEST_SOURCE}test("triples an integer", () => { expect(triple(2)).toBe(6); });\n`;

/** Root coverage and load-refusal cases use the same preserved project files. */
export const JEST_PROJECT_FILES = {
    'math.cjs': SOURCE,
    'authored.txt': 'preserved source\n',
    'coverage/authored.txt': 'preserved report\n',
};
