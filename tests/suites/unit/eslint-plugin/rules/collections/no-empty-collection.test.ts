import { noEmptyCollection } from '#eslint-plugin/rules/collections/no-empty-collection.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-empty-collection', noEmptyCollection, {
    valid: [
        'function list() { const names = []; names.push("a"); return names.map(String); }',
        'function list() { const names = ["a"]; return names.map(String); }',
        'function list() { const names = []; names[0] = "a"; return names.join(); }',
        'function list(names) { names = []; return names.join(); }',
    ],
    invalid: [
        {
            code: 'function list() { const names = []; for (const name of names) print(name); }',
            errors: [{ messageId: 'empty', data: { name: 'names' }, column: 56 }],
        },
        {
            code: 'function find(key) { const cache = new Map(); return cache.has(key) ? cache.get(key) : key; }',
            errors: [
                { messageId: 'empty', data: { name: 'cache' } },
                { messageId: 'empty', data: { name: 'cache' } },
            ],
        },
        {
            code: 'function first() { let names = []; names = []; return names[0]; }',
            errors: [{ messageId: 'empty', data: { name: 'names' }, column: 55 }],
        },
        {
            code: 'function list() { const names = Array(); return names.join(); }',
            errors: [{ messageId: 'empty', data: { name: 'names' } }],
        },
    ],
});
