import { tester } from '#tests/support/plugin/tester.ts';
import { privateBeforePublic } from '#plugin/rules/private-before-public.ts';

tester().run('private-before-public', privateBeforePublic, {
    valid: [
        'const a = 1;\nfunction b() {}\nexport const c = a;\nexport function d() { b(); }',
        'export const a = 1;\nexport const b = 2;',
        "import { x } from './x';\nexport const a = x;",
        'export const a = 1;\ndeclare const b: number;',
        'export const a = 1;\nconsole.log(a);',
        'const a = 1;\nexport default a;',
    ],
    invalid: [
        {
            code: 'export const a = 1;\nconst b = 2;',
            errors: [{ messageId: 'order', data: { name: 'b', exported: 'a' } }],
        },
        {
            code: 'export function a() {}\nfunction b() {}\nfunction c() {}',
            errors: [{ messageId: 'order' }, { messageId: 'order' }],
        },
        { code: 'export default function a() {}\ntype B = string;', errors: [{ messageId: 'order' }] },
    ],
});
