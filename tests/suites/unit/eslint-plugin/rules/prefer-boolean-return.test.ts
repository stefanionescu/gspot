import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('prefer-boolean-return', plugin.rules['prefer-boolean-return'], {
    valid: [
        'function read() { if (ready) { save(); return true; } else return false; }',
        'function read() { if (ready) return value; else return false; }',
        'function read() { if (ready) return true; save(); return false; }',
        'function read() { if (first) return false; if (second) return false; return true; }',
        'function read() { if (first) run(); else if (second) return true; else return false; }',
        'function read() { if (ready) { { return true; } } else return false; }',
        'function read() { switch (value) { case 1: if (ready) return true; return false; } }',
    ],
    invalid: [
        { code: 'function read() { if (ready) return true; else return false; }', errors: [{ messageId: 'return' }] },
        {
            code: 'function read() { if (ready) { return false; } else { return true; } }',
            errors: [{ messageId: 'return' }],
        },
        { code: 'function read() { if (ready) return true; return false; }', errors: [{ messageId: 'return' }] },
        { code: 'function read() { if (ready) return true; else return true; }', errors: [{ messageId: 'return' }] },
        { code: 'function read() { if (ready) return false; else return false; }', errors: [{ messageId: 'return' }] },
        {
            code: 'function read() { if (first ? second : third) return true; else return false; }',
            errors: [{ messageId: 'return' }],
        },
        {
            code: 'function read() { if (ready) run(); if (other) return true; return false; }',
            errors: [{ messageId: 'return' }],
        },
        {
            code: 'function read() { if (ready) return true; /* explanation */ return false; }',
            errors: [{ messageId: 'return' }],
        },
    ],
});
