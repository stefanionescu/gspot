import { tester } from '#tests/support/plugin/tester.ts';
import { typesPlacement } from '#plugin/rules/types-placement.ts';

tester().run('types-placement', typesPlacement, {
    valid: [
        { code: 'export type A = string;', filename: '/repo/types/a.ts' },
        { code: 'export type A = string;', filename: '/repo/api/types/a.ts' },
        { code: "import type { B } from './b';\nexport type A = B;", filename: '/repo/types/a.ts' },
        { code: "import { type B, type C } from './b';\nexport type A = B | C;", filename: '/repo/types/a.ts' },
        {
            code: "export const Mode = { on: 'on', off: 'off' } as const;\nexport type Mode = (typeof Mode)[keyof typeof Mode];",
            filename: '/repo/types/mode.ts',
        },
        { code: "import type { A } from '../types/a';\nexport const a: A = 'x';", filename: '/repo/src/a.ts' },
        { code: 'export type A = string;', filename: '/repo/src/a.d.ts' },
        { code: 'interface A { a: string }', filename: '/repo/src/a.ts', options: [{ allowInterface: true }] },
        {
            code: 'export type A = string;',
            filename: '/repo/src/vendor/a.ts',
            options: [{ exempt: ['src/vendor/**'] }],
        },
        { code: 'export type A = string;', filename: '/repo/src/kinds/a.ts', options: [{ typesDirectory: 'kinds' }] },
    ],
    invalid: [
        {
            options: [{ typesDirectory: 'types' }],
            code: 'type A = string;',
            filename: '/repo/src/a.ts',
            errors: [{ messageId: 'aliasOutside', data: { directory: 'types', name: 'A' } }],
        },
        {
            options: [{ typesDirectory: 'types' }],
            code: 'interface A { a: string }',
            filename: '/repo/src/a.ts',
            errors: [{ messageId: 'interface' }],
        },
        {
            options: [{ typesDirectory: 'types' }],
            code: "export const Mode = { on: 'on' } as const;",
            filename: '/repo/src/a.ts',
            errors: [{ messageId: 'enumOutside', data: { directory: 'types', name: 'Mode' } }],
        },
        {
            options: [{ typesDirectory: 'types' }],
            code: 'export function a() {}',
            filename: '/repo/types/a.ts',
            errors: [{ messageId: 'runtimeInside', data: { directory: 'types', name: 'a' } }],
        },
        {
            options: [{ typesDirectory: 'types' }],
            code: 'export const a = 1;',
            filename: '/repo/types/a.ts',
            errors: [{ messageId: 'runtimeInside' }],
        },
        {
            options: [{ typesDirectory: 'types' }],
            code: 'export default 1;',
            filename: '/repo/types/a.ts',
            errors: [{ messageId: 'defaultInside' }],
        },
        {
            options: [{ typesDirectory: 'types' }],
            code: "import { b } from './b';\nexport type A = typeof b;",
            filename: '/repo/types/a.ts',
            errors: [{ messageId: 'valueImportInside', data: { directory: 'types', source: './b' } }],
        },
    ],
});
