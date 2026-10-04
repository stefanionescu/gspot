import type { HelpersBesideTestsOptions } from '#plugin/types/rules.ts';

/** Files that distinguish test siblings, declaration files, and support directories. */
export const TEST_FILES = {
    'tests/unit/a.test.ts': '',
    'tests/unit/builders.ts': '',
    'tests/unit/b.d.ts': '',
    'tests/support/factory.ts': '',
    'tests/only/one.ts': '',
    'tests/declarations/one.ts': '',
    'tests/declarations/types.d.ts': '',
    'tests/folders/a.test.ts/placeholder': '',
    'tests/folders/builders.ts': '',
    'tests/custom-pattern/a.check.ts': '',
    'tests/custom-pattern/builders.ts': '',
    'src/a.ts': '',
    'tests/custom/a.test.ts': '',
    'tests/custom/factory.ts': '',
    'tests/mocks/a.test.ts': '',
    'tests/mocks/factory.ts': '',
};

/** The declared owner of support code. */
export const OPTIONS: [HelpersBesideTestsOptions[0]] = [{ harness: 'tests/support' }];

/** Assertion modules belong with tests, including an aliased framework import. */
export const ASSERTION_SOURCES = [
    "import { expect } from 'bun:test'; export function assertValue(value: number) { expect(value).toBe(1); }",
    "import { expect as assert } from 'vitest'; export function assertValue(value: number) { assert(value).toBe(1); }",
    "import { expect } from '@jest/globals'; export async function assertValue(value: Promise<number>) { await expect(value).resolves.toBe(1); }",
];

/** Matcher data, unrelated imports, and a shadowed binding do not perform framework assertions. */
export const HARNESS_SOURCES = [
    "import { expect } from 'bun:test'; export const matcher = expect.objectContaining({ value: 1 });",
    "import { expect } from 'another-library'; export function build(value: number) { expect(value).toBe(1); }",
    "import { expect } from 'bun:test'; export function build(expect: (value: number) => { toBe(value: number): void }) { expect(1).toBe(1); }",
];
