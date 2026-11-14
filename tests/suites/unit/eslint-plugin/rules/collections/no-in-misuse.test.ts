import { buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noInMisuse } from '#eslint-plugin/rules/collections/no-in-misuse.ts';

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
