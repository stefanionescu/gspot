import { noMagicNumbers } from '#eslint-plugin/rules/variables/no-magic-numbers.ts';
import type { MagicNumbersOptions } from '#eslint-plugin/types/variables.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run<keyof (typeof noMagicNumbers)['meta']['messages'], MagicNumbersOptions>(
    'no-magic-numbers',
    noMagicNumbers,
    {
        valid: [
            'const SIZES = [16, 32, 64];',
            'export const TIMEOUT_MS = 60 * 1000;',
            "export const DEPTHS = new Map([['expect', 3], ['assert', 2]]);",
            'export const UNITS = new Set<unknown>([1, 1n]);',
            {
                name: 'numeric argument explicitly ignored',
                code: 'setTimeout(retry, 3000);',
                options: [{ ignore: [3000] }],
            },
            { name: 'split limit', code: "function read(line) { return line.split('=', 2); }" },
            {
                name: 'sizes of a destructuring pattern',
                code: 'function read(values) { const [first, second] = values.slice(0, 2); [head, , tail] = values.slice(3); return [first, second]; }',
                options: [{ ignore: [0] }],
            },
        ],
        invalid: [
            { code: 'let timeout = 3000;', options: [{ enforceConst: true }], errors: [{ messageId: 'useConst' }] },
            {
                name: 'numeric argument without an ignore',
                code: 'setTimeout(retry, 3000);',
                errors: [{ messageId: 'noMagic', data: { raw: '3000' } }],
            },
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
                name: 'constructor argument in a module constant',
                code: 'const BUFFER = new ArrayBuffer(1024);',
                errors: [{ messageId: 'noMagic', data: { raw: '1024' } }],
            },
            {
                name: 'call argument inside a module constant map',
                code: "export const TIMERS = new Map([['retry', setTimeout(retry, 3000)]]);",
                errors: [{ messageId: 'noMagic', data: { raw: '3000' } }],
            },
            {
                code: 'function build() { const SIZES = [16, 32]; return SIZES; }',
                errors: [{ messageId: 'noMagic' }, { messageId: 'noMagic' }],
            },
            { code: 'type Size = 12;', errors: [{ messageId: 'noMagic' }] },
            {
                name: 'a number that differs from the pattern size, and a split separator position',
                code: 'function read(values, line) { const [first, second] = values.slice(0, 3); return [first, second, line.split(2, 5)]; }',
                options: [{ ignore: [0] }],
                errors: [
                    { messageId: 'noMagic', data: { raw: '3' } },
                    { messageId: 'noMagic', data: { raw: '2' } },
                ],
            },
        ],
    },
);
