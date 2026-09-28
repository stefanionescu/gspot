// The literal values integration/cli/generation/plugin-levels reads: names, patterns, limits, and tables.

export const VITEST_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'tests/fixtures/helpers.js': 'export const value = 1;\n',
    'tests/fixtures/example.test.js': '',
    'tests/unit/helpers.js': 'export const value = 1;\n',
    'tests/unit/example.test.js': '',
    'src/runtime.js': 'import { value } from "../tests/fixtures/helpers.js"; export const result = value + 1;\n',
};
