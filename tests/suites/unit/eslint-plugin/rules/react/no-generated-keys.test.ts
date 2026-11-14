import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noGeneratedKeys } from '#eslint-plugin/rules/react/no-generated-keys.ts';

buildRuleTester().run('no-generated-keys', noGeneratedKeys, {
    valid: ['<Row key={row.id} />', '<Row id={Math.random()} />'],
    invalid: [
        { code: '<Row key={Math.random()} />', errors: [{ messageId: 'generated', column: 11 }] },
        { code: '<Row key={`row-${Date.now()}`} />', errors: [{ messageId: 'generated' }] },
    ],
});
