import { tester } from '#tests/support/plugin/tester.ts';
import { noTrivialFunctions } from '#plugin/rules/no-trivial-functions.ts';

tester().run('no-trivial-functions', noTrivialFunctions, {
    valid: [
        'function work() { first(); second(); third(); }',
        'function work() { if (ready) { first(); second(); } }',
        { code: 'function work() { first(); second(); }', options: [{ maxStatements: 1 }] },
        'declare function required(): void;',
        '// eslint-disable-next-line @rule-tester/no-trivial-functions -- reason: External callback requires this signature.\nconst callback = () => 1;',
    ],
    invalid: [
        ...[
            'function empty() {}',
            'function one() { return 1; }',
            'function two() { first(); second(); }',
            'function comments() { /* one */\n\nreturn 1; /* two */ }',
            'const multiline = () => (\n first +\n second\n);',
            'items.map((item) => item.value);',
            'class A { constructor() {} }',
            'class A { get value() { return 1; } }',
            'class A { @decorate method() { return 1; } }',
            'function manyCallers() { return 1; } manyCallers(); manyCallers();',
            'function typed() { type Value = number; return 1; }',
        ].map((code) => ({ code, errors: [{ messageId: 'trivial' as const }] })),
        {
            code: 'function outer() { function inner() { first(); second(); third(); } }',
            errors: [{ messageId: 'trivial' }],
        },
        {
            code: 'function outer() { function inner() {} }',
            errors: [{ messageId: 'trivial' }, { messageId: 'trivial' }],
        },
        {
            code: 'function three() { first(); second(); third(); }',
            options: [{ maxStatements: 3 }],
            errors: [{ messageId: 'trivial' }],
        },
    ],
});
