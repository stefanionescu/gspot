import { noInMisuse } from '#eslint-plugin/rules/collections/no-in-misuse.ts';
import { buildRuleTester, buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-in-misuse without types', noInMisuse, {
    valid: ['const names = ["a"]; if ("a" in names) run();'],
    invalid: [],
});

buildTypedRuleTester().run('no-in-misuse', noInMisuse, {
    valid: [
        'declare const names: string[], index: number; if (index in names) run();',
        'declare const names: string[]; if ("map" in names) run();',
        'declare const record: Record<string, string>; if ("a" in record) run();',
    ],
    invalid: [
        {
            code: 'declare const names: string[], name: string; if (name in names) run();',
            errors: [{ messageId: 'misuse' }],
        },
    ],
});
