import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-redundant-assignment', plugin.rules['no-redundant-assignment'], {
    valid: [
        'function pick(ready) { let mode = "fast"; mode = "slow"; return mode; }',
        'function pick(ready) { let mode = "fast"; if (ready) { mode = "slow"; } mode = "fast"; return mode; }',
        'function pick(ready) { let mode; mode = "fast"; mode = "fast"; return mode; }',
        'function pick(mode = "fast") { mode = "fast"; return mode; }',
        'function pick() { let _mode = "fast"; _mode = "fast"; return _mode; }',
        'function pick() { let mode = "fast"; read(() => mode); mode = "fast"; }',
        'function pick() { let count = 1; count++; count = 1; return count; }',
    ],
    invalid: [
        {
            code: 'function pick(ready) { let mode = "fast"; if (ready) mode = "fast"; return mode; }',
            errors: [{ messageId: 'redundant', data: { name: 'mode' }, column: 61 }],
        },
        {
            code: 'function pick(ready) { let mode = 1; if (ready) { mode = 2; } else { mode = 1; } return mode; }',
            errors: [{ messageId: 'redundant', column: 77 }],
        },
        {
            code: 'function pick() { let first = null; let second = null; second = first; return second; }',
            errors: [{ messageId: 'redundant', data: { name: 'second' } }],
        },
        {
            code: 'function pick(ready) { let mode = true; while (ready) { mode = true; } return mode; }',
            errors: [{ messageId: 'redundant' }],
        },
    ],
});
