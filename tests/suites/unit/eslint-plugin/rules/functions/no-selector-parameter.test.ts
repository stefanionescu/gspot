import { buildRuleTester, buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noSelectorParameter } from '#eslint-plugin/rules/functions/no-selector-parameter.ts';

const rule = noSelectorParameter;

buildRuleTester().run('no-selector-parameter', rule, {
    valid: ['function save(draft) { if (draft) store(); else publish(); }'],
    invalid: [],
});

buildTypedRuleTester().run('no-selector-parameter', rule, {
    valid: [
        'declare function store(): void; function save(draft: boolean) { if (draft) store(); }',
        'declare function store(): void; function save(draft: boolean) { store(); if (draft) store(); else store(); }',
        'function label(draft: boolean) { return draft ? "draft" : "final"; }',
        'declare function store(): void; function save(draft?: boolean) { if (draft) store(); else store(); }',
        'declare function store(): void; declare function run(callback: unknown): void; run((draft: boolean) => { if (draft) store(); else store(); });',
        'declare function store(): void; const handlers = { onSave(draft: boolean) { if (draft) store(); else store(); } };',
        'declare function store(): void; const handlers = { "onSave": function (draft: boolean) { if (draft) store(); else store(); } };',
        'declare function store(): void; const button = <a onClick={(draft: boolean) => { if (draft) store(); else store(); }} />;',
        'declare function store(): void; const draft = true; function save() { if (draft) store(); else store(); }',
        'declare function store(): void; function save({ draft }: { draft: boolean }) { if (draft) store(); else store(); }',
        'declare function store(): void; const save = (draft: boolean) => draft ? store() : 1;',
    ],
    invalid: [
        {
            code: 'declare function store(): void; declare function publish(): void; function save(draft: boolean) { if (draft) store(); else publish(); }',
            errors: [{ messageId: 'selector', data: { name: 'draft' }, column: 103 }],
        },
        {
            code: 'declare function store(): void; class Editor { save(draft: boolean) { return draft ? store() : 1; } }',
            errors: [{ messageId: 'selector', data: { name: 'draft' } }],
        },
        {
            code: 'declare function read(): number; function total(draft: boolean) { return draft ? 1 + read() : 1; }',
            errors: [{ messageId: 'selector', data: { name: 'draft' } }],
        },
        {
            code: 'declare function store(): void; const save = (draft: boolean, local: boolean) => { if (draft && !local) store(); else store(); };',
            errors: [
                { messageId: 'selector', data: { name: 'draft' } },
                { messageId: 'selector', data: { name: 'local' } },
            ],
        },
    ],
});
