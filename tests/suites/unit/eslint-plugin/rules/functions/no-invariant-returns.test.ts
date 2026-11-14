import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noInvariantReturns } from '#eslint-plugin/rules/functions/no-invariant-returns.ts';

buildRuleTester().run('no-invariant-returns', noInvariantReturns, {
    valid: [
        'function save(item) { if (item) { store(item); return 1; } return 1; }',
        'function read(item) { if (item) return 1; }',
        'function read(item) { if (item) throw new Error("Missing item."); if (other) return 1; return 1; }',
        'function read(item) { const result = []; if (item) { result.push(1); return result; } return result; }',
        'function read(item) { if (item) return 1; return 2; }',
        'function read(item) { if (item) return; return; }',
        'const LIMIT = 3; function read(item) { if (item) return LIMIT; return LIMIT; }',
        'function read(item) { const result = {}; if (item) { result.size = 1; return result; } return result; }',
        'function read(item) { const result = {}; if (item) store(item); if (other) return result; return result; }',
        'async function read(item) { const result = []; if (item) { await fill(result); return result; } return result; }',
    ],
    invalid: [
        {
            code: 'function read(item) { const result = 3; if (item) return result; return result; }',
            errors: [{ messageId: 'invariant' }],
        },
        {
            code: 'function read(item) { const result = {}; if (item) return result; return result; }',
            errors: [{ messageId: 'invariant' }],
        },
        { code: 'const read = (item) => { if (item) return -1; return -1; };', errors: [{ messageId: 'invariant' }] },
        {
            code: 'function save(item) { if (item) { store(item); return 1; } if (other) { return 1; } return 1; }',
            errors: [{ messageId: 'invariant' }],
        },
        {
            code: 'function read(item) { switch (item) { case 1: return "same"; default: return "same"; } }',
            errors: [{ messageId: 'invariant' }],
        },
    ],
});
