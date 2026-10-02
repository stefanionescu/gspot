import { tester } from '#tests/harness/plugin/tester.ts';
import { maxBarrelReexports } from '#plugin/rules/max-barrel-reexports.ts';

// Twenty re-exports; a case takes the first few.
const EXPORTS = Array.from({ length: 20 }, (_, index) => `export { a${String(index)} } from './a${String(index)}';`);

tester().run('max-barrel-reexports', maxBarrelReexports, {
    valid: [
        { code: EXPORTS.slice(0, 3).join('\n'), filename: '/repo/src/index.ts', options: [{ max: 3 }] },
        { code: EXPORTS.slice(0, 5).join('\n'), filename: '/repo/src/other.ts', options: [{ max: 3 }] },
        { code: EXPORTS.join('\n'), filename: '/repo/src/index.ts' },
    ],
    invalid: [
        {
            code: EXPORTS.slice(0, 4).join('\n'),
            filename: '/repo/src/index.ts',
            options: [{ max: 3 }],
            errors: Array.from({ length: 4 }, () => ({
                messageId: 'tooMany' as const,
                data: { count: '4', max: '3' },
            })),
        },
        {
            code: [...EXPORTS.slice(0, 2), "export * from './x';"].join('\n'),
            filename: '/repo/src/index.ts',
            options: [{ max: 2 }],
            errors: [{ messageId: 'tooMany' }, { messageId: 'tooMany' }, { messageId: 'tooMany' }],
        },
    ],
});
