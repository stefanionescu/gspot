import { noUnvalidatedJsonBody } from '#eslint-plugin/rules/servers/no-unvalidated-json-body.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-unvalidated-json-body', noUnvalidatedJsonBody, {
    valid: [
        'const body = Order.parse(await req.json());',
        'const body = await req.json();\nconst order = Order.safeParse(body);',
        'const data = await response.json();',
    ],
    invalid: [
        { code: 'const body = await req.json();', errors: [{ messageId: 'unvalidated', column: 14 }] },
        { code: 'save(await request.json());', errors: [{ messageId: 'unvalidated' }] },
    ],
});
