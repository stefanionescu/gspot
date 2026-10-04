import { MAX_REEXPORTS } from '#plugin/config/rules.ts';
import { createRuleTester } from '#tests/harness/rule-tester.ts';
import { maxBarrelReexports } from '#plugin/rules/max-barrel-reexports.ts';

const exports = Array.from(
    { length: MAX_REEXPORTS + 1 },
    (_, index) => `export { a${String(index)} } from './a${String(index)}';`,
);

createRuleTester().run('max-barrel-reexports', maxBarrelReexports, {
    valid: [
        { code: exports.slice(0, 3).join('\n'), filename: '/repo/src/index.ts', options: [{ max: 3 }] },
        { code: exports.slice(0, 5).join('\n'), filename: '/repo/src/other.ts', options: [{ max: 3 }] },
        { code: exports.slice(0, MAX_REEXPORTS).join('\n'), filename: '/repo/src/index.ts' },
    ],
    invalid: [
        {
            code: exports.join('\n'),
            filename: '/repo/src/index.ts',
            errors: [
                {
                    messageId: 'tooMany',
                    line: MAX_REEXPORTS + 1,
                    data: { count: String(MAX_REEXPORTS + 1), max: String(MAX_REEXPORTS) },
                },
            ],
        },
        {
            code: exports.slice(0, 4).join('\n'),
            filename: '/repo/src/index.ts',
            options: [{ max: 3 }],
            errors: [{ messageId: 'tooMany', line: 4, data: { count: '4', max: '3' } }],
        },
        {
            code: [...exports.slice(0, 2), "export * from './x';"].join('\n'),
            filename: '/repo/src/index.ts',
            options: [{ max: 2 }],
            errors: [{ messageId: 'tooMany', line: 3, data: { count: '3', max: '2' } }],
        },
    ],
});
