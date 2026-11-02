import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-invariant-returns', plugin.rules['no-invariant-returns'], {
    valid: [
        'function save(item) { if (item) { store(item); return 1; } return 1; }',
        'function read(item) { if (item) return 1; }',
        'function read(item) { let result = 3; if (item) { result = 4; } return result; }',
        'function read(item) { if (item) throw new Error("Missing item."); if (other) return 1; return 1; }',
        'function read(item) { const result = []; if (item) { result.push(1); return result; } return result; }',
        'function read(item) { if (item) return 1; return 2; }',
        'function read(item) { if (item) return; return; }',
        'const LIMIT = 3; function read(item) { if (item) return LIMIT; return LIMIT; }',
        'function read(item) { const result = {}; if (item) { result.size = 1; return result; } return result; }',
        'function read(item) { const result = {}; if (item) store(item); if (other) return result; return result; }',
        'async function save(draft) { if (draft) { await store(); return true; } await publish(); return true; }',
        'async function load(p, langs) { const h = await p; if (!langs) { return h; } for (const l of langs) { await h.load(l); } return h; }',
    ],
    invalid: [
        {
            code: 'function isValid(item) { if (item) return true; return true; }',
            errors: [{ messageId: 'invariant' }],
        },
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
            code: 'function read(item) { switch (item) { case 1: return "same"; default: return "same"; } }',
            errors: [{ messageId: 'invariant' }],
        },
    ],
});
