import { noGeneratedKeys } from '#eslint-plugin/rules/react/no-generated-keys.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-generated-keys', noGeneratedKeys, {
    valid: ['<Row key={row.id} />', '<Row id={Math.random()} />'],
    invalid: [{ code: '<Row key={Math.random()} />', errors: [{ messageId: 'generated', column: 11 }] }],
});
