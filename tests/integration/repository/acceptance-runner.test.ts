import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { acceptanceArguments } from '#tests/support/acceptance/run.ts';

const root = join(import.meta.dir, '../../..');
const acceptance = join(root, 'tests/acceptance');

test('acceptance selection keeps its default suite when filtering names', () => {
    expect(acceptanceArguments(['-t', 'findings'])).toStrictEqual([
        '--timeout',
        '60000',
        '--test-name-pattern',
        'findings',
        acceptance,
    ]);
    expect(acceptanceArguments([join(acceptance, 'cli/checks.test.ts')])).toStrictEqual([
        '--timeout',
        '60000',
        join(acceptance, 'cli/checks.test.ts'),
    ]);
});

test.each([
    { args: ['--test-name-pattern'] },
    { args: ['--preload', 'script.ts'] },
    { args: [join(root, 'tests/release')] },
    { args: [join(root, 'packages/cli/src/main.ts')] },
])('acceptance refuses invalid or out-of-suite selection before setup: %j', ({ args }) => {
    expect(() => acceptanceArguments(args)).toThrow();
});
