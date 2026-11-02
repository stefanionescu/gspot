import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-unused-collection', plugin.rules['no-unused-collection'], {
    valid: [
        'function list() { const names = []; names.push("a"); return names; }',
        'function list(run) { const names = []; run(() => names.push("a")); }',
        'function list(make) { const names = make(); names.push("a"); }',
        'export const names = []; names.push("a");',
        'function list() { const names = []; names.items.push("a"); }',
    ],
    invalid: [
        {
            code: 'function list() { const names = []; names.push("a"); }',
            errors: [{ messageId: 'unused', data: { name: 'names' }, column: 25 }],
        },
        {
            code: 'function store(key) { const cache = new Map(); cache.set(key, 1); cache.delete(key); }',
            errors: [{ messageId: 'unused', data: { name: 'cache' } }],
        },
        {
            code: 'function list() { const names = ["a"]; names[0] = "b"; }',
            errors: [{ messageId: 'unused' }],
        },
        {
            code: 'function list(flag) { let seen = []; seen = new Set(); if (flag) seen.add(1); }',
            errors: [{ messageId: 'unused', data: { name: 'seen' } }],
        },
    ],
});
