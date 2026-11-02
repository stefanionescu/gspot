import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import type { MagicNumbersOptions } from '#eslint-plugin/types/variables.ts';

buildRuleTester().run<keyof (typeof plugin.rules)['no-magic-numbers']['meta']['messages'], MagicNumbersOptions>(
    'no-magic-numbers',
    plugin.rules['no-magic-numbers'],
    {
        valid: [
            'const SIZES = [16, 32, 64];',
            'export const TIMEOUT_MS = 60 * 1000;',
            'export const STEPS = [1, 2, 4].map((step) => step) as const;',
            {
                name: 'numeric argument explicitly ignored',
                code: 'setTimeout(retry, 3000);',
                options: [{ ignore: [3000] }],
            },
        ],
        invalid: [
            { code: 'let timeout = 3000;', options: [{ enforceConst: true }], errors: [{ messageId: 'useConst' }] },
            {
                name: 'numeric argument without an ignore',
                code: 'setTimeout(retry, 3000);',
                errors: [{ messageId: 'noMagic', data: { raw: '3000' } }],
            },
            { code: 'function area(radius) { return radius * 3.14; }', errors: [{ messageId: 'noMagic' }] },
            { code: 'const HANDLERS = [() => wait(500)];', errors: [{ messageId: 'noMagic' }] },
            {
                name: 'call argument in a module constant',
                code: 'export const server = app.listen(8080);',
                errors: [{ messageId: 'noMagic', data: { raw: '8080' } }],
            },
            {
                name: 'method arguments on a module constant array',
                code: 'export const page = [1, 2, 3, 4, 5, 6].slice(0, 50);',
                errors: [
                    { messageId: 'noMagic', data: { raw: '0' } },
                    { messageId: 'noMagic', data: { raw: '50' } },
                ],
            },
            {
                name: 'timer delay in a module constant',
                code: 'export const timer = setTimeout(() => undefined, 3000);',
                errors: [{ messageId: 'noMagic', data: { raw: '3000' } }],
            },
            {
                name: 'constructor argument in a module constant',
                code: 'const BUFFER = new ArrayBuffer(1024);',
                errors: [{ messageId: 'noMagic', data: { raw: '1024' } }],
            },
            {
                code: 'function build() { const SIZES = [16, 32]; return SIZES; }',
                errors: [{ messageId: 'noMagic' }, { messageId: 'noMagic' }],
            },
            { code: 'type Size = 12;', errors: [{ messageId: 'noMagic' }] },
        ],
    },
);
