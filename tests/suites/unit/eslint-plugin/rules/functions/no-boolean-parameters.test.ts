import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noBooleanParameters } from '#eslint-plugin/rules/functions/no-boolean-parameters.ts';

buildRuleTester().run('no-boolean-parameters', noBooleanParameters, {
    valid: [
        'function save({ draft }: { draft: boolean }) {}',
        'items.filter((isReady: boolean) => isReady);',
        'function save({ draft = false }) {}',
        'function save(...flags: boolean[]) {}',
        'function label(draft: boolean | string) {}',
        {
            code: 'const onSave: Handler = (draft: boolean) => {};',
            name: 'the annotation of the variable fixes the signature',
        },
        {
            code: 'const handlers: Handlers = { save(draft: boolean) {}, list: [(draft: boolean) => {}] };',
            name: 'the annotation of the variable fixes the signatures inside its value',
        },
        {
            code: 'run({ onDone: (isReady: boolean) => {} });',
            name: 'the parameter of a call fixes the signatures of its argument',
        },
        'const handlers = { save: (draft: boolean) => {} } satisfies Handlers;',
        'handlers.save = (draft: boolean) => {};',
        'const button = <a onClick={(draft: boolean) => {}} />;',
        {
            code: 'class Store { set draft(value: boolean) {} override save(draft: boolean) {} }',
            name: 'a setter and an overriding method take the signature of their member',
        },
        'class Store { save: Handler = (draft: boolean) => {}; }',
        'declare function save(draft: boolean): void;',
        'function save(draft: boolean): void;\nfunction save(draft: string): void;\nfunction save(draft: unknown) {}',
        { code: 'export function save(draft: boolean) {}', filename: 'types.d.ts' },
    ],
    invalid: [
        {
            code: 'export function print(error: unknown, isVerbose: boolean) {}',
            errors: [{ messageId: 'positional', column: 39 }],
        },
        { code: 'const save = (draft = false) => {};', errors: [{ messageId: 'positional', column: 15 }] },
        { code: 'const save = function (draft?: boolean) {};', errors: [{ messageId: 'positional' }] },
        { code: 'function save(draft: boolean | undefined) {}', errors: [{ messageId: 'positional' }] },
        { code: 'function save(draft: boolean = true) {}', errors: [{ messageId: 'positional' }] },
        {
            code: 'function save(draft: boolean, local: boolean) {}',
            errors: [{ messageId: 'positional' }, { messageId: 'positional' }],
        },
        {
            code: 'const handlers = { save(draft: boolean) {} };',
            name: 'a method of an object without a declared type reports',
            errors: [{ messageId: 'positional' }],
        },
        {
            code: 'class Store { constructor(private readonly isDraft: boolean) {} save(draft: boolean) {} }',
            errors: [{ messageId: 'positional' }, { messageId: 'positional' }],
        },
    ],
});
