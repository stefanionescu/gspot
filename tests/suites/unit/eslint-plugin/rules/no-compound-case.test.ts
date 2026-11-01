import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-compound-case', plugin.rules['no-compound-case'], {
    valid: [
        'switch (value) { case 1: case 2: break; default: break; }',
        'switch (true) { case first || second: break; }',
        'switch (true) { case first || second || third: break; }',
        'switch (value) { case first && second: break; }',
        'switch (value) { case (first && second) || third: break; }',
        'switch (value) { case (first ?? second) || third: break; }',
        'switch (value) { case first ?? second: break; }',
        'switch (value) { case first: read(first, second); break; }',
    ],
    invalid: [
        'switch (value) { case 1, 2: break; }',
        'switch (true) { case first, second: break; }',
        'switch (value) { case first || second: break; }',
        'switch (value) { case first || second || third: break; }',
        'switch (value) { case first || (second && third): break; }',
        'switch (false) { case first || second: break; }',
        'switch (1) { case first || second: break; }',
        'const condition = true; switch (condition) { case first || second: break; }',
    ].map((code) => ({ code, errors: [{ messageId: 'cases' as const }] })),
});
