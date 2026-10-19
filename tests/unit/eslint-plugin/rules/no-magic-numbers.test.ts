import plugin from '#eslint-plugin/plugin.ts';
import { createRuleTester } from '#tests/setup/rule-tester.ts';
import type { MagicNumbersOptions } from '#eslint-plugin/types/rules.ts';

createRuleTester().run<keyof (typeof plugin.rules)['no-magic-numbers']['meta']['messages'], MagicNumbersOptions>(
    'no-magic-numbers',
    plugin.rules['no-magic-numbers'],
    {
        valid: [
            // A module-level constant names every number of its initializer: in an array, or in arithmetic.
            'const SIZES = [16, 32, 64];',
            'export const TIMEOUT_MS = 60 * 1000;',
            'export const STEPS = [1, 2, 4].map((step) => step) as const;',
            { code: 'setTimeout(retry, 3000);', options: [{ ignore: [3000] }] },
        ],
        invalid: [
            { code: 'setTimeout(retry, 3000);', errors: [{ messageId: 'noMagic', data: { raw: '3000' } }] },
            { code: 'function area(radius) { return radius * 3.14; }', errors: [{ messageId: 'noMagic' }] },
            { code: 'const HANDLERS = [() => wait(500)];', errors: [{ messageId: 'noMagic' }] },
            {
                code: 'function build() { const SIZES = [16, 32]; return SIZES; }',
                errors: [{ messageId: 'noMagic' }, { messageId: 'noMagic' }],
            },
        ],
    },
);
