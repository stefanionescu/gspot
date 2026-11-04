import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noCompoundCase } from '#eslint-plugin/rules/control-flow/no-compound-case.ts';

buildRuleTester().run('no-compound-case', noCompoundCase, {
    valid: [
        'switch (value) { case 1: case 2: break; default: break; }',
        'switch (true) { case first || second: break; }',
        'switch (value) { case first && second: break; }',
        'switch (value) { case (first && second) || third: break; }',
    ],
    invalid: [
        'switch (value) { case 1, 2: break; }',
        'switch (value) { case first || second: break; }',
        'switch (false) { case first || second: break; }',
    ].map((code) => ({ code, errors: [{ messageId: 'cases' as const }] })),
});
