import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-generated-keys', plugin.rules['no-generated-keys'], {
    valid: ['<Row key={row.id} />', '<Row id={Math.random()} />'],
    invalid: [{ code: '<Row key={Math.random()} />', errors: [{ messageId: 'generated', column: 11 }] }],
});
