import { tester } from '#tests/harness/plugin/tester.ts';
import { typesPlacement } from '#plugin/rules/types-placement.ts';

tester().run('types-placement', typesPlacement, {
    valid: [
        ...[
            'export const WIDTHS = { label: 9, path: 40 } as const;',
            "export const LOCKS = { npm: 'package-lock.json', bun: 'bun.lock' } as const;",
            "export const INPUT = { version: '1.0.0', url: 'https://example.com/input', digest: 'abc' } as const;",
        ].map((code) => ({ code, filename: '/repo/src/constants.ts', options: [{ directory: 'types' }] })),
        {
            code: 'export const Mode = { off: 0, on: 1 } as const; export type Mode = (typeof Mode)[keyof typeof Mode];',
            filename: '/repo/types/mode.ts',
            options: [{ directory: 'types' }],
        },
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
            options: [{ allowed: ['src/vendor/**'] }],
        },
        { code: 'export type A = string;', filename: '/repo/src/kinds/a.ts', options: [{ directory: 'kinds' }] },
    ].map((entry) => ({ ...entry, options: [{ directory: 'types', ...entry.options?.[0] }] })),
    invalid: [
        {
            code: 'export const Functions = { one: () => 1 } as const; export type Functions = (typeof Functions)[keyof typeof Functions];',
            filename: '/repo/types/functions.ts',
            options: [{ directory: 'types' }],
            errors: [{ messageId: 'runtimeInside' }],
        },
        {
            code: "export const width = 9, Mode = { on: 'on' } as const;",
            filename: '/repo/src/mode.ts',
            options: [{ directory: 'types' }],
            errors: [{ messageId: 'enumOutside', data: { directory: 'types', name: 'Mode' } }],
        },
        {
            code: 'export const WIDTHS = { label: 9, path: 40 } as const;',
            filename: '/repo/types/constants.ts',
            options: [{ directory: 'types' }],
            errors: [{ messageId: 'runtimeInside', data: { directory: 'types', name: 'WIDTHS' } }],
        },
        {
            code: "export const Mode = { on: 'on' } as const, width = 9;",
            filename: '/repo/types/mode.ts',
            options: [{ directory: 'types' }],
            errors: [{ messageId: 'runtimeInside', data: { directory: 'types', name: 'width' } }],
        },
        {
            code: 'export const Mode = { off: 0, on: 1 } as const; export type Mode = (typeof Mode)[keyof typeof Mode];',
            filename: '/repo/src/mode.ts',
            options: [{ directory: 'types' }],
            errors: [{ messageId: 'enumOutside' }, { messageId: 'aliasOutside' }],
        },
        {
            options: [{ directory: 'types' }],
            code: 'type A = string;',
            filename: '/repo/src/a.ts',
            errors: [{ messageId: 'aliasOutside', data: { directory: 'types', name: 'A' } }],
        },
        {
            options: [{ directory: 'types' }],
            code: 'interface A { a: string }',
            filename: '/repo/src/a.ts',
            errors: [{ messageId: 'interface' }],
        },
        {
            options: [{ directory: 'types' }],
            code: "export const Mode = { on: 'on' } as const;",
            filename: '/repo/src/a.ts',
            errors: [{ messageId: 'enumOutside', data: { directory: 'types', name: 'Mode' } }],
        },
        {
            options: [{ directory: 'types' }],
            code: 'export function a() {}',
            filename: '/repo/types/a.ts',
            errors: [{ messageId: 'runtimeInside', data: { directory: 'types', name: 'a' } }],
        },
        {
            options: [{ directory: 'types' }],
            code: 'export const a = 1;',
            filename: '/repo/types/a.ts',
            errors: [{ messageId: 'runtimeInside' }],
        },
        {
            options: [{ directory: 'types' }],
            code: 'export default 1;',
            filename: '/repo/types/a.ts',
            errors: [{ messageId: 'defaultInside' }],
        },
        {
            options: [{ directory: 'types' }],
            code: "import { b } from './b';\nexport type A = typeof b;",
            filename: '/repo/types/a.ts',
            errors: [{ messageId: 'valueImport', data: { directory: 'types', source: './b' } }],
        },
    ],
});
