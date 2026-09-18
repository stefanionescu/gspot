import { tester } from '#plugin-tests/harness/tester.ts';
import { maxBarrelReexports } from '#plugin/rules/max-barrel-reexports.ts';

const lines = (count: number) =>
    Array.from({ length: count }, (_, index) => `export { a${String(index)} } from './a${String(index)}';`).join('\n');

tester().run('max-barrel-reexports', maxBarrelReexports, {
    valid: [
        { code: lines(3), filename: '/repo/src/index.ts', options: [{ max: 3 }] },
        { code: lines(5), filename: '/repo/src/other.ts', options: [{ max: 3 }] },
        { code: lines(20), filename: '/repo/src/index.ts' },
    ],
    invalid: [
        {
            code: lines(4),
            filename: '/repo/src/index.ts',
            options: [{ max: 3 }],
            errors: Array.from({ length: 4 }, () => ({
                messageId: 'tooMany' as const,
                data: { count: '4', max: '3' },
            })),
        },
        {
            code: `${lines(2)}\nexport * from './x';`,
            filename: '/repo/src/index.ts',
            options: [{ max: 2 }],
            errors: [{ messageId: 'tooMany' }, { messageId: 'tooMany' }, { messageId: 'tooMany' }],
        },
    ],
});
