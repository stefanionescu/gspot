import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noNestedSwitch } from '#eslint-plugin/rules/control-flow/no-nested-switch.ts';

buildRuleTester().run('no-nested-switch', noNestedSwitch, {
    valid: ['switch (kind) { case "file": readFile(); break; default: readFolder(); }'],
    invalid: [
        {
            code: 'switch (kind) { case "file": function read(format) { switch (format) { case "text": return readText(); } } }',
            errors: [{ messageId: 'nested' }],
        },
    ],
});
