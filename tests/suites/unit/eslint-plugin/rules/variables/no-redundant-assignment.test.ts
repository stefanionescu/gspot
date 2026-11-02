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
        'function pick(fallback) { let mode = null; mode = fallback; return mode; }',
        'function pick(ready) { let mode = "fast"; if (ready) mode = load(); mode = "fast"; return mode; }',
        'function pick() { let index = 0; for (index = 0; index < 3; index++) read(index); return index; }',
        'function pick(ready) { while (ready()) { let mode = "fast"; read(mode); mode = "slow"; mode = "fast"; read(mode); } }',
        'function pick(options) { let mode = "fast"; ({ mode = "fast" } = options); return mode; }',
    ],
    invalid: [
        {
            code: 'function pick(ready) { let mode = "fast"; if (ready) mode = "fast"; return mode; }',
            errors: [{ messageId: 'redundant', data: { name: 'mode' }, column: 61 }],
        },
        {
            code: 'function pick() { let first = null; let second = null; second = first; return second; }',
            errors: [{ messageId: 'redundant', data: { name: 'second' } }],
        },
    ],
});
