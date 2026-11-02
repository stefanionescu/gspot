import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-nested-switch', plugin.rules['no-nested-switch'], {
    valid: ['switch (kind) { case "file": readFile(); break; default: readFolder(); }'],
    invalid: [
        {
            code: 'switch (kind) { case "file": function read(format) { switch (format) { case "text": return readText(); } } }',
            errors: [{ messageId: 'nested' }],
        },
    ],
});
