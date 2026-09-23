import { tester } from '#tests/support/plugin/tester.ts';
import { noReexports } from '#plugin/rules/no-reexports.ts';

tester().run('no-reexports', noReexports, {
    valid: [
        'export const a = 1;',
        'export function b() {}',
        "import { a } from './a';\nexport const b = a;",
        { code: "export * from './a';", filename: '/repo/src/index.ts', options: [{ allowIndex: true }] },
    ],
    invalid: [
        {
            code: "export * from './a';",
            filename: '/repo/src/index.ts',
            errors: [{ messageId: 'star', data: { source: './a' } }],
        },
        { code: "export { a } from './a';", filename: '/repo/src/b.ts', errors: [{ messageId: 'from' }] },
        { code: 'const a = 1;\nexport { a };', filename: '/repo/src/b.ts', errors: [{ messageId: 'local' }] },
    ],
});
