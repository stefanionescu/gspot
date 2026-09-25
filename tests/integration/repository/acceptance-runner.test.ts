import { acceptanceArguments } from '#tests/support/acceptance.ts';
import { expect, test } from 'bun:test';
import { join } from 'node:path';

const root = join(import.meta.dir, '../../..');
const acceptance = join(root, 'tests/acceptance/source');

test('acceptance selection keeps its default suite when filtering names', () => {
    expect(acceptanceArguments(['-t', 'findings'])).toStrictEqual([
        '--timeout',
        '60000',
        '--test-name-pattern',
        'findings',
        acceptance,
    ]);
    expect(acceptanceArguments([join(acceptance, 'cli/checks/declared.test.ts')])).toStrictEqual([
        '--timeout',
        '60000',
        join(acceptance, 'cli/checks/declared.test.ts'),
    ]);
});

test.each([
    { args: ['--test-name-pattern'] },
    { args: ['--preload', 'script.ts'] },
    { args: [join(root, 'tests/acceptance/release')] },
    { args: [join(root, 'packages/cli/src/main.ts')] },
])('acceptance refuses invalid or out-of-suite selection before setup: %j', ({ args }) => {
    expect(() => acceptanceArguments(args)).toThrow();
});
