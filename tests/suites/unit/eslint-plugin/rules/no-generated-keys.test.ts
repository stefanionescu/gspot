import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-generated-keys', plugin.rules['no-generated-keys'], {
    valid: [
        '<Row key={row.id} />',
        '<Row id={Math.random()} />',
        '<Row key="first" />',
        '<Row key={`${row.id}-${index}`} />',
    ],
    invalid: [
        { code: '<Row key={Math.random()} />', errors: [{ messageId: 'generated', column: 11 }] },
        { code: '<Row key={`row-${Date.now()}`} />', errors: [{ messageId: 'generated' }] },
        { code: '<Row key={String(Math.random())} />', errors: [{ messageId: 'generated' }] },
        { code: '<Row key={row.id + Date.now()} />', errors: [{ messageId: 'generated' }] },
        { code: '<Row key={Math.random().toString()} />', errors: [{ messageId: 'generated' }] },
    ],
});
