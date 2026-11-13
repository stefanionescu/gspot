import { noUnusedCollection } from '#eslint-plugin/rules/collections/no-unused-collection.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-unused-collection', noUnusedCollection, {
    valid: [
        'function list() { const names = []; names.push("a"); return names; }',
        'function list(make) { const names = make(); names.push("a"); }',
        'export const names = []; names.push("a");',
        'function list() { const names = []; names.items.push("a"); }',
        'function list() { const names = []; names.push("a"); names.length > 0 && notify(); }',
    ],
    invalid: [
        {
            code: 'function list() { const names = []; names.push("a"); }',
            errors: [{ messageId: 'unused', data: { name: 'names' }, column: 25 }],
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
