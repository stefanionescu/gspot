import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-empty-collection', plugin.rules['no-empty-collection'], {
    valid: [
        'function list() { const names = []; names.push("a"); return names.map(String); }',
        'function list() { const names = ["a"]; return names.map(String); }',
        'function list() { const names = []; names[0] = "a"; return names.join(); }',
        'function list(fill) { const names = []; fill(names); return names.join(); }',
        'function list() { const names = []; return names.length; }',
        'function list(names) { names = []; return names.join(); }',
    ],
    invalid: [
        {
            code: 'function list() { const names = []; for (const name of names) print(name); }',
            errors: [{ messageId: 'empty', data: { name: 'names' }, column: 56 }],
        },
        {
            code: 'function find(key) { const cache = new Map(); return cache.has(key) ? cache.get(key) : key; }',
            errors: [{ messageId: 'empty' }, { messageId: 'empty' }],
        },
        {
            code: 'function first() { let names = []; names = []; return names[0]; }',
            errors: [{ messageId: 'empty', column: 55 }],
        },
        {
            code: 'export function list() { const names = Array(); return names.join(); }',
            errors: [{ messageId: 'empty' }],
        },
    ],
});
